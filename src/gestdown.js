const API = 'https://api.gestdown.info';

export class GestdownError extends Error {
  constructor(status, message) {
    super(`Gestdown ${status}${message ? `: ${message}` : ''}`);
    this.status = status;
  }
}

/**
 * Gestdown istemcisi: Addic7ed'deki dizi altyazılarını sunan, anahtar istemeyen bir servis.
 * Yalnızca dizi altyazısı barındırır ve dizileri TheTVDB numarasıyla tanır.
 */
export class GestdownClient {
  constructor({ userAgent }) {
    this.userAgent = userAgent;
  }

  async fetch(path, accept = 'application/json') {
    const res = await fetch(API + path, {
      headers: { Accept: accept, 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new GestdownError(res.status, (await res.text().catch(() => '')).slice(0, 120));
    return res;
  }

  /** Dizinin Gestdown'daki kimliğini döndürür; dizi orada yoksa null. */
  async show(tvdbId) {
    try {
      const data = await (await this.fetch(`/shows/external/tvdb/${encodeURIComponent(tvdbId)}`)).json();
      const id = data?.shows?.[0]?.id;
      return typeof id === 'string' && id ? id : null;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Bir bölümün tek dildeki altyazıları. Sonuç: [{ id, release, hi, downloads }]
   * Gestdown diziyi o sırada yeniliyorsa 423 hatası verir; biraz sonra tekrar sorulmalıdır.
   */
  async search({ showId, season, episode, language }) {
    let data;
    try {
      const path = [showId, Number(season), Number(episode), language].map(encodeURIComponent).join('/');
      data = await (await this.fetch(`/subtitles/get/${path}`)).json();
    } catch (err) {
      // Dizide böyle bir bölüm yok.
      if (err.status === 404) return [];
      throw err;
    }
    const results = [];
    for (const item of Array.isArray(data?.matchingSubtitles) ? data.matchingSubtitles : []) {
      // Çevirisi bitmemiş altyazılar eksik satırlarla gelir.
      if (!item?.completed || !/^[0-9a-f-]{36}$/i.test(String(item.subtitleId))) continue;
      results.push({
        id: item.subtitleId.toLowerCase(),
        release: typeof item.version === 'string' ? item.version.trim() : '',
        hi: item.hearingImpaired ? 1 : 0,
        downloads: Number(item.downloadCount) || 0,
      });
    }
    return results;
  }

  /** Altyazıyı düz metin (SRT) dosyası olarak indirir. */
  async download(id) {
    const res = await this.fetch(`/subtitles/download/${encodeURIComponent(id)}`, '*/*');
    return new Uint8Array(await res.arrayBuffer());
  }
}
