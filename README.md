# MERGE BLOOM

A portrait-friendly merge puzzle: drop flowers into columns, merge groups of three or more, clear obstacles, and complete 30 campaign levels or a daily challenge. Build your flower album and unlock garden skins.

## Rules

Tap a column to drop the previewed flower or vertical pair. Flowers fall with gravity; orthogonally connected groups of at least three merge and can create chains. Stones take damage beside a merge, vines protect wrapped flowers until cleared. Complete each level goal before moves run out.

## Development

- `npm run dev` starts Vite.
- `npm test` runs pure rule tests.
- `npm run build` type-checks and creates `dist/`.
- `npm run preview` previews the production build.
- `python3 tools/make_icons.py` generates PWA icons.

The live root URL is https://frankzhang-ai.github.io/merge-puzzle/ (do not overwrite it from the v2 branch).

The art/tutorial preview deploys only to the `preview2/` folder on the `gh-pages` branch with `bash tools/deploy-preview2.sh`. That preview uses a separate service-worker cache prefix (`mp2-`) and localStorage prefix (`mp2.`) so it cannot corrupt the live root saves. Preview URL: https://frankzhang-ai.github.io/merge-puzzle/preview2/.
