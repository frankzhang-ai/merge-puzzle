import Phaser from 'phaser';
import { ART } from './assets.ts';

export const FONT = '-apple-system, "SF Pro Rounded", system-ui, sans-serif';
export const INK = '#59465b';
export const MUTED = '#77746d';
export const BOARD = { x: 40, y: 560, cell: 100, columns: 7, rows: 9 };

const SKIN_PALETTES: Record<string, string[]> = {
  Classic: ['#ff8fab', '#ffd1a8', '#ffd45e', '#70cda9', '#75c9f5', '#b993f5', '#ff8fab', '#e8bf59'],
  'Dawn Petal': ['#ff8fab', '#ffb3c7', '#ffd1a8', '#ffd45e', '#ffb3c7', '#ff8fab', '#ffd1a8', '#ffd45e'],
  'Night Bloom': ['#b993f5', '#d7c4ff', '#75c9f5', '#7a6b8a', '#b993f5', '#d7c4ff', '#75c9f5', '#fff1a8'],
  'Rainbow Garden': ['#ff8fab', '#ffd45e', '#70cda9', '#75c9f5', '#b993f5', '#ff8fab', '#ffd45e', '#70cda9'],
};

function hex(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color = INK,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    align: 'center',
    ...extra,
  }).setOrigin(0.5);
}

export function paintBackground(scene: Phaser.Scene): void {
  if (scene.textures.exists(ART.bg)) {
    scene.add.image(390, 844, ART.bg).setDisplaySize(780, 1688).setDepth(-20);
    return;
  }
  const bg = scene.add.graphics().setDepth(-20);
  bg.fillGradientStyle(0xfff6fb, 0xfff6fb, 0xeef8ff, 0xeef8ff, 1);
  bg.fillRect(0, 0, 780, 1688);
  const blobs: Array<[number, number, number, number]> = [
    [80, 365, 0xffb3c7, 34],
    [680, 600, 0xa8d8ff, 46],
    [115, 1130, 0xfff1a8, 38],
    [665, 1420, 0xd7c4ff, 42],
    [525, 300, 0xb5ead7, 27],
    [80, 1560, 0x70cda9, 22],
    [710, 1540, 0xffb3c7, 26],
  ];
  blobs.forEach(([x, y, color, radius]) => {
    const blob = scene.add.graphics().setDepth(-10);
    blob.fillStyle(color, 0.16);
    blob.fillCircle(x, y, radius);
  });
  const ground = scene.add.graphics().setDepth(-9);
  ground.fillStyle(0xb5ead7, 0.35);
  ground.fillEllipse(390, 1690, 900, 150);
}

function drawFlowerArt(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  level: number,
  size: number,
  skin: string,
): void {
  const palette = SKIN_PALETTES[skin] ?? SKIN_PALETTES.Classic!;
  const base = hex(palette[Math.min(7, level - 1)]!);
  const petals = 5 + Math.min(3, Math.floor((level - 1) / 2));
  if (skin === 'Dawn Petal') {
    graphics.fillStyle(0xffd1a8, 0.34);
    graphics.fillCircle(cx, cy, size * 1.18);
  }
  for (let index = 0; index < petals; index += 1) {
    const angle = index * Math.PI * 2 / petals - Math.PI / 2;
    const color = skin === 'Rainbow Garden'
      ? hex(palette[index % palette.length]!)
      : base;
    graphics.fillStyle(color, 1);
    graphics.fillCircle(
      cx + Math.cos(angle) * size * 0.54,
      cy + Math.sin(angle) * size * 0.54,
      size * 0.4,
    );
  }
  graphics.fillStyle(0xfff1a8, 1);
  graphics.fillCircle(cx, cy, size * 0.44);
  graphics.fillStyle(0xffffff, 0.35);
  graphics.fillCircle(cx - size * 0.12, cy - size * 0.12, size * 0.18);
  graphics.fillStyle(0x59465b, 1);
  graphics.fillCircle(cx - size * 0.13, cy - size * 0.02, size * 0.055);
  graphics.fillCircle(cx + size * 0.13, cy - size * 0.02, size * 0.055);
  graphics.fillStyle(0xffffff, 1);
  graphics.fillCircle(cx - size * 0.15, cy - size * 0.05, size * 0.02);
  graphics.fillCircle(cx + size * 0.11, cy - size * 0.05, size * 0.02);
  graphics.fillStyle(0xffb3c7, 0.6);
  graphics.fillCircle(cx - size * 0.27, cy + size * 0.13, size * 0.09);
  graphics.fillCircle(cx + size * 0.27, cy + size * 0.13, size * 0.09);
  graphics.lineStyle(Math.max(2, size * 0.06), 0x59465b, 1);
  graphics.beginPath();
  graphics.arc(cx, cy + size * 0.04, size * 0.14, 0.15, Math.PI - 0.15, false);
  graphics.strokePath();
  if (skin === 'Night Bloom') {
    const starX = cx + size * 0.72;
    const starY = cy - size * 0.7;
    graphics.fillStyle(0xfff1a8, 1);
    const points = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 ? size * 0.06 : size * 0.14;
      points.push({ x: starX + Math.cos(angle) * radius, y: starY + Math.sin(angle) * radius });
    }
    graphics.fillPoints(points, true);
  }
}

