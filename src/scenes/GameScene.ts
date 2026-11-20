import Phaser from 'phaser';
import { levels, makeLevel } from '../config/levels.ts';
import {
  canFit, cloneBoard, emptyBoard, gravity, landingRows, place, resolve, resolveSteps, shuffleBoard, type Grid,
} from '../systems/board.ts';
import { pieceForDaily, pieceForLevel, RNG } from '../systems/pieces.ts';
import { movesToThreeStars, nextStarSkin, STAR_SKINS, stars, totalStars, unlocked } from '../systems/progress.ts';
import { dailyGoal, updateStreak } from '../systems/daily.ts';
import { discoverFlowers, hasRainbowGarden } from '../systems/album.ts';
import {
  consumeUse, dailyUses as getDailyUses, lockLabel, toolUnlocked, reachedLevel, type PowerUpKind,
} from '../systems/powerups.ts';
import {
  applyGoalEvent, cloneGoalState, dailyGoalSpecs, goalDone, goalProgress, goalsDone, newGoalState,
  type GoalEvent, type GoalSpec, type GoalState,
} from '../systems/goals.ts';
import {
  completes, firstValidStep, isWrongColumn, scriptForLevel, stepsForLevel, type TutorialEvent, type TutorialStep,
} from '../systems/tutorial.ts';
import { clearPrefixedStorage, read, write } from '../systems/storage.ts';
import { track } from '../systems/analytics.ts';
import {
  BOARD, addBoardFrame, addBubble, addButton, addFlower, addIcon, addIconButton, addPill, addText, cellCenter,
  drawChest, drawGroundShadow, drawLock, drawStone, drawVine, goalIconKey, goalSentence, paintBackground, MUTED, INK,
} from '../objects/draw.ts';
import { ART, lazyArt, preloadArt } from '../objects/assets.ts';
import { MAP_GIFTS, MAP_NODES, MAP_SIZE } from '../config/mapNodes.ts';

export async function tryRewardedAd(_kind: string): Promise<boolean> {
  return false;
}

type Screen = 'boot' | 'menu' | 'map' | 'goal' | 'game' | 'pause' | 'clear' | 'fail' | 'daily' | 'album';
type Mode = 'campaign' | 'daily';
type Rect = { x: number; y: number; w: number; h: number };

const today = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const QUEUE_CAP = 4;
const VIEW_H = 1688;
const CHEERS = [
  'Look at that bloom!', 'You are on a roll!', 'My garden is so happy!', 'Petal power!', 'Sweet! Let us keep growing!',
];
const BOSS_LEVELS = [5, 10, 15, 20, 25, 30];
const TOOLS: Array<{ kind: PowerUpKind; art: string; x: number }> = [
  { kind: 'undo', art: ART.undo, x: 160 },
  { kind: 'hammer', art: ART.hammer, x: 390 },
  { kind: 'shuffle', art: ART.shuffle, x: 620 },
];

export class GameScene extends Phaser.Scene {
  screen: Screen = 'menu';
  mode: Mode = 'campaign';
  levelNo = 1;
  board: Grid = emptyBoard();
  moves = 0;
  gs: GoalState = newGoalState();
  next: number[] = [1];
  rng = new RNG(Date.now());
  id = 1;
  best = read<number[]>('progress', Array(30).fill(0));
  album = read<boolean[]>('album', Array(8).fill(false));
  albumAtStart: boolean[] = Array(8).fill(false);
  skin = read('skin', 'Classic');
  soundEnabled = read('sound', true);
  audioContext: AudioContext | null = null;
  buttons: Record<string, Rect> = {};
  snapUndo: ReturnType<GameScene['capture']> | null = null;
  dailyDate = today();
  fx = { lastText: '', chain: 0, particles: 0, lastSound: '' };
  targeting = '';
  failReason = 'Board full';
  celebration = '';
  busy = false;
  inputQueue: number[] = [];
  lastDropColumn = -1;
  scriptedQueue: number[][] = [];
  tutorialActive = false;
  tutorialSteps: TutorialStep[] = [];
  tutorialIdx = 0;
  tutorialReplay = false;
  tutorialView = { highlight: false, gotIt: false };
  freeTool = false;
  mapScroll = 0;
  mapAuto = true;
  mapWorld: Phaser.GameObjects.Container | null = null;
  resultInfo = { newFlowers: [] as number[], skinLine: '' };

