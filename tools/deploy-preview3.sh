#!/usr/bin/env bash
# Deploy ONLY to gh-pages subfolder preview3/. Never touch the live root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ "$(git branch --show-current)" == "main" ]]; then
  echo "Refusing to deploy preview3 from main. Use the v3-polish (or feature) branch."
  exit 1
fi
npm run build -- --mode preview3
STAGE="$(mktemp -d)"
git clone --branch gh-pages --single-branch https://github.com/frankzhang-ai/merge-puzzle.git "$STAGE"
# Keep all existing root files; replace only preview3/
rm -rf "$STAGE/preview3"
mkdir -p "$STAGE/preview3"
cp -a dist-preview3/. "$STAGE/preview3/"
cd "$STAGE"
git add -A -- preview3
# Safety: only preview3/ may be staged.
BAD="$(git diff --cached --name-only | grep -v '^preview3/' || true)"
if [[ -n "$BAD" ]]; then
  echo "ABORT: staged paths outside preview3/:"; echo "$BAD"
  cd /; rm -rf "$STAGE"; exit 1
fi
if git diff --cached --quiet; then
  echo "No preview3 changes to deploy."
  cd /
  rm -rf "$STAGE"
  exit 0
fi
git -c user.name=frankzhang-ai -c user.email=frankzhang-ai@users.noreply.github.com commit -m "deploy MERGE BLOOM preview3"
git push origin gh-pages
cd /
rm -rf "$STAGE"
# GitHub Pages sometimes needs an API-triggered rebuild after a new folder is pushed.
gh api -X POST repos/frankzhang-ai/merge-puzzle/pages/builds >/dev/null || true
echo "Pushed dist-preview3/ to gh-pages:preview3/"
