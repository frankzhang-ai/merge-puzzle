#!/usr/bin/env bash
# Deploy ONLY to gh-pages subfolder preview2/. Never touch the live root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ "$(git branch --show-current)" == "main" ]]; then
  echo "Refusing to deploy preview2 from main. Use the v2-art (or feature) branch."
  exit 1
fi
npm run build -- --mode preview2
STAGE="$(mktemp -d)"
git clone --branch gh-pages --single-branch https://github.com/frankzhang-ai/merge-puzzle.git "$STAGE"
# Keep all existing root files; replace only preview2/
rm -rf "$STAGE/preview2"
mkdir -p "$STAGE/preview2"
cp -a dist-preview2/. "$STAGE/preview2/"
touch "$STAGE/.nojekyll"
cd "$STAGE"
git add -A
if git diff --cached --quiet; then
  echo "No preview2 changes to deploy."
  cd /
  rm -rf "$STAGE"
  exit 0
fi
git -c user.name=frankzhang-ai -c user.email=frankzhang-ai@users.noreply.github.com commit -m "deploy MERGE BLOOM preview2"
git push origin gh-pages
cd /
rm -rf "$STAGE"
# GitHub Pages sometimes needs an API-triggered rebuild after a new folder is pushed.
gh api -X POST repos/frankzhang-ai/merge-puzzle/pages/builds >/dev/null || true
echo "Pushed dist-preview2/ to gh-pages:preview2/"
