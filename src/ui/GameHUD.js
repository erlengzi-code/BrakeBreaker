export function getBrakeFeedback(depth) {
  const value = Math.max(0, Math.min(1, Number(depth) || 0));
  if (value < 0.05) return { label: '未踩', level: 'idle' };
  if (value < 0.28) return { label: '轻踩', level: 'light' };
  if (value < 0.56) return { label: '中踩', level: 'medium' };
  if (value < 0.86) return { label: '深踩', level: 'heavy' };
  return { label: '踩到底', level: 'max' };
}

export class GameHUD {
  constructor() {
    this.speed = document.querySelector('#speed-value');
    this.distance = document.querySelector('#distance-value');
    this.section = document.querySelector('#section-name');
    this.progress = document.querySelector('#progress-bar');
    this.routeCard = document.querySelector('.route-card');
    this.condition = document.querySelector('#condition-value');
    this.warning = document.querySelector('#corner-warning');
    this.safeSpeed = document.querySelector('#safe-speed');
    this.warningDistance = document.querySelector('#warning-distance');
    this.brakeFill = document.querySelector('#brake-fill');
    this.brakeTrack = document.querySelector('#brake-track');
    this.brakeStatus = document.querySelector('#brake-status');
    this.speedCard = document.querySelector('.speed-card');
    this.hud = document.querySelector('#hud');
    this.hint = document.querySelector('#space-hint');
    this.announcement = document.querySelector('#system-announcement');
    this.announcementText = document.querySelector('#announcement-text');
  }

  update(run, section, upcoming, maxDurability) {
    this.speed.textContent = Math.round(run.speedMps * 3.6);
    this.speedCard.dataset.danger = run.speedMps * 3.6 >= 112 ? 'high' : 'normal';
    this.distance.textContent = `${Math.round(run.distanceM)} m`;
    this.section.textContent = section.name;
    const condition = Math.max(0, Math.min(100, Math.round(run.pedalDurability / maxDurability * 100)));
    this.condition.textContent = `${condition}%`;
    this.progress.style.width = `${condition}%`;
    this.routeCard.dataset.condition = condition < 25 ? 'critical' : 'normal';
    this.brakeFill.style.width = `${run.brakeDepth * 100}%`;
    const brakeFeedback = getBrakeFeedback(run.brakeDepth);
    this.brakeTrack.dataset.level = brakeFeedback.level;
    this.brakeStatus.dataset.level = brakeFeedback.level;
    this.hud.dataset.brakeLevel = brakeFeedback.level;
    this.brakeStatus.textContent = brakeFeedback.label;
    this.hint.classList.toggle('faded', run.elapsedSec > 7);

    const remaining = upcoming ? upcoming.startM + upcoming.lengthM * 0.25 - run.distanceM : Infinity;
    const shouldWarn = upcoming && remaining <= upcoming.warningDistanceM && remaining >= -1;
    this.warning.hidden = !shouldWarn;
    if (shouldWarn) {
      this.safeSpeed.textContent = upcoming.safeSpeedKmh;
      this.warningDistance.textContent = `${upcoming.name} · 前方 ${Math.max(0, Math.ceil(remaining))} m`;
    }
  }

  announce(message, tone = 'neutral') {
    this.announcementText.textContent = message;
    this.announcement.dataset.tone = tone;
    this.announcement.hidden = false;
  }

  clearAnnouncement() {
    this.announcement.hidden = true;
    this.announcementText.textContent = '';
  }
}
