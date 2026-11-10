import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';

function serviceWorker(): Plugin {
  return {
    name: 'mergebloom-service-worker',
    generateBundle(_options, bundle) {
      const builtFiles = Object.keys(bundle).filter((file) => /\.(js|css)$/.test(file));
      const icons = [
        'icon-180.png', 'icon-192.png', 'icon-512.png', 'maskable-192.png',
        'maskable-512.png', 'favicon-32.png', 'icon.svg', 'splash-512.png',
        'splash-1170x2532.png', 'splash-1290x2796.png', 'splash-750x1334.png',
      ].map((file) => `./icons/${file}`);
      const manifest = [
        './index.html', './manifest.webmanifest', './privacy.html', './favicon.ico', ...icons,
        ...builtFiles.map((file) => `./${file}`),
      ];
      const digest = createHash('sha256');
      for (const file of builtFiles.sort()) {
        const asset = bundle[file];
        if (asset) digest.update(typeof asset === 'string' ? asset : asset.type === 'asset'
          ? asset.source : asset.code);
      }
      const hash = digest.digest('hex').slice(0, 12);
      const source = `const CACHE='mergebloom-${hash}';\n`
        + `const PREFIX='mergebloom-';\n`
        + `const ASSETS=${JSON.stringify(['./', ...manifest])};\n`
        + `self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));\n`
        + `self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))));\n`
        + `self.addEventListener('fetch',event=>{if(event.request.method==='GET')event.respondWith(caches.match(event.request).then(response=>response||fetch(event.request).then(result=>{const copy=result.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return result;})));});`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({ base: './', plugins: [serviceWorker()], build: { chunkSizeWarningLimit: 2000 } });
