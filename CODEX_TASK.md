# MERGE BLOOM — Codex Task Round 1: Core engine, levels, screens, docs

You are building a new web PWA merge-puzzle game called **MERGE BLOOM** in `/workspace/merge-puzzle`.

The folder already has `package.json`, `tsconfig.json`, `.gitignore`, and `node_modules` (Phaser 3.90, Vite 8, TypeScript 5.9) installed. Do **not** reinstall unless needed. Do **not** touch any other repo (no `/workspace/color-factory*`, no `/workspace/one-second`, no Lovable repos). Do **not** git commit, push, deploy, publish, or spend money. I will commit and deploy.

Write a complete, playable, type-checked game. After you finish, `npm test` and `npm run build` must succeed.

## Product

Portrait mobile-browser PWA. Style must match COLOR FACTORY cute: macaron pastels, rounded shapes, soft blush background `#fff6fb`, ink `#59465b`, muted `#77746d`, candy buttons with shadow + white highlight, SF Pro Rounded / system-ui / -apple-system. Palette to reuse:

- coral/pink `#ff8fab` / `#ffb3c7`
- peach `#ffd1a8`
- butter `#ffd45e` / `#fff1a8`
- mint `#70cda9` / `#b5ead7`
- sky `#75c9f5` / `#a8d8ff`
- lilac `#b993f5` / `#d7c4ff`
- soft ground ellipse at the bottom like the cute version

Art is 100% code/canvas/SVG (Phaser Graphics baked to textures). Flowers are cute rounded blossoms with glossy highlight, eyes, blush, smile. 8 levels of flowers get progressively more petals / richer color. No raster photos.

## Game rules (implement exactly)

- Board: **7 columns × 9 rows**. Gravity down. Row 0 is the top.
- Each turn a **piece** appears (previewed above the board): either **1 flower** or a **vertical pair** (two flowers). Player **taps a column** to drop the piece. The whole column is tappable (not just a small tile).
  - Single: occupies the lowest empty cell in that column.
  - Pair: drops as a stack in the **same** column (bottom flower of the pair first, then the top). The column must have 2 empty cells; otherwise the tap is rejected with a short shake (do not consume a move).
  - If no column can fit the current piece, the player **fails** (board full).
- After a successful drop, apply **gravity**, then resolve merges, repeating until stable (chains).
- Merge: orthogonally (4-dir) connected groups of **3 or more same-level flowers** merge into **one** flower of `level+1`, placed at the cell of the most recently dropped/created flower in the group if that cell is in the group, else the bottom-most then left-most cell of the group. Other cells in the group become empty, then gravity, then check again.
- Max flower level is **8**. A group of 3+ level-8 flowers **blooms and clears** (they vanish, award score, no level-9 flower).
- Flowers have levels 1–8.
- **Obstacles**
  - **Stone**: solid blocker, cannot be dropped onto. `hp` 1 normally, 2 on some boss levels. An orthogonal merge adjacent to the stone deals 1 hp. At 0 hp the stone is removed and counts as an obstacle cleared.
  - **Vine**: wraps a flower (cell has a flower + vine). A vine-wrapped flower **cannot be part of a merge**. An orthogonal merge adjacent to the vine (or a merge that would have included the wrapped flower if the vine were gone) removes the vine but leaves the flower. Clearing a vine counts as an obstacle cleared. You may drop a piece into an empty cell; vines do not occupy empty cells in v1 — they only wrap existing flowers on the starting board (and never wrap stones).
- **Moves**: each successful drop costs 1 move. When moves reach 0 and the goal is not met after the resulting chains, the player fails. If a drop’s chains complete the goal, the level is cleared even if moves become 0.
- **Score**: when a group of N (N>=3) level-L flowers merges (or level-8 clears), add `L * 10 * N * chainIndex` points, where chainIndex is 1 for the first merge wave, 2 for the second wave, etc.
- **Stars** (on clear): 1 star if the goal is met; 2 stars if `movesLeft >= twoStar`; 3 stars if `movesLeft >= threeStar`. Thresholds are per-level (see table). Save the **best** stars per level. Completing level N unlocks N+1.
- **Goals** (a level may have one or, for bosses, a combination — all listed parts must be met):
  - `make`: make (create by merge or bloom) at least `count` flowers of `level` during this level (count creations, not current board presence). Level-8 blooms count as “making” a level-8 flower.
  - `clear`: clear at least `count` obstacles (stones + vines) this level. Starting board obstacles are the ones to clear; only obstacles present at start plus none spawned mid-level in v1.
  - `score`: reach at least `score` points this level (level score, not career).

