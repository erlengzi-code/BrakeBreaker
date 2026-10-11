export class ScreenManager {
  constructor() {
    this.menu = document.querySelector('#menu-screen');
    this.diy = document.querySelector('#diy-screen');
    this.hud = document.querySelector('#hud');
    this.result = document.querySelector('#result-screen');
    this.breakFlash = document.querySelector('#break-flash');
    this.pedalPreview = document.querySelector('.pedal-preview');
    this.pauseScreen = document.querySelector('#pause-screen');
    this.pauseButton = document.querySelector('#pause-button');
  }

  show(name) {
    this.menu.hidden = name !== 'menu';
    this.diy.hidden = name !== 'diy';
    this.hud.hidden = name !== 'hud' && name !== 'break' && name !== 'crash';
    this.result.hidden = name !== 'result';
    this.breakFlash.hidden = true;
    this.hud.classList.toggle('break-mode', name === 'break');
    this.hud.classList.toggle('crash-mode', name === 'crash');
    this.pedalPreview.classList.toggle('cinematic', name === 'break');
    this.pauseButton.hidden = name !== 'hud';
    if (name !== 'hud') this.setPaused(false);
    if (name !== 'break') this.pedalPreview.classList.remove('returning');
  }

  setPaused(paused) {
    this.pauseScreen.hidden = !paused;
    this.pauseButton.hidden = paused || this.hud.hidden || this.hud.classList.contains('break-mode') || this.hud.classList.contains('crash-mode');
  }

  setBreakImpact(visible) {
    this.breakFlash.hidden = !visible;
  }

  setBreakProgress(progress) {
    const normalized = Math.max(0, Math.min(1, progress));
    this.hud.style.setProperty('--break-progress', `${normalized}`);
  }

  setBreakReturn(progress) {
    this.pedalPreview.classList.toggle('returning', progress > 0.02);
    this.pedalPreview.style.setProperty('--pedal-return-progress', `${Math.max(0, Math.min(1, progress))}`);
  }
}
