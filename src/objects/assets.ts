import type Phaser from 'phaser';

export const ART = {
  bg: 'bg', frame: 'board-frame', stone: 'stone', stone2: 'stone-hp2', vine: 'vine',
  star: 'star', emptyStar: 'star-empty', hand: 'hand', logo: 'logo-hero',
  undo: 'btn-undo', hammer: 'btn-hammer', shuffle: 'btn-shuffle', pause: 'btn-pause',
  sound: 'btn-sound', muted: 'btn-sound-off', goalMake: 'goal-make', goalClear: 'goal-clear', goalScore: 'goal-score',
  clearPose: 'pose-clear', failPose: 'pose-fail', dailyPose: 'pose-daily', albumPose: 'pose-album', map: 'map',
} as const;

const CRITICAL = [
  'bg','board-frame','stone','stone-hp2','vine','star','star-empty','hand','logo-hero',
  'btn-undo','btn-hammer','btn-shuffle','btn-sound','btn-sound-off','btn-pause',
  'goal-make','goal-clear','goal-score',
];

export function preloadArt(scene: Phaser.Scene): void {
  for (const key of CRITICAL) scene.load.image(key, `assets/${key}.webp`);
  for (let n = 1; n <= 8; n += 1) scene.load.image(`flower-${n}`, `assets/flower-${n}.webp`);
}

export function lazyArt(scene: Phaser.Scene, key: string, onReady?: () => void): void {
  if (scene.textures.exists(key)) { onReady?.(); return; }
  scene.load.image(key, `assets/${key}.webp`);
  scene.load.once('complete', () => onReady?.());
  scene.load.start();
}