## 30-level campaign (document in docs/LEVELS.md AND encode in src/config/levels.ts)

Columns: level, boss, goal, moves, twoStar, threeStar, obstacles on start, piece bias notes.

Design starting boards in code (deterministic). Stones/vines should be reachable (not sealed in impossible pockets). Early levels are easy tutorial-like; bosses are clearly marked in the map.

1. make 1× L3, moves 20, stars 3/8, 2/3, empty, almost all singles L1 (occasionally L2)
2. make 2× L3, moves 18, 3/7, 2/3, empty, singles L1–L2
3. score 200, moves 20, 3/8, 2/3, empty, singles L1–L2
4. clear 3 stones (hp1), moves 16, 3/6, 2/2, 3 stones mid-board with space around them, singles L1–L2
5. **BOSS** make 1× L4 AND clear 2 stones, moves 18, 3/7, 2/3, 2 stones + a few L1 flowers, singles, L1–L2
6. make 3× L3, moves 18, 3/7, 2/3, empty, start introducing occasional pairs
7. clear 4 vines, moves 16, 3/6, 2/2, 4 vine-wrapped L1/L2 flowers, singles+pairs L1–L2
8. score 400, moves 18, 3/6, 2/2, empty
9. make 2× L4, moves 20, 3/7, 2/3, empty
10. **BOSS** make 1× L5 AND clear 3 stones, moves 20, 3/7, 2/3, 3 stones (one hp2), mixed pieces L1–L3
11. clear 4 stones, moves 18, 3/6, 2/2, 4 stones
12. make 4× L3, moves 16, 3/5, 2/2, empty
13. score 600, moves 18, 3/6, 2/2, empty
14. clear 3 stones + 3 vines (goal count 6), moves 20, 3/7, 2/3, mixed obstacles
15. **BOSS** make 2× L5 AND score 200, moves 22, 3/8, 2/3, a couple of stones as clutter (not required)
16. make 3× L4, moves 20, 3/7, 2/3, empty
17. clear 6 vines, moves 18, 3/6, 2/2, 6 vines
18. score 800, moves 20, 3/6, 2/2, empty
19. make 1× L6, moves 24, 3/8, 2/3, empty, pieces L1–L3
20. **BOSS** make 1× L6 AND clear 4 stones, moves 24, 3/8, 2/3, 4 stones (one hp2)
21. clear 5 stones + 2 vines (goal 7), moves 20, 3/6, 2/2, those obstacles
22. make 4× L4, moves 20, 3/6, 2/2, empty
23. score 1000, moves 20, 3/6, 2/2, empty
24. make 2× L6, moves 24, 3/8, 2/3, empty
25. **BOSS** make 1× L7 AND clear 4 stones + 3 vines (goal obstacles 7), moves 26, 3/9, 2/3, those obstacles (two stones hp2)
26. make 5× L4, moves 22, 3/7, 2/3, empty
27. clear 8 mixed obstacles (4 stones + 4 vines), moves 22, 3/7, 2/3
28. score 1500, moves 22, 3/7, 2/2, empty
29. make 2× L7, moves 26, 3/8, 2/3, empty, pieces L1–L4
30. **BOSS** make 1× L8 AND score 800 AND clear 4 stones, moves 30, 3/10, 2/4, 4 stones (two hp2), pieces L1–L4

Piece generators are seeded per level (and per daily date) so a level is consistent for a given run start, but use a fresh RNG stream each time the level starts (seed = `level * 99991 + attempt` or similar stored attempt count — actually: seed with `levelNumber * 100003 + Date.now()` is fine for campaign variety; daily MUST be date-only seed). Document the piece bias in LEVELS.md.

## Daily challenge

