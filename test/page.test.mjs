// Ayar sayfasının denetimi: betik sözdizimi, kimlikler, çeviri anahtarları.
import './setup.mjs';
import vm from 'node:vm';
import { configurePage } from '../src/configure.js';
import { STRINGS } from '../src/i18n.js';

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${ok ? '' : ' → ' + String(detail).slice(0, 400)}`); };

const html = configurePage({
  baseUrl: 'http://127.0.0.1:7000', selected: [], ui: null, auth: null,
  sources: { os: null, subdl: null, subsource: null, subsro: null, altyazidb: null },
  max: null, match: true, fallback: false, machine: true, hi: 'show', forced: 'last', clean: false, gestdown: false, anisub: false, dual: false, prefer: null,
  maxLanguages: 10, misconfigured: false,
});
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let syntax = '';
for (const code of scripts) { try { new vm.Script(code); } catch (err) { syntax = err.message; } }
check('sayfadaki betiklerin sözdizimi doğru', scripts.length > 0 && !syntax, syntax || 'betik yok');

const script = scripts[0];
const allIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const ids = new Set(allIds);
const dup = allIds.filter((id, i, all) => all.indexOf(id) !== i);
check('yinelenen kimlik yok', !dup.length, dup);
const used = new Set([...script.matchAll(/\$\('([A-Za-z0-9]+)'\)/g)].map((m) => m[1]));
const lost = [...used].filter((id) => !ids.has(id));
check('betiğin kullandığı her kimlik sayfada var', !lost.length, lost);

const missing = [];
const dyn = ['Panel', 'Body', 'Head', 'Chev', 'Badge', 'Form', 'Done', 'Status', 'Key', 'Msg'];
for (const name of ['os', 'subdl', 'subsource', 'subsro', 'altyazidb']) for (const sfx of dyn) {
  if (name === 'os' && sfx === 'Key') continue;
  if (!ids.has(name + sfx)) missing.push(name + sfx);
}
for (const id of ['limit', 'hi', 'forced', 'pri']) if (!ids.has(id + 'Seg')) missing.push(id + 'Seg');
for (let i = 0; i < 4; i++) for (const p of ['step', 'stepBtn', 'stepNum']) if (!ids.has(p + i)) missing.push(p + i);
check('kaynak kartlarının, seçeneklerin ve adımların kimlikleri eksiksiz', !missing.length, missing);

const keys = new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]));
const trKeys = new Set([...script.matchAll(/tr\('([A-Za-z0-9]+)'/g)].map((m) => m[1]));
const sent = JSON.parse(script.match(/const STRINGS = (.*);\n/)[1]);
const unknown = [...keys, ...trKeys].filter((k) => !(k in sent.tr));
check('sayfanın kullandığı her çeviri anahtarı sayfaya gönderiliyor', !unknown.length, unknown);
const det = [...html.matchAll(/data-det="([^"]+)"/g)].map((m) => m[1]).filter((id) => !ids.has(id));
check('her "ayrıntı" düğmesinin hedefi sayfada var', !det.length, det);
const langs = Object.keys(STRINGS);
const gaps = langs.flatMap((lang) => Object.keys(STRINGS.tr).filter((k) => !(k in STRINGS[lang])).map((k) => `${lang}.${k}`));
check('13 dilin hepsinde aynı çeviri anahtarları var', langs.length === 13 && !gaps.length, gaps);

// Bilgi: sayfaya gönderilip hiçbir yerde kullanılmayan anahtarlar. Hata sayılmaz.
const idle = Object.keys(STRINGS.tr).filter((k) => k in sent.tr && !keys.has(k) && !script.includes("'" + k + "'") && !script.includes('.' + k));
console.log(`bilgi: sayfaya gidip kullanılmayan anahtar: ${idle.join(', ') || 'yok'}`);

process.exit(fails ? 1 : 0);
