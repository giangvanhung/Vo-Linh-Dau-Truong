import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

export async function bundleGame(source = root, { minify = false } = {}) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('src/main.js', source))],
    bundle: true,
    minify,
    format: 'iife',
    target: 'chrome68',
    write: false,
  });
  return result.outputFiles[0].text;
}
