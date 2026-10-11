export class InputManager {
  constructor() {
    this.brakeHeld = false;
    this.pressEdge = false;
    this.enabled = false;

    this.onKeyDown = (event) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (!this.enabled || event.repeat) return;
      if (!this.brakeHeld) this.pressEdge = true;
      this.brakeHeld = true;
    };
    this.onKeyUp = (event) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      this.brakeHeld = false;
    };
    this.release = () => { this.brakeHeld = false; };

    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.release);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.release();
    });
  }

  consumePressEdge() {
    const value = this.pressEdge;
    this.pressEdge = false;
    return value;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.release();
      this.pressEdge = false;
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.release);
  }
}
