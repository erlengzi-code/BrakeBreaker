import { CINEMATICS } from '../config/cinematics.js';

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function getBreakCinematicFrame(elapsedSec) {
  const elapsed = Math.max(0, elapsedSec);
  const breakMoment = CINEMATICS.breakMomentSec;
  const zoomProgress = smoothstep(elapsed / CINEMATICS.breakZoomDurationSec);
  const slamProgress = smoothstep(elapsed / breakMoment);
  const afterBreak = Math.max(0, elapsed - breakMoment);
  const missDuration = Math.max(0.001, CINEMATICS.breakReturnStartSec - breakMoment);
  const missProgress = smoothstep(afterBreak / missDuration);
  const returnProgress = smoothstep((elapsed - CINEMATICS.breakReturnStartSec) / 0.82);
  const cockpitProgress = smoothstep((elapsed - CINEMATICS.breakCockpitTransitionStartSec) /
    Math.max(0.001, CINEMATICS.brakeBreakDurationSec - CINEMATICS.breakCockpitTransitionStartSec));
  return Object.freeze({
    elapsed,
    zoomProgress,
    slamDepth: 0.72 + slamProgress * 0.28,
    footScale: 1 + slamProgress * 0.12,
    shouldBreak: elapsed >= breakMoment,
    impactVisible: elapsed >= breakMoment && elapsed < 3.12,
    announcementVisible: elapsed >= CINEMATICS.breakAnnouncementSec,
    // One short, low-amplitude impact nudge. No continuous camera shake.
    shake: elapsed < 0.32
      ? (1 - smoothstep(elapsed / 0.32)) * Math.sin(elapsed * 26) * 0.2
      : 0,
    footMissProgress: missProgress,
    detachedProgress: clamp01(afterBreak / Math.max(0.001, CINEMATICS.breakReturnStartSec - breakMoment)),
    returnProgress,
    cockpitProgress,
    forwardLurchMeters: cockpitProgress * 8.5,
    cameraPitch: cockpitProgress * 0.045,
    complete: elapsed >= CINEMATICS.brakeBreakDurationSec,
  });
}

export function getCrashCinematicFrame(elapsedSec, durationSec = CINEMATICS.crashDurationSec) {
  const elapsed = Math.max(0, elapsedSec);
  const transitionProgress = smoothstep(elapsed / CINEMATICS.crashTransitionDurationSec);
  return Object.freeze({
    elapsed,
    progress: clamp01(elapsed / durationSec),
    transitionProgress,
    thirdPerson: transitionProgress >= 0.72,
    // Let the car begin moving while the camera is pulling away, so the switch
    // to third person reads as one continuous reveal instead of a cockpit hold.
    flightElapsed: Math.max(0, elapsed - CINEMATICS.crashFlightRevealSec),
    complete: elapsed >= durationSec,
  });
}
