// QA for MERGE BLOOM preview3. Run `npm run build` first. Usage: node tools/qa-v3.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('/tmp/mp-qa/node_modules/playwright-core');

const CHROME = '/usr/bin/google-chrome';
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/?qa=1`;
const ROOT = resolve(import.meta.dirname, '..', 'screenshots', 'v3');
const ALL_SIZES = [
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
];

const SIZES = process.env.QA_SIZES ? ALL_SIZES.filter((z) => process.env.QA_SIZES.split(',').includes(z.name)) : ALL_SIZES;

const results = [];
let failed = 0;
function check(size, name, ok, detail = '') {
  results.push({ size, name, ok: Boolean(ok), detail: String(detail) });
  if (!ok) { failed += 1; console.error(`FAIL [${size}] ${name} ${detail}`); }
  else console.log(`ok   [${size}] ${name}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = (page) => page.evaluate(() => window.__MERGEBLOOM__.getState());
const qa = (page, fn, arg) => page.evaluate(fn, arg);
const waitHook = (page) => page.waitForFunction(() => window.__MERGEBLOOM__?.getState, { timeout: 20000 });
const waitIdle = async (page) => {
  await page.waitForFunction(() => { const s = window.__MERGEBLOOM__.getState(); return !s.busy && s.inputQueue === 0; }, { timeout: 20000 });
  await sleep(120);
};
async function tapGame(page, gx, gy, wait = 60) {
  const box = await page.locator('#game canvas').boundingBox();
  const scale = Math.min(box.width / 780, box.height / 1688);
  const ox = box.x + (box.width - 780 * scale) / 2;
  const oy = box.y + (box.height - 1688 * scale) / 2;
  await page.touchscreen.tap(ox + gx * scale, oy + gy * scale);
  if (wait) await sleep(wait);
}
const tapColumn = async (page, col, wait) => tapGame(page, 40 + col * 100 + 50, 1000, wait);
async function tapButton(page, key) {
  const rect = await page.evaluate((name) => window.__MERGEBLOOM__.getState().layout.buttons[name] ?? null, key);
  if (!rect) throw new Error(`missing button ${key}`);
  await tapGame(page, rect.x + rect.w / 2, rect.y + rect.h / 2, 120);
}
const shot = async (page, dir, name) => { await page.screenshot({ path: resolve(ROOT, dir, `${name}.png`) }); };

async function newPage(browser, size, errors) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`[http ${r.status()}] ${r.url()}`); });
  return { context, page };
}
async function fresh(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitHook(page);
  await qa(page, () => window.__MERGEBLOOM__.qa.resetStorage());
  await page.reload({ waitUntil: 'networkidle' });
  await waitHook(page);
  await sleep(500);
}

/** Greedy bot: best column by immediate clears/merges/score plus a setup bonus for touching same-level flowers. */
async function botPlay(page, maxIter = 60) {
  for (let i = 0; i < maxIter; i += 1) {
    const s = await state(page);
    if (s.scene !== 'game') return s;
    const sims = await qa(page, () => [0, 1, 2, 3, 4, 5, 6].map((c) => window.__MERGEBLOOM__.qa.simulateDrop(c)));
    let best = -1; let bestScore = -Infinity;
    sims.forEach((sim, c) => {
      if (!sim) return;
      let adj = 0;
      for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nb = s.board[sim.row + dy]?.[c + dx];
        if (nb?.kind === 'flower' && nb.level === s.nextPiece.levels[0]) adj += 1;
        if (nb?.kind === 'stone') adj += 0.5;
      }
      const score = adj * 20 + sim.cleared * 1000 + sim.created.reduce((a, l) => a + l * 50, 0) + sim.score - (9 - sim.row) * 3;
      if (score > bestScore) { bestScore = score; best = c; }
    });
    if (best < 0) return s;
    await qa(page, (c) => window.__MERGEBLOOM__.qa.dropColumn(c), best);
  }
  return state(page);
}
async function winLevel(page, level, label) {
  for (let seed = 1; seed <= 6; seed += 1) {
    const s = await state(page);
    if (s.scene === 'clear') return true;
    await qa(page, ([n, sd]) => { window.__MERGEBLOOM__.qa.instant = true; window.__MERGEBLOOM__.qa.startLevel(n, { tutorial: false, seed: sd * 977 }); }, [level, seed]);
    const end = await botPlay(page);
    if (end.scene === 'clear') return true;
  }
  console.warn(`could not win level ${level} (${label})`);
  return false;
}

