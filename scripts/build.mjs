import { cp, mkdir, writeFile } from 'node:fs/promises';
import { loadFighterConfig } from './fighter-config.mjs';
import { bundleGame } from './game-bundle.mjs';

const source = path => new URL('../' + path, import.meta.url);
const dist = path => source('dist/' + path);
const relay = new URL(process.env.LAN_RELAY_URL ?? '');
if (!['https:', 'wss:'].includes(relay.protocol) || relay.username || relay.password
    || relay.pathname !== '/' || relay.search || relay.hash) {
  throw new Error('LAN_RELAY_URL must be the HTTPS or WSS origin of the controller server.');
}

await mkdir(dist(''), { recursive: true });
await Promise.all([
  ...['src', 'index.html', 'controller.html'].map(path => cp(source(path), dist(path), { recursive: true })),
  ...['assets', 'styles'].map(path => cp(source('public/' + path), dist(path), { recursive: true })),
]);
await Promise.all(['src/vendor/', 'data/'].map(path => mkdir(dist(path), { recursive: true })));
await Promise.all([
  loadFighterConfig().then(config => writeFile(dist('data/fighters.json'), JSON.stringify(config))),
  cp(source('node_modules/jsqr/dist/jsQR.js'), dist('src/vendor/jsqr.js')),
  writeFile(dist('src/platform/relay-url.js'), `export const relayUrl = ${JSON.stringify(relay.origin)};\n`),
]);
await writeFile(dist('src/game.bundle.js'), await bundleGame(dist(''), { minify: true }));
