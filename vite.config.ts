import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pkg from './package.json' with { type: 'json' };

/**
 * Génère le service worker (sw.js) avec la liste exacte des fichiers à mettre en cache.
 * Il ne gère que le cache de l'interface : IndexedDB (les données d'Ophélie) n'est jamais touché.
 */
function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  const walk = (dir: string, base = ''): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
          d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`],
        )
      : [];
  return {
    name: 'univers-service-worker',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    generateBundle(_, bundle) {
      const publicFiles = walk(config.publicDir).filter((f) => !f.startsWith('.') && !f.endsWith('.DS_Store'));
      // Les polices des alphabets non latins restent téléchargées à la demande (non pré-cachées)
      const skip = (f: string) =>
        f === 'sw.js' || f.endsWith('.map') || /\.woff$/.test(f) || /(cyrillic|vietnamese|greek|hebrew|math|symbols)/.test(f);
      const assets = [...Object.keys(bundle), ...publicFiles].filter((f) => !skip(f));
      const hash = createHash('sha256');
      for (const [name, chunk] of Object.entries(bundle)) {
        hash.update(name);
        hash.update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source));
      }
      for (const f of publicFiles) hash.update(f + fs.statSync(path.join(config.publicDir, f)).size);
      const version = hash.digest('hex').slice(0, 12);
      const template = fs.readFileSync(path.resolve(__dirname, 'src/sw-template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__ASSETS__', JSON.stringify(assets)),
      });
    },
  };
}

export default defineConfig({
  // Chemins relatifs : fonctionne à la racine d'un domaine comme sous /nom-du-depot/ (GitHub Pages)
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${new Date().toISOString().slice(0, 10)})`),
  },
  plugins: [react(), serviceWorker()],
  build: {
    target: ['es2020', 'safari15'],
    chunkSizeWarningLimit: 800,
  },
});
