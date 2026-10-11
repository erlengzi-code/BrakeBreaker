import { MATERIALS, MATERIAL_ORDER, REINFORCEMENTS, REINFORCEMENT_ORDER, normalizeBuild } from '../config/materials.js';
import { getEnchantment } from '../config/enchantments.js';
import { PedalViewport } from '../brake/PedalCamera.js';
import { LogoCanvas } from '../enchant/LogoCanvas.js';
import { canEnchant, drawEnchantment } from '../enchant/EnchantmentSystem.js';

const LOGO_COLORS = Object.freeze(['#121a22', '#e34f39', '#f1ca3f', '#3c8d8a', '#4169a8', '#8f4bb8']);

export class DiyScreen {
  constructor({ build, onChange }) {
    this.build = build;
    this.onChange = onChange;
    this.materialList = document.querySelector('#material-options');
    this.reinforcementList = document.querySelector('#reinforcement-options');
    this.thickness = document.querySelector('#thickness-input');
    this.thicknessValue = document.querySelector('#thickness-value');
    this.hint = document.querySelector('#diy-hint');
    this.driveButton = document.querySelector('#drive-button');
    this.enchantButton = document.querySelector('#enchant-button');
    this.enchantStatus = document.querySelector('#enchant-status');
    this.enchantResult = document.querySelector('#enchant-result');
    this.enchantName = document.querySelector('#enchant-name');
    this.enchantEffect = document.querySelector('#enchant-effect');
    this.logoImage = document.querySelector('#diy-logo-image');
    this.logoColors = document.querySelector('#logo-colors');
    this.logoBrush = document.querySelector('#logo-brush');
    this.undoButton = document.querySelector('#logo-undo');
    this.tabButtons = [...document.querySelectorAll('[data-diy-tab]')];
    this.tabPanels = [...document.querySelectorAll('[data-diy-panel]')];
    this.activeTab = 'pedal';
    this.isEnchanting = false;
    this.preview = new PedalViewport(document.querySelector('#diy-canvas'), this.build);
    this.logoCanvas = new LogoCanvas(document.querySelector('#logo-canvas'), (drawing) => this.logoChanged(drawing));
    this.logoCanvas.revision = this.build.logoRevision ?? 0;
    this.lastTime = performance.now();
    this.renderOptions();
    this.bind();
    this.sync();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  renderOptions() {
    MATERIAL_ORDER.forEach((id) => {
      const material = MATERIALS[id];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-button material-choice';
      button.dataset.material = id;
      button.innerHTML = `<i style="--swatch:#${material.color.toString(16).padStart(6, '0')}"></i><span>${material.label}</span>`;
      this.materialList.append(button);
    });
    REINFORCEMENT_ORDER.forEach((id) => {
      const reinforcement = REINFORCEMENTS[id];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-button reinforce-choice';
      button.dataset.reinforcement = id;
      button.textContent = reinforcement.label;
      this.reinforcementList.append(button);
    });
    LOGO_COLORS.forEach((color, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `logo-color${index === 0 ? ' selected' : ''}`;
      button.style.setProperty('--color', color);
      button.dataset.logoColor = color;
      button.setAttribute('aria-label', `画笔颜色 ${index + 1}`);
      this.logoColors.append(button);
    });
  }

  bind() {
    this.materialList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-material]');
      if (!button) return;
      this.build.materialId = button.dataset.material;
      this.changed();
    });
    this.reinforcementList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-reinforcement]');
      if (!button) return;
      this.build.reinforcementId = button.dataset.reinforcement;
      this.changed();
    });
    this.thickness.addEventListener('input', () => {
      this.build.thickness = Number(this.thickness.value);
      this.changed();
    });
    this.logoColors.addEventListener('click', (event) => {
      const button = event.target.closest('[data-logo-color]');
      if (!button) return;
      this.logoCanvas.setColor(button.dataset.logoColor);
      this.logoColors.querySelectorAll('[data-logo-color]').forEach((item) => item.classList.toggle('selected', item === button));
    });
    this.logoBrush.addEventListener('input', () => this.logoCanvas.setBrushSize(this.logoBrush.value));
    document.querySelector('#logo-clear').addEventListener('click', () => this.logoCanvas.clear());
    this.undoButton.addEventListener('click', () => this.logoCanvas.undo());
    this.enchantButton.addEventListener('click', () => this.enchant());
    this.tabButtons.forEach((button) => button.addEventListener('click', () => this.showTab(button.dataset.diyTab)));
    document.querySelector('#to-logo-button').addEventListener('click', () => this.showTab('logo'));
  }

  showTab(tabId) {
    this.activeTab = tabId;
    this.tabButtons.forEach((button) => {
      const selected = button.dataset.diyTab === tabId;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', `${selected}`);
    });
    this.tabPanels.forEach((panel) => { panel.hidden = panel.dataset.diyPanel !== tabId; });
  }

  changed() {
    Object.assign(this.build, normalizeBuild(this.build));
    this.preview.setBuild(this.build);
    this.preview.reset();
    this.sync();
    this.onChange(this.build);
  }

  logoChanged({ dataUrl, fingerprint, revision, canUndo: undoAvailable }) {
    this.build.logoDataUrl = dataUrl;
    this.build.logoRevision = revision;
    this.build.logoFingerprint = fingerprint;
    const restoredId = this.build.enchantmentHistory?.[fingerprint] ?? null;
    this.build.enchantmentId = restoredId;
    this.build.enchantmentRevision = restoredId ? revision : null;
    this.build.enchantmentFingerprint = restoredId ? fingerprint : null;
    this.undoButton.disabled = !undoAvailable;
    this.syncEnchantment();
    this.onChange(this.build);
  }

  enchant() {
    const drawing = this.logoCanvas.prepareForEnchant();
    if (this.isEnchanting || !canEnchant(this.build, drawing.fingerprint)) {
      this.syncEnchantment();
      return;
    }
    this.isEnchanting = true;
    this.enchantButton.disabled = true;
    this.enchantButton.classList.add('enchanting');
    this.enchantStatus.textContent = '正在注入玄学能量……请勿拍打显示器。';

    window.setTimeout(() => {
      this.build.logoDataUrl = drawing.dataUrl;
      this.build.logoRevision = drawing.revision;
      this.build.logoFingerprint = drawing.fingerprint;
      this.build.enchantmentId = drawEnchantment(drawing.features);
      this.build.enchantmentRevision = drawing.revision;
      this.build.enchantmentFingerprint = drawing.fingerprint;
      this.build.enchantmentHistory = {
        ...this.build.enchantmentHistory,
        [drawing.fingerprint]: this.build.enchantmentId,
      };
      this.isEnchanting = false;
      this.enchantButton.classList.remove('enchanting');
      this.syncEnchantment();
      this.onChange(this.build);
    }, 650);
  }

  sync() {
    this.thickness.value = this.build.thickness;
    this.thicknessValue.textContent = `${Math.round(this.build.thickness)}`;
    this.materialList.querySelectorAll('[data-material]').forEach((button) => {
      button.classList.toggle('selected', button.dataset.material === this.build.materialId);
    });
    this.reinforcementList.querySelectorAll('[data-reinforcement]').forEach((button) => {
      button.classList.toggle('selected', button.dataset.reinforcement === this.build.reinforcementId);
    });
    const material = MATERIALS[this.build.materialId];
    const thicknessHint = this.build.thickness >= 90 ? ' 检测到您正在用汽车运输刹车踏板。' : '';
    this.hint.textContent = material.hint + thicknessHint;
    this.syncEnchantment();
  }

  syncEnchantment() {
    const recordedId = this.build.enchantmentHistory?.[this.build.logoFingerprint] ?? null;
    if (recordedId) {
      this.build.enchantmentId = recordedId;
      this.build.enchantmentFingerprint = this.build.logoFingerprint;
    }
    const enchantment = getEnchantment(recordedId);
    const locked = Boolean(enchantment);
    this.enchantButton.disabled = this.isEnchanting || !canEnchant(this.build, this.build.logoFingerprint);
    this.driveButton.disabled = !locked;
    this.driveButton.textContent = locked ? '装车，开始下山' : '先附魔，再开始下山';
    this.enchantResult.hidden = !locked;

    if (locked) {
      this.logoImage.src = this.build.logoDataUrl;
      this.enchantName.textContent = enchantment.label;
      this.enchantEffect.textContent = `${enchantment.effectLabel} · ${enchantment.description}`;
      this.enchantStatus.textContent = '本幅车标已经附魔。撤销回这幅原画时会恢复同一结果，不能重复刷取。';
    } else if (!this.isEnchanting) {
      this.enchantStatus.textContent = '画点什么，或者使用实验室默认标志进行附魔。';
    }
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (!document.querySelector('#diy-screen').hidden && this.activeTab === 'pedal') this.preview.update(dt, 0.16, true);
    requestAnimationFrame(this.loop);
  }
}
