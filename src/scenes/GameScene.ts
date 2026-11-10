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
import { clearPrefixedStorage, read, write } from '../systems/storage.ts';
import { track } from '../systems/analytics.ts';
import {
  BOARD, addBoardFrame, addButton, addFlower, addIconButton, addText, cellCenter,
  drawStone, drawVine, goalIconKey, goalSentence, paintBackground, MUTED, INK,
} from '../objects/draw.ts';
import { ART, lazyArt, preloadArt } from '../objects/assets.ts';
import { resolveSteps } from '../systems/board.ts';
import { MAP_NODES, MAP_SIZE } from '../config/mapNodes.ts';

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
  tutorialActive = false;
  tutorialStep = 0;
  tutorialHint = '';
  mapScroll = 0;

  preload(): void { preloadArt(this); }

  constructor() {
    super('main');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#fff6fb');
    this.wireHook();
    const todayKey = today();
    if (read<string | null>('first', null) === null) write('first', todayKey);
    else if (read('first', todayKey) !== todayKey && read('lastReturn', '') !== todayKey) {
      track('mp-continue');
      write('lastReturn', todayKey);
    }
    this.input.on('pointerdown', () => this.unlockAudio());
    this.scale.on('resize', () => {
      if (!this.busy) this.draw();
    });
    if (!read('tutorialDone', false)) this.startLevel(1, true, true);
    else this.draw();
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
          clearPrefixedStorage();
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

  startLevel(levelNumber: number, force = false, tutorial = false): void {
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
    const keepTeaching = tutorial || (!read('tutorialDone', false) && levelNumber <= 3);
    this.tutorialActive = keepTeaching && levelNumber <= 3;
    this.tutorialStep = this.tutorialActive ? 1 : 0;
    this.tutorialHint = '';
    this.fx = { lastText: '', chain: 0, particles: 0, lastSound: '' };
    this.rng = new RNG(levelNumber * 100003);
    this.next = this.nextPiece();
    if (this.tutorialActive) {
      if (levelNumber === 1) {
        this.board = emptyBoard();
        this.board[8]![2] = { kind: 'flower', level: 2 };
        this.board[8]![4] = { kind: 'flower', level: 2 };
        this.next = [1];
        this.setTutorialHint('Tap a column to drop the flower.');
      }
      if (levelNumber === 2) {
        this.board=emptyBoard(); this.board[8]![0]={kind:'flower',level:3}; this.board[8]![1]={kind:'flower',level:3};
        this.board[8]![3]={kind:'flower',level:2}; this.board[8]![4]={kind:'flower',level:2}; this.next=[2];
        this.setTutorialHint('Merges can chain! Drop here.');
      }
      if (levelNumber === 3) {
        this.board=emptyBoard(); this.board[8]![3]={kind:'stone',hp:1};
        this.board[7]![2]={kind:'flower',level:1,vine:true};
        this.board[8]![1]={kind:'flower',level:1}; this.board[8]![2]={kind:'flower',level:1}; this.next=[1];
        this.setTutorialHint('A merge next to a stone cracks it.');
      }
    }
    this.screen = 'game';
    this.saveAlbum();
    track(`mp-level-start-${levelNumber}`);
    this.draw();
  }

  setTutorialHint(hint: string): void {
    this.tutorialHint=hint;
    track(`mp-tutorial-step-${this.tutorialStep}`);
  }
  skipTutorial(): void {
    if (!this.tutorialActive) return;
    track('mp-tutorial-skip'); this.tutorialActive=false; this.tutorialStep=0;
    write('tutorialDone',true); this.draw();
  }
  tutorialContinue(): void {
    if (!this.tutorialActive || this.busy) return;
    if (this.levelNo===1 && this.tutorialStep===1) { this.tutorialStep=2; this.next=[2]; this.setTutorialHint('Match 3 same flowers to merge them.'); }
    else if (this.levelNo===3 && this.tutorialStep===1) { this.tutorialStep=2; this.setTutorialHint('Vines unwrap when a merge happens beside them.'); }
    else if (this.levelNo===3 && this.tutorialStep>=2 && this.tutorialStep<5) {
      this.tutorialStep++;
      this.setTutorialHint(['','', 'Undo takes back your last drop.','Hammer clears one tile.','Shuffle rearranges flowers.'][this.tutorialStep]!);
    } else { this.tutorialActive=false; write('tutorialDone',true); this.draw(); }
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
    if(this.screen==='map') lazyArt(this,ART.map);
    if(this.screen==='clear') lazyArt(this,ART.clearPose);
    if(this.screen==='fail') lazyArt(this,ART.failPose);
    if(this.screen==='daily') lazyArt(this,ART.dailyPose);
    if(this.screen==='album') lazyArt(this,ART.albumPose);

    if (this.screen === 'menu') this.drawMenu();
    else if (this.screen === 'map') this.drawMap();
    else if (this.screen === 'goal') this.drawGoal();
    else if (this.screen === 'daily') this.drawDaily();
    else if (this.screen === 'game') this.drawGame();
    else if (this.screen === 'pause') this.drawPause();
    else if (this.screen === 'clear' || this.screen === 'fail') this.drawResult();
    else if (this.screen === 'album') this.drawAlbum();
    if(this.tutorialActive && this.screen==='game') this.drawTutorial();
  }

  drawTutorial(): void {
    const column = this.levelNo === 1 ? (this.tutorialStep === 1 ? 1 : 3)
      : this.levelNo === 2 ? 2
        : this.tutorialStep === 1 ? 0 : -1;
    const highlight = column >= 0 ? this.buttons[`column${column}`] : (
      this.tutorialStep === 3 ? this.buttons.undo
        : this.tutorialStep === 4 ? this.buttons.hammer
          : this.tutorialStep === 5 ? this.buttons.shuffle : undefined
    );
    const shade = this.add.graphics().setDepth(90);
    shade.fillStyle(0x241c2d, 0.48);
    if (highlight) {
      const hx = highlight.x, hy = highlight.y, hw = highlight.w, hh = highlight.h;
      shade.fillRect(0, 0, 780, hy);
      shade.fillRect(0, hy + hh, 780, 1688 - hy - hh);
      shade.fillRect(0, hy, hx, hh);
      shade.fillRect(hx + hw, hy, 780 - hx - hw, hh);
      const ring = this.add.graphics().setDepth(92);
      ring.lineStyle(8, 0xffd45e, 1);
      ring.strokeRoundedRect(hx + 6, hy + 6, hw - 12, hh - 12, 22);
      const handX = hx + hw / 2 + 36;
      const handY = Math.min(hy + hh - 24, 1500);
      const hand = this.add.image(handX, handY, ART.hand).setDisplaySize(96, 96).setDepth(93);
      this.tweens.add({ targets: hand, y: handY + 18, duration: 450, yoyo: true, repeat: -1 });
    } else {
      shade.fillRect(0, 0, 780, 1688);
    }
    const banner = this.add.graphics().setDepth(94);
    banner.fillStyle(0xffffff, 0.95);
    banner.fillRoundedRect(70, 470, 640, 80, 28);
    banner.lineStyle(4, 0xffd45e, 1);
    banner.strokeRoundedRect(70, 470, 640, 80, 28);
    addText(this, 390, 510, this.tutorialHint, 24, INK, { wordWrap: { width: 600 } }).setDepth(95);
    const skip = this.add.container(650, 92).setDepth(96);
    const skipBg = this.add.graphics();
    skipBg.fillStyle(0xffd45e, 1);
    skipBg.fillRoundedRect(-80, -32, 160, 64, 22);
    skip.add(skipBg);
    skip.add(addText(this, 0, 0, 'SKIP', 22, INK));
    this.buttons.tutorialSkip = { x: 570, y: 60, w: 160, h: 64 };
    this.add.zone(570, 60, 160, 64).setOrigin(0).setDepth(97)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 160, 64), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => this.skipTutorial());
    if (this.levelNo === 3 && this.tutorialStep >= 2) {
      this.add.zone(0, 180, 780, 1500).setOrigin(0).setDepth(94)
        .setInteractive(new Phaser.Geom.Rectangle(0, 0, 780, 1500), Phaser.Geom.Rectangle.Contains)
        .on('pointerdown', () => this.tutorialContinue());
    }
  }

  drawMenu(): void {
    if (this.textures.exists(ART.logo)) this.add.image(390, 420, ART.logo).setDisplaySize(700, 688);
    this.button('PLAY', 390, 1000, 420, 100, () => this.goto('map'), 'play');
    this.button('DAILY CHALLENGE', 390, 1130, 420, 100, () => this.goto('daily'), 'daily', '#75c9f5');
    this.button('GARDEN / ALBUM', 390, 1260, 420, 100, () => this.goto('album'), 'album', '#b993f5');
    this.button('HOW TO PLAY', 390, 1410, 280, 82, () => this.startLevel(1,true,true), 'howto', '#70cda9');
    this.button(this.soundEnabled ? 'SOUND ON' : 'SOUND OFF', 120, 1410, 170, 82, () => {
      this.soundEnabled = !this.soundEnabled;
      write('sound', this.soundEnabled);
      this.draw();
    }, 'mute', '#ffd1a8');
    addText(this, 390, 1560, 'Privacy', 18, MUTED)
      .setInteractive(new Phaser.Geom.Rectangle(-80, -20, 160, 40), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => window.open('./privacy.html', '_self'));
    this.buttons.privacy = { x: 310, y: 1540, w: 160, h: 40 };
  }

  drawMap(): void {
    if (!this.textures.exists(ART.map)) {
      lazyArt(this, ART.map, () => { if (this.screen === 'map') this.draw(); });
      addText(this, 390, 840, 'Loading the garden…', 26, MUTED);
      this.button('BACK', 390, 1540, 300, 88, () => this.goto('menu'), 'back', '#ffd1a8');
      return;
    }
    const viewTop = 120;
    const viewH = 1320;
    const maxScroll = Math.max(0, MAP_SIZE.height - viewH + 80);
    this.mapScroll = Math.max(0, Math.min(maxScroll, this.mapScroll));
    const world = this.add.container(0, viewTop - this.mapScroll);
    const mapImg = this.add.image(390, MAP_SIZE.height / 2, ART.map).setDisplaySize(MAP_SIZE.width, MAP_SIZE.height);
    world.add(mapImg);
    const nextLevel = Array.from({ length: 30 }, (_, i) => i + 1).find((n) => unlocked(this.best, n) && (this.best[n - 1] ?? 0) === 0) ?? 1;
    for (let index = 0; index < 30; index += 1) {
      const node = MAP_NODES[index]!;
      const x = node.x * MAP_SIZE.width;
      const y = node.y * MAP_SIZE.height;
      const level = index + 1;
      const open = unlocked(this.best, level);
      const boss = [5, 10, 15, 20, 25, 30].includes(level);
      const starsEarned = this.best[index] ?? 0;
      const r = boss ? 44 : 34;
      const g = this.add.graphics();
      g.fillStyle(open ? (boss ? 0xff8fab : 0xfff8f0) : 0xd9d0d6, open ? 1 : 0.75);
      g.fillCircle(x, y, r);
      g.lineStyle(boss ? 7 : 5, boss ? 0xe8bf59 : 0xffffff, 1);
      g.strokeCircle(x, y, r);
      world.add(g);
      if (boss) {
        const crown = this.add.image(x, y - r - 8, ART.star).setDisplaySize(28, 28);
        world.add(crown);
      }
      const label = this.add.text(x, y - (starsEarned || !open ? 8 : 0), String(level), {
        fontFamily: '-apple-system, "SF Pro Rounded", system-ui, sans-serif',
        fontSize: boss ? '22px' : '20px', fontStyle: 'bold', color: '#59465b',
      }).setOrigin(0.5);
      world.add(label);
      if (open) {
        for (let s = 0; s < 3; s += 1) {
          const key = s < starsEarned ? ART.star : ART.emptyStar;
          if (this.textures.exists(key)) {
            world.add(this.add.image(x + (s - 1) * 18, y + 18, key).setDisplaySize(16, 16));
          }
        }
      }
      if (level === nextLevel && this.textures.exists('flower-1')) {
        const hop = this.add.image(x, y - r - 28, 'flower-1').setDisplaySize(56, 56);
        world.add(hop);
        this.tweens.add({ targets: hop, y: y - r - 42, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      const zone = this.add.zone(x, y, r * 2.2, r * 2.2).setInteractive();
      world.add(zone);
      if (open) zone.on('pointerdown', () => { this.levelNo = level; this.goto('goal'); });
      this.buttons[`map${level}`] = { x: x - r, y: viewTop - this.mapScroll + y - r, w: r * 2, h: r * 2 };
    }
    const maskG = this.add.graphics().setVisible(false);
    maskG.fillRect(0, viewTop, 780, viewH);
    world.setMask(maskG.createGeometryMask());
    mapImg.setInteractive();
    let lastY: number | null = null;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > viewTop && pointer.y < viewTop + viewH) lastY = pointer.y;
    });
    this.input.on('pointerup', () => { lastY = null; });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (lastY === null || !pointer.isDown) return;
      this.mapScroll = Math.max(0, Math.min(maxScroll, this.mapScroll - (pointer.y - lastY)));
      lastY = pointer.y;
      world.y = viewTop - this.mapScroll;
    });
    this.button('DAILY', 150, 1548, 200, 86, () => this.goto('daily'), 'daily', '#75c9f5');
    this.button('BACK', 390, 1548, 200, 86, () => this.goto('menu'), 'back', '#ffd1a8');
    this.button('ALBUM', 630, 1548, 200, 86, () => this.goto('album'), 'album', '#b993f5');
  }

  drawGoal(): void {
    const level = makeLevel(this.levelNo);
    addText(this, 390, 200, `LEVEL ${level.n}${level.boss ? '  •  BOSS' : ''}`, 38);
    let y = 360;
    for (const goal of level.goals) {
      const icon = goalIconKey(goal.kind);
      if (this.textures.exists(icon)) this.add.image(200, y, icon).setDisplaySize(96, 96);
      addText(this, 470, y, goalSentence(goal), 26, INK, { wordWrap: { width: 420 } });
      const have = goal.kind === 'make' ? (this.made[goal.level ?? 3] ?? 0)
        : goal.kind === 'clear' ? this.cleared : this.score;
      addText(this, 470, y + 36, `${have} / ${goal.target}`, 18, MUTED);
      y += 140;
    }
    addText(this, 390, y + 20, `${level.moves} moves   ·   3★ with ${level.threeStar} left   ·   2★ with ${level.twoStar} left`, 20, MUTED, { wordWrap: { width: 640 } });
    this.button('PLAY', 390, y + 160, 400, 110, () => this.startLevel(this.levelNo, true, this.levelNo <= 3 && !read('tutorialDone', false)), 'goalPlay');
    this.button('BACK', 390, y + 300, 300, 88, () => this.goto('map'), 'back', '#ffd1a8');
  }

  drawDaily(): void {
    const goal = dailyGoal(today());
    this.dailyDate = today();
    if (this.textures.exists(ART.dailyPose)) this.add.image(390, 360, ART.dailyPose).setDisplaySize(420, 300);
    else lazyArt(this, ART.dailyPose, () => { if (this.screen === 'daily') this.draw(); });
    addText(this, 390, 560, 'DAILY CHALLENGE', 34);
    const icon = goalIconKey(goal.kind === 'combined' ? 'make' : goal.kind);
    if (this.textures.exists(icon)) this.add.image(200, 680, icon).setDisplaySize(88, 88);
    addText(this, 470, 668, this.previewDailyGoal(goal), 24, INK, { wordWrap: { width: 420 } });
    addText(this, 390, 780, `Streak: ${read<number>('streak', 0)} day${read<number>('streak', 0) === 1 ? '' : 's'}`, 24, MUTED);
    if (read('dailyDone', '') === today()) addText(this, 390, 830, 'Completed today', 22, '#70cda9');
    this.button('PLAY TODAY', 390, 1000, 420, 110, () => this.startDaily(), 'play');
    this.button('BACK', 390, 1140, 300, 88, () => this.goto('menu'), 'back', '#ffd1a8');
  }

  previewDailyGoal(goal: ReturnType<typeof dailyGoal>): string {
    if (goal.kind === 'make') return `Make ${goal.target} Lv.${goal.level} flowers`;
    if (goal.kind === 'clear') return `Clear ${goal.target} obstacles`;
    if (goal.kind === 'score') return `Score ${goal.target} points`;
    return `Make ${goal.target} Lv.${goal.level} flowers AND clear ${goal.extra?.target ?? 0} obstacles`;
  }

  drawGoalBar(y: number): void {
    const goals = this.mode === 'campaign' ? makeLevel(this.levelNo).goals : (() => {
      const daily = dailyGoal(this.dailyDate);
      return daily.kind === 'combined'
        ? [{ kind: 'make' as const, target: daily.target, level: daily.level }, { kind: 'clear' as const, target: daily.extra?.target ?? 0 }]
        : [{ kind: daily.kind, target: daily.target, level: daily.level }];
    })();
    const width = 700 / Math.max(1, goals.length);
    goals.forEach((goal, index) => {
      const x = 40 + width * index + width / 2;
      const icon = goalIconKey(goal.kind as 'make' | 'clear' | 'score');
      if (this.textures.exists(icon)) this.add.image(x - width / 2 + 36, y, icon).setDisplaySize(52, 52);
      const have = goal.kind === 'make' ? (this.made[goal.level ?? 3] ?? 0)
        : goal.kind === 'clear' ? this.cleared : this.score;
      addText(this, x + 20, y - 10, goalSentence(goal), 18, INK, { wordWrap: { width: width - 70 } });
      addText(this, x + 20, y + 16, `${have} / ${goal.target}`, 16, MUTED);
    });
  }

  drawGame(): void {
    addText(this, 390, 118, this.mode === 'daily' ? 'DAILY' : `LEVEL ${this.levelNo}`, 24, MUTED);
    addText(this, 390, 168, `Moves  ${this.moves}      Score  ${this.score}`, 26);
    this.drawGoalBar(210);
    addText(this, 390, 330, 'NEXT', 16, MUTED);
    addFlower(this, this.next[1] ? 350 : 390, 400, this.next[0] ?? 1, 36, this.skin);
    if (this.next[1]) addFlower(this, 430, 400, this.next[1], 30, this.skin);

    const { x, y, cell, columns, rows } = BOARD;
    addBoardFrame(this);
    const well = this.add.graphics();
    well.fillStyle(0xffffff, 0.82);
    well.fillRoundedRect(x - 6, y - 6, cell * columns + 12, cell * rows + 12, 24);

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
    addIconButton(this, ART.undo, 160, 1568, 92, () => this.undo(), this.buttons, 'undo', uses.undo > 0 ? `${uses.undo} left` : 'soon');
    addIconButton(this, ART.hammer, 390, 1568, 92, () => this.useTool('hammer'), this.buttons, 'hammer', uses.hammer > 0 ? `${uses.hammer} left` : 'soon');
    addIconButton(this, ART.shuffle, 620, 1568, 92, () => this.useTool('shuffle'), this.buttons, 'shuffle', uses.shuffle > 0 ? `${uses.shuffle} left` : 'soon');
    addIconButton(this, ART.pause, 720, 118, 76, () => this.goto('pause'), this.buttons, 'pause');
    addIconButton(this, this.soundEnabled ? ART.sound : ART.muted, 60, 118, 76, () => {
      this.soundEnabled = !this.soundEnabled;
      write('sound', this.soundEnabled);
      this.draw();
    }, this.buttons, 'mute');

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
    if (this.mode === 'campaign') {
      this.button('HOW TO PLAY', 390, 940, 400, 100, () => this.startLevel(1, true, true), 'howto', '#70cda9');
    }
  }

  drawResult(): void {
    const success = this.screen === 'clear';
    const pose = success ? ART.clearPose : ART.failPose;
    if (this.textures.exists(pose)) this.add.image(390, 420, pose).setDisplaySize(520, 360);
    else lazyArt(this, pose, () => { if (this.screen === 'clear' || this.screen === 'fail') this.draw(); });
    addText(this, 390, 200, success ? 'A lovely bloom!' : this.failReason, 36);
    if (success) {
      if (this.mode !== 'daily') {
        addText(this, 390, 640, '★'.repeat(this.starCount()) || '★', 56, '#e8bf59');
      } else {
        addText(this, 390, 640, 'Daily complete!', 28, MUTED);
      }
      addText(this, 390, 710, `Score ${this.score}`, 28, MUTED);
    } else {
      addText(this, 390, 680, 'Try a different path and bloom again.', 24, MUTED, { wordWrap: { width: 620 } });
    }
    if (success && this.celebration) {
      addText(this, 390, 760, this.celebration, 28, '#ff8fab');
      this.burstParticles(22, 390, 600);
    }
    if (success) {
      this.button(this.mode === 'daily' ? 'MENU' : 'NEXT', 390, 980, 400, 110, () => {
        if (this.mode === 'daily') this.goto('menu');
        else if (this.levelNo < 30) this.startLevel(this.levelNo + 1);
        else this.goto('map');
      }, 'next');
      this.button('MAP', 390, 1120, 300, 88, () => this.goto(this.mode === 'daily' ? 'menu' : 'map'), 'map', '#ffd1a8');
    } else {
      this.button('RETRY', 390, 980, 400, 110, () => {
        if (this.mode === 'daily') this.startDaily(this.dailyDate);
        else this.startLevel(this.levelNo);
      }, 'retry');
      this.button('MAP', 390, 1120, 300, 88, () => this.goto(this.mode === 'daily' ? 'menu' : 'map'), 'map', '#ffd1a8');
    }
  }

  drawAlbum(): void {
    const names = ['Blush Bud', 'Peach Bell', 'Butter Bloom', 'Mint Daisy', 'Sky Tulip', 'Lilac Rose', 'Coral Peony', 'Golden Crown'];
    if (this.textures.exists(ART.albumPose)) this.add.image(390, 250, ART.albumPose).setDisplaySize(360, 260);
    else lazyArt(this, ART.albumPose, () => { if (this.screen === 'album') this.draw(); });
    addText(this, 390, 80, 'GARDEN ALBUM', 32);
    for (let index = 0; index < 8; index += 1) {
      const x = 140 + (index % 4) * 170;
      const y = 560 + Math.floor(index / 4) * 280;
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
      addText(this, 390, 1180, 'Garden complete!', 22, '#70cda9');
    }
    this.button(`Skin: ${this.skin}`, 390, 1280, 400, 96, () => {
      const skins = read<string[]>('skins', ['Classic']);
      const current = Math.max(0, skins.indexOf(this.skin));
      this.skin = skins[(current + 1) % skins.length] ?? 'Classic';
      write('skin', this.skin);
      this.draw();
    }, 'skin', '#d7c4ff');
    this.button('BACK', 390, 1420, 300, 88, () => this.goto('menu'), 'back', '#ffd1a8');
  }

  goalText(level?: ReturnType<typeof makeLevel>): string {
    const goals = level?.goals ?? (this.mode === 'campaign' ? makeLevel(this.levelNo).goals : null);
    if (goals) {
      return goals.map((goal) => {
        const have = goal.kind === 'make' ? (this.made[goal.level ?? 3] ?? 0)
          : goal.kind === 'clear' ? this.cleared : this.score;
        return `${goalSentence(goal)} (${have}/${goal.target})`;
      }).join('  ');
    }
    const daily = dailyGoal(this.dailyDate);
    if (daily.kind === 'combined') {
      return `${goalSentence({ kind: 'make', target: daily.target, level: daily.level })} (${this.made[daily.level] ?? 0}/${daily.target})  ${goalSentence({ kind: 'clear', target: daily.extra?.target ?? 0 })} (${this.cleared}/${daily.extra?.target ?? 0})`;
    }
    const have = daily.kind === 'make' ? (this.made[daily.level] ?? 0) : daily.kind === 'clear' ? this.cleared : this.score;
    return `${this.previewDailyGoal(daily)} (${have}/${daily.target})`;
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
    if (this.tutorialActive && this.levelNo === 1 && this.tutorialStep === 1 && column !== 1) { this.cameras.main.shake(100,0.004); return; }
    if (this.tutorialActive && this.levelNo === 1 && this.tutorialStep === 2 && column !== 3) { this.cameras.main.shake(100,0.004); return; }
    if (this.tutorialActive && this.levelNo === 2 && this.tutorialStep === 1 && column !== 2) { this.cameras.main.shake(100,0.004); return; }
    if (this.tutorialActive && this.levelNo === 3 && this.tutorialStep === 1 && column !== 0) { this.cameras.main.shake(100,0.004); return; }
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
    this.moves -= 1;
    const steps = resolveSteps(this.board, this.id - dropped.length);
    const finish = (): void => {
      this.score += steps.reduce((n,s)=>n+s.score,0);
      this.cleared += steps.reduce((n,s)=>n+s.cleared,0);
      this.recordCreated(steps.flatMap(s=>s.created));
      this.fx.chain=steps.length ? steps[steps.length-1]!.chain : 0;
      this.fx.lastText=steps.length>1 ? (['','', 'NICE','GREAT','AMAZING','BLOOM!'][Math.min(5,steps.length)] ?? 'BLOOM!') : '';
      this.next = this.nextPiece(); this.saveAlbum(); this.busy=false;
      if (this.tutorialActive) {
        if (this.levelNo===1 && this.tutorialStep===1) this.tutorialContinue();
        else if (this.levelNo===1 && this.tutorialStep===2) this.tutorialActive=false;
        else if (this.levelNo===2) this.tutorialActive=false;
        else if (this.levelNo===3 && this.tutorialStep===1) this.tutorialContinue();
      }
      this.draw();
      if (this.done()) { this.clearLevel(); return; }
      if (this.moves <= 0 || !canFit(this.board,this.next)) this.fail();
    };
    if (steps.length && !this.isInstant()) {
      this.busy = true;
      const animateStep = (i: number): void => {
        const step = steps[i];
        if (!step) { finish(); return; }
        const dest = cellCenter(step.target[1], step.target[0]);
        const movers = step.cells.map(([row, col]) => {
          const from = cellCenter(col, row);
          const img = addFlower(this, from.x, from.y, 1, 37, this.skin).setDepth(30);
          this.tweens.add({
            targets: img, x: dest.x, y: dest.y, scaleX: 0.2, scaleY: 0.2, duration: 220, ease: 'Cubic.In',
            onComplete: () => img.destroy(),
          });
          return img;
        });
        this.playTone(step.chain);
        const label = step.chain > 1 ? (['', '', 'NICE', 'GREAT', 'AMAZING', 'BLOOM!'][Math.min(5, step.chain)] ?? 'BLOOM!') : '';
        if (label) {
          const text = addText(this, dest.x, dest.y - 30, label, 42, '#ff8fab').setDepth(40);
          text.setStroke('#ffffff', 10);
          this.tweens.add({ targets: text, y: dest.y - 80, alpha: 0, duration: 700, ease: 'Cubic.Out', onComplete: () => text.destroy() });
        }
        this.burstParticles(18, dest.x, dest.y);
        this.time.delayedCall(230, () => {
          movers.forEach((img) => img.destroy());
          this.board = cloneBoard(step.board);
          this.fx.chain = step.chain;
          this.fx.lastText = label;
          this.draw();
          const grown = step.created[0] ?? 1;
          const pop = addFlower(this, dest.x, dest.y, grown, 37, this.skin).setDepth(31);
          pop.setScale(0.2);
          this.tweens.add({
            targets: pop, scaleX: 1.22, scaleY: 0.82, duration: 90, yoyo: true, ease: 'Back.Out',
            onComplete: () => pop.destroy(),
          });
          this.time.delayedCall(280, () => animateStep(i + 1));
        });
      };
      animateStep(0);
      return;
    }

    for(const step of steps){this.score+=step.score;this.cleared+=step.cleared;this.recordCreated(step.created);this.playTone(step.chain);}
    this.fx.chain=steps.length?steps[steps.length-1]!.chain:0;
    this.fx.lastText=steps.length>1?(['','', 'NICE','GREAT','AMAZING','BLOOM!'][Math.min(5,steps.length)]??'BLOOM!'):'';
    this.fx.particles=steps.length*12;
    this.next = this.nextPiece();
    this.saveAlbum();
    if (this.tutorialActive) {
      if (this.levelNo===1 && this.tutorialStep===1) this.tutorialContinue();
      else if (this.levelNo===1 && this.tutorialStep===2) this.tutorialActive=false;
      else if (this.levelNo===2) this.tutorialActive=false;
      else if (this.levelNo===3 && this.tutorialStep===1) this.tutorialContinue();
    }
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
