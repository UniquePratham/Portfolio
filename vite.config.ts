import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Replace `__FRAME_VERSION__` in index.html with the hash of the generated
 * frame set.
 *
 * The frames are served with `Cache-Control: immutable`, so every URL that
 * points at them must carry the version. The preload link lives in static HTML
 * and cannot import the module, so the value is injected here. Without it the
 * preload fetches a stale cached frame and the canvas paints it before the
 * versioned request resolves — the portrait visibly changes size mid-scroll.
 */
function frameVersionPlugin() {
  const versionFile = fileURLToPath(new URL('./src/scripts/frames-version.ts', import.meta.url));
  return {
    name: 'frame-version',
    transformIndexHtml(html: string) {
      const source = readFileSync(versionFile, 'utf8');
      const match = /FRAME_VERSION\s*=\s*'([^']+)'/.exec(source);
      if (!match) {
        throw new Error(`no FRAME_VERSION in ${versionFile} — run _tools/gen_frames_fullbody.py`);
      }
      return html.replaceAll('__FRAME_VERSION__', match[1]);
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [frameVersionPlugin()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
  },
});
