import './styles/main.css';
import { Game } from './core/Game.js';
import { InputManager } from './core/InputManager.js';
import { ScreenManager } from './ui/ScreenManager.js';
import { GameHUD } from './ui/GameHUD.js';
import { ResultScreen } from './ui/ResultScreen.js';
import { DiyScreen } from './ui/DiyScreen.js';
import { createDefaultBuild } from './config/materials.js';

const playerBuild = createDefaultBuild();

const game = new Game({
  canvas: document.querySelector('#game-canvas'),
  input: new InputManager(),
  screens: new ScreenManager(),
  hud: new GameHUD(),
  results: new ResultScreen(),
  playerBuild,
});

const diy = new DiyScreen({
  build: playerBuild,
  onChange: (build) => game.setPlayerBuild(build),
});

document.querySelector('#start-button').addEventListener('click', (event) => {
  event.currentTarget.blur();
  game.openDiy();
});
document.querySelector('#drive-button').addEventListener('click', (event) => {
  if (!playerBuild.enchantmentId) return;
  event.currentTarget.blur();
  game.startRun();
});
document.querySelector('#retry-button').addEventListener('click', (event) => {
  event.currentTarget.blur();
  game.startRun();
});
document.querySelector('#exit-run-button').addEventListener('click', (event) => {
  event.currentTarget.blur();
  game.returnToMenu();
});
document.querySelector('#pause-button').addEventListener('click', (event) => {
  event.currentTarget.blur();
  game.setPaused(true);
});
document.querySelector('#resume-button').addEventListener('click', (event) => {
  event.currentTarget.blur();
  game.setPaused(false);
});
document.querySelector('#pause-exit-button').addEventListener('click', (event) => {
  event.currentTarget.blur();
  game.returnToMenu();
});
window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyP' || event.repeat || event.target?.matches('input, textarea, [contenteditable]')) return;
  if (game.togglePause()) event.preventDefault();
});
document.querySelector('#menu-button').addEventListener('click', (event) => {
  event.currentTarget.blur();
  diy.sync();
  game.openDiy();
});
document.querySelector('#help-button').addEventListener('click', () => {
  const panel = document.querySelector('#help-panel');
  panel.hidden = !panel.hidden;
});

const muteButton = document.querySelector('#mute-button');
const volumeInput = document.querySelector('#volume-input');
const fullscreenButton = document.querySelector('#fullscreen-button');
fullscreenButton.addEventListener('click', async () => {
  fullscreenButton.blur();
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    console.warn('当前浏览器无法切换全屏模式', error);
  }
});
document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = active ? '⛶ 退出全屏' : '⛶ 全屏';
  fullscreenButton.setAttribute('aria-label', active ? '退出全屏' : '进入全屏');
  game.resize();
});
muteButton.addEventListener('click', () => {
  const muted = muteButton.getAttribute('aria-pressed') !== 'true';
  muteButton.setAttribute('aria-pressed', `${muted}`);
  muteButton.textContent = muted ? '声音：关' : '声音：开';
  game.setMuted(muted);
});
volumeInput.addEventListener('input', () => game.setVolume(Number(volumeInput.value) / 100));
document.addEventListener('pointerdown', () => game.unlockAudio(), { once: true });

game.start();
