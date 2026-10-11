import * as THREE from 'three';
import { BALANCE } from '../config/balance.js';
import { advanceBrakeDepth, clamp } from '../utils/math.js';
import { buildCockpit } from '../world/Cockpit.js';
import { EndlessRoute, ROAD_EXIT_OFFSET, getRoadGrade } from '../world/EndlessRoute.js';
import { EndlessWorld } from '../world/EndlessWorld.js';
import { SkyBackdrop } from '../world/SkyBackdrop.js';
import { GAME_PHASE, GameState } from './GameState.js';
import { stepEndlessSpeed } from './DrivingModel.js';
import { getRoadCurvature, stepBodyRoll, stepLateralMotion } from './SteeringModel.js';
import { BrakeSystem, isPedalBreakCinematicComplete } from '../brake/BrakeSystem.js';
import { PedalCamera } from '../brake/PedalCamera.js';
import { normalizeBuild } from '../config/materials.js';
import { getCrashMotion, getOutsideTurnSign } from './CrashMotion.js';
import { CINEMATICS, ANNOUNCEMENTS } from '../config/cinematics.js';
import { getBreakCinematicFrame, getCrashCinematicFrame } from '../cinematic/CinematicTimeline.js';
import { CrashCar } from '../world/CrashCar.js';
import { GameAudio } from '../audio/GameAudio.js';
import { getGraphicsProfile } from '../utils/graphics.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const CAMERA_ROLL_AXIS = new THREE.Vector3(0, 0, 1);

