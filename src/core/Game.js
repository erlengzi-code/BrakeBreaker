import * as THREE from 'three';
import { BALANCE } from '../config/balance.js';
import { CHECKPOINTS, createRouteCurve, getSectionAtProgress, ROUTE_SECTIONS } from '../config/route.js';
import { advanceBrakeDepth, clamp } from '../utils/math.js';
import { buildRoad } from '../world/RoadBuilder.js';
import { buildEnvironment } from '../world/Environment.js';
import { buildCockpit } from '../world/Cockpit.js';
import { RouteFollower } from '../world/RouteFollower.js';
import { GAME_PHASE, GameState } from './GameState.js';
import { isCheckpointOverspeed, stepVehicleSpeed } from './DrivingModel.js';
import { BrakeSystem, isPedalBreakCinematicComplete } from '../brake/BrakeSystem.js';
import { PedalCamera } from '../brake/PedalCamera.js';
import { normalizeBuild } from '../config/materials.js';
import { getCrashMotion, getOutsideTurnSign } from './CrashMotion.js';
import { CINEMATICS, ANNOUNCEMENTS } from '../config/cinematics.js';
import { getBreakCinematicFrame, getCrashCinematicFrame } from '../cinematic/CinematicTimeline.js';
import { CrashCar } from '../world/CrashCar.js';
import { GameAudio } from '../audio/GameAudio.js';
import { createTerrainHeightSampler } from '../world/TerrainHeight.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

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
    this.crashElapsed = 0;
    this.breakElapsed = 0;
    this.resultSnapshot = null;
    this.cinematicCause = null;
    this.breakSoundPlayed = false;
    this.breakAnnouncementShown = false;
    this.playerBuild = normalizeBuild(playerBuild);
    this.brakeSystem = new BrakeSystem(this.playerBuild);
    this.audio = new GameAudio();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7aa6bb);
    this.scene.fog = new THREE.Fog(0x9db4ae, 190, 760);
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 1100);
    this.scene.add(this.camera);

    this.curve = createRouteCurve();
    this.route = new RouteFollower(this.curve, CHECKPOINTS);
    this.terrainSampler = createTerrainHeightSampler(this.curve);
    this.scene.add(
      buildRoad(this.curve, { terrainSampler: this.terrainSampler }),
      buildEnvironment(this.curve, this.terrainSampler),
    );
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
    sun.shadow.mapSize.set(1024, 1024);
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
      failureReason: null,
    };
  }

  start() {
    this.screens.show('menu');
    this.renderer.setAnimationLoop(this.loop);
  }

  startRun() {
    this.audio.stopAll();
    this.brakeSystem.reset(this.playerBuild);
    this.run = this.createRunState();
    this.route.reset();
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
      if (this.cinematicCause === 'OVERSPEED') this.hud.announce(ANNOUNCEMENTS.OVERSPEED, 'danger');
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
    if (this.brakeSystem.update(this.run.brakeDepth, dt)) {
      this.run.pedalDurability = 0;
      this.triggerPedalFailure();
      return;
    }
    this.run.pedalDurability = this.brakeSystem.durability;

    const currentSample = this.route.sample(this.run.distanceM);
    const section = getSectionAtProgress(currentSample.u);
    const sectionIndex = ROUTE_SECTIONS.indexOf(section);
    this.run.speedMps = stepVehicleSpeed({
      speedMps: this.run.speedMps,
      brakeDepth: this.run.brakeDepth,
      tangentY: currentSample.tangent.y,
      sectionIndex,
      brakeMultiplier: this.brakeSystem.stats.brakeMultiplier,
    }, dt);
    this.run.maxSpeedMps = Math.max(this.run.maxSpeedMps, this.run.speedMps);
    this.audio.updateVehicle(this.run.speedMps, this.run.brakeDepth);
    this.run.elapsedSec += dt;
    this.run.previousDistanceM = this.run.distanceM;
    this.run.distanceM = Math.min(this.route.routeLengthM, this.run.distanceM + this.run.speedMps * dt);

    const crossed = this.route.findCrossedCheckpoint(this.run.previousDistanceM, this.run.distanceM);
    if (crossed) {
      crossed.passed = true;
      if (isCheckpointOverspeed(this.run.speedMps, crossed.safeSpeedKmh)) {
        this.triggerOverspeedFailure(crossed);
        return;
      }
    }

    if (this.run.distanceM >= this.route.routeLengthM) {
      this.resultSnapshot = this.snapshotResult('SUCCESS');
      this.hud.announce(ANNOUNCEMENTS.SUCCESS, 'success');
      this.state.set(GAME_PHASE.RESULT);
      return;
    }

    const nextSample = this.route.sample(this.run.distanceM);
    this.updateVehicleCamera(nextSample);
    this.hud.update(this.run, this.route.routeLengthM, section, this.route.getUpcomingCheckpoint(this.run.distanceM));
  }

  updateVehicleCamera(sample) {
    const point = sample.position;
    const tangent = sample.tangent;
    const speedRatio = clamp((this.run.speedMps * 3.6 - 35) / 105, 0, 1);
    const vibrationX = Math.sin(this.run.elapsedSec * 18.5) * 0.008 * speedRatio;
    const vibrationY = Math.cos(this.run.elapsedSec * 22) * 0.009 * speedRatio;
    this.cameraVertical.set(vibrationX, 2.58 + vibrationY - this.run.brakeDepth * 0.034, 0);
    this.camera.position.copy(point).add(this.cameraVertical).addScaledVector(tangent, 1.4 + this.run.brakeDepth * 0.085);
    this.camera.up.set(0, 1, 0);
    this.cameraTarget.copy(point).addScaledVector(tangent, 32);
    this.cameraTarget.y += 0.75 - this.run.brakeDepth * 0.07;
    this.camera.lookAt(this.cameraTarget);
    this.cockpit.wheel.rotation.z = clamp(-tangent.x * 0.34, -0.28, 0.28);
    this.cockpit.setBrakeFeedback(this.run.brakeDepth, vibrationX * 0.35);
  }

  triggerOverspeedFailure(checkpoint) {
    if (this.state.phase !== GAME_PHASE.DRIVING) return false;
    this.run.failureReason = 'OVERSPEED';
    this.resultSnapshot = this.snapshotResult('FAIL', checkpoint);
    this.cinematicCause = 'OVERSPEED';
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
    const currentSample = this.route.sample(Math.min(this.route.routeLengthM, this.run.distanceM + transitionAdvance));
    this.crashU = currentSample.u;
    const currentPosition = currentSample.position.clone();
    const currentTangent = currentSample.tangent.clone();
    const beforeTangent = this.route.sample(Math.max(0, this.run.distanceM - 24)).tangent.clone();
    const aheadTangent = this.route.sample(Math.min(this.route.routeLengthM, this.run.distanceM + 30)).tangent.clone();
    this.crashForward = currentTangent.normalize();

    const routeRight = new THREE.Vector3().crossVectors(WORLD_UP, this.crashForward).normalize();
    this.crashOutsideSign = getOutsideTurnSign(beforeTangent, aheadTangent);
    this.crashSide = routeRight.multiplyScalar(this.crashOutsideSign);
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
      { uHint: this.crashU },
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
      { uHint: this.crashU },
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
      checkpointLabel: checkpoint?.label ?? '',
      safeSpeedKmh: checkpoint?.safeSpeedKmh ?? null,
      failureReason: this.run.failureReason,
      routeLengthM: this.route.routeLengthM,
      build: Object.freeze({ ...this.playerBuild }),
    });
  }

  showMenuView() {
    this.camera.position.set(-145, 235, -105);
    this.camera.lookAt(60, 115, 150);
  }

  updateMenu(dt) {
    this.overviewTime += dt * 0.12;
    const target = new THREE.Vector3(35, 105, 195);
    this.camera.position.set(
      target.x + Math.cos(this.overviewTime) * 275,
      230,
      target.z + Math.sin(this.overviewTime) * 275,
    );
    this.camera.lookAt(target);
  }

  loop() {
    const rawDt = this.clock.getDelta();
    const simulationDt = Math.min(rawDt, BALANCE.maxDeltaSec);
    const cinematicDt = Math.min(rawDt, 0.1);
    if (this.state.phase === GAME_PHASE.MENU) this.updateMenu(simulationDt);
    if (this.state.phase === GAME_PHASE.DRIVING) this.updateDriving(simulationDt);
    if (this.state.phase === GAME_PHASE.BRAKE_BREAK_CINEMATIC) this.updatePedalBreak(cinematicDt);
    if (this.state.phase === GAME_PHASE.CRASH_CINEMATIC) this.updateCrash(cinematicDt);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height, false);
    this.pedalCamera.resize();
  }

  unlockAudio() {
    this.audio.unlock().catch(() => {});
  }

  setMuted(muted) {
    this.audio.setMuted(muted);
  }

  setVolume(volume) {
    this.audio.setVolume(volume);
  }
}