export function flowerTexture(scene: Phaser.Scene, level: number, skin: string, size: number): string {
  const key = `flower-${skin}-${level}-${size}`;
  if (scene.textures.exists(key)) return key;
  const padding = Math.ceil(size * 1.5);
  const graphics = scene.add.graphics().setVisible(false);
  drawFlowerArt(graphics, padding, padding, level, size, skin);
  graphics.generateTexture(key, padding * 2, padding * 2);
  graphics.destroy();
  return key;
}

export function addFlower(
  scene: Phaser.Scene,
  x: number,
  y: number,
  level: number,
  size: number,
  skin: string,
): Phaser.GameObjects.Image {
  const artKey = `flower-${Math.max(1, Math.min(8, level))}`;
  if (scene.textures.exists(artKey)) {
    const image = scene.add.image(x, y, artKey).setDisplaySize(size * 2, size * 2);
    if (skin === 'Dawn Petal') image.setTint(0xffd8df);
    else if (skin === 'Night Bloom') image.setTint(0xc9b6ff);
    else if (skin === 'Rainbow Garden') image.setTint([0xff8fab,0xffd45e,0x70cda9,0x75c9f5][(level-1)%4]!);
    return image;
  }
  return scene.add.image(x, y, flowerTexture(scene, level, skin, size));
}

export function drawStone(scene: Phaser.Scene, x: number, y: number, hp: number): void {
  const key = hp > 1 ? ART.stone2 : ART.stone;
  if (scene.textures.exists(key)) { scene.add.image(x,y,key).setDisplaySize(72,72); return; }
  const graphics = scene.add.graphics();
  const radius = hp > 1 ? 34 : 30;
  graphics.fillStyle(0x855875, 0.18);
  graphics.fillEllipse(x + 3, y + 22, radius * 1.6, 16);
  graphics.fillStyle(hp > 1 ? 0x8a7d93 : 0xa79eab, 1);
  graphics.fillCircle(x, y, radius);
  graphics.fillStyle(0xffffff, 0.28);
  graphics.fillCircle(x - 10, y - 10, radius * 0.35);
  graphics.lineStyle(3, 0xffffff, 0.35);
  graphics.strokeCircle(x, y, radius - 2);
  if (hp > 1) {
    graphics.lineStyle(3, 0x59465b, 0.45);
    graphics.beginPath();
    graphics.moveTo(x - 8, y - 6);
    graphics.lineTo(x + 2, y + 4);
    graphics.lineTo(x + 12, y - 2);
    graphics.strokePath();
  }
}

