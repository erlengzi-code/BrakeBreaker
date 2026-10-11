export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.masterConnected = false;
    this.volume = 0.65;
    this.muted = false;
    this.activeSources = new Set();
    this.vehicleLoop = null;
  }

  async unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    this.context ??= new AudioContextClass();
    this.master ??= this.context.createGain();
    if (!this.masterConnected) {
      this.master.connect(this.context.destination);
      this.masterConnected = true;
    }
    this.applyVolume();
    if (this.context.state === 'suspended') await this.context.resume();
    this.ensureVehicleLoop();
    return this.context.state === 'running';
  }

  ensureVehicleLoop() {
    if (!this.context || !this.master || this.vehicleLoop) return;
    const engine = this.context.createOscillator();
    const engineGain = this.context.createGain();
    engine.type = 'triangle';
    engine.frequency.value = 48;
    engineGain.gain.value = 0;
    engine.connect(engineGain).connect(this.master);

    const windBuffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const data = windBuffer.getChannelData(0);
    let seed = 0x51f15e;
    for (let index = 0; index < data.length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[index] = (seed / 0xffffffff) * 2 - 1;
    }
    const wind = this.context.createBufferSource();
    const windFilter = this.context.createBiquadFilter();
    const windGain = this.context.createGain();
    wind.buffer = windBuffer;
    wind.loop = true;
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 520;
    windFilter.Q.value = 0.7;
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(this.master);
    engine.start();
    wind.start();
    this.vehicleLoop = { engine, engineGain, wind, windFilter, windGain };
  }

  updateVehicle(speedMps, brakeDepth = 0) {
    if (!this.context || !this.vehicleLoop) return;
    const now = this.context.currentTime;
    const speed = Math.max(0, Number(speedMps) || 0);
    const normalized = Math.min(1, speed / 38);
    const brake = Math.max(0, Math.min(1, Number(brakeDepth) || 0));
    this.vehicleLoop.engine.frequency.setTargetAtTime(42 + speed * 2.25, now, 0.08);
    this.vehicleLoop.engineGain.gain.setTargetAtTime(0.018 + normalized * 0.034 + brake * 0.008, now, 0.08);
    this.vehicleLoop.windFilter.frequency.setTargetAtTime(380 + normalized * 920, now, 0.1);
    this.vehicleLoop.windGain.gain.setTargetAtTime(normalized * normalized * 0.055, now, 0.12);
  }

  stopVehicleMotion() {
    if (!this.context || !this.vehicleLoop) return;
    const now = this.context.currentTime;
    this.vehicleLoop.engineGain.gain.setTargetAtTime(0, now, 0.04);
    this.vehicleLoop.windGain.gain.setTargetAtTime(0, now, 0.04);
  }

  updateCinematicWind(amount = 0) {
    if (!this.context || !this.vehicleLoop) return;
    const progress = Math.max(0, Math.min(1, Number(amount) || 0));
    const now = this.context.currentTime;
    this.vehicleLoop.windFilter.frequency.setTargetAtTime(520 + progress * 1120, now, 0.08);
    this.vehicleLoop.windGain.gain.setTargetAtTime(progress * 0.095, now, 0.1);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.applyVolume();
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    this.applyVolume();
  }

  applyVolume() {
    if (!this.master || !this.context) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.012);
  }

  tone({ frequency = 220, endFrequency = frequency, duration = 0.12, type = 'sine', gain = 0.12, delay = 0 }) {
    if (!this.context || this.context.state !== 'running' || !this.master) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope).connect(this.master);
    this.trackSource(oscillator, now, duration);
  }

  noise({ duration = 0.45, gain = 0.12 } = {}) {
    if (!this.context || this.context.state !== 'running' || !this.master) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 780;
    envelope.gain.setValueAtTime(gain, this.context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter).connect(envelope).connect(this.master);
    this.trackSource(source, this.context.currentTime, duration);
  }

  trackSource(source, startAt, duration) {
    this.activeSources.add(source);
    source.addEventListener('ended', () => this.activeSources.delete(source), { once: true });
    source.start(startAt);
    source.stop(startAt + duration + 0.03);
  }

  playPedal() {
    this.tone({ frequency: 150, endFrequency: 96, duration: 0.075, type: 'triangle', gain: 0.075 });
  }

  playPedalStrain() {
    this.tone({ frequency: 185, endFrequency: 82, duration: 0.16, type: 'sawtooth', gain: 0.035 });
  }

  playBreak() {
    this.tone({ frequency: 210, endFrequency: 45, duration: 0.24, type: 'square', gain: 0.23 });
    this.tone({ frequency: 120, endFrequency: 34, duration: 0.34, type: 'sawtooth', gain: 0.12, delay: 0.045 });
  }

  playCrash() {
    this.noise({ duration: 0.72, gain: 0.14 });
    this.tone({ frequency: 110, endFrequency: 38, duration: 0.66, type: 'sawtooth', gain: 0.13 });
  }

  playSuccess() {
    [0, 0.12, 0.24].forEach((delay, index) => this.tone({
      frequency: [392, 523, 659][index], endFrequency: [440, 587, 784][index], duration: 0.2, gain: 0.09, delay,
    }));
  }

  playFailure() {
    this.tone({ frequency: 196, endFrequency: 92, duration: 0.42, type: 'triangle', gain: 0.11 });
  }

  stopAll() {
    this.activeSources.forEach((source) => {
      try { source.stop(); } catch { /* source may already be stopped */ }
    });
    this.activeSources.clear();
    this.stopVehicleMotion();
  }
}
