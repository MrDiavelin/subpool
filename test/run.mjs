// Bütün test dosyalarını sırayla çalıştırır: npm test
// Bir dosya, "HATA" ile başlayan bir satır yazarsa, hiç "OK" yazmazsa ya da hatayla kapanırsa başarısız sayılır.
// Yalnızca bazılarını çalıştırmak için ad verilir: npm test -- archive v3140
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = new URL('./', import.meta.url);
const wanted = process.argv.slice(2);
const suites = readdirSync(dir).filter((name) => name.endsWith('.test.mjs')).map((name) => name.replace('.test.mjs', ''))
  .filter((name) => !wanted.length || wanted.includes(name))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
if (!suites.length) { console.log('Çalıştırılacak test bulunamadı.'); process.exit(1); }

let total = 0;
const failed = [];
for (const name of suites) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [fileURLToPath(new URL(`${name}.test.mjs`, dir))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const lines = `${run.stdout || ''}`.split(/\r?\n/);
  const ok = lines.filter((line) => line.startsWith('OK')).length;
  const bad = lines.filter((line) => line.startsWith('HATA'));
  const broken = run.status !== 0 || bad.length > 0 || ok === 0;
  total += ok;
  console.log(`${broken ? 'HATA' : 'OK  '} ${name.padEnd(9)} ${String(ok).padStart(3)} denetim, ${((Date.now() - started) / 1000).toFixed(1)} sn`);
  if (!broken) continue;
  failed.push(name);
  for (const line of bad) console.log(`       ${line}`);
  // Dosya yarıda kesildiyse nedeni hata çıktısının sonundadır.
  if (run.status !== 0 && !bad.length) console.log(`${run.stderr || run.error || ''}`.trim().split(/\r?\n/).slice(-12).map((line) => `       ${line}`).join('\n'));
}

console.log(failed.length ? `\nBAŞARISIZ: ${failed.join(', ')}` : `\nHepsi geçti: ${suites.length} dosya, ${total} denetim`);
process.exit(failed.length ? 1 : 0);
