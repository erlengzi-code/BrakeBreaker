export class ScreenManager {
  constructor() {
    this.menu = document.querySelector('#menu-screen');
    this.diy = document.querySelector('#diy-screen');
    this.hud = document.querySelector('#hud');
    this.result = document.querySelector('#result-screen');
    this.breakFlash = document.querySelector('#break-flash');
    this.pedalPreview = document.querySelector('.pedal-preview');
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
    if (name !== 'break') this.pedalPreview.classList.remove('returning');
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
