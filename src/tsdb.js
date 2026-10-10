const API = 'https://api.thesubtitledb.org';
// Oynatıcıların doğrudan açabildiği biçimler; diğerleri (ass, ssa, sub) listeye alınmaz.
const FORMATS = new Set(['srt', 'vtt']);

export class TsdbError extends Error {
  constructor(status, message) {
    super(`TheSubtitleDB ${status}${message ? `: ${message}` : ''}`);
    this.status = status;
  }
}

/**
 * TheSubtitleDB istemcisi (thesubtitledb.org/llms.txt): hesap ya da anahtar istemeyen bir altyazı arşivi.
 * Yalnızca arama yapılır. Site indirmelerin kullanıcının kendi tarafından yapılmasını ister (IP başına saatte 150
 * indirme), bu yüzden dosya adresi olduğu gibi döndürülür: adres elle üretilmez ve dosyaya sunucu dokunmaz.
 */
export class TsdbClient {
  constructor({ userAgent }) {
    this.userAgent = userAgent;
  }

  /**
   * Bir filmin ya da dizi bölümünün tek dildeki altyazıları, en çok indirilenler önce.
   * Sonuç: [{ id, url, release, hi }]
   */
  async search({ imdbId, season, episode, language }) {
    const path = `/v1/by-imdb/${encodeURIComponent(imdbId)}` + (season != null ? `/season/${Number(season)}/episode/${Number(episode)}` : '');
    const query = new URLSearchParams({ lang: language, sort: 'downloads', limit: '100' });
    const res = await fetch(`${API}${path}?${query}`, {
      headers: { Accept: 'application/json', 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(8000),
    });
    // Bu numarayla kayıtlı bir şey yok.
    if (res.status === 404) return [];
    if (!res.ok) throw new TsdbError(res.status, (await res.text().catch(() => '')).slice(0, 120));
    const data = await res.json();
    const results = [];
    for (const item of Array.isArray(data?.subtitles?.items) ? data.subtitles.items : []) {
      // Site tanımadığı bir dil kodunu yok sayıp bütün dilleri döndürür; bu yüzden dil burada da denetlenir.
      if (item?.language !== language || !FORMATS.has(item.format) || !Number.isInteger(item.id)) continue;
      if (item.download_url !== `${API}/get/${item.id}`) continue;
      results.push({
        id: item.id,
        url: item.download_url,
        release: typeof item.release_name === 'string' ? item.release_name.trim() : '',
        hi: item.hearing_impaired ? 1 : 0,
      });
    }
    return results;
  }
}
