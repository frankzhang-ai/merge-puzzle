#!/usr/bin/env bash
# Build MergeBloom-iOS-mac.zip: a self-contained Xcode project (no node/npm, no
# network needed on the Mac). Capacitor + plugin Swift packages are vendored
# under Vendor/ and referenced by relative path.
# Usage (from native/): bash scripts/make-ios-mac-bundle.sh [output-dir]
set -euo pipefail
cd "$(dirname "$0")/.."
NATIVE="$PWD"
OUTDIR="${1:-$NATIVE/../native-builds}"
mkdir -p "$OUTDIR"; OUTDIR="$(cd "$OUTDIR" && pwd)"
CAP_SPM_VERSION=8.6.0
STAGE="$(mktemp -d)"; B="$STAGE/MergeBloom-iOS"
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

[ -d node_modules/@capacitor/ios ] || npm ci --no-audit --no-fund
[ -d ../node_modules/vite ] || (cd .. && npm ci --no-audit --no-fund)
node scripts/copy-web.mjs
npx cap sync ios

mkdir -p "$B"
cp -R ios/App "$B/App"
cp ios/debug.xcconfig "$B/debug.xcconfig"
rm -rf "$B/App/build" "$B/App/DerivedData" "$B/App/Pods" "$B/App/output"
find "$B" -name xcuserdata -type d -prune -exec rm -rf {} +
find "$B" -name .DS_Store -delete

# Vendor capacitor-swift-pm (binary xcframeworks, checksum-verified).
V="$B/Vendor"; mkdir -p "$V/capacitor-swift-pm"
PKG_URL="https://raw.githubusercontent.com/ionic-team/capacitor-swift-pm/$CAP_SPM_VERSION/Package.swift"
curl -fsSL "$PKG_URL" -o "$STAGE/upstream-Package.swift"
for fw in Capacitor Cordova; do
  want=$(awk -v n="$fw" '/binaryTarget\(/ {b=1} b && $0 ~ "name: \""n"\"" {f=1} f && /checksum:/ {gsub(/.*checksum: "|".*/,""); print; exit}' "$STAGE/upstream-Package.swift")
  curl -fsSL "https://github.com/ionic-team/capacitor-swift-pm/releases/download/$CAP_SPM_VERSION/$fw.xcframework.zip" -o "$STAGE/$fw.zip"
  got=$(sha256 "$STAGE/$fw.zip")
  [ "$got" = "$want" ] || { echo "checksum mismatch for $fw: $got != $want" >&2; exit 1; }
  (cd "$V/capacitor-swift-pm" && unzip -q "$STAGE/$fw.zip")
  [ -d "$V/capacitor-swift-pm/$fw.xcframework" ] || { echo "missing $fw.xcframework" >&2; exit 1; }
done
cat > "$V/capacitor-swift-pm/Package.swift" <<SWIFT
// swift-tools-version:5.3
// Vendored copy of ionic-team/capacitor-swift-pm $CAP_SPM_VERSION (local binary targets, no download).
import PackageDescription

let package = Package(
    name: "capacitor-swift-pm",
    products: [
        .library(name: "Capacitor", targets: ["Capacitor"]),
        .library(name: "Cordova", targets: ["Cordova"])
    ],
    dependencies: [],
    targets: [
        .binaryTarget(name: "Capacitor", path: "Capacitor.xcframework"),
        .binaryTarget(name: "Cordova", path: "Cordova.xcframework")
    ]
)
SWIFT

# Vendor the Capacitor plugins (Swift sources only), pointing at the local capacitor-swift-pm.
for pair in app:CapacitorApp haptics:CapacitorHaptics status-bar:CapacitorStatusBar; do
  npm_name="${pair%%:*}"; pkg="${pair##*:}"; src="node_modules/@capacitor/$npm_name"
  mkdir -p "$V/$pkg"
  cp -R "$src/ios" "$V/$pkg/ios"; cp "$src/LICENSE" "$src/package.json" "$V/$pkg/"
  sed -E 's#\.package\(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "[^"]+"\)#.package(path: "../capacitor-swift-pm")#' \
    "$src/Package.swift" > "$V/$pkg/Package.swift"
done

# Point CapApp-SPM at the vendored packages.
sed -i.bak -E \
  -e 's#\.package\(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "[^"]+"\)#.package(path: "../../Vendor/capacitor-swift-pm")#' \
  -e 's#path: "\.\./\.\./\.\./node_modules/@capacitor/app"#path: "../../Vendor/CapacitorApp"#' \
  -e 's#path: "\.\./\.\./\.\./node_modules/@capacitor/haptics"#path: "../../Vendor/CapacitorHaptics"#' \
  -e 's#path: "\.\./\.\./\.\./node_modules/@capacitor/status-bar"#path: "../../Vendor/CapacitorStatusBar"#' \
  -e 's#// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands#// Self-contained Mac bundle: dependencies are vendored under ../../Vendor (no network, no node_modules).#' \
  "$B/App/CapApp-SPM/Package.swift"
rm -f "$B/App/CapApp-SPM/Package.swift.bak"

# Self-containment checks.
if grep -RIl --include=Package.swift -E 'url:|path: "[^"]*node_modules' "$B"; then echo "remote/node_modules reference left" >&2; exit 1; fi
if grep -RIl -E 'gc\.zgo\.at|goatcounter\.com/count' "$B/App/App/public"; then echo "analytics left in bundle" >&2; exit 1; fi
[ ! -e "$B/App/App/public/manifest.webmanifest" ] || { echo "web manifest in bundle" >&2; exit 1; }
[ ! -e "$B/App/App/public/sw.js" ] || { echo "service worker in bundle" >&2; exit 1; }

cat > "$B/先读我-README.txt" <<'TXT'
MERGE BLOOM – iOS Xcode 工程（自包含，不需要 node/npm，也不需要联网下载依赖）

打开方式：双击 App/App.xcodeproj（用 Xcode 打开）。
上传步骤见同目录的 MAC-UPLOAD-GUIDE.md。

Bundle ID: com.frankzhang.mergebloom   Version 1.0.0 (Build 1)
Team: B82V7J8MC5（请在 Xcode → App target → Signing & Capabilities 核对/改成你自己的 Team）
依赖：Vendor/ 里是 Capacitor 8.6.0 与 App/Haptics/StatusBar 插件的本地副本。
注意：不要在这个目录里运行 npx cap sync（它会把依赖路径改回 node_modules）。
TXT

[ -f "$NATIVE/../appstore/MAC-UPLOAD-GUIDE.md" ] && cp "$NATIVE/../appstore/MAC-UPLOAD-GUIDE.md" "$B/MAC-UPLOAD-GUIDE.md"

rm -f "$OUTDIR/MergeBloom-iOS-mac.zip"
(cd "$STAGE" && zip -qry "$OUTDIR/MergeBloom-iOS-mac.zip" MergeBloom-iOS)
rm -rf "$STAGE"
ls -l "$OUTDIR/MergeBloom-iOS-mac.zip"