export class Game {
  constructor({ canvas, input, screens, hud, results, playerBuild }) {
    this.canvas = canvas;
    this.input = input;
    this.screens = screens;
    this.hud = hud;
    this.results = results;
    this.state = new GameState();
    this.clock = new THREE.Clock();
    this.overviewTime = 0;
    this.paused = false;
    this.crashElapsed = 0;
    this.breakElapsed = 0;
    this.resultSnapshot = null;
    this.cinematicCause = null;
    this.breakSoundPlayed = false;
    this.breakAnnouncementShown = false;
    this.playerBuild = normalizeBuild(playerBuild);
    this.brakeSystem = new BrakeSystem(this.playerBuild);
    this.audio = new GameAudio();
    this.graphics = getGraphicsProfile();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.graphics.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.graphics.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.graphics.lowPower ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xda92a4);
    this.scene.fog = new THREE.Fog(0xbda3a3, 210, 680);
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 1100);
    this.scene.add(this.camera);

    this.route = new EndlessRoute();
    this.skyBackdrop = new SkyBackdrop(this.scene);
    this.world = new EndlessWorld(this.scene, this.route);
    this.terrainSampler = this.world;
    this.cockpit = buildCockpit(this.camera);
    this.cockpitMaterialState = new Map();
    this.cockpit.group.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material && !this.cockpitMaterialState.has(material)) {
          this.cockpitMaterialState.set(material, {
            opacity: material.opacity,
            transparent: material.transparent,
            depthWrite: material.depthWrite,
          });
        }
      });
    });
    this.crashCar = new CrashCar();
    this.crashCameraRig = new THREE.Object3D();
    this.scene.add(this.crashCar.group);
    this.pedalCamera = new PedalCamera(document.querySelector('#pedal-canvas'), this.playerBuild);
    this.cameraVertical = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.cameraPreviousQuaternion = new THREE.Quaternion();
    this.cameraDesiredQuaternion = new THREE.Quaternion();
    this.cameraBaseQuaternion = new THREE.Quaternion();
    this.cameraRollQuaternion = new THREE.Quaternion();
    this.cameraOrientationInitialized = false;
    this.addLighting();

    this.run = this.createRunState();
    this.showMenuView();
    this.state.subscribe((nextPhase) => this.handlePhaseChange(nextPhase));

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  addLighting() {
    this.scene.add(new THREE.HemisphereLight(0xd9f2ff, 0x314238, 2.35));
    const sun = new THREE.DirectionalLight(0xfff1cf, 3.2);
    sun.position.set(-120, 280, -160);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.graphics.shadowMapSize, this.graphics.shadowMapSize);
    sun.shadow.camera.left = -250;
    sun.shadow.camera.right = 250;
    sun.shadow.camera.top = 250;
    sun.shadow.camera.bottom = -250;
    this.scene.add(sun);
  }

  createRunState() {
    return {
      distanceM: 0,
      previousDistanceM: 0,
      speedMps: BALANCE.initialSpeedMps,
      maxSpeedMps: BALANCE.initialSpeedMps,
      elapsedSec: 0,
      brakeDepth: 0,
      brakePressCount: 0,
      pedalDurability: this.brakeSystem?.stats.maxDurability ?? 0,
      lateralOffsetM: 0,
      lateralVelocityMps: 0,
      wheelAngle: 0,
      bodyRollRad: 0,
      failureReason: null,
    };
  }

  start() {
    this.screens.show('menu');
    this.renderer.setAnimationLoop(this.loop);
  }

  startRun() {
    this.setPaused(false);
    this.audio.stopAll();
    this.brakeSystem.reset(this.playerBuild);
    this.run = this.createRunState();
    this.cameraOrientationInitialized = false;
    this.cockpit.group.rotation.z = 0;
    this.route.reset();
    this.world.reset();
    this.resultSnapshot = null;
    this.crashElapsed = 0;
    this.breakElapsed = 0;
    this.cinematicCause = null;
    this.breakSoundPlayed = false;
    this.breakAnnouncementShown = false;
    this.screens.setBreakReturn(0);
    this.pedalCamera.setBuild(this.playerBuild);
    this.pedalCamera.reset();
    this.crashCar.hide();
    this.cockpit.group.visible = true;
    this.setCockpitOpacity(1);
    this.crashCar.setLogo(this.playerBuild.logoDataUrl);
    this.hud.clearAnnouncement();
    this.screens.setBreakImpact(false);
    this.audio.unlock().catch(() => {});
    this.input.setEnabled(true);
    this.state.set(GAME_PHASE.DRIVING);
    this.updateVehicleCamera(this.route.sample(0));
  }

  returnToMenu() {
    this.setPaused(false);
    this.audio.stopAll();
    this.input.setEnabled(false);
    this.crashCar.hide();
    this.cockpit.group.visible = true;
    this.setCockpitOpacity(1);
    this.hud.clearAnnouncement();
    this.state.set(GAME_PHASE.MENU);
    this.showMenuView();
  }

  openDiy() {
    this.setPaused(false);
    this.audio.stopAll();
    this.input.setEnabled(false);
    this.crashCar.hide();
    this.cockpit.group.visible = true;
    this.setCockpitOpacity(1);
    this.hud.clearAnnouncement();
    this.state.set(GAME_PHASE.DIY);
    this.showMenuView();
  }

  setPlayerBuild(build) {
    this.playerBuild = normalizeBuild(build);
    this.pedalCamera.setBuild(this.playerBuild);
    this.cockpit.setLogo(this.playerBuild.logoDataUrl);
    this.crashCar.setLogo(this.playerBuild.logoDataUrl);
  }

  setCockpitOpacity(opacity) {
    const alpha = clamp(opacity, 0, 1);
    this.cockpitMaterialState.forEach((original, material) => {
      material.transparent = alpha < 0.999 || original.transparent;
      material.opacity = original.opacity * alpha;
      material.depthWrite = alpha >= 0.999 ? original.depthWrite : false;
      material.needsUpdate = true;
    });
  }

  handlePhaseChange(nextPhase) {
    if (nextPhase !== GAME_PHASE.DRIVING) this.setPaused(false);
    if (nextPhase === GAME_PHASE.MENU) this.screens.show('menu');
    if (nextPhase === GAME_PHASE.DIY) this.screens.show('diy');
    if (nextPhase === GAME_PHASE.DRIVING) this.screens.show('hud');
    if (nextPhase === GAME_PHASE.BRAKE_BREAK_CINEMATIC) {
      this.audio.stopVehicleMotion();
      this.input.setEnabled(false);
      this.breakElapsed = 0;
      this.breakSoundPlayed = false;
      this.breakAnnouncementShown = false;
      this.cinematicCause = 'PEDAL_BROKEN';
      this.breakCameraPosition = this.camera.position.clone();
      this.breakCameraQuaternion = this.camera.quaternion.clone();
      this.breakRouteSample = this.route.sample(this.run.distanceM);
      this.pedalCamera.beginBreakCinematic();
      this.hud.clearAnnouncement();
      this.screens.show('break');
    }
    if (nextPhase === GAME_PHASE.CRASH_CINEMATIC) {
      this.audio.stopVehicleMotion();
      this.input.setEnabled(false);
      this.crashElapsed = 0;
      this.prepareCrashMotion();
      this.crashTransitionCameraPosition = this.camera.position.clone();
      this.cockpit.group.visible = true;
      this.setCockpitOpacity(1);
      this.audio.playCrash();
      if (this.cinematicCause === 'ROAD_EXIT') this.hud.announce(ANNOUNCEMENTS.OVERSPEED, 'danger');
      this.screens.show('crash');
    }
    if (nextPhase === GAME_PHASE.RESULT) {
      this.audio.stopVehicleMotion();
      this.input.setEnabled(false);
      this.cockpit.group.visible = true;
      this.setCockpitOpacity(1);
      this.hud.clearAnnouncement();
      this.results.render(this.resultSnapshot);
      this.screens.show('result');
      if (this.resultSnapshot.outcome === 'SUCCESS') this.audio.playSuccess();
      else this.audio.playFailure();
    }
  }

  updateDriving(dt) {
    if (this.input.consumePressEdge()) {
      this.run.brakePressCount += 1;
      this.audio.playPedal();
    }
    const previousBrakeDepth = this.run.brakeDepth;
    this.run.brakeDepth = advanceBrakeDepth(
      this.run.brakeDepth,
      this.input.brakeHeld,
      dt,
      BALANCE.pressTimeToMax,
      BALANCE.releaseTime,
    );
    if (previousBrakeDepth < 0.9 && this.run.brakeDepth >= 0.9) this.audio.playPedalStrain();
    if (this.brakeSystem.update(this.run.brakeDepth, dt, this.run.speedMps)) {
      this.run.pedalDurability = 0;
      this.triggerPedalFailure();
      return;
    }
    this.run.pedalDurability = this.brakeSystem.durability;

    const currentSample = this.route.sample(this.run.distanceM);
    const section = currentSample.module;
    this.run.speedMps = stepEndlessSpeed({
      speedMps: this.run.speedMps,
      brakeDepth: this.run.brakeDepth,
      grade: getRoadGrade(section, this.run.distanceM),
      distanceM: this.run.distanceM,
      brakeMultiplier: this.brakeSystem.stats.brakeMultiplier,
    }, dt);
    this.run.maxSpeedMps = Math.max(this.run.maxSpeedMps, this.run.speedMps);
    this.audio.updateVehicle(this.run.speedMps, this.run.brakeDepth);
    this.run.elapsedSec += dt;
    this.run.previousDistanceM = this.run.distanceM;
    this.run.distanceM += this.run.speedMps * dt;
    this.world.sync(this.run.distanceM);
    const nextSample = this.route.sample(this.run.distanceM);
    const curvature = getRoadCurvature(nextSample.module, this.run.distanceM);
    const lateral = stepLateralMotion({
      offsetM: this.run.lateralOffsetM,
      velocityMps: this.run.lateralVelocityMps,
      steer: this.input.steer,
      speedMps: this.run.speedMps,
      curvature,
    }, dt);
    this.run.lateralOffsetM = lateral.offsetM;
    this.run.lateralVelocityMps = lateral.velocityMps;
    this.run.bodyRollRad = stepBodyRoll(this.run.bodyRollRad, {
      steer: this.input.steer,
      speedMps: this.run.speedMps,
      curvature,
    }, dt);
    if (Math.abs(this.run.lateralOffsetM) > ROAD_EXIT_OFFSET) {
      this.triggerRoadExitFailure(nextSample.module);
      return;
    }
    this.updateVehicleCamera(nextSample);
    this.hud.update(this.run, nextSample.module, this.route.getUpcomingHazard(this.run.distanceM),
      this.brakeSystem.stats.maxDurability);
  }

  updateVehicleCamera(sample) {
    const point = sample.position;
    const tangent = sample.tangent;
    const side = new THREE.Vector3().crossVectors(WORLD_UP, tangent).normalize();
    const speedRatio = clamp((this.run.speedMps * 3.6 - 35) / 105, 0, 1);
    const vibrationX = Math.sin(this.run.elapsedSec * 18.5) * 0.008 * speedRatio;
    const vibrationY = Math.cos(this.run.elapsedSec * 22) * 0.009 * speedRatio;
    this.cameraVertical.set(vibrationX, 2.58 + vibrationY - this.run.brakeDepth * 0.034, 0);
    this.camera.position.copy(point).addScaledVector(side, this.run.lateralOffsetM)
      .add(this.cameraVertical).addScaledVector(tangent, 1.4 + this.run.brakeDepth * 0.085);
    this.camera.up.set(0, 1, 0);
    this.cameraTarget.copy(point).addScaledVector(side, this.run.lateralOffsetM)
      .addScaledVector(tangent, 32);
    this.cameraTarget.y += 0.75 - this.run.brakeDepth * 0.07;
    this.cameraPreviousQuaternion.copy(this.cameraBaseQuaternion);
    this.camera.lookAt(this.cameraTarget);
    if (this.cameraOrientationInitialized) {
      this.cameraDesiredQuaternion.copy(this.camera.quaternion);
      const follow = 1 - Math.exp(-16 * (this.lastDrivingDt ?? 0));
      this.cameraBaseQuaternion.copy(this.cameraPreviousQuaternion)
        .slerp(this.cameraDesiredQuaternion, follow);
    } else {
      this.cameraBaseQuaternion.copy(this.camera.quaternion);
      this.cameraOrientationInitialized = true;
    }
    this.cameraRollQuaternion.setFromAxisAngle(CAMERA_ROLL_AXIS, this.run.bodyRollRad * 0.3);
    this.camera.quaternion.copy(this.cameraBaseQuaternion).multiply(this.cameraRollQuaternion);
    this.cockpit.group.rotation.z = this.run.bodyRollRad * 0.8;
    this.run.wheelAngle += (this.input.steer * -0.32 - this.run.wheelAngle) * Math.min(1, 8 * (this.lastDrivingDt ?? 0));
    this.cockpit.wheel.rotation.z = this.run.wheelAngle;
    this.cockpit.setBrakeFeedback(this.run.brakeDepth, vibrationX * 0.35);
  }

  triggerRoadExitFailure(module) {
    if (this.state.phase !== GAME_PHASE.DRIVING) return false;
    this.run.failureReason = 'ROAD_EXIT';
    this.resultSnapshot = this.snapshotResult('FAIL', module);
    this.cinematicCause = 'ROAD_EXIT';
    this.state.set(GAME_PHASE.CRASH_CINEMATIC);
    return true;
  }

  triggerPedalFailure() {
    if (this.state.phase !== GAME_PHASE.DRIVING) return false;
    this.run.failureReason = 'PEDAL_BROKEN';
    this.resultSnapshot = this.snapshotResult('FAIL');
    this.state.set(GAME_PHASE.BRAKE_BREAK_CINEMATIC);
    return true;
  }

  updatePedalBreak(dt) {
    this.breakElapsed += dt;
    const frame = getBreakCinematicFrame(this.breakElapsed);
    this.screens.setBreakProgress(frame.zoomProgress);
    this.screens.setBreakReturn(frame.returnProgress);
    this.screens.setBreakImpact(frame.impactVisible);
    this.pedalCamera.updateBreakCinematic(frame, dt);
    this.camera.position.copy(this.breakCameraPosition)
      .addScaledVector(this.breakRouteSample.tangent, frame.forwardLurchMeters);
    this.camera.quaternion.copy(this.breakCameraQuaternion);
    this.camera.position.x += frame.shake * 0.025;
    this.camera.position.y += Math.abs(frame.shake) * 0.012;
    this.camera.rotateZ(frame.shake * 0.002);
    this.camera.rotateX(-frame.cameraPitch);
    this.audio.updateCinematicWind(frame.cockpitProgress);
    if (frame.shouldBreak && !this.breakSoundPlayed) {
      this.breakSoundPlayed = true;
      this.audio.playBreak();
    }
    if (frame.announcementVisible && !this.breakAnnouncementShown) {
      this.breakAnnouncementShown = true;
      this.hud.announce(ANNOUNCEMENTS.PEDAL_BROKEN, 'danger');
    }
    if (frame.complete || isPedalBreakCinematicComplete(this.breakElapsed)) {
      this.screens.setBreakImpact(false);
      this.state.set(GAME_PHASE.CRASH_CINEMATIC);
    }
  }

  prepareCrashMotion() {
    const transitionAdvance = this.cinematicCause === 'PEDAL_BROKEN' ? 8.5 : 0;
    const currentSample = this.route.sample(this.run.distanceM + transitionAdvance);
    this.crashModuleIndex = currentSample.module.index;
    const currentPosition = currentSample.position.clone();
    const currentTangent = currentSample.tangent.clone();
    const beforeTangent = this.route.sample(Math.max(0, this.run.distanceM - 24)).tangent.clone();
    const aheadTangent = this.route.sample(this.run.distanceM + 30).tangent.clone();
    this.crashForward = currentTangent.normalize();

    const routeRight = new THREE.Vector3().crossVectors(WORLD_UP, this.crashForward).normalize();
    this.crashOutsideSign = Math.abs(this.run.lateralOffsetM) > 0.6
      ? Math.sign(this.run.lateralOffsetM)
      : getOutsideTurnSign(beforeTangent, aheadTangent);
    this.crashSide = routeRight.multiplyScalar(this.crashOutsideSign);
    currentPosition.addScaledVector(this.crashSide, Math.abs(this.run.lateralOffsetM));
    this.crashDuration = this.cinematicCause === 'PEDAL_BROKEN'
      ? CINEMATICS.crashDurationSec
      : CINEMATICS.overspeedCrashDurationSec;
    this.crashCar.begin(currentPosition, this.crashForward, this.crashSide);
  }

  updateCrash(dt) {
    this.crashElapsed += dt;
    const frame = getCrashCinematicFrame(this.crashElapsed, this.crashDuration);
    const transitionDuration = CINEMATICS.crashTransitionDurationSec;
    const flightDuration = Math.max(0.01, this.crashDuration - CINEMATICS.crashFlightRevealSec);
    const motion = getCrashMotion(frame.flightElapsed, this.run.speedMps, flightDuration);
    const flightProgress = clamp(frame.flightElapsed / flightDuration, 0, 1);
    this.crashCar.update(motion, this.crashOutsideSign, flightProgress);
    const carGroundY = this.terrainSampler.getTerrainHeight(
      this.crashCar.group.position.x,
      this.crashCar.group.position.z,
      { moduleIndex: this.crashModuleIndex },
    );
    if (Number.isFinite(carGroundY) && this.crashCar.group.position.y < carGroundY + 0.28) {
      this.crashCar.group.position.y = carGroundY + 0.28;
    }
    const lookTarget = this.crashCar.group.position.clone().addScaledVector(this.crashForward, 3.5);
    const followPosition = this.crashCar.group.position.clone()
      .addScaledVector(this.crashForward, -13)
      .addScaledVector(this.crashSide, -6.5)
      .addScaledVector(WORLD_UP, 7.5);
    this.crashCameraRig.position.copy(followPosition);
    this.crashCameraRig.up.set(0, 1, 0);
    this.crashCameraRig.lookAt(lookTarget);
    this.camera.position.copy(this.crashTransitionCameraPosition).lerp(followPosition, frame.transitionProgress);
    const cameraGroundY = this.terrainSampler.getTerrainHeight(
      this.camera.position.x,
      this.camera.position.z,
      { moduleIndex: this.crashModuleIndex },
    );
    if (Number.isFinite(cameraGroundY)) this.camera.position.y = Math.max(this.camera.position.y, cameraGroundY + 2.4);
    this.camera.lookAt(lookTarget);
    const cockpitFade = clamp(frame.transitionProgress / 0.72, 0, 1);
    this.setCockpitOpacity(1 - cockpitFade);
    if (frame.thirdPerson) {
      this.cockpit.group.visible = false;
    }
    if (frame.complete) this.state.set(GAME_PHASE.RESULT);
  }

  snapshotResult(outcome, checkpoint = null) {
    return Object.freeze({
      outcome,
      distanceM: this.run.distanceM,
      elapsedSec: this.run.elapsedSec,
      speedMps: this.run.speedMps,
      maxSpeedMps: this.run.maxSpeedMps,
      brakePressCount: this.run.brakePressCount,
      checkpointLabel: checkpoint?.label ?? checkpoint?.name ?? '',
      safeSpeedKmh: checkpoint?.safeSpeedKmh ?? null,
      failureReason: this.run.failureReason,
      routeLengthM: 0,
      build: Object.freeze({ ...this.playerBuild }),
    });
  }

  showMenuView() {
    this.cockpit.group.rotation.z = 0;
    const point = this.route.sample(120).position;
    this.camera.position.copy(point).add(new THREE.Vector3(95, 80, -125));
    this.camera.lookAt(point);
  }

  updateMenu(dt) {
    this.overviewTime += dt * 0.12;
    const target = this.route.sample(125).position;
    this.camera.position.set(
      target.x + Math.cos(this.overviewTime) * 155,
      target.y + 100,
      target.z + Math.sin(this.overviewTime) * 155,
    );
    this.camera.lookAt(target);
  }

  loop() {
    const rawDt = this.clock.getDelta();
    if (this.paused) return;
    const simulationDt = Math.min(rawDt, BALANCE.maxDeltaSec);
    const cinematicDt = Math.min(rawDt, 0.1);
    if (this.state.phase === GAME_PHASE.MENU) this.updateMenu(simulationDt);
    if (this.state.phase === GAME_PHASE.DRIVING) {
      this.lastDrivingDt = simulationDt;
      this.updateDriving(simulationDt);
    }
    if (this.state.phase === GAME_PHASE.BRAKE_BREAK_CINEMATIC) this.updatePedalBreak(cinematicDt);
    if (this.state.phase === GAME_PHASE.CRASH_CINEMATIC) this.updateCrash(cinematicDt);
    this.skyBackdrop.follow(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    if (this.state.phase === GAME_PHASE.DRIVING) this.pedalCamera.update(simulationDt, this.run.brakeDepth);
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.fov = width / height < 1.1 ? 74 : 68;
    this.camera.updateProjectionMatrix();
    const compactCockpit = width / height < 1.1;
    this.cockpit.group.scale.setScalar(compactCockpit ? 0.78 : 1);
    this.cockpit.setViewportCompact(compactCockpit);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.graphics.maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.pedalCamera.resize();
  }

  unlockAudio() {
    this.audio.unlock().catch(() => {});
  }

  setPaused(paused) {
    const nextPaused = Boolean(paused) && this.state.phase === GAME_PHASE.DRIVING;
    if (this.paused === nextPaused) return false;
    this.paused = nextPaused;
    this.input.setEnabled(!nextPaused && this.state.phase === GAME_PHASE.DRIVING);
    if (nextPaused) this.audio.stopVehicleMotion();
    else if (this.state.phase === GAME_PHASE.DRIVING) this.audio.updateVehicle(this.run.speedMps, this.run.brakeDepth);
    this.screens.setPaused(nextPaused);
    return true;
  }

  togglePause() {
    return this.setPaused(!this.paused);
  }

  setMuted(muted) {
    this.audio.setMuted(muted);
  }

  setVolume(volume) {
    this.audio.setVolume(volume);
  }
}
