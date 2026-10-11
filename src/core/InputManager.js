export class InputManager {
  constructor() {
    this.brakeHeld = false;
    this.pressEdge = false;
    this.leftHeld = false;
    this.rightHeld = false;
    this.enabled = false;

    this.onKeyDown = (event) => {
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        if (this.enabled) { event.preventDefault(); this.leftHeld = true; }
        return;
      }
      if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        if (this.enabled) { event.preventDefault(); this.rightHeld = true; }
        return;
      }
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (!this.enabled || event.repeat) return;
      if (!this.brakeHeld) this.pressEdge = true;
      this.brakeHeld = true;
    };
    this.onKeyUp = (event) => {
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        if (this.enabled) event.preventDefault();
        this.leftHeld = false;
        return;
      }
      if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        if (this.enabled) event.preventDefault();
        this.rightHeld = false;
        return;
      }
      if (event.code !== 'Space') return;
      event.preventDefault();
      this.brakeHeld = false;
    };
    this.release = () => { this.brakeHeld = false; this.leftHeld = false; this.rightHeld = false; };

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

  get steer() { return Number(this.rightHeld) - Number(this.leftHeld); }

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
