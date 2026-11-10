import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.ts';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 780,
  height: 1688,
  backgroundColor: '#fff6fb',
  parent: 'game',
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [GameScene],
};

const game = new Phaser.Game(config);
const splash = document.getElementById('splash');
game.events.once('ready', () => {
  window.setTimeout(() => splash?.classList.add('gone'), 180);
});

const refreshBounds = (): void => {
  try { game.scale.updateBounds(); } catch { /* scale may not be ready yet */ }
};
window.addEventListener('touchstart', refreshBounds, { capture: true, passive: true });
window.addEventListener('pointerdown', refreshBounds, { capture: true, passive: true });
window.addEventListener('resize', () => { window.setTimeout(() => game.scale.refresh(), 50); });
window.addEventListener('orientationchange', () => { window.setTimeout(() => game.scale.refresh(), 300); });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js', { scope: './' }); });
}