- Name the mode clearly on the menu: “Daily Challenge”.
- Seed all generation (board, goal, pieces) with the **local calendar date** `YYYY-MM-DD`. Same device date ⇒ same challenge.
- Goal type rotates by day-of-year: make / clear / score / combined, medium difficulty (about level 12–16 strength), moves ~20.
- Track `lastCompletedDate` and `streak`. If the player completes today’s challenge: if lastCompleted was yesterday, streak+1; if lastCompleted is today, do not change; else streak = 1. If they open the game after a missed day, streak is only reset when they complete a non-consecutive day (don’t zero the displayed streak until a missed completion happens — show current streak and whether today is done).
- Rewards: streak **3** unlocks skin **Dawn Petal**; streak **7** unlocks skin **Night Bloom**. Unlock once earned, permanently. Show a clear celebration the first time.
- Event: `mp-daily-play` when a daily run actually starts (once per open of that day’s run is ok, not on every resume).

## Power-ups

- **Undo**: restore board, score, moves, goal progress, and current/next piece to the state before the last successful drop (or last hammer/shuffle). One-step undo. Disabled if nothing to undo.
- **Hammer**: enter targeting mode; tap a flower to remove it (then gravity+merges). Can also deal 1 hp to a stone or remove a vine (leaving the flower). Cancel by tapping the hammer button again. Does not spend a move.
- **Shuffle**: randomly permute all non-obstacle, non-vine-wrapped? Actually permute all **unwrapped flowers** among the cells that currently hold unwrapped flowers, then gravity, then resolve merges. Stones and vine-wrapped flowers stay put. Does not spend a move.
- Each power-up has **1 free use per local day**. Remaining counts shown on the buttons. Reset at local date change.
- When a free use is exhausted, the button stays visible but shows a clearly marked **“Ad (soon)”** / rewarded-ad hook that is **disabled** (tapping may toast “Rewarded ads coming later”). Do not integrate any ad SDK. Leave a single function like `tryRewardedAd(kind): Promise<boolean>` that currently returns false and is the only hook to replace later.
- Power-up buttons must have large full-rect hit areas (min ~96×96 game pixels), label + icon, not just a tiny glyph.

## Garden / album

- Record the first time the player **creates** each flower level 1–8 (level 1: first time a L1 is dropped or seen on a board; levels 2–8: first time that level is created by a merge or a level-8 bloom).
- Album screen: 8 cute frames in a garden layout; locked slots are silhouettes; unlocked show the flower + name. Names (English, floral, short): e.g. Blush Bud, Peach Bell, Butter Bloom, Mint Daisy, Sky Tulip, Lilac Rose, Coral Peony, Golden Crown. You may refine names but keep them wholesome and clear.
- Filling all 8 unlocks skin **Rainbow Garden** (permanent), with a one-time celebration.
- Skin is selectable from the album or menu (only unlocked skins). Skins change flower accessories / petal style, not the merge rules. Default skin **Classic**.

## Screens / flow

Phaser canvas **780×1688**, `Phaser.Scale.FIT` + `CENTER_BOTH`, background `#fff6fb`, `input.activePointers: 3`, antialias on. Safe-area friendly padding in CSS like color-factory-cute.

Screens (scenes):
1. **Boot** — hide HTML splash after ready.
2. **Menu** — title MERGE BLOOM, tagline (e.g. “Drop. Merge. Bloom.”), big PLAY, Daily Challenge, Garden/Album, muted/sound toggle (whole button tappable). Soft floating pastel shapes in the background.
3. **Map** — 30-level winding map (nodes, path, lock, stars 1–3, boss badges on 5/10/15/20/25/30). Scrollable if needed but all nodes must be reachable and not overlapping labels at 375×667 letterbox. Tap an unlocked level to open the goal card. Back to menu.
4. **Goal card** — level number, boss banner if boss, clearly worded goal, move count, star thresholds, PLAY / BACK. This is the “goal card” screenshot.
5. **Game** — HUD: level or “DAILY”, moves left, score, goal progress (e.g. “Make two Lv.4 flowers 1/2”), mute, pause/map. Next-piece preview at the top of the board. 7×9 board with rounded well, column tap highlights. Power-up row at the bottom with remaining uses. During chains, ignore new drops until resolved.
6. **Pause** — resume, restart, map/menu, mute. Full-rect buttons.
7. **Clear** — stars animate in, goal recap, NEXT / MAP. If a new skin unlocked, say so.
8. **Fail** — friendly “Board full” or “No moves left”, RETRY / MAP. No shame-y copy.
9. **Daily** intro card (today’s goal, streak, play) then reuse Game scene with a daily flag; on clear/fail return to daily result then menu.
10. **Album/Garden** — collection, skin picker, back.

