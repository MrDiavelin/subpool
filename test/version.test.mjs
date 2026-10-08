// Sürüm her yerde aynı mı: package.json, package-lock.json, eklentinin bildirdiği sürüm ve README'deki sürüm geçmişi.
import { VERSION } from './setup.mjs';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const { createAddon } = await import('../src/addon.js');

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 300) : ''}`); };
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const log = console.log;
console.log = () => {};
const server = createServer(createAddon()).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const get = (path) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: { connection: 'close' } }).then((res) => res.json());
const manifest = await get('/manifest.json');
const configured = await get('/languages=tr&ui=tr/manifest.json');
const health = await get('/api/health');
server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));
console.log = log;

const lock = JSON.parse(read('../package-lock.json'));
check('package.json sürümü üç sayıdan oluşur', /^\d+\.\d+\.\d+$/.test(VERSION), VERSION);
check('package-lock.json aynı sürümü taşır', lock.version === VERSION && lock.packages[''].version === VERSION, `${lock.version} / ${lock.packages[''].version}`);
check('eklentinin bildirdiği sürüm package.json ile aynı', manifest.version === VERSION && configured.version === VERSION, `${manifest.version} / ${configured.version}`);
check('/api/health aynı sürümü bildirir', health.version === VERSION, health.version);
check("README'deki sürüm geçmişinde bu sürüm var", read('../README.md').includes(`- **${VERSION}:**`), VERSION);

process.exitCode = fails ? 1 : 0;
