import { getBuildLabels } from '../config/materials.js';
import { getEnchantment } from '../config/enchantments.js';
import { getFailureLabel, getFunnyTitle } from '../core/RunResult.js';
import { ANNOUNCEMENTS } from '../config/cinematics.js';

export class ResultScreen {
  constructor() {
    this.card = document.querySelector('.result-card');
    this.title = document.querySelector('#result-title');
    this.kicker = document.querySelector('#result-kicker');
    this.reason = document.querySelector('#result-reason');
    this.message = document.querySelector('#result-message');
    this.distance = document.querySelector('#result-distance');
    this.time = document.querySelector('#result-time');
    this.speed = document.querySelector('#result-speed');
    this.presses = document.querySelector('#result-presses');
    this.material = document.querySelector('#result-material');
    this.thickness = document.querySelector('#result-thickness');
    this.reinforcement = document.querySelector('#result-reinforcement');
    this.enchantment = document.querySelector('#result-enchantment');
    this.logoImage = document.querySelector('#result-logo-image');
  }

  render(snapshot) {
    const success = snapshot.outcome === 'SUCCESS';
    const pedalBroken = snapshot.failureReason === 'PEDAL_BROKEN';
    this.card.classList.toggle('fail', !success);
    this.kicker.textContent = success ? '下山成功 · 系统认证' : '极限下坡 · 生存报告';
    this.title.textContent = getFunnyTitle(snapshot);
    this.reason.textContent = getFailureLabel(snapshot);
    this.message.textContent = success
      ? ANNOUNCEMENTS.SUCCESS
      : pedalBroken
        ? ANNOUNCEMENTS.PEDAL_BROKEN
        : `${ANNOUNCEMENTS.OVERSPEED}车辆在${snapshot.checkpointLabel || '山路上'}驶出道路边缘。`;
    this.distance.textContent = `${Math.round(snapshot.distanceM)} m`;
    this.time.textContent = `${snapshot.elapsedSec.toFixed(1)} s`;
    this.speed.textContent = `${Math.round(snapshot.maxSpeedMps * 3.6)} km/h`;
    this.presses.textContent = snapshot.brakePressCount;
    const labels = getBuildLabels(snapshot.build);
    this.material.textContent = labels.material;
    this.thickness.textContent = labels.thickness;
    this.reinforcement.textContent = labels.reinforcement;
    this.enchantment.textContent = getEnchantment(snapshot.build.enchantmentId)?.label ?? '未附魔';
    this.logoImage.src = snapshot.build.logoDataUrl ?? '';
  }
}