export function drawVine(scene: Phaser.Scene, x: number, y: number, size: number): void {
  if (scene.textures.exists(ART.vine)) { scene.add.image(x,y,ART.vine).setDisplaySize(size*2.2,size*2.2); return; }
  const graphics = scene.add.graphics();
  graphics.lineStyle(5, 0x70cda9, 0.95);
  graphics.strokeCircle(x, y, size * 0.86);
  graphics.fillStyle(0x70cda9, 1);
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    graphics.fillEllipse(
      x + Math.cos(angle) * size * 0.86,
      y + Math.sin(angle) * size * 0.86,
      10,
      16,
    );
  }
}

export function addButton(
  scene: Phaser.Scene,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  onClick: () => void,
  buttons: Record<string, { x: number; y: number; w: number; h: number }>,
  key: string,
  color = '#ff8fab',
): void {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x855875, 0.16);
  graphics.fillRoundedRect(x - width / 2, y - height / 2 + 8, width, height, 28);
  graphics.fillStyle(hex(color), 1);
  graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, 28);
  graphics.fillStyle(0xffffff, 0.28);
  graphics.fillRoundedRect(x - width / 2 + 8, y - height / 2 + 6, width - 16, height * 0.22, 16);
  graphics.lineStyle(4, 0xffffff, 0.55);
  graphics.strokeRoundedRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, height - 4, 26);
  addText(scene, x, y, label, Math.min(28, Math.max(18, height * 0.28)), INK, {
    wordWrap: { width: width - 20 },
  });
  const rect = { x: x - width / 2, y: y - height / 2, w: width, h: height };
  buttons[key] = rect;
  scene.add.zone(rect.x, rect.y, rect.w, rect.h)
    .setOrigin(0)
    .setInteractive(new Phaser.Geom.Rectangle(0, 0, rect.w, rect.h), Phaser.Geom.Rectangle.Contains)
    .on('pointerdown', onClick);
}

export function cellCenter(column: number, row: number): { x: number; y: number } {
  return {
    x: BOARD.x + column * BOARD.cell + BOARD.cell / 2,
    y: BOARD.y + row * BOARD.cell + BOARD.cell / 2,
  };
}

export function goalIconKey(kind: 'make' | 'clear' | 'score'): string {
  return kind === 'make' ? ART.goalMake : kind === 'clear' ? ART.goalClear : ART.goalScore;
}

export function goalSentence(goal: { kind: string; target: number; level?: number }): string {
  if (goal.kind === 'make') {
    const n = goal.target;
    const lv = goal.level ?? 3;
    return n === 1 ? `Make 1 Level ${lv} flower.` : `Make ${n} Level ${lv} flowers.`;
  }
  if (goal.kind === 'clear') return `Clear ${goal.target} stones or vines.`;
  return `Score ${goal.target} points.`;
}

export function addIconButton(
  scene: Phaser.Scene,
  texture: string,
  x: number,
  y: number,
  size: number,
  onClick: () => void,
  buttons: Record<string, { x: number; y: number; w: number; h: number }>,
  key: string,
  caption = '',
): void {
  if (scene.textures.exists(texture)) {
    scene.add.image(x, y, texture).setDisplaySize(size, size);
  } else {
    scene.add.circle(x, y, size / 2, 0xffd1a8);
  }
  if (caption) addText(scene, x, y + size * 0.52, caption, 16, INK);
  const hit = Math.max(size, 88);
  const rect = { x: x - hit / 2, y: y - hit / 2, w: hit, h: hit + (caption ? 22 : 0) };
  buttons[key] = rect;
  scene.add.zone(rect.x, rect.y, rect.w, rect.h)
    .setOrigin(0)
    .setInteractive(new Phaser.Geom.Rectangle(0, 0, rect.w, rect.h), Phaser.Geom.Rectangle.Contains)
    .on('pointerdown', onClick);
}

export function addBoardFrame(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ART.frame)) return;
  // Logical board is 700x900 at (40, 560). The art has a thick wooden border.
  scene.add.image(390, 1010, ART.frame).setDisplaySize(780, 1040).setDepth(-1);
}
