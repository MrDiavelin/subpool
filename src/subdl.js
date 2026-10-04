const API = 'https://api.subdl.com/api/v1';
const DOWNLOAD = 'https://dl.subdl.com';

export class SubdlError extends Error {
  constructor(status, message) {
    super(`SubDL ${status}${message ? `: ${message}` : ''}`);
    this.status = status;
  }
}

/** SubDL istemcisi: arama kullanıcının kendi ücretsiz API anahtarıyla yapılır. */
export class SubdlClient {
  constructor({ apiKey, userAgent }) {
    this.apiKey = apiKey;
    this.userAgent = userAgent;
  }

  async request(query) {
    const url = new URL(`${API}/subtitles`);
    for (const [key, value] of Object.entries({ api_key: this.apiKey, ...query })) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.status === false) {
      const message = data?.error || data?.message || '';
      // Sonuç bulunamaması SubDL'de hata olarak dönüyor; boş liste say.
      if (res.ok && /not found|no subtitles|can't find/i.test(message)) return { subtitles: [] };
      throw new SubdlError(res.ok ? 400 : res.status, message);
    }
    return data;
  }

  /** Anahtarın çalışıp çalışmadığını tek sonuçluk ucuz bir aramayla kontrol eder. */
  async verify() {
    try {
      await this.request({ imdb_id: 'tt0111161', type: 'movie', languages: 'EN', subs_per_page: 1 });
      return true;
    } catch (err) {
      if ([401, 403].includes(err.status) || /auth|api.?key/i.test(err.message)) return false;
      throw err;
    }
  }

  /**
   * Bir film ya da bölüm için altyazıları döndürür.
   * Sonuç: [{ lang, path, release, releases, hi, season, episode, direct }] — path, dl.subdl.com altındaki dosya yoludur.
   * `strict` açıkken yalnızca bu bölümü açıkça içeren sonuçlar alınır ("tüm sezon" paketleri alınmaz); animelerde
   * baştan sayılan bölüm numarasıyla yapılan ek aramalarda kullanılır.
   */
  async search({ imdbId, season, episode, languages, strict = false }) {
    const isEpisode = season !== undefined && episode !== undefined;
    const data = await this.request({
      imdb_id: imdbId,
      type: isEpisode ? 'tv' : 'movie',
      season_number: isEpisode ? season : undefined,
      episode_number: isEpisode ? episode : undefined,
      languages: languages.join(','),
      subs_per_page: 30,
      releases: 1,
      hi: 1,
      unpack: isEpisode ? 1 : undefined,
      client: 'stremio',
    });

    const results = [];
    for (const item of data.subtitles || []) {
      if (!item?.url) continue;
      // Bir altyazı birden fazla sürüme uyabilir; hepsi saklanır ki videoya uyan bulunabilsin.
      const releases = [...new Set([item.release_name, ...(Array.isArray(item.releases) ? item.releases : [])].filter((name) => typeof name === 'string' && name))].slice(0, 8);
      const base = {
        lang: String(item.language || '').toUpperCase(),
        release: releases[0] || item.name || '',
        releases,
        hi: item.hi ? 1 : 0,
      };
      if (!isEpisode) {
        results.push({ ...base, path: item.url, direct: false });
        continue;
      }

      const s = Number(season);
      const e = Number(episode);
      // Sezon paketlerinde SubDL istenen bölümün dosyasını ayrıca veriyor (unpack=1); doğrudan onu kullan.
      const file = (item.unpack_files || []).find((f) => Number(f.episode) === e && (!f.season || Number(f.season) === s));
      if (file?.url) {
        const release = file.release_name || file.name || base.release;
        results.push({ ...base, release, releases: [release], path: file.url, direct: true });
        continue;
      }
      if (item.season && Number(item.season) !== s) continue;
      const from = Number(item.episode_from) || 0;
      const end = Number(item.episode_end) || 0;
      const inRange = from && end ? e >= from && e <= end : false;
      if (Number(item.episode) === e || inRange || (item.full_season && !strict)) {
        results.push({ ...base, path: item.url, direct: false, season: s, episode: e, pack: Number(item.episode) !== e });
      }
    }
    return results;
  }

  static async download(path, userAgent) {
    if (!/^\/subtitle\/[\w./-]+$/.test(path) || path.includes('..')) throw new SubdlError(400, 'bad path');
    const res = await fetch(DOWNLOAD + path, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new SubdlError(res.status, 'download failed');
    return new Uint8Array(await res.arrayBuffer());
  }
}
