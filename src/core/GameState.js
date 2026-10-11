export const GAME_PHASE = Object.freeze({
  MENU: 'MENU',
  DIY: 'DIY',
  DRIVING: 'DRIVING',
  BRAKE_BREAK_CINEMATIC: 'BRAKE_BREAK_CINEMATIC',
  CRASH_CINEMATIC: 'CRASH_CINEMATIC',
  RESULT: 'RESULT',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [GAME_PHASE.MENU]: new Set([GAME_PHASE.DIY]),
  [GAME_PHASE.DIY]: new Set([GAME_PHASE.MENU, GAME_PHASE.DRIVING]),
  [GAME_PHASE.DRIVING]: new Set([
    GAME_PHASE.MENU,
    GAME_PHASE.BRAKE_BREAK_CINEMATIC,
    GAME_PHASE.CRASH_CINEMATIC,
    GAME_PHASE.RESULT,
  ]),
  [GAME_PHASE.BRAKE_BREAK_CINEMATIC]: new Set([GAME_PHASE.MENU, GAME_PHASE.CRASH_CINEMATIC]),
  [GAME_PHASE.CRASH_CINEMATIC]: new Set([GAME_PHASE.MENU, GAME_PHASE.RESULT]),
  [GAME_PHASE.RESULT]: new Set([GAME_PHASE.MENU, GAME_PHASE.DIY, GAME_PHASE.DRIVING]),
});

export class GameState {
  constructor(initialPhase = GAME_PHASE.MENU) {
    this.phase = initialPhase;
    this.listeners = new Set();
  }

  set(nextPhase, payload = null) {
    if (nextPhase === this.phase || !ALLOWED_TRANSITIONS[this.phase]?.has(nextPhase)) return false;
    const previousPhase = this.phase;
    this.phase = nextPhase;
    this.listeners.forEach((listener) => listener(nextPhase, previousPhase, payload));
    return true;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
