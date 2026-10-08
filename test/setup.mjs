// Her test dosyasının ilk içe aktarımı. Testler gerçek hesap, anahtar ya da .env dosyası kullanmaz:
// buradaki değerler yalnızca test içindir, gerçek sitelere giden istekler test dosyalarında sahte yanıtlarla karşılanır.
import { readFileSync } from 'node:fs';

process.env.CONFIG_SECRET = 'yalnizca-test-icin-kullanilan-sabit-metin';
process.env.OS_API_KEY = 'test-api-anahtari';
for (const name of ['PUBLIC_URL', 'SOURCE_DEADLINE_MS', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[name];

// Beklenen sürüm package.json'dan okunur: eklentinin bildirdiği sürüm ondan ayrışırsa testler kalır.
export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
