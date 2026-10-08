const API = 'https://altyazidb.com/api/v1';

/** AltyazıDB'de yalnızca bu dillerde altyazı bulunur. */
export const ALTYAZIDB_LANGUAGES = ['tr', 'en'];

export class AltyazidbError extends Error {
  constructor(status, message) {
    super(`AltyazıDB ${status}${message ? `: ${message}` : ''}`);
    this.status = status;
  }
}

/** AltyazıDB istemcisi: her istek kullanıcının kendi API anahtarıyla yapılır. */
export class AltyazidbClient {
  constructor({ apiKey, userAgent }) {
    this.apiKey = apiKey;
    this.userAgent = userAgent;
  }

  async fetch(path, query, accept = 'application/json') {
    const url = new URL(API + path);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const res = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey, Accept: accept, 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(20000),
    });
    // Dosya uç noktaları başarıda altyazının kendisini, hatada JSON döndürür.
    const failed = !res.ok || (accept !== 'application/json' && /json/i.test(res.headers.get('content-type') || ''));
    if (failed) {
      const data = await res.json().catch(() => null);
      throw new AltyazidbError(res.ok ? 400 : res.status, data?.error || data?.message || '');
    }
    return res;
  }

  async json(path, query) {
    const data = await (await this.fetch(path, query)).json();
    if (data?.success === false) throw new AltyazidbError(400, data.error || data.message || '');
    return data;
  }

  async verify() {
    try {
      await this.json('/me');
      return true;
    } catch (err) {
      if ([401, 403].includes(err.status)) return false;
      throw err;
    }
  }

  /** Sonuç: [{ id, lang, release, releases, hi, forced, machine, downloads, pack }] */
  async search({ imdbId, season, episode, languages }) {
    const isEpisode = season !== undefined && episode !== undefined;
    const lists = await Promise.all(languages.map((lang) =>
      this.json('/search', {
        imdb_id: imdbId,
        lang,
        season: isEpisode ? season : undefined,
        episode: isEpisode ? episode : undefined,
        sort: 'downloads',
        limit: 50,
      }).then(listOf, (err) => {
        // Yapım sitede hiç yoksa hata dönüyor; boş liste say.
        if (err.status === 404) return [];
        throw err;
      }),
    ));

    const results = [];
    for (const item of lists.flat()) {
      if (!item?.id || !/^\d+$/.test(String(item.id))) continue;
      const pack = !!Number(item.is_package) || /paket/i.test(String(item.episode ?? ''));
      if (isEpisode) {
        if (item.season != null && Number(item.season) !== Number(season)) continue;
        if (!pack && item.episode != null && Number(item.episode) !== Number(episode)) continue;
      }
      const list = (value) => (Array.isArray(value) ? value : []);
      const releases = [...new Set([...list(item.versions).map((v) => v?.file), ...list(item.releases), ...list(item.version_groups)].filter((name) => typeof name === 'string' && name))].slice(0, 8);
      results.push({
        id: Number(item.id),
        lang: String(item.language || '').toLowerCase(),
        release: releases[0] || '',
        releases,
        hi: Number(item.hearing_impaired) ? 1 : 0,
        // Yalnızca yabancı dildeki konuşmaları içeren altyazı: filmin tamamını çevirmez.
        forced: Number(item.forced) ? 1 : 0,
        machine: Number(item.ai_ceviri) ? 1 : 0,
        downloads: Number(item.downloads) || 0,
        pack,
      });
    }
    return results;
  }

  /** Altyazıyı düz metin dosyası olarak indirir; arşivi site kendisi açar. Sezon paketinden tek bölüm ayıklanır. */
  async download(id, { season, episode } = {}) {
    const res = episode
      ? await this.fetch('/extract_ep', { sub_id: Number(id), season, episode }, '*/*')
      : await this.fetch('/subtitle', { sub_id: Number(id) }, '*/*');
    return new Uint8Array(await res.arrayBuffer());
  }
}

function listOf(data) {
  for (const list of [data?.data, data?.subtitles, data?.results, data?.data?.subtitles]) {
    if (Array.isArray(list)) return list;
  }
  return [];
}
