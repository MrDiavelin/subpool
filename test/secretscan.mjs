// Depoya girecek dosyalarda gizli bilgi arar: npm run scan
// Değerleri asla yazdırmaz; yalnızca dosya ve satır numarası verir. Göndermeden (push) önce çalıştırılır.
// Varsa .env ve .env.local içindeki değerler de aranır; bu dosyalar depoya girmez.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Depoda izlenen dosyalar ile henüz eklenmemiş (ama yok sayılmayan) dosyalar, çalışma klasöründeki halleriyle taranır.
const git = (args) => execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const files = [...new Set([...git('ls-files'), ...git('ls-files --others --exclude-standard')])].filter((file) => existsSync(root + file));

// Paketin herkese açık adında ve açıklamasında zaten geçen bir değer gizli sayılmaz.
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
const open = `${pkg.name} ${pkg.description}`.toLowerCase();
const secrets = [];
for (const envFile of ['.env', '.env.local']) {
  if (!existsSync(root + envFile)) continue;
  for (const line of readFileSync(root + envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && m[2].length >= 6 && !open.includes(m[2].toLowerCase())) secrets.push([m[1], m[2]]);
  }
}

const patterns = [
  ['e-posta', /[A-Za-z0-9._%+-]+@(?!anthropic\.com|users\.noreply\.github\.com)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['şifreli auth içeren adres', /auth=[A-Za-z0-9_-]{40,}/g],
  ['Windows kullanıcı yolu', /[A-Za-z]:[\\/]+Users[\\/]/g],
  ['Bearer/JWT', /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g],
  ['uzun onaltılık dizi', /\b[a-f0-9]{32,}\b/g],
  ['upstash/vercel adresi', /[a-z0-9-]+\.upstash\.io|vercel\.app\/[^\s"'`)]*auth=/g],
];

let problems = 0;
let looks = 0;
for (const file of files) {
  // Gömülü ikili dosya ve arşiv örnekleri satır satır okunmaz; yalnızca .env değerleri için taranır.
  const binary = file === 'src/unrar-wasm.js' || /\.(rar|zip|7z|png|jpg|ico|woff2?)$/.test(file);
  const text = readFileSync(root + file, binary ? 'latin1' : 'utf8');
  (binary ? [text] : text.split(/\r?\n/)).forEach((line, i) => {
    for (const [name, value] of secrets) {
      if (!line.includes(value)) continue;
      problems++;
      console.log(`GİZLİ DEĞER (${name}) → ${file}${binary ? '' : `:${i + 1}`}`);
    }
    if (binary) return;
    for (const [label, re] of patterns) {
      const hits = line.match(re);
      if (!hits) continue;
      looks++;
      console.log(`bak: ${label} → ${file}:${i + 1} (${hits.length} eşleşme, ilk ${Math.min(hits[0].length, 12)} karakter: ${hits[0].slice(0, 12)}…)`);
    }
  });
}
console.log(`\n${files.length} dosya tarandı, ${secrets.length} .env değeri arandı, bakılacak satır: ${looks}, gizli değer eşleşmesi: ${problems}`);
process.exit(problems || !files.length ? 1 : 0);
