import Phaser from 'phaser';
import { levels, makeLevel } from '../config/levels.ts';
import {
  canFit, cloneBoard, emptyBoard, gravity, landingRows, place, resolve, type Grid,
} from '../systems/board.ts';
import { pieceForDaily, pieceForLevel, RNG } from '../systems/pieces.ts';
import { stars, unlocked } from '../systems/progress.ts';
import { dailyGoal, updateStreak } from '../systems/daily.ts';
import { discoverFlowers, hasRainbowGarden } from '../systems/album.ts';
import { consumeUse, dailyUses as getDailyUses } from '../systems/powerups.ts';
import { read, write } from '../systems/storage.ts';
import { track } from '../systems/analytics.ts';
import {
  BOARD, addButton, addFlower, addText, cellCenter, drawStone, drawVine, paintBackground, MUTED, INK,
} from '../objects/draw.ts';

export async function tryRewardedAd(_kind: string): Promise<boolean> {
  return false;
}

type Screen = 'boot' | 'menu' | 'map' | 'goal' | 'game' | 'pause' | 'clear' | 'fail' | 'daily' | 'album';
type Mode = 'campaign' | 'daily';

const today = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export class GameScene extends Phaser.Scene {
  screen: Screen = 'menu';
  mode: Mode = 'campaign';
  levelNo = 1;
  board: Grid = emptyBoard();
  moves = 0;
  score = 0;
  progress = 0;
  cleared = 0;
  made: Record<number, number> = {};
  next: number[] = [1];
  rng = new RNG(Date.now());
  id = 1;
  best = read<number[]>('progress', Array(30).fill(0));
  album = read<boolean[]>('album', Array(8).fill(false));
  skin = read('skin', 'Classic');
  soundEnabled = read('sound', true);
  audioContext: AudioContext | null = null;
  buttons: Record<string, { x: number; y: number; w: number; h: number }> = {};
  snapUndo: ReturnType<GameScene['capture']> | null = null;
  dailyDate = today();
  fx = { lastText: '', chain: 0, particles: 0, lastSound: '' };
  targeting = '';
  failReason = 'Board full';
  celebration = '';
  busy = false;

  constructor() {
    super('main');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#fff6fb');
    this.wireHook();
    const todayKey = today();
    if (!localStorage.getItem('mp.first')) write('first', todayKey);
    else if (read('first', todayKey) !== todayKey && read('lastReturn', '') !== todayKey) {
      track('mp-continue');
      write('lastReturn', todayKey);
    }
    this.input.on('pointerdown', () => this.unlockAudio());
    this.scale.on('resize', () => {
      if (!this.busy) this.draw();
    });
    this.draw();
  }

  wireHook(): void {
    const self = this;
    (window as Window & { __MERGEBLOOM__?: unknown }).__MERGEBLOOM__ = {
      getState: () => self.snapshot(),
      qa: {
        instant: location.search.includes('qa=1'),
        goto: (screen: Screen) => self.goto(screen),
        startLevel: (level: number) => self.startLevel(level, true),
        startDaily: () => self.startDaily(self.dailyDate),
        setBoard: (board: Grid) => {
          self.board = cloneBoard(board);
          self.draw();
        },
        setPiece: (levels: number[]) => {
          self.next = levels;
          self.draw();
        },
        dropColumn: (column: number) => self.drop(column),
        tickInstant: () => {
          self.tweens.killAll();
        },
        useUndo: () => self.undo(),
        useHammerAt: (column: number, row: number) => self.hammerAt(column, row),
        useShuffle: () => self.useTool('shuffle'),
        setDate: (date: string) => {
          self.dailyDate = date;
        },
        unlockAlbum: () => {
          self.album = Array(8).fill(true);
          self.saveAlbum();
        },
        resetStorage: () => {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith('mp.')) localStorage.removeItem(key);
          }
        },
      },
    };
  }

  snapshot() {
    const { x, y, cell, columns, rows } = BOARD;
    return {
      scene: this.screen,
      mode: this.mode,
      level: this.mode === 'daily' ? null : this.levelNo,
      moves: this.moves,
      score: this.score,
      goal: {
        type: this.mode === 'campaign' ? makeLevel(this.levelNo).goals[0]!.kind : dailyGoal(this.dailyDate).kind,
        text: this.goalText(),
        progress: this.progress,
        target: this.mode === 'campaign' ? makeLevel(this.levelNo).goals[0]!.target : dailyGoal(this.dailyDate).target,
        done: this.done(),
      },
      board: cloneBoard(this.board),
      nextPiece: { levels: [...this.next] },
      starsEarned: this.screen === 'clear' ? this.starCount() : 0,
      bestStars: [...this.best],
      album: [...this.album],
      daily: {
        date: this.dailyDate,
        streak: read('streak', 0),
        completedToday: read('dailyDone', '') === this.dailyDate,
        skins: read('skins', ['Classic']),
      },
      powerups: {
        undo: this.dailyUses().undo,
        hammer: this.dailyUses().hammer,
        shuffle: this.dailyUses().shuffle,
        adHookDisabled: true as const,
      },
      sound: this.soundEnabled,
      skin: this.skin,
      layout: {
        board: { x, y, w: cell * columns, h: cell * rows },
        columns: Array.from({ length: 7 }, (_, column) => ({
          col: column, x: x + column * cell, y, w: cell, h: cell * rows,
        })),
        buttons: { ...this.buttons },
      },
      fx: { ...this.fx },
    };
  }

  unlockAudio(): void {
    try {
      this.audioContext ??= new AudioContext();
      if (this.audioContext.state === 'suspended') void this.audioContext.resume();
    } catch { /* Audio may be blocked until a gesture. */ }
  }

  isInstant(): boolean {
    const hook = (window as Window & { __MERGEBLOOM__?: { qa?: { instant?: boolean } } }).__MERGEBLOOM__;
    return location.search.includes('qa=1') || Boolean(hook?.qa?.instant);
  }

  playTone(chain: number): void {
    if (!this.soundEnabled || !this.audioContext) return;
    const context = this.audioContext;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 420 + Math.min(chain, 5) * 110;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.17);
    this.fx.lastSound = `tone-${chain}`;
  }

  goto(screen: Screen): void {
    this.screen = screen;
    this.draw();
  }

  nextPiece(): number[] {
    return this.mode === 'daily' ? pieceForDaily(this.rng) : pieceForLevel(this.rng, this.levelNo);
  }

  startLevel(levelNumber: number, force = false): void {
    if (!force && !unlocked(this.best, levelNumber)) return;
    this.busy = false;
    this.mode = 'campaign';
    this.celebration = '';
    this.levelNo = levelNumber;
    const level = makeLevel(levelNumber);
    this.board = cloneBoard(level.board);
    this.album = discoverFlowers(this.album, this.board.flat()
      .flatMap((cell) => cell?.kind === 'flower' ? [cell.level] : []));
    this.moves = level.moves;
    this.score = 0;
    this.progress = 0;
    this.cleared = 0;
    this.made = {};
    this.targeting = '';
    this.snapUndo = null;
    this.rng = new RNG(levelNumber * 100003 + Date.now());
    this.next = this.nextPiece();
    this.screen = 'game';
    this.saveAlbum();
    track(`mp-level-start-${levelNumber}`);
    this.draw();
  }

  startDaily(date = today()): void {
    this.busy = false;
    this.celebration = '';
    this.mode = 'daily';
    this.dailyDate = date;
    const goal = dailyGoal(this.dailyDate);
    this.rng = new RNG(Number(this.dailyDate.replaceAll('-', '')));
    this.board = emptyBoard();
    this.moves = 20;
    this.score = 0;
    this.progress = 0;
    this.cleared = 0;
    this.made = {};
    this.targeting = '';
    this.snapUndo = null;
    this.next = this.nextPiece();
    if (goal.kind === 'clear' || goal.kind === 'combined') {
      for (let index = 0; index < 3; index += 1) {
        this.board[5 + index % 2]![1 + Math.floor(index / 2) * 3] = { kind: 'stone', hp: 1 };
      }
    }
    this.screen = 'game';
    if (read('dailyStarted', '') !== this.dailyDate) {
      track('mp-daily-play');
      write('dailyStarted', this.dailyDate);
    }
    this.draw();
  }

  dailyUses() {
    return getDailyUses(read('power', null), today());
  }

  saveAlbum(): void {
    write('album', this.album);
  }

  recordCreated(created: number[]): void {
    for (const level of created) this.made[level] = (this.made[level] ?? 0) + 1;
    const hadRainbow = hasRainbowGarden(this.album);
    this.album = discoverFlowers(this.album, created);
    if (!hadRainbow && hasRainbowGarden(this.album)) {
      const skins = read<string[]>('skins', ['Classic']);
      if (!skins.includes('Rainbow Garden')) {
        skins.push('Rainbow Garden');
        write('skins', skins);
        this.celebration = 'Rainbow Garden unlocked!';
        write('celebrated-Rainbow Garden', true);
      }
    }
    this.progress = this.made[this.primaryLevel()] ?? this.cleared;
    this.saveAlbum();
  }

  primaryLevel(): number {
    if (this.mode === 'campaign') return makeLevel(this.levelNo).goals[0]?.level ?? 3;
    return dailyGoal(this.dailyDate).level;
  }

  button(label: string, x: number, y: number, width: number, height: number, onClick: () => void, key: string, color?: string): void {
    addButton(this, label, x, y, width, height, onClick, this.buttons, key, color);
  }

  draw(): void {
    this.children.removeAll();
    this.buttons = {};
    paintBackground(this);
    if (this.screen !== 'game' && this.screen !== 'pause') {
      addText(this, 390, 82, 'MERGE BLOOM', 48);
    }

    if (this.screen === 'menu') this.drawMenu();
    else if (this.screen === 'map') this.drawMap();
    else if (this.screen === 'goal') this.drawGoal();
    else if (this.screen === 'daily') this.drawDaily();
    else if (this.screen === 'game') this.drawGame();
    else if (this.screen === 'pause') this.drawPause();
    else if (this.screen === 'clear' || this.screen === 'fail') this.drawResult();
    else if (this.screen === 'album') this.drawAlbum();
  }

  drawMenu(): void {
    addText(this, 390, 150, 'Drop. Merge. Bloom.', 25, MUTED);
    this.button('PLAY', 390, 520, 420, 110, () => this.goto('map'), 'play');
    this.button('Daily Challenge', 390, 660, 420, 110, () => this.goto('daily'), 'daily', '#75c9f5');
    this.button('Garden / Album', 390, 800, 420, 110, () => this.goto('album'), 'album', '#b993f5');
    this.button(this.soundEnabled ? 'Sound: On' : 'Sound: Off', 390, 940, 320, 88, () => {
      this.soundEnabled = !this.soundEnabled;
      write('sound', this.soundEnabled);
      this.draw();
    }, 'mute', '#ffd1a8');
    addText(this, 390, 1060, 'Privacy', 18, MUTED)
      .setInteractive(new Phaser.Geom.Rectangle(-80, -20, 160, 40), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => window.open('./privacy.html', '_self'));
    this.buttons.privacy = { x: 310, y: 1040, w: 160, h: 40 };
  }

  drawMap(): void {
    addText(this, 390, 155, 'Choose a bloom', 30);
    for (let index = 0; index < 30; index += 1) {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const x = 95 + column * 148;
      const y = 270 + row * 180;
      const level = index + 1;
      const open = unlocked(this.best, level);
      const boss = [5, 10, 15, 20, 25, 30].includes(level);
      const starsEarned = this.best[index] ?? 0;
      const label = boss
        ? `${level}\nBOSS\n${'★'.repeat(starsEarned) || ' '}`
        : `${level}\n${'★'.repeat(starsEarned) || (open ? ' ' : '🔒')}`;
      this.button(label, x, y, 124, 112, () => {
        if (!open) return;
        this.levelNo = level;
        this.goto('goal');
      }, `map${level}`, open ? (boss ? '#ff8fab' : '#ffd45e') : '#ddd5df');
    }
    this.button('BACK', 390, 1540, 300, 88, () => this.goto('menu'), 'back', '#ffd1a8');
  }

  drawGoal(): void {
    const level = makeLevel(this.levelNo);
    addText(this, 390, 260, `LEVEL ${level.n}${level.boss ? '  •  BOSS' : ''}`, 38);
    addText(this, 390, 420, this.goalText(level), 28, INK, { wordWrap: { width: 620 } });
    addText(
      this,
      390,
      560,
      `${level.moves} moves\n3★ with ${level.threeStar} moves left  ·  2★ with ${level.twoStar} left`,
      24,
      MUTED,
    );
    this.button('PLAY', 390, 780, 400, 110, () => this.startLevel(this.levelNo), 'goalPlay');
    this.button('BACK', 390, 920, 300, 88, () => this.goto('map'), 'back', '#ffd1a8');
  }

  drawDaily(): void {
    const goal = dailyGoal(today());
    this.dailyDate = today();
    addText(this, 390, 260, 'DAILY CHALLENGE', 34);
    addText(this, 390, 400, `Today: ${this.previewDailyGoal(goal)}`, 26, INK, { wordWrap: { width: 620 } });
    addText(this, 390, 500, `Streak: ${read<number>('streak', 0)} day${read<number>('streak', 0) === 1 ? '' : 's'}`, 26, MUTED);
    if (read('dailyDone', '') === today()) {
      addText(this, 390, 560, 'Completed today', 22, '#70cda9');
    }
    this.button('PLAY TODAY', 390, 720, 420, 110, () => this.startDaily(), 'play');
    this.button('BACK', 390, 860, 300, 88, () => this.goto('menu'), 'back', '#ffd1a8');
  }

  previewDailyGoal(goal: ReturnType<typeof dailyGoal>): string {
    if (goal.kind === 'make') return `Make ${goal.target} Lv.${goal.level} flowers`;
    if (goal.kind === 'clear') return `Clear ${goal.target} obstacles`;
    if (goal.kind === 'score') return `Score ${goal.target} points`;
    return `Make ${goal.target} Lv.${goal.level} flowers AND clear ${goal.extra?.target ?? 0} obstacles`;
  }

  drawGame(): void {
    addText(this, 390, 145, this.mode === 'daily' ? 'DAILY' : `LEVEL ${this.levelNo}`, 26, MUTED);
    addText(this, 390, 200, `Moves  ${this.moves}      Score  ${this.score}`, 28);
    addText(this, 390, 255, this.goalText(), 20, MUTED, { wordWrap: { width: 640 } });
    addText(this, 390, 330, 'NEXT', 18, MUTED);
    addFlower(this, this.next[1] ? 350 : 390, 400, this.next[0] ?? 1, 36, this.skin);
    if (this.next[1]) addFlower(this, 430, 400, this.next[1], 30, this.skin);

    const { x, y, cell, columns, rows } = BOARD;
    const well = this.add.graphics();
    well.fillStyle(0xffffff, 0.72);
    well.fillRoundedRect(x - 10, y - 10, cell * columns + 20, cell * rows + 20, 30);
    well.lineStyle(4, 0xffd9e7, 1);
    well.strokeRoundedRect(x - 10, y - 10, cell * columns + 20, cell * rows + 20, 30);

    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const left = x + column * cell;
        const top = y + row * cell;
        this.add.graphics().fillStyle(0xfff6fb, 1).fillRoundedRect(left + 4, top + 4, cell - 8, cell - 8, 18);
        const cellData = this.board[row]?.[column];
        const center = cellCenter(column, row);
        if (cellData?.kind === 'flower') {
          addFlower(this, center.x, center.y, cellData.level, 37, this.skin);
          if (cellData.vine) drawVine(this, center.x, center.y, 37);
        } else if (cellData?.kind === 'stone') {
          drawStone(this, center.x, center.y, cellData.hp);
        }
      }
    }

    this.buttons.board = { x, y, w: cell * columns, h: cell * rows };
    for (let column = 0; column < 7; column += 1) {
      const rect = { x: x + column * cell, y, w: cell, h: cell * rows };
      this.buttons[`column${column}`] = rect;
      const zone = this.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0);
      zone.setInteractive(new Phaser.Geom.Rectangle(0, 0, rect.w, rect.h), Phaser.Geom.Rectangle.Contains);
      const highlight = this.add.graphics();
      zone.on('pointerover', () => {
        highlight.clear();
        highlight.fillStyle(0xff8fab, 0.12);
        highlight.fillRoundedRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, 18);
      });
      zone.on('pointerout', () => highlight.clear());
      zone.on('pointerdown', () => {
        highlight.clear();
        highlight.fillStyle(0xff8fab, 0.2);
        highlight.fillRoundedRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, 18);
        if (this.targeting) {
          const pointer = this.input.activePointer;
          const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          const row = Math.max(0, Math.min(8, Math.floor((world.y - y) / cell)));
          this.hammerAt(column, row);
        } else {
          this.drop(column);
        }
      });
    }

    if (this.targeting) {
      addText(this, 390, 520, 'Tap a flower, stone, or vine', 22, '#ff8fab');
    }

    const uses = this.dailyUses();
    this.button(uses.undo > 0 ? `Undo\n${uses.undo} left` : 'Undo\nAd (soon)', 180, 1570, 200, 104, () => this.undo(), 'undo', '#ffd1a8');
    this.button(uses.hammer > 0 ? `Hammer\n${uses.hammer} left` : 'Hammer\nAd (soon)', 390, 1570, 200, 104, () => this.useTool('hammer'), 'hammer', this.targeting ? '#ffd45e' : '#b5ead7');
    this.button(uses.shuffle > 0 ? `Shuffle\n${uses.shuffle} left` : 'Shuffle\nAd (soon)', 600, 1570, 200, 104, () => this.useTool('shuffle'), 'shuffle', '#a8d8ff');
    this.button('Ⅱ', 720, 130, 80, 80, () => this.goto('pause'), 'pause', '#ffd1a8');
    this.button(this.soundEnabled ? 'SOUND' : 'MUTED', 60, 130, 96, 80, () => {
      this.soundEnabled = !this.soundEnabled;
      write('sound', this.soundEnabled);
      this.draw();
    }, 'mute', '#ffd1a8');

    if (this.fx.lastText) {
      const label = addText(this, 390, 505, this.fx.lastText, 46, '#ff8fab').setDepth(20);
      label.setStroke('#ffffff', 10);
      if (this.isInstant()) {
        label.setY(470);
      } else {
        this.tweens.add({ targets: label, y: 455, duration: 400, ease: 'Back.Out' });
        this.tweens.add({ targets: label, alpha: 0, delay: 900, duration: 300 });
      }
    }
    this.burstParticles(this.fx.particles);
  }

  burstParticles(count: number, originX = 390, originY = 900): void {
    const palette = [0xff8fab, 0xffd45e, 0x70cda9, 0x75c9f5, 0xb993f5];
    for (let index = 0; index < Math.min(28, count); index += 1) {
      const x = originX + (this.rng.next() - 0.5) * 360;
      const y = originY + (this.rng.next() - 0.5) * 360;
      const dot = this.add.circle(x, y, 5 + this.rng.next() * 6, palette[index % palette.length]!);
      this.tweens.add({
        targets: dot,
        y: y - 50 - this.rng.next() * 60,
        alpha: 0,
        scale: 0.25,
        duration: this.isInstant() ? 0 : 500,
      });
    }
  }

  drawPause(): void {
    addText(this, 390, 300, 'PAUSED', 42);
    this.button('RESUME', 390, 520, 400, 110, () => this.goto('game'), 'resume');
    this.button('RESTART', 390, 660, 400, 110, () => {
      if (this.mode === 'daily') this.startDaily(this.dailyDate);
      else this.startLevel(this.levelNo);
    }, 'retry', '#ffd1a8');
    this.button('MAP / MENU', 390, 800, 400, 110, () => this.goto(this.mode === 'daily' ? 'menu' : 'map'), 'map', '#75c9f5');
  }

  drawResult(): void {
    const success = this.screen === 'clear';
    addText(this, 390, 280, success ? 'A lovely bloom!' : this.failReason, 42);
    if (success) {
      if (this.mode !== 'daily') {
        addText(this, 390, 390, '★'.repeat(this.starCount()) || '★', 56, '#e8bf59');
      } else {
        addText(this, 390, 390, 'Daily complete!', 28, MUTED);
      }
      addText(this, 390, 460, `Score ${this.score}`, 28, MUTED);
    } else {
      addText(this, 390, 420, 'Try a different path and bloom again.', 24, MUTED, { wordWrap: { width: 620 } });
    }
    if (success && this.celebration) {
      addText(this, 390, 560, this.celebration, 28, '#ff8fab');
      this.burstParticles(22, 390, 600);
    }
    if (success) {
      this.button(this.mode === 'daily' ? 'MENU' : 'NEXT', 390, 760, 400, 110, () => {
        if (this.mode === 'daily') this.goto('menu');
        else if (this.levelNo < 30) this.startLevel(this.levelNo + 1);
        else this.goto('map');
      }, 'next');
      this.button('MAP', 390, 900, 300, 88, () => this.goto(this.mode === 'daily' ? 'menu' : 'map'), 'map', '#ffd1a8');
    } else {
      this.button('RETRY', 390, 760, 400, 110, () => {
        if (this.mode === 'daily') this.startDaily(this.dailyDate);
        else this.startLevel(this.levelNo);
      }, 'retry');
      this.button('MAP', 390, 900, 300, 88, () => this.goto(this.mode === 'daily' ? 'menu' : 'map'), 'map', '#ffd1a8');
    }
  }

  drawAlbum(): void {
    const names = ['Blush Bud', 'Peach Bell', 'Butter Bloom', 'Mint Daisy', 'Sky Tulip', 'Lilac Rose', 'Coral Peony', 'Golden Crown'];
    addText(this, 390, 155, 'GARDEN ALBUM', 32);
    for (let index = 0; index < 8; index += 1) {
      const x = 140 + (index % 4) * 170;
      const y = 380 + Math.floor(index / 4) * 300;
      const frame = this.add.graphics();
      frame.fillStyle(0xffffff, 0.85);
      frame.fillRoundedRect(x - 65, y - 80, 130, 200, 28);
      frame.lineStyle(3, 0xffcdda, 1);
      frame.strokeRoundedRect(x - 65, y - 80, 130, 200, 28);
      if (this.album[index]) addFlower(this, x, y, index + 1, 42, this.skin);
      else addText(this, x, y, '✿', 56, '#ddd5df');
      addText(this, x, y + 80, this.album[index] ? names[index]! : '???', 16);
    }
    if (hasRainbowGarden(this.album)) {
      addText(this, 390, 1020, 'Garden complete!', 22, '#70cda9');
    }
    this.button(`Skin: ${this.skin}`, 390, 1140, 400, 96, () => {
      const skins = read<string[]>('skins', ['Classic']);
      const current = Math.max(0, skins.indexOf(this.skin));
      this.skin = skins[(current + 1) % skins.length] ?? 'Classic';
      write('skin', this.skin);
      this.draw();
    }, 'skin', '#d7c4ff');
    this.button('BACK', 390, 1300, 300, 88, () => this.goto('menu'), 'back', '#ffd1a8');
  }

  goalText(level?: ReturnType<typeof makeLevel>): string {
    if (level) {
      return level.goals.map((goal) => {
        if (goal.kind === 'make') {
          const current = this.made[goal.level ?? 3] ?? 0;
          return `Make ${goal.target} Lv.${goal.level ?? 3}  (${current}/${goal.target})`;
        }
        if (goal.kind === 'clear') return `Clear ${goal.target} obstacles  (${this.cleared}/${goal.target})`;
        return `Score ${goal.target} points  (${this.score}/${goal.target})`;
      }).join('\nAND\n');
    }
    if (this.mode === 'campaign') return this.goalText(makeLevel(this.levelNo));
    const goal = dailyGoal(this.dailyDate);
    if (goal.kind === 'make') return `Make ${goal.target} Lv.${goal.level}  (${this.made[goal.level] ?? 0}/${goal.target})`;
    if (goal.kind === 'clear') return `Clear ${goal.target} obstacles  (${this.cleared}/${goal.target})`;
    if (goal.kind === 'score') return `Score ${goal.target} points  (${this.score}/${goal.target})`;
    return `Make ${goal.target} Lv.${goal.level}  (${this.made[goal.level] ?? 0}/${goal.target})\nAND\nClear ${goal.extra?.target ?? 0}  (${this.cleared}/${goal.extra?.target ?? 0})`;
  }

  done(): boolean {
    if (this.mode === 'campaign') {
      return makeLevel(this.levelNo).goals.every((goal) => {
        if (goal.kind === 'make') return (this.made[goal.level ?? 3] ?? 0) >= goal.target;
        if (goal.kind === 'clear') return this.cleared >= goal.target;
        return this.score >= goal.target;
      });
    }
    const goal = dailyGoal(this.dailyDate);
    if (goal.kind === 'make') return (this.made[goal.level] ?? 0) >= goal.target;
    if (goal.kind === 'clear') return this.cleared >= goal.target;
    if (goal.kind === 'score') return this.score >= goal.target;
    return (this.made[goal.level] ?? 0) >= goal.target && this.cleared >= (goal.extra?.target ?? 0);
  }

  drop(column: number): void {
    if (this.screen !== 'game' || this.targeting || this.busy) return;
    const rows = landingRows(this.board, column, this.next.length);
    if (!rows) {
      this.cameras.main.shake(120, 0.006);
      return;
    }
    this.snapUndo = this.capture();
    if (this.isInstant()) {
      this.commitDrop(column);
      return;
    }
    this.busy = true;
    const falling = this.next.map((level, index) => {
      const start = cellCenter(column, 0);
      const end = cellCenter(column, rows[index]!);
      const image = addFlower(this, start.x, BOARD.y - 20, level, 37, this.skin);
      this.tweens.add({
        targets: image,
        y: end.y,
        duration: 280 + index * 40,
        ease: 'Cubic.In',
        onComplete: () => {
          this.tweens.add({
            targets: image,
            scaleX: 1.18,
            scaleY: 0.82,
            duration: 80,
            yoyo: true,
            ease: 'Quad.Out',
          });
        },
      });
      return image;
    });
    this.time.delayedCall(420, () => {
      falling.forEach((image) => image.destroy());
      this.busy = false;
      this.commitDrop(column);
    });
  }

  commitDrop(column: number): void {
    const dropped = [...this.next];
    if (!place(this.board, column, this.next, this.id)) {
      this.snapUndo = null;
      this.cameras.main.shake(120, 0.006);
      return;
    }
    this.id += dropped.length;
    this.album = discoverFlowers(this.album, dropped);
    const result = resolve(this.board, this.id - dropped.length);
    this.score += result.score;
    this.cleared += result.cleared;
    this.recordCreated(result.created);
    this.moves -= 1;
    this.fx.chain = result.chain;
    this.playTone(Math.max(1, result.chain));
    this.fx.lastText = result.chain > 1
      ? (['', '', 'NICE', 'GREAT', 'AMAZING', 'BLOOM!'][Math.min(5, result.chain)] ?? 'BLOOM!')
      : '';
    this.fx.particles = result.created.length * 12;
    this.next = this.nextPiece();
    this.saveAlbum();
    this.draw();
    if (this.done()) {
      this.clearLevel();
      return;
    }
    if (this.moves <= 0 || !canFit(this.board, this.next)) this.fail();
  }

  capture() {
    return {
      board: cloneBoard(this.board),
      moves: this.moves,
      score: this.score,
      progress: this.progress,
      cleared: this.cleared,
      made: { ...this.made },
      next: [...this.next],
    };
  }

  undo(): void {
    if (!this.snapUndo) return;
    const spent = consumeUse(this.dailyUses(), 'undo');
    if (!spent) {
      this.showAdMessage();
      return;
    }
    write('power', spent);
    const state = this.snapUndo;
    this.board = cloneBoard(state.board);
    this.moves = state.moves;
    this.score = state.score;
    this.progress = state.progress;
    this.cleared = state.cleared;
    this.made = { ...state.made };
    this.next = [...state.next];
    this.snapUndo = null;
    this.draw();
  }

  useTool(kind: 'undo' | 'hammer' | 'shuffle'): void {
    if (kind === 'undo') {
      this.undo();
      return;
    }
    if (kind === 'hammer') {
      if (this.targeting) {
        this.targeting = '';
        this.draw();
        return;
      }
      if (this.dailyUses().hammer <= 0) {
        this.showAdMessage();
        return;
      }
      this.targeting = 'hammer';
      this.draw();
      return;
    }
    const flowers = this.board.flat().filter((cell) => cell?.kind === 'flower' && !cell.vine);
    if (flowers.length < 2) return;
    const spent = consumeUse(this.dailyUses(), 'shuffle');
    if (!spent) {
      this.showAdMessage();
      return;
    }
    write('power', spent);
    this.snapUndo = this.capture();
    this.shuffle();
  }

  showAdMessage(): void {
    void tryRewardedAd('power-up');
    addText(this, 390, 1480, 'Rewarded ads coming later', 20, INK);
  }

  hammerAt(column: number, row: number): void {
    const target = this.board[row]?.[column];
    if (!target) return;
    const spent = consumeUse(this.dailyUses(), 'hammer');
    if (!spent) {
      this.targeting = '';
      this.showAdMessage();
      this.draw();
      return;
    }
    write('power', spent);
    this.snapUndo = this.capture();
    const cell = this.board[row]?.[column];
    if (cell?.kind === 'stone') {
      cell.hp -= 1;
      if (cell.hp <= 0) {
        this.board[row]![column] = null;
        this.cleared += 1;
      }
    } else if (cell?.kind === 'flower') {
      if (cell.vine) {
        cell.vine = false;
        this.cleared += 1;
      } else {
        this.board[row]![column] = null;
      }
    }
    gravity(this.board);
    const result = resolve(this.board, undefined);
    this.score += result.score;
    this.cleared += result.cleared;
    this.recordCreated(result.created);
    this.targeting = '';
    if (this.done()) this.clearLevel();
    else this.draw();
  }

  shuffle(): void {
    const flowers: { row: number; column: number; level: number }[] = [];
    for (let row = 0; row < this.board.length; row += 1) {
      for (let column = 0; column < (this.board[0]?.length ?? 0); column += 1) {
        const cell = this.board[row]![column];
        if (cell?.kind === 'flower' && !cell.vine) flowers.push({ row, column, level: cell.level });
      }
    }
    const shuffled = flowers.map((flower) => flower.level);
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = this.rng.int(index + 1);
      [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
    }
    flowers.forEach((flower, index) => {
      this.board[flower.row]![flower.column] = { kind: 'flower', level: shuffled[index]! };
    });
    gravity(this.board);
    const result = resolve(this.board, undefined);
    this.score += result.score;
    this.cleared += result.cleared;
    this.recordCreated(result.created);
    if (this.done()) this.clearLevel();
    else this.draw();
  }

  clearLevel(): void {
    if (this.mode === 'campaign') {
      const index = this.levelNo - 1;
      const earned = stars(this.moves, levels[index]!.twoStar, levels[index]!.threeStar);
      this.best[index] = Math.max(this.best[index] ?? 0, earned);
      write('progress', this.best);
      track(`mp-level-clear-${this.levelNo}`);
    } else {
      const previous = read<string | null>('lastCompletedDate', null);
      const streak = updateStreak(previous, this.dailyDate, read('streak', 0));
      write('streak', streak);
      write('lastCompletedDate', this.dailyDate);
      write('dailyDone', this.dailyDate);
      const skins = read<string[]>('skins', ['Classic']);
      const streakSkins = [[3, 'Dawn Petal'], [7, 'Night Bloom']] as const;
      for (const [threshold, skin] of streakSkins) {
        if (streak >= threshold && !skins.includes(skin)) {
          skins.push(skin);
          if (!read(`celebrated-${skin}`, false)) {
            this.celebration = `${skin} unlocked!`;
            write(`celebrated-${skin}`, true);
          }
        }
      }
      write('skins', skins);
    }
    this.screen = 'clear';
    this.draw();
  }

  fail(): void {
    this.failReason = this.moves <= 0 ? 'No moves left' : 'Board full';
    if (this.mode === 'campaign') track(`mp-level-fail-${this.levelNo}`);
    this.screen = 'fail';
    this.draw();
  }

  starCount(): number {
    const level = levels[this.levelNo - 1]!;
    return stars(this.moves, level.twoStar, level.threeStar);
  }
}
