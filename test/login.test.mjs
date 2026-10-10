// Ayar sayfasının betiği bozulmamış mı ve e-posta yazılınca sunucuya istek gitmeden uyarı çıkıyor mu?
import './setup.mjs';
import { createServer } from 'node:http';
import vm from 'node:vm';
const { createAddon } = await import('../src/addon.js');
const { STRINGS } = await import('../src/i18n.js');

const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '' })).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const html = await (await fetch(`http://127.0.0.1:${server.address().port}/configure`)).text();
server.close();

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
let ok = true;
const check = (label, pass) => { console.log(`${pass ? 'OK  ' : 'HATA'} ${label}`); if (!pass) ok = false; };
for (const [i, code] of scripts.entries()) {
  try { new vm.Script(code); check(`sayfa betiği ${i + 1} sözdizimi`, true); } catch (err) { check(`sayfa betiği ${i + 1} sözdizimi: ${err.message}`, false); }
}
const page = scripts.join('\n');
check('e-posta denetimi sayfada', page.includes("username.includes('@')") && page.includes("setMsg('os', 'badLogin')"));
check('13 dilde ipucu var', Object.values(STRINGS).every((s) => s.badLogin.includes('opensubtitles.com')) && Object.keys(STRINGS).length === 13);
check('ipucu sayfaya gidiyor', html.includes("opensubtitles.com'daki kullanıcı adını yaz"));
console.log(ok ? '\nHepsi geçti' : '\nBAŞARISIZ');
process.exit(ok ? 0 : 1);
