import { episodeOf } from './release.js';

const API = 'https://api.subsource.net/api/v1';

export class SubsourceError extends Error {
  constructor(status, message) {
    super(`SubSource ${status}${message ? `: ${message}` : ''}`);
    this.status = status;
  }
}

/** SubSource istemcisi: her istek kullanıcının kendi ücretsiz API anahtarıyla yapılır. */
export class SubsourceClient {
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
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new SubsourceError(res.status, data?.message || data?.error || '');
    }
    return res;
  }

  async json(path, query) {
    const data = await (await this.fetch(path, query)).json();
    if (data?.success === false) throw new SubsourceError(400, data.message || '');
    return data;
  }

  async verify() {
    try {
      await this.json('/movies/search', { searchType: 'imdb', imdb: 'tt0111161' });
      return true;
    } catch (err) {
      if ([401, 403].includes(err.status)) return false;
      throw err;
    }
  }

  /** IMDb numarasından SubSource'un kendi film/sezon kimliğini bulur. */
  async findMovieId(imdbId, season) {
    const data = await this.json('/movies/search', { searchType: 'imdb', imdb: imdbId, season });
    const list = data?.data || [];
    const match = season !== undefined
      ? list.find((m) => Number(m.season) === Number(season)) || null
      : list.find((m) => m.type !== 'tvseries' && m.type !== 'series') || list[0] || null;
    return match?.movieId ?? null;
  }

  /**
   * Sonuç: [{ id, lang, release, releases, hi, pack }]
   * `anime` açıkken sürüm adlarındaki yalın bölüm numarası da okunur ("[Grup] Ad - 75"). `strict` açıkken yalnızca
   * adında bu bölüm yazan sonuçlar alınır; baştan sayılan bölüm numarasıyla yapılan ek aramalarda kullanılır.
   */
  async search({ imdbId, season, episode, languages, anime = false, strict = false }) {
    const isEpisode = season !== undefined && episode !== undefined;
    const movieId = await this.findMovieId(imdbId, isEpisode ? season : undefined);
    if (!movieId) return [];

    const lists = await Promise.all(languages.map((language) =>
      this.json('/subtitles', {
        movieId,
        language,
        limit: 100,
        seasonNumber: isEpisode ? season : undefined,
        episodeNumber: isEpisode ? episode : undefined,
      }).then((d) => d?.data || []),
    ));

    const results = [];
    for (const item of lists.flat()) {
      if (!item?.subtitleId) continue;
      const releases = Array.isArray(item.releaseInfo) ? item.releaseInfo : [item.releaseInfo].filter(Boolean);
      let pack = false;
      if (isEpisode) {
        const found = releaseEpisode(releases, anime);
        if (found.season !== null && found.season !== Number(season)) continue;
        if (found.episode !== null && found.episode !== Number(episode)) continue;
        pack = found.episode === null;
        if (pack && strict) continue;
      }
      results.push({
        id: item.subtitleId,
        lang: String(item.language || '').toLowerCase(),
        release: releases[0] || '',
        releases: [...new Set(releases.filter((name) => typeof name === 'string' && name))].slice(0, 8),
        hi: item.hearingImpaired ? 1 : 0,
        pack,
      });
    }
    return results;
  }

  async download(id) {
    const res = await this.fetch(`/subtitles/${Number(id)}/download`, null, '*/*');
    return new Uint8Array(await res.arrayBuffer());
  }
}

/** Sürüm adlarından sezon/bölüm numarasını çıkarır (S01E02, 1x02; animelerde "Ad - 75" de). */
function releaseEpisode(releases, anime) {
  if (anime) {
    for (const name of releases) {
      const found = episodeOf(name);
      if (found.episode !== null) return found;
    }
  }
  for (const name of releases) {
    const text = String(name).toLowerCase();
    let m = text.match(/s(\d{1,2})[ ._-]*e(\d{1,4})/);
    if (m) return { season: Number(m[1]), episode: Number(m[2]) };
    m = text.match(/(?:^|[^\d])(\d{1,2})x(\d{1,3})(?:[^\d]|$)/);
    if (m) return { season: Number(m[1]), episode: Number(m[2]) };
    m = text.match(/(?:^|[^a-z0-9])s(\d{1,2})(?:[^a-z0-9e]|$)|season[ ._-]*(\d{1,2})/);
    if (m) return { season: Number(m[1] || m[2]), episode: null };
  }
  return { season: null, episode: null };
}
