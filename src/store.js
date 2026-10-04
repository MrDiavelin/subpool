import { gunzipSync, gzipSync } from 'node:zlib';

/** Süreli, boyutu sınırlı bellek içi önbellek. */
export class MemoryStore {
  constructor(maxEntries) {
    this.maxEntries = maxEntries;
    this.map = new Map();
  }
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }
  set(key, value, ttlSec) {
    this.map.delete(key);
    if (this.map.size >= this.maxEntries) this.map.delete(this.map.keys().next().value);
    this.map.set(key, { value, expires: Date.now() + ttlSec * 1000 });
  }
  delete(key) {
    this.map.delete(key);
  }
}

/**
 * Metin önbelleği. Upstash Redis ayarlıysa kalıcıdır ve tüm sunucu örnekleri paylaşır;
 * değilse (ya da Redis'e ulaşılamazsa) sadece bellekte tutar.
 * Değerler Redis'e gzip ile sıkıştırılarak yazılır (altyazılar ~3 kat küçülür).
 */
export function createStore(env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  const memory = new MemoryStore(300);

  if (!url || !token) {
    return {
      persistent: false,
      get: async (key) => memory.get(key),
      set: async (key, value, ttlSec) => memory.set(key, value, ttlSec),
    };
  }

  async function command(args) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(`Redis ${res.status}: ${data.error || ''}`);
    return data.result;
  }

  return {
    persistent: true,
    async get(key) {
      const hit = memory.get(key);
      if (hit !== undefined) return hit;
      try {
        const raw = await command(['GET', key]);
        if (raw === null || raw === undefined) return undefined;
        const value = gunzipSync(Buffer.from(raw, 'base64')).toString('utf8');
        memory.set(key, value, 600);
        return value;
      } catch (err) {
        console.error(`[cache] Okunamadı ${key}: ${err.message}`);
        return undefined;
      }
    },
    async set(key, value, ttlSec) {
      memory.set(key, value, Math.min(ttlSec, 600));
      try {
        await command(['SET', key, gzipSync(value).toString('base64'), 'EX', String(ttlSec)]);
      } catch (err) {
        console.error(`[cache] Yazılamadı ${key}: ${err.message}`);
      }
    },
  };
}