All interactive buttons: `setInteractive` on the **full rounded rectangle** (the visible button body), not a small icon. Minimum comfortable size. This was a real past bug — be careful with Container origins vs hit areas.

## Juice (include a solid baseline in this round; round 2 will polish)

- Drop: squash (scaleY down / scaleX up) then bounce back (Back.Out / Bounce).
- Merge: shrink-pop the group, spawn the new flower with a bounce, pastel particle burst.
- Chains: more particles, stronger punch, higher audio pitch as chain index rises.
- Floating text: chain 2 “NICE”, 3 “GREAT”, 4 “AMAZING”, 5+ “BLOOM!”.
- WebAudio synthesized tones (no audio files). Mute toggle persisted. Unlock AudioContext on first pointer/touch like color-factory.
- Do not block logic correctness on juice: support `instant` mode (tweens duration 0) when `?qa=1` is in the URL or `window.__MERGEBLOOM__.qa.instant = true`.

## Tech requirements

- Phaser 3 + TypeScript + Vite. Relative paths. `base: './'` in vite.config.ts.
- Service worker with versioned cache: copy the precache Vite plugin approach from `/workspace/color-factory/vite.config.ts` and `/workspace/color-factory/public/sw.js`. Cache prefix `mergebloom-`. Replace `__BUILD_HASH__` at build time. Include `public/sw.js` template. Register only in `import.meta.env.PROD`. Scope is `./`.
- `index.html`: viewport-fit=cover, apple-mobile-web-app-capable, mobile-web-app-capable, apple-mobile-web-app-title “Merge Bloom”, theme-color `#fff6fb`, manifest, apple-touch-icon 180, favicon 32, a few apple-touch-startup-image links if you generate splashes. Launch splash HTML overlay (like cute version) with pastel dots + “MERGE BLOOM”.
- GoatCounter script on the page: `data-goatcounter="https://onesecond.goatcounter.com/count"` and `//gc.zgo.at/count.js` — BUT do **not** inject/load the script on localhost, 127.0.0.1, or when `navigator.webdriver` is true, or when `?qa=1` is present. Event helper must also no-op in those cases.
- Events (path names exactly): `mp-level-start-N`, `mp-level-clear-N`, `mp-level-fail-N` (N is the campaign level number, 1–30), `mp-daily-play`, `mp-continue` (returning visitor on a later local day than first visit — similar to color-factory trackReturns, but one event named `mp-continue`).
- localStorage prefix **`mp.`** (e.g. `mp.progress`, `mp.sound`, `mp.skin`, `mp.album`, `mp.daily`, `mp.power`, `mp.first`, `mp.lastReturn`). Never write other prefixes.
- `privacy.html` in public/ (copied into dist): adapt `/workspace/one-second/privacy.html` style/text for MERGE BLOOM. Contact: **playonesecond@proton.me**. Effective date November 10, 2026. Mention: no account, progress/settings only on device, GoatCounter cookie-less analytics, no ads currently, no personal info from children, contact email. Link back to `./index.html`.
- README.md: what the game is, rules short, `npm run dev/build/preview/test`, how to deploy (build dist/, publish to GitHub Pages `gh-pages` branch root, include `.nojekyll`), icons via `python3 tools/make_icons.py`.
- `docs/LEVELS.md`: full difficulty table (level, boss flag, goal, moves, twoStar, threeStar, starting obstacles, piece bias). Must match the code.
- Icons: write `tools/make_icons.py` (Pillow) generating `public/icons/icon-180.png`, `icon-192.png`, `icon-512.png`, `maskable-192.png`, `maskable-512.png`, `favicon-32.png`, optional `icon.svg`, and a few splashes. Motif: a rounded pastel tile with a cute 5-petal flower (pink/mint/sky). Run the script so the PNGs exist.
- Manifest: name “MERGE BLOOM”, short_name “Merge Bloom”, start_url `./`, scope `./`, standalone, portrait, theme/background `#fff6fb`, icons 192/512 + maskable.
- Add `.nojekyll` in public/.
- Keep initial transfer reasonably small. Prefer a single vendor chunk. After build, you don’t need to hit 350KB gzip if Phaser can’t; just don’t add huge assets. No image atlases besides the generated icons/splashes.

