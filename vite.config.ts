import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function walkPublic(dir: string, prefix = ''): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) files.push(...walkPublic(full, rel));
    else files.push(`./${rel}`);
  }
  return files;
}

function serviceWorker(cachePrefix: string): Plugin {
  return {
    name: 'mergebloom-service-worker',
    generateBundle(_options, bundle) {
      const builtFiles = Object.keys(bundle).filter((file) => /\.(js|css)$/.test(file));
      const publicFiles = walkPublic('public');
      const manifest = [
        './index.html',
        ...publicFiles.filter((file) => !file.endsWith('/sw.js')),
        ...builtFiles.map((file) => `./${file}`),
      ];
      const digest = createHash('sha256');
      for (const file of builtFiles.sort()) {
        const asset = bundle[file];
        if (asset) {
          digest.update(typeof asset === 'string' ? asset : asset.type === 'asset'
            ? asset.source : asset.code);
        }
      }
      const hash = digest.digest('hex').slice(0, 12);
      const source = `const CACHE='${cachePrefix}${hash}';\n`
        + `const PREFIX='${cachePrefix}';\n`
        + `const ASSETS=${JSON.stringify(['./', ...manifest])};\n`
        + `self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));\n`
        + `self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));\n`
        + `self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&new URL(event.request.url).origin===self.location.origin)event.respondWith(caches.match(event.request).then(response=>response||fetch(event.request).then(result=>{if(result.ok){const copy=result.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return result;})));});`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig(({ mode }) => {
  const preview2 = mode === 'preview2' || mode === 'production';
  const outDir = preview2 ? 'dist-preview2' : 'dist';
  const cachePrefix = 'mp2-';
  return {
    base: './',
    plugins: [serviceWorker(cachePrefix)],
    build: {
      outDir,
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
    },
  };
});
