// CI-only driver for simulator verification + App Store screenshots. NEVER shipped:
// the workflow injects it into a throwaway copy of the bundle. It plays the real
// game through the same drop() path a tap uses (greedy bot over simulateDrop) and
// prints "CI:<marker>" lines (Capacitor forwards console.log to stdout).
(() => {
  const log = (msg) => console.log('CI:' + msg);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const H = () => window.__MERGEBLOOM__;
  const S = () => H().getState();
  async function until(fn, ms = 20000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (fn()) return true; await wait(50); }
    return false;
  }
  const idle = () => until(() => { const s = S(); return !s.busy && s.inputQueue === 0; }, 15000);

  function bestColumn(holdChains = false) {
    const s = S();
    let best = -1; let bestScore = -Infinity; let bestSim = null;
    for (let c = 0; c < 7; c += 1) {
      const sim = H().qa.simulateDrop(c);
      if (!sim) continue;
      if (holdChains && sim.chain >= 1) continue; // fill the board first so the screenshot shows a real mid-game
      let adj = 0;
      for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nb = s.board[sim.row + dy]?.[c + dx];
        if (nb?.kind === 'flower' && nb.level === s.nextPiece.levels[0]) adj += 1;
        if (nb?.kind === 'stone') adj += 0.5;
      }
      const score = adj * 20 + sim.cleared * 1000 + sim.created.reduce((a, l) => a + l * 50, 0) + sim.score - (9 - sim.row) * 3 + sim.chain * 400;
      if (score > bestScore) { bestScore = score; best = c; bestSim = sim; }
    }
    return { col: best, sim: bestSim };
  }

  /** Animated play until a real chain (combo) happens; returns true when the chain marker was logged. */
  async function playForChain(maxDrops = 40, minDrops = 11) {
    for (let i = 0; i < maxDrops; i += 1) {
      if (S().scene !== 'game') return false;
      let { col, sim } = bestColumn(i < minDrops);
      if (col < 0) ({ col, sim } = bestColumn());
      if (col < 0) return false;
      H().qa.dropColumn(col);
      if (sim && sim.chain >= 2 && i >= minDrops) { await wait(420); log('chain chain=' + sim.chain); await wait(2600); await idle(); return true; }
      await idle();
      await wait(80);
    }
    return false;
  }
  /** Instant greedy play to finish the level. */
  async function finishLevel(maxDrops = 80) {
    H().qa.instant = true;
    for (let i = 0; i < maxDrops && S().scene === 'game'; i += 1) {
      const { col } = bestColumn();
      if (col < 0) break;
      H().qa.dropColumn(col);
      await idle();
    }
    H().qa.instant = false;
    return S().scene;
  }
  async function winLevel(level) {
    for (let seed = 1; seed <= 10; seed += 1) {
      H().qa.instant = true;
      H().qa.startLevel(level, { tutorial: false, seed: seed * 977 });
      if (await finishLevel() === 'clear') return seed;
    }
    return 0;
  }
  function resources() {
    return performance.getEntriesByType('resource').map((e) => e.name).filter((u) => !/^(capacitor|blob|data):/.test(u) && !u.startsWith(location.origin));
  }
  function env() {
    const canvas = document.querySelector('#game canvas');
    const r = canvas ? canvas.getBoundingClientRect() : { left: -1, right: -1, top: -1, bottom: -1 };
    return 'native=' + !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
      + ' inner=' + innerWidth + 'x' + innerHeight
      + ' canvas=' + [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v)).join(',')
      + ' fullbleed=' + (canvas ? (Math.abs(r.left) < 1 && Math.abs(r.right - innerWidth) < 1 && Math.abs(r.top) < 1 && Math.abs(r.bottom - innerHeight) < 1) : false)
      + ' goatcounter=' + (typeof window.goatcounter)
      + ' sw=' + (navigator.serviceWorker ? 'api' : 'none')
      + ' audioSession=' + (navigator.audioSession ? navigator.audioSession.type : 'n/a');
  }

  async function run1() {
    await until(() => H() && H().getState, 30000);
    await wait(1500);
    log('fresh scene=' + S().scene + ' tutorial=' + S().tutorial.active + ' level=' + S().level);
    H().qa.skipTutorial();
    // Real wins for levels 1-6 (bot through the normal drop path) so the map/album show earned progress.
    const wins = [];
    for (let n = 1; n <= 6; n += 1) wins.push(await winLevel(n));
    log('wins ' + wins.join(','));
    H().qa.goto('menu'); await wait(1500);
    log('menu');
    await wait(2500);
    H().qa.goto('map'); await wait(2500);
    log('map');
    await wait(2500);
    // Animated gameplay with a real chain/combo.
    let got = false;
    for (let seed = 1; seed <= 8 && !got; seed += 1) {
      H().qa.instant = false;
      H().qa.startLevel(10, { tutorial: false, seed: seed * 131 });
      await wait(1200);
      got = await playForChain();
    }
    if (!got) log('nochain');
    // Finish a level for the clear screen (stars + celebration).
    // Clear screen: replay level 7 (instant, real rules) until a 3-star win, keep the last win otherwise.
    for (let seed = 1; seed <= 12; seed += 1) {
      H().qa.instant = true;
      H().qa.startLevel(7, { tutorial: false, seed: seed * 313 });
      if (await finishLevel() === 'clear' && S().starsEarned === 3) break;
    }
    if (S().scene !== 'clear') await winLevel(7);
    await wait(2600);
    log('clear scene=' + S().scene + ' stars=' + S().starsEarned);
    await wait(2500);
    H().qa.goto('daily'); await wait(2000);
    log('daily');
    await wait(2500);
    H().qa.goto('album'); await wait(2000);
    log('album');
    await wait(2500);
    // Persist: sound off + progress are written by the game itself.
    H().qa.goto('menu'); await wait(500);
    const sound = S().sound;
    localStorage.setItem('ci.run1', 'done');
    const best = JSON.stringify(S().bestStars);
    localStorage.setItem('ci.best', best);
    log('ext ' + JSON.stringify(resources()));
    log('run1-done best=' + best + ' sound=' + sound + ' ' + env());
  }

  async function run2() {
    await until(() => H() && H().getState, 30000);
    await wait(1500);
    const best = JSON.stringify(S().bestStars);
    log('run2 scene=' + S().scene + ' same=' + (best === localStorage.getItem('ci.best')) + ' best=' + best);
    localStorage.setItem('ci.run1', 'checked');
    await wait(2000);
    log('run2-home');
    H().qa.instant = false;
    H().qa.startLevel(12, { tutorial: false, seed: 4242 });
    await wait(1200);
    for (let i = 0; i < 2; i += 1) { const { col } = bestColumn(); if (col >= 0) H().qa.dropColumn(col); await idle(); }
    const moves = S().moves;
    const back = new Promise((resolve) => {
      let hidden = false;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { hidden = true; log('hidden'); } else if (hidden) resolve();
      });
    });
    log('bg-ready scene=' + S().scene + ' moves=' + moves);
    await back;
    await wait(1200);
    log('resumed scene=' + S().scene + ' moves=' + S().moves);
    await wait(3000);
    H().qa.goto('game');
    await wait(800);
    log('bg-done scene=' + S().scene + ' moves=' + S().moves + ' ext=' + JSON.stringify(resources()));
  }

  window.addEventListener('load', () => {
    setTimeout(() => {
      log('boot ' + env());
      const phase = localStorage.getItem('ci.run1');
      (phase === 'done' ? run2() : phase === 'checked' ? Promise.resolve(log('idle')) : run1()).catch((e) => log('error ' + (e && e.stack || e)));
    }, 300);
  });
})();