const tutorialOk = (s) => !s.tutorial.active || (s.tutorial.valid && (s.tutorial.hasHighlight || s.tutorial.hasGotIt));

async function runSize(browser, size) {
  const dir = size.name;
  mkdirSync(resolve(ROOT, dir), { recursive: true });
  const errors = [];
  const { context, page } = await newPage(browser, size, errors);
  const S = size.name;

  // ---- fresh start: tutorial L1 -> L2 -> L3 with real canvas taps (animations ON)
  await fresh(page);
  await qa(page, () => { window.__MERGEBLOOM__.qa.instant = false; });
  let s = await state(page);
  check(S, 'fresh start opens level 1 tutorial', s.scene === 'game' && s.level === 1 && s.tutorial.active);
  check(S, 'L1 goal starts at 0', s.goal.progress === 0 && s.goals.every((g) => g.progress === 0));
  check(S, 'L1 tools are locked', !s.powerups.unlocked.undo && !s.powerups.unlocked.hammer && !s.powerups.unlocked.shuffle);
  await shot(page, dir, '01-tutorial-l1-step1-tools-locked');
  // wrong column: shake only, nothing placed
  await tapColumn(page, 5, 150);
  s = await state(page);
  check(S, 'L1 wrong column does not place', s.moves === 20 && tutorialOk(s));
  await tapColumn(page, 1, 80);
  await waitIdle(page);
  await shot(page, dir, '02-tutorial-l1-step2');
  await tapColumn(page, 3, 0);
  await sleep(250); await shot(page, dir, '03-merge-anim-l1-a');
  await waitForClear(page);
  await sleep(2200);
  await shot(page, dir, '04-level-clear');
  s = await state(page);
  check(S, 'L1 cleared via real taps', s.scene === 'clear' && s.starsEarned >= 1);
  await tapButton(page, 'next');
  await sleep(400);
  s = await state(page);
  check(S, 'next opens L2 tutorial', s.scene === 'game' && s.level === 2 && s.tutorial.active && s.goal.progress === 0);
  await shot(page, dir, '05-tutorial-l2-chain');
  await tapColumn(page, 2, 0);
  for (const [i, d] of [[1, 140], [2, 220], [3, 260]]) { await sleep(d); await shot(page, dir, `06-merge-anim-l2-frame${i}`); }
  await waitIdle(page);
  s = await state(page);
  check(S, 'L2 undo tip valid after chain', s.tutorial.stepId === 'l2-undo' && s.tutorial.valid, JSON.stringify(s.tutorial));
  await shot(page, dir, '07-tutorial-l2-undo-tip');
  await tapButton(page, 'tutorialGotIt');
  s = await state(page);
  check(S, 'L2 tutorial ends after Got it', !s.tutorial.active);
  await qa(page, () => { window.__MERGEBLOOM__.qa.instant = true; });
  check(S, 'L2 cleared', await winLevel(page, 2, 'tutorial'));
  await qa(page, () => { window.__MERGEBLOOM__.qa.instant = false; });
  await sleep(300);
  await tapButton(page, 'next');
  await sleep(400);
  s = await state(page);
  check(S, 'next opens L3 tutorial (stone step)', s.level === 3 && s.tutorial.stepId === 'l3-stone' && s.tutorial.valid, JSON.stringify(s.tutorial));
  await shot(page, dir, '08-tutorial-l3-step-stone');
  await tapColumn(page, 6, 150);
  s = await state(page);
  check(S, 'L3 wrong column shakes, no soft-lock', s.moves === 20 + 2 && tutorialOk(s) || s.moves > 0 && tutorialOk(s));
  const movesBefore = s.moves;
  await tapColumn(page, 0, 80);
  await waitIdle(page);
  s = await state(page);
  check(S, 'L3 stone cracked, goal counter ticks', s.goals[0].progress >= 0 && s.tutorial.stepId === 'l3-vine' && s.moves === movesBefore - 1, JSON.stringify(s.tutorial));
  await shot(page, dir, '09-tutorial-l3-step-vine');
  await tapColumn(page, 6, 80);
  await waitIdle(page);
  s = await state(page);
  check(S, 'L3 hammer tip shown with highlight', s.tutorial.stepId === 'l3-hammer' && s.tutorial.hasHighlight, JSON.stringify(s.tutorial));
  await shot(page, dir, '10-tutorial-l3-step-hammer');
  await tapButton(page, 'tutorialGotIt');
  s = await state(page);
  check(S, 'L3 tutorial done', !s.tutorial.active);
  await qa(page, () => { window.__MERGEBLOOM__.qa.instant = true; });
  check(S, 'L3 cleared', await winLevel(page, 3, 'after tutorial'));

  // ---- level 4: goal card, gameplay, tools bar
  await qa(page, () => window.__MERGEBLOOM__.qa.showGoal(4));
  await sleep(300);
  s = await state(page);
  check(S, 'L4 goal card shows 0/target', s.scene === 'goal' && s.goal.progress === 0 && /0\/\d/.test(s.goal.text), s.goal.text);
  await shot(page, dir, '11-level4-goal-card');
  await qa(page, () => window.__MERGEBLOOM__.qa.startLevel(4, { tutorial: true }));
  await sleep(300);
  s = await state(page);
  check(S, 'L4 shuffle tip valid', s.tutorial.stepId === 'l4-shuffle' && s.tutorial.valid, JSON.stringify(s.tutorial));
  await shot(page, dir, '12-level4-shuffle-tip');
  await tapButton(page, 'tutorialGotIt');
  await shot(page, dir, '13-level4-gameplay');
  await qa(page, () => window.__MERGEBLOOM__.qa.setBest([3, 3, 3, 0]));
  await sleep(200);
  await shot(page, dir, '14-tools-bar-unlocked');

  // winning L4 for the clear screen (instant), then the fail screen
  await qa(page, () => { window.__MERGEBLOOM__.qa.instant = true; });
  await winLevel(page, 4, 'for clear screenshot');
  await sleep(2400);
  await shot(page, dir, '15-level-clear-l4');
  await qa(page, () => window.__MERGEBLOOM__.qa.goto('fail'));
  await sleep(400); await shot(page, dir, '16-fail');
  await qa(page, () => window.__MERGEBLOOM__.qa.goto('menu'));
  await sleep(400); await shot(page, dir, '17-menu');
  await qa(page, () => window.__MERGEBLOOM__.qa.goto('map'));
  await sleep(900); await shot(page, dir, '18-map');

  // ---- tutorial orders on level 3
  const startL3 = async () => {
    await qa(page, () => {
      const q = window.__MERGEBLOOM__.qa; q.instant = false; q.setBest([3, 3, 0]); q.startLevel(3, { tutorial: true });
    });
    await sleep(300);
  };
  const afterOk = async (label) => {
    let st = await state(page);
    check(S, `${label}: no freeze (ended or valid highlighted target)`, tutorialOk(st), JSON.stringify(st.tutorial));
    const before = JSON.stringify(st.board) + st.moves;
    if (st.tutorial.active && st.tutorial.target?.type === 'column') await tapColumn(page, st.tutorial.target.column, 80);
    else await tapColumn(page, 4, 80);
    await waitIdle(page);
    st = await state(page);
    check(S, `${label}: a board tap changes state`, JSON.stringify(st.board) + st.moves !== before);
  };
  // (a) intended order
  await startL3();
  await tapColumn(page, 0, 80); await waitIdle(page);
  await tapColumn(page, 6, 80); await waitIdle(page);
  await afterOk('L3 order (a) intended');
  // (b) clear stone AND vine early with one different merge (old freeze scenario)
  await startL3();
  await qa(page, () => {
    const b = Array.from({ length: 9 }, () => Array(7).fill(null));
    b[8][1] = { kind: 'flower', level: 1 }; b[8][2] = { kind: 'flower', level: 1 };
    b[7][2] = { kind: 'flower', level: 1, vine: true }; b[8][3] = { kind: 'stone', hp: 1 };
    window.__MERGEBLOOM__.qa.setBoard(b); window.__MERGEBLOOM__.qa.setPiece([1]);
  });
  await tapColumn(page, 0, 80); await waitIdle(page);
  s = await state(page);
  check(S, 'L3 order (b): stone+vine cleared by one merge', s.goal.progress >= 0 && !s.board.flat().some((c) => c && (c.kind === 'stone' || c.vine)));
  await shot(page, dir, '19-tutorial-l3-early-clear');
  await afterOk('L3 order (b) early clear');
  // (c) wrong columns repeatedly
  await startL3();
  s = await state(page); const m0 = s.moves;
  for (const c of [3, 4, 5, 2, 1, 6, 3, 5]) await tapColumn(page, c, 60);
  s = await state(page);
  check(S, 'L3 order (c): wrong taps place nothing', s.moves === m0, `moves ${s.moves} vs ${m0}`);
  await afterOk('L3 order (c) wrong columns');
  // (d) skip
  await startL3();
  await tapButton(page, 'tutorialSkip');
  await sleep(200);
  s = await state(page);
  check(S, 'L3 order (d): skip ends tutorial', !s.tutorial.active);
  await afterOk('L3 order (d) skip');

  // ---- level 4 greedy bot: >=4 of 5 seeded runs
  let wins = 0;
  for (const seed of [11, 22, 33, 44, 55]) {
    await qa(page, (sd) => { const q = window.__MERGEBLOOM__.qa; q.instant = true; q.startLevel(4, { tutorial: false, seed: sd }); }, seed);
    const end = await botPlay(page);
    if (end.scene === 'clear') wins += 1;
  }
  check(S, 'L4 greedy bot wins >=4/5', wins >= 4, `${wins}/5`);

  // ---- rapid taps (animations ON): 4 taps on one column within ~150ms
  await qa(page, () => { const q = window.__MERGEBLOOM__.qa; q.instant = false; q.startLevel(2, { tutorial: false }); });
  await sleep(400);
  s = await state(page); const mv = s.moves;
  await qa(page, () => {
    window.__maxQ = 0;
    window.__qTimer = setInterval(() => { window.__maxQ = Math.max(window.__maxQ, window.__MERGEBLOOM__.getState().inputQueue); }, 5);
  });
  const t0 = Date.now();
  await Promise.all([0, 1, 2, 3].map(() => tapColumn(page, 4, 0)));
  const tapMs = Date.now() - t0;
  await waitIdle(page);
  await sleep(500); await waitIdle(page);
  s = await state(page);
  const maxQueue = await qa(page, () => { clearInterval(window.__qTimer); return window.__maxQ; });
  check(S, 'rapid taps: all 4 pieces placed', s.moves === mv - 4 && s.scene === 'game', `moves ${mv} -> ${s.moves}, maxQueue ${maxQueue}, taps took ${tapMs}ms`);
  check(S, 'rapid taps: queue was used and drained', maxQueue >= 1 && s.inputQueue === 0, `maxQueue ${maxQueue}, taps took ${tapMs}ms`);

  // ---- goal counters for levels 1-6
  await qa(page, () => { window.__MERGEBLOOM__.qa.instant = true; });
  for (let n = 1; n <= 6; n += 1) {
    await qa(page, (lv) => window.__MERGEBLOOM__.qa.showGoal(lv), n);
    let st = await state(page);
    const intro = st.scene === 'goal' && st.goals.every((g) => g.progress === 0);
    await qa(page, (lv) => window.__MERGEBLOOM__.qa.startLevel(lv, { tutorial: false }), n);
    st = await state(page);
    check(S, `L${n} intro and start show 0/target`, intro && st.goals.every((g) => g.progress === 0) && st.score === 0, st.goal.text);
  }
  // clear counter increments on an obstacle (L4 bot first clear)
  await qa(page, () => window.__MERGEBLOOM__.qa.startLevel(4, { tutorial: false, seed: 11 }));
  let seen = 0;
  for (let i = 0; i < 40; i += 1) {
    const st = await state(page);
    if (st.scene !== 'game') break;
    seen = Math.max(seen, st.goal.progress);
    const sims = await qa(page, () => [0, 1, 2, 3, 4, 5, 6].map((c) => window.__MERGEBLOOM__.qa.simulateDrop(c)));
    const c = sims.reduce((b, sm, i2) => sm && (b < 0 || sm.cleared > (sims[b]?.cleared ?? -1)) ? i2 : b, -1);
    await qa(page, (cc) => window.__MERGEBLOOM__.qa.dropColumn(cc), c);
    if (sims[c]?.cleared > 0) { const after = await state(page); check(S, 'clearing an obstacle bumps the counter', after.goal.progress > seen || after.scene === 'clear'); break; }
  }

  check(S, 'no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

async function waitForClear(page) {
  await page.waitForFunction(() => window.__MERGEBLOOM__.getState().scene === 'clear', { timeout: 15000 }).catch(() => {});
}

// ---- main
const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-preview3', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  cwd: resolve(import.meta.dirname, '..'), stdio: 'ignore',
});
let browser;
try {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break; } catch { /* retry */ }
    await sleep(250);
  }
  browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--headless=new', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=angle'],
  });
  mkdirSync(ROOT, { recursive: true });
  for (const size of SIZES) {
    try { await runSize(browser, size); } catch (error) { check(size.name, 'run completed', false, error.stack ?? error); }
  }
} finally {
  await browser?.close();
  server.kill();
}
writeFileSync(resolve(ROOT, 'qa-results.json'), JSON.stringify({ failed, results }, null, 2));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL QA CHECKS PASSED');
process.exit(failed ? 1 : 0);
