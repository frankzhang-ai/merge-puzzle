// Build the MERGE BLOOM game (branch code, vite mode "ios") into native/www and
// apply native-only changes: no analytics, no service worker, no web manifest,
// ambient audio session, in-app privacy page for the iOS app.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'native/www');
await rm(out, { recursive: true, force: true });
execFileSync('npx', ['vite', 'build', '--mode', 'ios', '--outDir', out, '--emptyOutDir'], { cwd: root, stdio: 'inherit' });

function mustReplace(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`copy-web: pattern not found (${label})`);
  return next;
}

for (const f of ['sw.js', 'manifest.webmanifest']) await rm(resolve(out, f), { force: true });
for (const f of ['splash-1170x2532.png', 'splash-1290x2796.png', 'splash-750x1334.png', 'splash-512.png', 'maskable-192.png', 'maskable-512.png'])
  await rm(resolve(out, 'icons', f), { force: true });

let html = await readFile(resolve(out, 'index.html'), 'utf8');
html = mustReplace(html, /\s*<link\b[^>]*rel=["']manifest["'][^>]*>/i, '', 'manifest');
html = html.replace(/\s*<link\b[^>]*rel=["']apple-touch-startup-image["'][^>]*>/gi, '');
html = html.replace(/\s*<meta name="(apple-mobile-web-app-capable|mobile-web-app-capable)"[^>]*>/gi, '');
// Analytics are disabled in the app (App Privacy: Data Not Collected).
html = mustReplace(html, /\s*<script>\s*const skipAnalytics[\s\S]*?<\/script>/i, '', 'goatcounter loader');
// Sound effects follow the Ring/Silent switch and mix with other audio (iOS 17+ WebKit Audio Session API;
// AppDelegate also sets AVAudioSession .ambient).
html = mustReplace(html, /<title>/i,
  `<script>try{if(navigator.audioSession)navigator.audioSession.type='ambient'}catch(e){}</script>\n    <title>`, 'audioSession');
if (/goatcounter|gc\.zgo\.at|serviceWorker/i.test(html)) throw new Error('copy-web: analytics/service worker still referenced in index.html');
await writeFile(resolve(out, 'index.html'), html);

let privacy = await readFile(resolve(out, 'privacy.html'), 'utf8');
privacy = mustReplace(privacy, 'initial-scale=1">', 'initial-scale=1, viewport-fit=cover">', 'privacy viewport');
privacy = mustReplace(privacy, '</style>',
  '      body{padding-top:calc(env(safe-area-inset-top,0px) + 8px);padding-bottom:calc(env(safe-area-inset-bottom,0px) + 32px);margin-top:0}\n      p:first-of-type a{display:inline-block;padding:10px 0}\n    </style>', 'privacy safe area');
privacy = mustReplace(privacy, /<section>\s*<h2>Analytics<\/h2>[\s\S]*?<\/section>/,
  `<section>
      <h2>No analytics, no tracking</h2>
      <p>The MERGE BLOOM iPhone app contains no analytics, no advertising, and no third-party SDKs.
        It makes no network requests while you play and works fully offline. We do not collect any data
        from the app, and nothing is used to track you.</p>
    </section>`, 'privacy analytics');
privacy = privacy.replace(/<section>\s*<h2>Advertising<\/h2>[\s\S]*?<\/section>/,
  `<section>
      <h2>Advertising and purchases</h2>
      <p>The app shows no ads and has no in-app purchases.</p>
    </section>`);
privacy = mustReplace(privacy, /Effective date: [^<]+\./, 'Effective date: November 20, 2026.', 'privacy date');
if (/goatcounter/i.test(privacy)) throw new Error('copy-web: privacy page still mentions analytics');
await writeFile(resolve(out, 'privacy.html'), privacy);

// Final gate: nothing in the bundle may load the analytics network script or any remote script.
async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir)) { const p = join(dir, e); (await stat(p)).isDirectory() ? files.push(...await walk(p)) : files.push(p); }
  return files;
}
for (const f of await walk(out)) {
  if (!/\.(html|js|css|json)$/.test(f)) continue;
  const text = await readFile(f, 'utf8');
  if (/gc\.zgo\.at|goatcounter\.com\/count/.test(text)) throw new Error(`copy-web: analytics endpoint in ${f}`);
  if (/<script[^>]+src=["'](https?:)?\/\//i.test(text)) throw new Error(`copy-web: remote script in ${f}`);
}
console.log('copy-web: native/www ready (no analytics, no service worker)');
