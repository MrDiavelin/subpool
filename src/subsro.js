const API = 'https://api.subs.ro/v1.0';

export class SubsroError extends Error {
  constructor(status, message) {
    super(`Subs.ro ${status}${message ? `: ${message}` : ''}`);
    this.status = status;
  }
}

/** Subs.ro istemcisi: her istek kullanıcının kendi API anahtarıyla yapılır; anahtarsız istek hiç gönderilmez. */
export class SubsroClient {
  constructor({ apiKey, userAgent }) {
    this.apiKey = apiKey;
    this.userAgent = userAgent;
  }

  async fetch(path, accept = 'application/json') {
    if (!this.apiKey) throw new SubsroError(401, 'no key');
    const res = await fetch(API + path, {
      headers: { 'X-Subs-Api-Key': this.apiKey, Accept: accept, 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new SubsroError(res.status, data?.message || '');
    }
    return res;
  }

  async json(path) {
    const data = await (await this.fetch(path)).json();
    // Hata yanıtları da { status, message } biçimindedir.
    if (Number(data?.status) >= 400) throw new SubsroError(Number(data.status), data.message || '');
    return data;
  }

  /**
   * Anahtar yalnızca site onu kendi kotasıyla tanıyorsa geçerli sayılır. Site tanımadığı anahtara "anonymous"
   * kotasıyla yanıt verirse anahtar reddedilir: eklenti kimsenin adına anahtarsız istek yapmaz.
   */
  async verify() {
    try {
      const data = await this.json('/quota');
      // Site alanı "type" adıyla verir; belgesi "quota_type" der. İkisi de okunur.
      const quota = data?.quota ?? data;
      return (quota?.type ?? quota?.quota_type) === 'api_key';
    } catch (err) {
      if ([401, 403].includes(err.status)) return false;
      throw err;
    }
  }

  /**
   * Yapımın sitedeki bütün altyazıları: [{ id, lang, title, text }]
   * Site sezon, bölüm ya da sürüm adı için ayrı alan vermez; bunlar başlıktan ve açıklamadan okunur.
   */
  async list(imdbId) {
    const data = await this.json(`/search/imdbid/${encodeURIComponent(imdbId)}`);
    const items = [];
    for (const item of Array.isArray(data?.items) ? data.items : []) {
      if (!item?.id || !/^\d+$/.test(String(item.id))) continue;
      items.push({
        id: Number(item.id),
        lang: String(item.language || '').toLowerCase(),
        title: plain(item.title),
        text: plain(item.description),
      });
    }
    return items;
  }

  /** Sonuç: [{ id, lang, release, releases }] */
  async search({ imdbId, season, episode, languages }) {
    return subsroPick(await this.list(imdbId), { season, episode, languages });
  }

  /** Altyazıyı sitenin verdiği arşiv olarak indirir. */
  async download(id) {
    const res = await this.fetch(`/subtitle/${Number(id)}/download`, '*/*');
    return new Uint8Array(await res.arrayBuffer());
  }
}

/**
 * `list` sonucundan istenen dillerdeki ve (dizilerde) istenen sezondaki altyazıları seçer.
 * Başlığında ya da açıklamasında başka bir sezon yazan altyazılar atlanır; sezon yazmayanlar kalır.
 * Bölüm çoğunlukla burada elenmez: sitedeki dizi altyazılarının çoğu sezon paketidir, istenen bölüm indirme sırasında
 * ayıklanır. Yalnızca açıklaması tek bir bölümün sürüm adını yazan altyazılar ("…s01e06.720p…") başka bölümlerde atlanır.
 */
export function subsroPick(items, { season, episode, languages } = {}) {
  const wanted = languages ? new Set(languages) : null;
  const results = [];
  for (const item of items || []) {
    if (wanted && !wanted.has(item.lang)) continue;
    if (season !== undefined && season !== null) {
      const range = seasonsOf(item.title) || seasonsOf(item.text);
      if (range && (Number(season) < range[0] || Number(season) > range[1])) continue;
      if (episode && otherEpisode(`${item.title} ${item.text}`, Number(season), Number(episode))) continue;
    }
    const release = shorten(item.text) || item.title;
    results.push({ id: item.id, lang: item.lang, release, releases: release ? [release] : [] });
  }
  return results;
}

const PACK_WORDS = /sezon|season|complet|episoade|episodul|episodes?|pack/;

/** Metin yalnızca başka bölümleri mi gösteriyor? Paket olduğunu düşündüren bir sözcük varsa hiçbir şey söylenmez. */
function otherEpisode(text, season, episode) {
  const value = String(text || '').toLowerCase();
  const found = [...value.matchAll(/(?:^|[^a-z0-9])s(\d{1,2})[ ._-]?e(\d{1,4})(?!\d)/g)];
  if (!found.length || PACK_WORDS.test(value)) return false;
  return !found.some((m) => Number(m[1]) === season && Number(m[2]) === episode);
}

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

/** HTML kaçışlarını ("&#241;", "&amp;") çözer; çözülemeyen sayılar olduğu gibi kalır. */
function unescapeHtml(text) {
  return text.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|(amp|quot|apos|lt|gt|nbsp));/gi, (whole, dec, hex, name) => {
    if (name) return ENTITIES[name.toLowerCase()];
    const code = dec ? Number(dec) : parseInt(hex, 16);
    return code > 31 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
  });
}

/** HTML kaçışlarını çözer, emoji ve ayraçları atar, baştaki "Release(s):" etiketini ve sondaki virgülü siler, boşlukları toplar. */
function plain(value) {
  return unescapeHtml(String(value ?? ''))
    .replace(/[\p{Extended_Pictographic}\p{Variation_Selector}\p{Join_Control}]/gu, ' ')
    .replace(/[|\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*release\(?s?\)?\s*:\s*/i, '')
    .replace(/[\s,;]+$/, '')
    .trim();
}

const MAX_TEXT = 80;

function shorten(text) {
  if (text.length <= MAX_TEXT) return text;
  const cut = text.slice(0, MAX_TEXT);
  const space = cut.lastIndexOf(' ');
  return `${(space > MAX_TEXT / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:-]+$/, '')}…`;
}

/**
 * Metinde yazan sezonu ya da sezon aralığını [ilk, son] olarak verir; yazmıyorsa null.
 * Tanınanlar: "Sezonul 2", "Sezonul 1-3", "Sezoanele 1-3", "Sezoanele 1, 2 și 3", "Season 2", "S02", "S02E05", "S01-S03".
 * Sayının hemen ardından başka rakam geliyorsa ("1080p") sezon sayılmaz.
 */
export function seasonsOf(text) {
  const value = String(text || '').toLowerCase();
  let m = value.match(/sezoanele((?:\s*(?:\d{1,2}(?!\d)|[,&+\-–—]|si|și|şi|la|pana|până)(?![a-z]))+)/);
  if (m) {
    const numbers = (m[1].match(/\d{1,2}/g) || []).map(Number);
    if (numbers.length) return [Math.min(...numbers), Math.max(...numbers)];
  }
  m = value.match(/(?:sezon(?:ului|ul)?|seasons?)\s*(\d{1,2})(?!\d)(?:[-–—](\d{1,2})(?![\da-z]))?/)
    || value.match(/(?:^|[^a-z0-9])s(\d{1,2})(?:\s*[-–—]\s*s(\d{1,2}))?(?=e\d|[^a-z0-9]|$)/);
  if (!m) return null;
  const first = Number(m[1]);
  const last = Number(m[2]);
  return [first, last > first ? last : first];
}
