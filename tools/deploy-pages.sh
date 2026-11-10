#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run build
STAGE="$(mktemp -d)"
cp -a dist/. "$STAGE/"
cd "$STAGE"
git init -q
git checkout -q -b gh-pages
git -c user.name=frankzhang-ai -c user.email=frankzhang-ai@users.noreply.github.com add -A
git -c user.name=frankzhang-ai -c user.email=frankzhang-ai@users.noreply.github.com commit -qm "deploy MERGE BLOOM"
git push -f https://github.com/frankzhang-ai/merge-puzzle.git HEAD:gh-pages
cd /
rm -rf "$STAGE"
echo "Pushed dist/ to gh-pages."
