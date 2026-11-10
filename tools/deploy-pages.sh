#!/usr/bin/env bash
# Live root deploy. Disabled on the preview2 / v2-art line of work.
set -euo pipefail
echo "This script deploys the LIVE root at https://frankzhang-ai.github.io/merge-puzzle/."
echo "The current v2 art/tutorial work must be deployed only with tools/deploy-preview2.sh"
echo "to https://frankzhang-ai.github.io/merge-puzzle/preview2/."
echo "Refusing to run so the live root is not changed."
exit 1