## QA / debug hook (required)

Expose `window.__MERGEBLOOM__` with:

```ts
{
  getState: () => frozen snapshot {
    scene: 'boot'|'menu'|'map'|'goal'|'game'|'pause'|'clear'|'fail'|'daily'|'album',
    mode: 'campaign'|'daily',
    level: number | null,
    moves, score, goal: { type, text, progress, target, done },
    board: (null | { kind:'flower', level:number, vine?:boolean } | { kind:'stone', hp:number })[][], // [row][col], row 0 = top
    nextPiece: { levels: number[] },
    starsEarned, bestStars: number[], // length 30
    album: boolean[8],
    daily: { date, streak, completedToday, skins },
    powerups: { undo, hammer, shuffle, adHookDisabled: true },
    sound, skin,
    layout: {   // axis-aligned rects in GAME pixels (780x1688 space)
      board, columns: [{col,x,y,w,h} x7],
      buttons: Record<string, {x,y,w,h}> // play, daily, album, mute, map nodes if present,
      // goalPlay, back, pause, resume, retry, next, undo, hammer, shuffle, columns already listed
    },
    fx: { lastText, chain, particles, lastSound }
  },
  qa: {
    instant: boolean,
    goto(scene, data?),
    startLevel(n, opts?), // opts can override moves/board/piece
    startDaily(),
    setBoard(grid),
    setPiece(levels),
    dropColumn(col), // 0-6, resolves fully if instant
    tickInstant(), // flush tweens
    useUndo(), useHammerAt(col,row), useShuffle(),
    setDate(iso), // for daily tests
    unlockAlbum(),
    resetStorage(),
  }
}
```

`getState().layout.buttons` and `columns` must be accurate so Playwright can tap by transforming game coords through the canvas CSS box. Update layout every frame or on every scene create.

Also refresh Phaser scale bounds on touchstart/pointerdown (capture) and on resize/orientationchange, like color-factory `main.ts`.

## Code structure (suggested, you may refine)

```
src/main.ts
src/style.css
src/config/gameConfig.ts
src/config/theme.ts
src/config/levels.ts
src/systems/board.ts      // pure: place, gravity, findGroups, merge, score, obstacles — NO Phaser
src/systems/pieces.ts     // piece RNG
src/systems/progress.ts   // stars, unlocks
src/systems/storage.ts
src/systems/daily.ts
src/systems/album.ts
src/systems/powerups.ts
src/systems/audio.ts
src/systems/analytics.ts
src/systems/state.ts      // hook
src/objects/draw.ts       // flowers, buttons, stones, vines
src/scenes/*.ts
tests/board.test.ts
tests/progress.test.ts
tests/daily.test.ts
tests/analytics.test.ts
```

Pure logic must live in `src/systems` without Phaser so Node tests can import it with `node --experimental-strip-types --test`.

Tests must cover:
- gravity
- 3+ merge, no merge for 2, diagonal does not count
- chain reaction (e.g. merge creates a flower that completes another group)
- level 8 bloom clears
- pair placement needs 2 cells; reject otherwise
- board-full detection
- stone hp / vine blocking merge / adjacent merge clears them
- score formula and star thresholds
- daily streak: first day=1, next day=2, skip a day resets to 1, same day doesn’t double
- album unlock of Rainbow Garden only when all 8 are collected
- analytics no-ops when skipped; `mp-continue` on a later day
- power-up daily remaining counts

## Implementation quality

- Strict TypeScript, no `any` unless truly necessary and rare.
- No fake customer quotes, no invented metrics on any UI copy.
- English UI (short, friendly, clear).
- Deterministic board helpers for QA.
- If you start a dev server, stop it before you finish.
- When done, print a short summary of files created, anything you didn’t finish, and `npm test` / `npm run build` results.

Write the complete game now. Prefer working end-to-end over empty stubs. Every listed screen must be playable.