  get score(): number { return this.gs.score; }

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
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.screen !== 'map' || !this.mapWorld || !pointer.isDown) return;
      this.scrollMap(this.mapScroll - (pointer.y - pointer.prevPosition.y));
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.screen === 'map') this.scrollMap(this.mapScroll + dy);
    });
    this.scale.on('resize', () => {
      if (!this.busy) this.draw();
    });
    if (read('tutorialSeen', 0) < 1) this.startLevel(1, true, true);
    else this.draw();
  }

  wireHook(): void {
    const self = this;
    (window as Window & { __MERGEBLOOM__?: unknown }).__MERGEBLOOM__ = {
      getState: () => self.snapshot(),
      qa: {
        instant: location.search.includes('qa=1'),
        goto: (screen: Screen) => self.goto(screen),
        startLevel: (level: number, opts: { tutorial?: boolean; seed?: number } = {}) =>
          self.startLevel(level, true, opts.tutorial ?? false, opts.seed),
        showGoal: (level: number) => { self.levelNo = level; self.goto('goal'); },
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
        simulateDrop: (column: number) => self.simulateDrop(column),
        tickInstant: () => {
          self.tweens.killAll();
        },
        useUndo: () => self.undo(),
        useHammerAt: (column: number, row: number) => self.hammerAt(column, row),
        useShuffle: () => self.useTool('shuffle'),
        skipTutorial: () => self.skipTutorial(),
        setBest: (best: number[]) => { self.best = best; write('progress', best); self.draw(); },
        resetUses: () => { write('power', null); self.draw(); },
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

  goalSpecs(): GoalSpec[] {
    return this.mode === 'campaign' ? makeLevel(this.levelNo).goals : dailyGoalSpecs(dailyGoal(this.dailyDate));
  }

  snapshot() {
    const { x, y, cell, columns, rows } = BOARD;
    const specs = this.goalSpecs();
    const first = specs[0]!;
    const step = this.currentStep();
    const uses = this.dailyUses();
    return {
      scene: this.screen,
      mode: this.mode,
      level: this.mode === 'daily' ? null : this.levelNo,
      moves: this.moves,
      score: this.score,
      goal: {
        type: first.kind,
        text: this.goalText(),
        progress: goalProgress(first, this.gs),
        target: first.target,
        done: this.done(),
      },
      goals: specs.map((goal) => ({ ...goal, progress: goalProgress(goal, this.gs), done: goalDone(goal, this.gs) })),
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
        undo: uses.undo,
        hammer: uses.hammer,
        shuffle: uses.shuffle,
        adHookDisabled: true as const,
        unlocked: {
          undo: toolUnlocked('undo', this.best), hammer: toolUnlocked('hammer', this.best), shuffle: toolUnlocked('shuffle', this.best),
        },
      },
      tutorial: {
        active: this.tutorialActive,
        stepId: step?.id ?? null,
        stepIndex: this.tutorialIdx,
        stepCount: this.tutorialSteps.length,
        target: step?.target ?? null,
        hasHighlight: this.tutorialView.highlight,
        hasGotIt: this.tutorialView.gotIt,
        valid: !this.tutorialActive || (step !== undefined && (this.tutorialView.highlight || this.tutorialView.gotIt)),
      },
      inputQueue: this.inputQueue.length,
      busy: this.busy,
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

  /** Instant mode is driven ONLY by the QA hook flag (initialised from ?qa=1, which QA can flip off). */
  isInstant(): boolean {
    const hook = (window as Window & { __MERGEBLOOM__?: { qa?: { instant?: boolean } } }).__MERGEBLOOM__;
    return Boolean(hook?.qa?.instant);
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
    if (screen === 'goal') this.gs = newGoalState();
    if (screen === 'map') this.mapAuto = true;
    if (screen === 'menu') this.tutorialReplay = false;
    if (screen !== 'game') this.inputQueue = [];
    this.screen = screen;
    this.draw();
  }

  nextPiece(): number[] {
    const scripted = this.scriptedQueue.shift();
    if (scripted) return [...scripted];
    return this.mode === 'daily' ? pieceForDaily(this.rng) : pieceForLevel(this.rng, this.levelNo);
  }

  startLevel(levelNumber: number, force = false, tutorial?: boolean, seed?: number): void {
    if (!force && !unlocked(this.best, levelNumber)) return;
    this.busy = false;
    this.inputQueue = [];
    this.freeTool = false;
    this.mode = 'campaign';
    this.celebration = '';
    this.levelNo = levelNumber;
    const level = makeLevel(levelNumber);
    this.board = cloneBoard(level.board);
    this.albumAtStart = [...this.album];
    this.moves = level.moves;
    this.gs = newGoalState();
    this.targeting = '';
    this.snapUndo = null;
    if (tutorial === true && levelNumber === 1) this.tutorialReplay = true;
    const wantTutorial = tutorial ?? (this.tutorialReplay || levelNumber > read('tutorialSeen', 0));
    this.tutorialSteps = wantTutorial ? stepsForLevel(levelNumber) : [];
    this.tutorialActive = this.tutorialSteps.length > 0;
    this.tutorialIdx = 0;
    this.tutorialView = { highlight: false, gotIt: false };
    this.fx = { lastText: '', chain: 0, particles: 0, lastSound: '' };
    this.rng = new RNG(seed ?? levelNumber * 100003);
    const script = this.tutorialActive ? scriptForLevel(levelNumber) : null;
    if (script?.scriptedBoard) this.board = cloneBoard(script.scriptedBoard);
    this.scriptedQueue = script?.scriptedQueue ? script.scriptedQueue.map((p) => [...p]) : [];
    this.next = this.nextPiece();
    this.album = discoverFlowers(this.album, this.board.flat()
      .flatMap((cell) => cell?.kind === 'flower' ? [cell.level] : []));
    this.screen = 'game';
    this.saveAlbum();
    track(`mp-level-start-${levelNumber}`);
    this.draw();
  }

  // ---- tutorial ----------------------------------------------------------
  currentStep(): TutorialStep | undefined {
    return this.tutorialActive ? this.tutorialSteps[this.tutorialIdx] : undefined;
  }

  tutorialCtx() {
    return {
      board: this.board,
      next: this.next,
      canUndo: this.snapUndo !== null,
      toolUnlocked: (tool: PowerUpKind) => toolUnlocked(tool, this.best),
    };
  }

  /** Skip steps whose target vanished or whose lesson is already moot; end when none remain. */
  syncTutorial(): void {
    if (!this.tutorialActive || this.busy || this.screen !== 'game') return;
    const index = firstValidStep(this.tutorialSteps, this.tutorialIdx, this.tutorialCtx());
    if (index !== this.tutorialIdx) track(`mp-tutorial-step-${index}`);
    this.tutorialIdx = index;
    if (index >= this.tutorialSteps.length) this.endTutorial();
  }

  tutorialEvent(event: TutorialEvent): void {
    const step = this.currentStep();
    if (step && completes(step, event)) this.tutorialIdx += 1;
    this.syncTutorial();
  }

  endTutorial(skipped = false): void {
    if (!this.tutorialActive) return;
    this.tutorialActive = false;
    this.tutorialView = { highlight: false, gotIt: false };
    write('tutorialSeen', skipped ? 99 : Math.max(read('tutorialSeen', 0), this.levelNo));
  }

  skipTutorial(): void {
    if (!this.tutorialActive) return;
    track('mp-tutorial-skip');
    this.tutorialReplay = false;
    this.endTutorial(true);
    this.draw();
  }

  tutorialAck(): void {
    if (!this.tutorialActive) return;
    this.tutorialEvent({ type: 'ack' });
    this.draw();
  }

  startDaily(date = today()): void {
    this.busy = false;
    this.inputQueue = [];
    this.freeTool = false;
    this.tutorialActive = false;
    this.scriptedQueue = [];
    this.celebration = '';
    this.mode = 'daily';
    this.dailyDate = date;
    const goal = dailyGoal(this.dailyDate);
    this.rng = new RNG(Number(this.dailyDate.replaceAll('-', '')));
    this.board = emptyBoard();
    this.albumAtStart = [...this.album];
    this.moves = 20;
    this.gs = newGoalState();
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

  applyEvent(event: GoalEvent): void {
    this.gs = applyGoalEvent(this.gs, event);
    if (event.created?.length) {
      const hadRainbow = hasRainbowGarden(this.album);
      this.album = discoverFlowers(this.album, event.created);
      if (!hadRainbow && hasRainbowGarden(this.album)) {
        const skins = read<string[]>('skins', ['Classic']);
        if (!skins.includes('Rainbow Garden')) {
          skins.push('Rainbow Garden');
          write('skins', skins);
          this.celebration = 'Rainbow Garden unlocked!';
          write('celebrated-Rainbow Garden', true);
        }
      }
      this.saveAlbum();
    }
  }

  button(label: string, x: number, y: number, width: number, height: number, onClick: () => void, key: string, color?: string): void {
    addButton(this, label, x, y, width, height, onClick, this.buttons, key, color);
  }

  toast(message: string, y = 1440): void {
    const w = Math.min(700, 60 + message.length * 15);
    addPill(this, 390, y, w, 60, message, 24, INK, 0xffffff, 120);
  }

  draw(): void {
    this.children.removeAll();
    this.buttons = {};
    this.mapWorld = null;
    this.tutorialView = { highlight: false, gotIt: false };
    paintBackground(this);
    if (this.screen === 'map') lazyArt(this, ART.map);
    if (this.screen === 'clear') lazyArt(this, ART.clearPose);
    if (this.screen === 'fail') lazyArt(this, ART.failPose);
    if (this.screen === 'daily') lazyArt(this, ART.dailyPose);
    if (this.screen === 'album') lazyArt(this, ART.albumPose);
    this.syncTutorial();

    if (this.screen === 'menu') this.drawMenu();
    else if (this.screen === 'map') this.drawMap();
    else if (this.screen === 'goal') this.drawGoal();
    else if (this.screen === 'daily') this.drawDaily();
    else if (this.screen === 'game') this.drawGame();
    else if (this.screen === 'pause') this.drawPause();
    else if (this.screen === 'clear' || this.screen === 'fail') this.drawResult();
    else if (this.screen === 'album') this.drawAlbum();
    if (this.tutorialActive && this.screen === 'game') this.drawTutorial();
  }

  drawTutorial(): void {
    const step = this.currentStep();
    if (!step) return;
    let highlight: Rect | undefined;
    if (step.target.type === 'column') highlight = this.buttons[`column${step.target.column}`];
    else if (step.target.type === 'button') highlight = this.buttons[step.target.button];
    const needsGotIt = step.target.type !== 'column' || !highlight;
    const shade = this.add.graphics().setDepth(90);
    shade.fillStyle(0x241c2d, 0.48);
    if (highlight) {
      const { x: hx, y: hy, w: hw, h: hh } = highlight;
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
      this.tutorialView.highlight = true;
    } else {
      shade.fillRect(0, 0, 780, 1688);
      // No target: swallow board taps; the visible "Got it" button is the only way on.
      this.add.zone(0, 180, 780, 1500).setOrigin(0).setDepth(94)
        .setInteractive(new Phaser.Geom.Rectangle(0, 0, 780, 1500), Phaser.Geom.Rectangle.Contains);
    }
    const banner = this.add.graphics().setDepth(94);
    banner.fillStyle(0xffffff, 0.95);
    banner.fillRoundedRect(70, 440, 640, 100, 28);
    banner.lineStyle(4, 0xffd45e, 1);
    banner.strokeRoundedRect(70, 440, 640, 100, 28);
    addText(this, 390, 490, step.hint, 26, INK, { wordWrap: { width: 590 } }).setDepth(95);
    const skip = this.add.container(650, 92).setDepth(96);
    const skipBg = this.add.graphics();
    skipBg.fillStyle(0xffd45e, 1);
    skipBg.fillRoundedRect(-80, -32, 160, 64, 22);
    skip.add(skipBg);
    skip.add(addText(this, 0, 0, 'SKIP', 24, INK));
    this.buttons.tutorialSkip = { x: 570, y: 60, w: 160, h: 64 };
    this.add.zone(570, 60, 160, 64).setOrigin(0).setDepth(97)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 160, 64), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => this.skipTutorial());
    if (needsGotIt) {
      const gx = 390, gy = step.target.type === 'button' && highlight && highlight.y > 1300 ? 1360 : 700;
      const got = this.add.graphics().setDepth(96);
      got.fillStyle(0xff8fab, 1);
      got.fillRoundedRect(gx - 120, gy - 40, 240, 80, 28);
      got.lineStyle(4, 0xffffff, 0.8);
      got.strokeRoundedRect(gx - 118, gy - 38, 236, 76, 26);
      addText(this, gx, gy, 'Got it', 30, INK).setDepth(97);
      this.buttons.tutorialGotIt = { x: gx - 120, y: gy - 40, w: 240, h: 80 };
      this.add.zone(gx - 120, gy - 40, 240, 80).setOrigin(0).setDepth(98)
        .setInteractive(new Phaser.Geom.Rectangle(0, 0, 240, 80), Phaser.Geom.Rectangle.Contains)
        .on('pointerdown', () => this.tutorialAck());
      this.tutorialView.gotIt = true;
    }
  }

  drawMenu(): void {
    if (this.textures.exists(ART.logo)) this.add.image(390, 400, ART.logo).setDisplaySize(760, 749);
    this.button('PLAY', 390, 1000, 420, 100, () => this.goto('map'), 'play');
    this.button('DAILY CHALLENGE', 390, 1130, 420, 100, () => this.goto('daily'), 'daily', '#75c9f5');
    this.button('GARDEN / ALBUM', 390, 1260, 420, 100, () => this.goto('album'), 'album', '#b993f5');
    this.button('HOW TO PLAY', 390, 1410, 280, 82, () => { this.tutorialReplay = true; this.startLevel(1, true, true); }, 'howto', '#70cda9');
    this.button(this.soundEnabled ? 'SOUND ON' : 'SOUND OFF', 120, 1410, 170, 82, () => {
      this.soundEnabled = !this.soundEnabled;
      write('sound', this.soundEnabled);
      this.draw();
    }, 'mute', '#ffd1a8');
    addPill(this, 390, 1570, 190, 52, 'Privacy', 26, '#3b2f3d', 0xffffff, 5);
    this.add.zone(295, 1544, 190, 52).setOrigin(0)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 190, 52), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => window.open('./privacy.html', '_self'));
    this.buttons.privacy = { x: 295, y: 1544, w: 190, h: 52 };
  }

  scrollMap(value: number): void {
    const maxScroll = MAP_SIZE.height + MAP_SIZE.pad - VIEW_H;
    this.mapScroll = Math.max(0, Math.min(maxScroll, value));
    if (this.mapWorld) this.mapWorld.y = -this.mapScroll;
  }

  nodeXY(index: number): { x: number; y: number } {
    const node = MAP_NODES[index]!;
    return { x: node.x * MAP_SIZE.width - (MAP_SIZE.width - 780) / 2, y: node.y * MAP_SIZE.height };
  }

  currentLevel(): number {
    return Math.min(30, reachedLevel(this.best));
  }

  drawMap(): void {
    if (!this.textures.exists(ART.map)) {
      lazyArt(this, ART.map, () => { if (this.screen === 'map') this.draw(); });
      addText(this, 390, 840, 'Loading the garden…', 26, MUTED);
      this.button('BACK', 390, 1540, 300, 88, () => this.goto('menu'), 'back', '#ffd1a8');
      return;
    }
    const current = this.currentLevel();
    const worldH = MAP_SIZE.height + MAP_SIZE.pad;
    if (this.mapAuto) {
      this.mapAuto = false;
      this.mapScroll = this.nodeXY(current - 1).y - VIEW_H / 2 + 40;
    }
    this.mapScroll = Math.max(0, Math.min(worldH - VIEW_H, this.mapScroll));
    const world = this.add.container(0, -this.mapScroll);
    this.mapWorld = world;
    world.add(this.add.image(390, worldH / 2, ART.map).setDisplaySize(MAP_SIZE.width, worldH));
    const dragged = (pointer: Phaser.Input.Pointer): boolean => Math.abs(pointer.y - pointer.downY) > 16 || Math.abs(pointer.x - pointer.downX) > 16;

    for (const [boss, pos] of Object.entries(MAP_GIFTS)) {
      const cleared = (this.best[Number(boss) - 1] ?? 0) > 0;
      const x = pos.x * MAP_SIZE.width - (MAP_SIZE.width - 780) / 2;
      const y = pos.y * MAP_SIZE.height;
      const chest = drawChest(this, x, y, 54, cleared);
      if (!cleared) chest.setAlpha(0.6);
      world.add(chest);
      if (!cleared) world.add(drawLock(this, x + 30, y - 26, 26, 3));
      const zone = this.add.zone(x, y, 110, 110).setInteractive();
      zone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (dragged(pointer)) return;
        this.toast(cleared ? 'Gift collected! A new bloom awaits.' : `Beat boss level ${boss} to open this gift!`, 1440);
      });
      world.add(zone);
    }

    for (let index = 0; index < 30; index += 1) {
      const { x, y } = this.nodeXY(index);
      const level = index + 1;
      const open = unlocked(this.best, level);
      const boss = BOSS_LEVELS.includes(level);
      const isCurrent = level === current;
      const starsEarned = this.best[index] ?? 0;
      const r = isCurrent ? 54 : boss ? 44 : 36;
      const g = this.add.graphics();
      g.fillStyle(0x855875, 0.2);
      g.fillEllipse(x, y + r * 0.85, r * 1.7, r * 0.5);
      if (!open) {
        g.fillStyle(0xc9c0cb, 0.95);
        g.fillCircle(x, y, r);
        g.lineStyle(5, 0xe9e3ea, 1);
        g.strokeCircle(x, y, r);
      } else {
        g.fillStyle(isCurrent ? 0xffe9a8 : (boss ? 0xff8fab : 0xfff8f0), 1);
        g.fillCircle(x, y, r);
        g.lineStyle(isCurrent ? 8 : boss ? 7 : 5, isCurrent ? 0xff8fab : boss ? 0xe8bf59 : 0xffffff, 1);
        g.strokeCircle(x, y, r);
      }
      world.add(g);
      if (boss && open) world.add(this.add.image(x, y - r - 10, ART.star).setDisplaySize(32, 32));
      if (!open) {
        world.add(drawLock(this, x, y - 2, 34, 3));
      } else {
        const label = this.add.text(x, y - (starsEarned ? 8 : 0), String(level), {
          fontFamily: '-apple-system, "SF Pro Rounded", system-ui, sans-serif',
          fontSize: isCurrent ? '40px' : boss ? '26px' : '24px', fontStyle: 'bold', color: '#59465b',
        }).setOrigin(0.5);
        world.add(label);
        if (starsEarned > 0 || (!isCurrent && starsEarned === 0)) {
          for (let s = 0; s < 3; s += 1) {
            const key = s < starsEarned ? ART.star : ART.emptyStar;
            if (this.textures.exists(key)) world.add(this.add.image(x + (s - 1) * 22, y + (isCurrent ? 30 : 22), key).setDisplaySize(20, 20));
          }
        }
      }
      if (isCurrent) {
        const ring = this.add.circle(x, y, r + 6).setStrokeStyle(8, 0xff8fab, 1);
        world.add(ring);
        this.tweens.add({ targets: ring, scale: 1.5, alpha: 0, duration: 1100, repeat: -1, ease: 'Sine.Out' });
      }
      const zone = this.add.zone(x, y, r * 2.3, r * 2.3).setInteractive();
      world.add(zone);
      if (open) zone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (dragged(pointer)) return;
        this.levelNo = level;
        this.goto('goal');
      });
      else zone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (!dragged(pointer)) this.toast(`Clear level ${level - 1} first!`, 1440);
      });
      this.buttons[`map${level}`] = { x: x - r, y: y - this.mapScroll - r, w: r * 2, h: r * 2 };
    }

    // Character standing beside the current level with a speech bubble.
    const cur = this.nodeXY(current - 1);
    const left = cur.x > 390;
    const charX = left ? cur.x - 100 : cur.x + 100;
    if (this.textures.exists('flower-3')) {
      const hero = this.add.image(charX, cur.y - 14, 'flower-3').setDisplaySize(124, 124);
      world.add(hero);
      this.tweens.add({ targets: hero, y: cur.y - 34, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    const bubbleX = Math.max(190, Math.min(590, charX));
    const bubbleObjs = this.add.container(0, 0);
    world.add(bubbleObjs);
    const bub = this.add.graphics();
    const bw = 330, bh = 66, by = cur.y - 118;
    bub.fillStyle(0xffffff, 0.97);
    bub.fillRoundedRect(bubbleX - bw / 2, by - bh / 2, bw, bh, 26);
    bub.lineStyle(4, 0xffcdda, 1);
    bub.strokeRoundedRect(bubbleX - bw / 2, by - bh / 2, bw, bh, 26);
    bub.fillStyle(0xffffff, 0.97);
    bub.fillTriangle(charX - 14, by + bh / 2 - 2, charX + 14, by + bh / 2 - 2, charX, by + bh / 2 + 20);
    bubbleObjs.add(bub);
    bubbleObjs.add(addText(this, bubbleX, by, `Level ${current} — let's go!`, 28));

    // Bottom dock: soft gradient scrim + buttons, so the map shows no empty band.
    const scrim = this.add.graphics();
    scrim.fillGradientStyle(0xe8f6e0, 0xe8f6e0, 0xe8f6e0, 0xe8f6e0, 0, 0, 0.92, 0.92);
    scrim.fillRect(0, 1480, 780, 208);
    const top = this.add.graphics();
    top.fillGradientStyle(0xfff6fb, 0xfff6fb, 0xfff6fb, 0xfff6fb, 0.55, 0.55, 0, 0);
    top.fillRect(0, 0, 780, 90);
    this.button('DAILY', 150, 1600, 200, 86, () => this.goto('daily'), 'daily', '#75c9f5');
    this.button('BACK', 390, 1600, 200, 86, () => this.goto('menu'), 'back', '#ffd1a8');
    this.button('ALBUM', 630, 1600, 200, 86, () => this.goto('album'), 'album', '#b993f5');
  }

  goalCard(goal: GoalSpec, y: number, have: number): void {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0xffffff, 0.94);
    g.fillRoundedRect(60, y - 78, 660, 156, 30);
    g.lineStyle(4, 0xffcdda, 1);
    g.strokeRoundedRect(60, y - 78, 660, 156, 30);
    addIcon(this, goalIconKey(goal.kind), 150, y, 100).setDepth(6);
    addText(this, 230, y - 16, goalSentence(goal), 28, INK, { wordWrap: { width: 460 }, align: 'left' })
      .setOrigin(0, 0.5).setDepth(6);
    addText(this, 230, y + 40, `${have} / ${goal.target}`, 26, MUTED, { align: 'left' }).setOrigin(0, 0.5).setDepth(6);
  }

  drawGoal(): void {
    const level = makeLevel(this.levelNo);
    addText(this, 390, 200, `LEVEL ${level.n}${level.boss ? '  •  BOSS' : ''}`, 42).setDepth(6);
    let y = 400;
    for (const goal of level.goals) {
      this.goalCard(goal, y, goalProgress(goal, newGoalState()));
      y += 190;
    }
    addText(this, 390, y + 10, `${level.moves} moves`, 30, INK).setDepth(6);
    addText(this, 390, y + 60, `★★★ with ${level.threeStar}+ left   ·   ★★ with ${level.twoStar}+ left`, 24, MUTED, { wordWrap: { width: 680 } }).setDepth(6);
    this.button('PLAY', 390, y + 190, 400, 110, () => this.startLevel(this.levelNo, true), 'goalPlay');
    this.button('BACK', 390, y + 330, 300, 88, () => this.goto('map'), 'back', '#ffd1a8');
  }

  drawDaily(): void {
    const goal = dailyGoal(today());
    this.dailyDate = today();
    if (this.textures.exists(ART.dailyPose)) this.add.image(390, 360, ART.dailyPose).setDisplaySize(420, 300);
    else lazyArt(this, ART.dailyPose, () => { if (this.screen === 'daily') this.draw(); });
    addText(this, 390, 560, 'DAILY CHALLENGE', 36);
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0xffffff, 0.94);
    g.fillRoundedRect(60, 620, 660, 150, 30);
    g.lineStyle(4, 0xffcdda, 1);
    g.strokeRoundedRect(60, 620, 660, 150, 30);
    addIcon(this, goalIconKey(goal.kind === 'combined' ? 'make' : goal.kind), 150, 695, 96).setDepth(6);
    addText(this, 230, 695, this.previewDailyGoal(goal), 26, INK, { wordWrap: { width: 460 }, align: 'left' }).setOrigin(0, 0.5).setDepth(6);
    addText(this, 390, 830, `Streak: ${read<number>('streak', 0)} day${read<number>('streak', 0) === 1 ? '' : 's'}`, 26, MUTED);
    if (read('dailyDone', '') === today()) addText(this, 390, 880, 'Completed today', 24, '#3f9c78');
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
    const goals = this.goalSpecs();
    const width = 700 / Math.max(1, goals.length);
    goals.forEach((goal, index) => {
      const x = 40 + width * index + width / 2;
      addIcon(this, goalIconKey(goal.kind), x - width / 2 + 36, y, 52).setDepth(6);
      addText(this, x + 20, y - 12, goalSentence(goal), 18, INK, { wordWrap: { width: width - 70 } }).setDepth(6);
      addText(this, x + 20, y + 20, `${goalProgress(goal, this.gs)} / ${goal.target}`, 20, MUTED).setDepth(6);
    });
  }

  drawGame(): void {
    addText(this, 390, 118, this.mode === 'daily' ? 'DAILY' : `LEVEL ${this.levelNo}`, 24, MUTED);
    addText(this, 390, 168, `Moves  ${this.moves}      Score  ${this.score}`, 26);
    this.drawGoalBar(230);
    addText(this, 390, 330, 'NEXT', 18, MUTED);
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
          drawGroundShadow(this, center.x, center.y + 32, 54, 14, 0.13);
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
      // pointerdown (not up/click): every touch registers, even repeated taps at the same spot.
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        highlight.clear();
        highlight.fillStyle(0xff8fab, 0.2);
        highlight.fillRoundedRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, 18);
        if (this.targeting) {
          const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          const row = Math.max(0, Math.min(8, Math.floor((world.y - y) / cell)));
          this.hammerAt(column, row);
        } else {
          this.drop(column);
        }
      });
    }

    if (this.targeting) {
      addText(this, 390, 520, 'Tap a flower, stone, or vine', 24, '#d9577a').setDepth(15);
    }

    // Tools tray: opaque panel covers the background decorations so labels stay readable.
    const tray = this.add.graphics().setDepth(5);
    tray.fillStyle(0xffffff, 0.86);
    tray.fillRoundedRect(30, 1520, 720, 156, 34);
    tray.lineStyle(4, 0xffcdda, 1);
    tray.strokeRoundedRect(30, 1520, 720, 156, 34);
    const uses = this.dailyUses();
    for (const tool of TOOLS) {
      const open = toolUnlocked(tool.kind, this.best);
      const caption = open ? `${uses[tool.kind]} left` : lockLabel(tool.kind);
      addIconButton(this, tool.art, tool.x, 1566, 84, () => this.useTool(tool.kind), this.buttons, tool.kind, caption, !open);
    }
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
      else this.startLevel(this.levelNo, true);
    }, 'retry', '#ffd1a8');
    this.button('MAP / MENU', 390, 800, 400, 110, () => this.goto(this.mode === 'daily' ? 'menu' : 'map'), 'map', '#75c9f5');
    if (this.mode === 'campaign') {
      this.button('HOW TO PLAY', 390, 940, 400, 100, () => { this.tutorialReplay = true; this.startLevel(1, true, true); }, 'howto', '#70cda9');
    }
  }

  confetti(): void {
    const palette = [0xff8fab, 0xffd45e, 0x70cda9, 0x75c9f5, 0xb993f5];
    for (let i = 0; i < 56; i += 1) {
      const x = 390 + (Math.random() - 0.5) * 120;
      const piece = this.add.rectangle(x, 360, 12 + Math.random() * 10, 18, palette[i % palette.length]!).setDepth(60);
      piece.setAngle(Math.random() * 360);
      this.tweens.add({
        targets: piece,
        x: x + (Math.random() - 0.5) * 900,
        y: 120 + Math.random() * 500,
        angle: piece.angle + 360 * (Math.random() > 0.5 ? 1 : -1),
        duration: 900 + Math.random() * 500,
        ease: 'Cubic.Out',
        onComplete: () => {
          this.tweens.add({
            targets: piece, y: piece.y + 700, alpha: 0, duration: 1100 + Math.random() * 600, ease: 'Quad.In',
            onComplete: () => piece.destroy(),
          });
        },
      });
    }
  }

  sparkle(x: number, y: number): void {
    for (let i = 0; i < 8; i += 1) {
      const a = i * Math.PI / 4;
      const dot = this.add.star(x, y, 4, 4, 11, 0xfff1a8).setDepth(61);
      this.tweens.add({
        targets: dot, x: x + Math.cos(a) * 90, y: y + Math.sin(a) * 90, alpha: 0, scale: 0.3,
        duration: 600, ease: 'Cubic.Out', onComplete: () => dot.destroy(),
      });
    }
  }

  drawResult(): void {
    const success = this.screen === 'clear';
    const pose = success ? ART.clearPose : ART.failPose;
    const campaign = this.mode === 'campaign';
    if (!success) {
      if (this.textures.exists(pose)) this.add.image(390, 420, pose).setDisplaySize(520, 365);
      else lazyArt(this, pose, () => { if (this.screen === 'fail') this.draw(); });
      addText(this, 390, 200, this.failReason, 40);
      addText(this, 390, 680, 'Try a different path and bloom again.', 26, MUTED, { wordWrap: { width: 620 } });
      this.button('RETRY', 390, 980, 400, 110, () => {
        if (this.mode === 'daily') this.startDaily(this.dailyDate);
        else this.startLevel(this.levelNo, true);
      }, 'retry');
      this.button('MAP', 390, 1120, 300, 88, () => this.goto(this.mode === 'daily' ? 'menu' : 'map'), 'map', '#ffd1a8');
      return;
    }

    addText(this, 390, 130, 'A lovely bloom!', 46).setDepth(10);
    if (this.textures.exists(pose)) this.add.image(215, 400, pose).setDisplaySize(380, 331).setDepth(3);
    else lazyArt(this, pose, () => { if (this.screen === 'clear') this.draw(); });
    addBubble(this, 566, 340, 300, CHEERS[(this.levelNo + this.score) % CHEERS.length]!, 26, 'left');
    this.confetti();

    let y = 640;
    if (campaign) {
      const earned = this.starCount();
      for (let s = 0; s < 3; s += 1) {
        const sx = 390 + (s - 1) * 150;
        if (s < earned) {
          const star = this.add.image(sx, y, ART.star).setDisplaySize(130, 130).setScale(0).setDepth(10);
          this.tweens.add({
            targets: star, scale: 130 / 192, duration: 420, delay: 350 + s * 380, ease: 'Back.Out',
            onStart: () => this.sparkle(sx, y),
          });
          // Final display size must be 130px: scale is relative to the 192px texture.
        } else {
          this.add.image(sx, y, ART.emptyStar).setDisplaySize(110, 110).setAlpha(0.8).setDepth(10);
        }
      }
      y += 130;
    } else {
      addText(this, 390, y, 'Daily complete!', 34, '#3f9c78');
      y += 90;
    }

    addText(this, 390, y + 10, 'SCORE', 24, MUTED).setDepth(10);
    const counter = addText(this, 390, y + 80, '0', 88, '#d9577a').setDepth(10);
    const roll = { v: 0 };
    this.tweens.add({
      targets: roll, v: this.score, duration: 1200, delay: 300, ease: 'Cubic.Out',
      onUpdate: () => counter.setText(String(Math.round(roll.v))),
      onComplete: () => counter.setText(String(this.score)),
    });
    y += 150;

    if (campaign) {
      const level = levels[this.levelNo - 1]!;
      const earned = this.starCount();
      addText(this, 390, y, `★★★ = finish with ${level.threeStar}+ moves left   ·   you had ${this.moves}`, 22, MUTED, { wordWrap: { width: 700 } });
      y += 50;
      if (earned < 3) {
        const need = movesToThreeStars(this.moves, level.threeStar);
        addText(this, 390, y, `${need} more move${need === 1 ? '' : 's'} left for 3 stars — try again?`, 26, '#d9577a', { wordWrap: { width: 680 } });
        y += 56;
      }
    }

    const rewards: string[] = [];
    if (this.celebration) rewards.push(this.celebration);
    if (this.resultInfo.newFlowers.length) rewards.push('New flower added to Album!');
    if (this.resultInfo.skinLine) rewards.push(this.resultInfo.skinLine);
    rewards.slice(0, 3).forEach((line, index) => {
      addPill(this, 390, y + 20 + index * 64, 600, 54, line, 24, INK, 0xfff1c9, 10);
    });
    y += Math.max(1, Math.min(3, rewards.length)) * 64 + 40;

    const nextY = Math.max(y + 30, 1230);
    this.button(this.mode === 'daily' ? 'MENU' : 'NEXT', 390, nextY, 500, 130, () => {
      if (this.mode === 'daily') this.goto('menu');
      else if (this.levelNo < 30) this.startLevel(this.levelNo + 1);
      else this.goto('map');
    }, 'next');
    const earned = campaign ? this.starCount() : 3;
    if (earned < 3) {
      this.button('RETRY', 260, nextY + 150, 240, 84, () => this.startLevel(this.levelNo, true), 'retry', '#ffd1a8');
      this.button('MAP', 520, nextY + 150, 240, 84, () => this.goto('map'), 'map', '#75c9f5');
    } else {
      this.button('MAP', 390, nextY + 150, 300, 84, () => this.goto(this.mode === 'daily' ? 'menu' : 'map'), 'map', '#ffd1a8');
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
      addText(this, 390, 1180, 'Garden complete!', 22, '#3f9c78');
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

  goalText(): string {
    return this.goalSpecs().map((goal) => `${goalSentence(goal)} (${goalProgress(goal, this.gs)}/${goal.target})`).join('  ');
  }

  done(): boolean {
    return goalsDone(this.goalSpecs(), this.gs);
  }

  /** Non-mutating preview of dropping the next piece in a column (used by the QA bot). */
  simulateDrop(column: number) {
    const rows = landingRows(this.board, column, this.next.length);
    if (!rows) return null;
    const trial = cloneBoard(this.board);
    place(trial, column, this.next, 9999);
    const result = resolve(trial, 9999);
    return { cleared: result.cleared, created: result.created, score: result.score, chain: result.chain, row: rows[0] };
  }

  /** Single entry point for every column tap: validates, queues during animation, or starts the drop. */
  drop(column: number): void {
    if (this.screen !== 'game' || this.targeting) return;
    if (isWrongColumn(this.currentStep(), column)) {
      this.cameras.main.shake(100, 0.004);
      return;
    }
    if (this.busy) {
      if (this.inputQueue.length < QUEUE_CAP) this.inputQueue.push(column);
      return;
    }
    this.startDrop(column);
  }

  processQueue(): void {
    if (this.screen !== 'game' || this.busy) { if (this.screen !== 'game') this.inputQueue = []; return; }
    const column = this.inputQueue.shift();
    if (column !== undefined) this.drop(column);
  }

  startDrop(column: number): void {
    const rows = landingRows(this.board, column, this.next.length);
    if (!rows) {
      this.cameras.main.shake(120, 0.006);
      this.processQueue();
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
      const image = addFlower(this, start.x, BOARD.y - 20, level, 37, this.skin).setDepth(30);
      this.tweens.add({
        targets: image,
        y: end.y,
        duration: 220 + index * 40,
        ease: 'Cubic.In',
        onComplete: () => {
          this.tweens.add({ targets: image, scaleX: 1.18, scaleY: 0.82, duration: 70, yoyo: true, ease: 'Quad.Out' });
        },
      });
      return image;
    });
    this.time.delayedCall(330, () => {
      falling.forEach((image) => image.destroy());
      this.busy = false;
      this.commitDrop(column);
    });
  }

  finishDrop(): void {
    this.next = this.nextPiece();
    this.saveAlbum();
    this.busy = false;
    this.tutorialEvent({ type: 'drop', column: this.lastDropColumn });
    this.draw();
    if (this.done()) { this.clearLevel(); return; }
    if (this.moves <= 0 || !canFit(this.board, this.next)) { this.fail(); return; }
    this.processQueue();
  }

  commitDrop(column: number): void {
    const dropped = [...this.next];
    if (!place(this.board, column, this.next, this.id)) {
      this.snapUndo = null;
      this.cameras.main.shake(120, 0.006);
      this.processQueue();
      return;
    }
    this.id += dropped.length;
    this.album = discoverFlowers(this.album, dropped);
    this.moves -= 1;
    this.lastDropColumn = column;
    const placed = cloneBoard(this.board);
    const steps = resolveSteps(this.board, this.id - dropped.length);
    const labelFor = (chain: number): string => chain > 1 ? (['', '', 'NICE', 'GREAT', 'AMAZING', 'BLOOM!'][Math.min(5, chain)] ?? 'BLOOM!') : '';

    if (steps.length && !this.isInstant()) {
      this.busy = true;
      this.board = placed;
      this.draw();
      const animateStep = (i: number): void => {
        const step = steps[i];
        if (!step) {
          this.fx.chain = steps[steps.length - 1]!.chain;
          this.fx.lastText = steps.length > 1 ? labelFor(Math.min(5, steps.length)) : '';
          this.finishDrop();
          return;
        }
        const dest = cellCenter(step.target[1], step.target[0]);
        const movers = step.cells.map(([row, col]) => {
          const from = cellCenter(col, row);
          const img = addFlower(this, from.x, from.y, this.levelAt(i === 0 ? placed : steps[i - 1]!.board, row, col), 37, this.skin).setDepth(30);
          this.tweens.add({
            targets: img, x: dest.x, y: dest.y, scaleX: 0.2, scaleY: 0.2, duration: 220, ease: 'Cubic.In',
            onComplete: () => img.destroy(),
          });
          return img;
        });
        this.playTone(step.chain);
        const label = labelFor(step.chain);
        if (label) {
          const text = addText(this, dest.x, dest.y - 30, label, 42, '#ff8fab').setDepth(40);
          text.setStroke('#ffffff', 10);
          this.tweens.add({ targets: text, y: dest.y - 80, alpha: 0, duration: 700, ease: 'Cubic.Out', onComplete: () => text.destroy() });
        }
        this.burstParticles(18, dest.x, dest.y);
        this.time.delayedCall(230, () => {
          movers.forEach((img) => img.destroy());
          this.board = cloneBoard(step.board);
          this.applyEvent({ created: step.created, cleared: step.cleared, score: step.score });
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

    for (const step of steps) {
      this.applyEvent({ created: step.created, cleared: step.cleared, score: step.score });
      this.playTone(step.chain);
    }
    this.fx.chain = steps.length ? steps[steps.length - 1]!.chain : 0;
    this.fx.lastText = steps.length > 1 ? labelFor(Math.min(5, steps.length)) : '';
    this.fx.particles = steps.length * 12;
    this.finishDrop();
  }

  /** Level of the flower that sat at (row, col) on the pre-step board (falls back to 1). */
  levelAt(board: Grid, row: number, col: number): number {
    const cell = board[row]?.[col];
    return cell?.kind === 'flower' ? cell.level : 1;
  }

  capture() {
    return {
      board: cloneBoard(this.board),
      moves: this.moves,
      gs: cloneGoalState(this.gs),
      next: [...this.next],
      scripted: this.scriptedQueue.map((p) => [...p]),
    };
  }

  tutorialFree(kind: PowerUpKind): boolean {
    const step = this.currentStep();
    return Boolean(step && step.target.type === 'button' && step.target.button === kind);
  }

  undo(): void {
    if (this.busy || !this.snapUndo || this.screen !== 'game') return;
    if (!toolUnlocked('undo', this.best)) { this.toast(lockLabel('undo')); return; }
    const free = this.tutorialFree('undo');
    if (!free) {
      const spent = consumeUse(this.dailyUses(), 'undo');
      if (!spent) {
        this.showAdMessage();
        return;
      }
      write('power', spent);
    }
    const state = this.snapUndo;
    this.board = cloneBoard(state.board);
    this.moves = state.moves;
    this.gs = cloneGoalState(state.gs);
    this.next = [...state.next];
    this.scriptedQueue = state.scripted.map((p) => [...p]);
    this.snapUndo = null;
    this.inputQueue = [];
    this.tutorialEvent({ type: 'tool', tool: 'undo' });
    this.draw();
  }

  useTool(kind: PowerUpKind): void {
    if (this.screen !== 'game') return;
    if (!toolUnlocked(kind, this.best)) { this.toast(lockLabel(kind)); return; }
    if (kind === 'undo') {
      this.undo();
      return;
    }
    if (this.busy) return;
    if (kind === 'hammer') {
      if (this.targeting) {
        this.targeting = '';
        this.freeTool = false;
        this.draw();
        return;
      }
      if (this.dailyUses().hammer <= 0 && !this.tutorialFree('hammer')) {
        this.showAdMessage();
        return;
      }
      this.freeTool = this.tutorialFree('hammer');
      this.targeting = 'hammer';
      this.tutorialEvent({ type: 'tool', tool: 'hammer' });
      this.draw();
      return;
    }
    const flowers = this.board.flat().filter((cell) => cell?.kind === 'flower' && !cell.vine);
    if (flowers.length < 2) { this.toast('Need 2 flowers to shuffle'); return; }
    if (!this.tutorialFree('shuffle')) {
      const spent = consumeUse(this.dailyUses(), 'shuffle');
      if (!spent) {
        this.showAdMessage();
        return;
      }
      write('power', spent);
    }
    this.snapUndo = this.capture();
    this.shuffle();
    if (this.screen !== 'game') return;
    this.tutorialEvent({ type: 'tool', tool: 'shuffle' });
    this.draw();
  }

  showAdMessage(): void {
    void tryRewardedAd('power-up');
    this.toast('Rewarded ads coming later', 1480);
  }

  hammerAt(column: number, row: number): void {
    const cell = this.board[row]?.[column];
    if (!cell || this.busy) return;
    if (!this.freeTool) {
      const spent = consumeUse(this.dailyUses(), 'hammer');
      if (!spent) {
        this.targeting = '';
        this.showAdMessage();
        this.draw();
        return;
      }
      write('power', spent);
    }
    this.freeTool = false;
    this.snapUndo = this.capture();
    let cleared = 0;
    if (cell.kind === 'stone') {
      cell.hp -= 1;
      if (cell.hp <= 0) {
        this.board[row]![column] = null;
        cleared += 1;
      }
    } else if (cell.vine) {
      cell.vine = false;
      cleared += 1;
    } else {
      this.board[row]![column] = null;
    }
    gravity(this.board);
    const result = resolve(this.board, undefined);
    this.applyEvent({ created: result.created, cleared: cleared + result.cleared, score: result.score });
    this.targeting = '';
    this.syncTutorial();
    if (this.done()) this.clearLevel();
    else this.draw();
  }

  /** Rearranges flowers (never scores or changes goal counts unless a match is unavoidable). */
  shuffle(): void {
    shuffleBoard(this.board, () => this.rng.next());
    const result = resolve(this.board, undefined);
    if (result.chain > 0) this.applyEvent({ created: result.created, cleared: result.cleared, score: result.score });
    if (this.done()) this.clearLevel();
  }

  clearLevel(): void {
    this.inputQueue = [];
    this.endTutorial();
    this.resultInfo = { newFlowers: [], skinLine: '' };
    this.resultInfo.newFlowers = this.album.flatMap((have, index) => have && !this.albumAtStart[index] ? [index + 1] : []);
    if (this.mode === 'campaign') {
      const index = this.levelNo - 1;
      const earned = stars(this.moves, levels[index]!.twoStar, levels[index]!.threeStar);
      this.best[index] = Math.max(this.best[index] ?? 0, earned);
      write('progress', this.best);
      track(`mp-level-clear-${this.levelNo}`);
      const skins = read<string[]>('skins', ['Classic']);
      for (const [skin, need] of STAR_SKINS) {
        if (totalStars(this.best) >= need && !skins.includes(skin)) {
          skins.push(skin);
          this.celebration = `${skin} skin unlocked!`;
        }
      }
      write('skins', skins);
      const next = nextStarSkin(this.best, skins);
      if (next) this.resultInfo.skinLine = `${next.remaining} ★ to next skin (${next.skin})`;
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
    this.inputQueue = [];
    this.endTutorial();
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
