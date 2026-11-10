# Campaign levels

Starting obstacle locations are deterministic in `src/config/levels.ts`; stones are placed in open middle columns and vines wrap flowers near the bottom. Campaign pieces use per-level bias and a level/time seed. Daily generation uses the local date only. Each goal listed with AND is required alongside the main goal. Star thresholds are moves remaining at clear; level 1 awards 2★ at 3 moves and 3★ at 8 moves.

| Level | Boss | Goal | Moves | 2★ remaining | 3★ remaining | Starting obstacles | Piece bias |
|---:|:---:|---|---:|---:|---:|---|---|
| 1 | No | Make 1 × Lv.3 | 20 | 3 | 8 | None | mostly singles L1; occasional L2 |
| 2 | No | Make 2 × Lv.3 | 18 | 3 | 7 | None | singles L1–L2 |
| 3 | No | Score 200 | 20 | 3 | 8 | None | singles L1–L2 |
| 4 | No | Clear 3 obstacles | 16 | 3 | 6 | 3 stones | singles L1–L2 |
| 5 | Yes | Make 1 × Lv.4 AND clear 2 obstacles | 18 | 3 | 7 | 2 stones + L1 flowers | singles L1–L2 |
| 6 | No | Make 3 × Lv.3 | 18 | 3 | 7 | None | occasional pairs L1–L2 |
| 7 | No | Clear 4 obstacles | 16 | 3 | 6 | 4 vine flowers | singles and pairs L1–L2 |
| 8 | No | Score 400 | 18 | 3 | 6 | None | singles L1–L3 |
| 9 | No | Make 2 × Lv.4 | 20 | 3 | 7 | None | singles L1–L3 |
| 10 | Yes | Make 1 × Lv.5 AND clear 3 obstacles | 20 | 3 | 7 | 3 stones (one hp2) | mixed L1–L3 |
| 11 | No | Clear 4 obstacles | 18 | 3 | 6 | 4 stones | singles L1–L3 |
| 12 | No | Make 4 × Lv.3 | 16 | 3 | 5 | None | singles L1–L3 |
| 13 | No | Score 600 | 18 | 3 | 6 | None | singles and pairs L1–L3 |
| 14 | No | Clear 6 obstacles | 20 | 3 | 7 | 3 stones + 3 vines | mixed L1–L3 |
| 15 | Yes | Make 2 × Lv.5 AND score 200 | 22 | 3 | 8 | 2 stones (clutter) | singles and pairs L1–4 |
| 16 | No | Make 3 × Lv.4 | 20 | 3 | 7 | None | singles and pairs L1–4 |
| 17 | No | Clear 6 obstacles | 18 | 3 | 6 | 6 vine flowers | singles and pairs L1–4 |
| 18 | No | Score 800 | 20 | 3 | 6 | None | singles and pairs L1–4 |
| 19 | No | Make 1 × Lv.6 | 24 | 3 | 8 | None | pieces L1–L3 |
| 20 | Yes | Make 1 × Lv.6 AND clear 4 obstacles | 24 | 3 | 8 | 4 stones (one hp2) | pieces L1–4 |
| 21 | No | Clear 7 obstacles | 20 | 3 | 6 | 5 stones + 2 vines | mixed L1–4 |
| 22 | No | Make 4 × Lv.4 | 20 | 3 | 6 | None | pieces L1–4 |
| 23 | No | Score 1000 | 20 | 3 | 6 | None | pieces L1–4 |
| 24 | No | Make 2 × Lv.6 | 24 | 3 | 8 | None | pieces L1–4 |
| 25 | Yes | Make 1 × Lv.7 AND clear 7 obstacles | 26 | 3 | 9 | 4 stones (two hp2) + 3 vines | pieces L1–5 |
| 26 | No | Make 5 × Lv.4 | 22 | 3 | 7 | None | pieces L1–5 |
| 27 | No | Clear 8 obstacles | 22 | 3 | 7 | 4 stones + 4 vines | mixed L1–5 |
| 28 | No | Score 1500 | 22 | 3 | 7 | None | pieces L1–5 |
| 29 | No | Make 2 × Lv.7 | 26 | 3 | 8 | None | pieces L1–4 |
| 30 | Yes | Make 1 × Lv.8 AND score 800 AND clear 4 obstacles | 30 | 3 | 10 | 4 stones (two hp2) | pieces L1–4 |
