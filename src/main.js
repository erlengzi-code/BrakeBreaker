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
muteButton.addEventListener('click', () => {
  const muted = muteButton.getAttribute('aria-pressed') !== 'true';
  muteButton.setAttribute('aria-pressed', `${muted}`);
  muteButton.textContent = muted ? '声音：关' : '声音：开';
  game.setMuted(muted);
});
volumeInput.addEventListener('input', () => game.setVolume(Number(volumeInput.value) / 100));
document.addEventListener('pointerdown', () => game.unlockAudio(), { once: true });

game.start();
