import { OpenSubtitlesClient, USER_AGENT } from './opensubtitles.js';
import { SubdlClient } from './subdl.js';
import { SubsourceClient } from './subsource.js';
import { ALTYAZIDB_LANGUAGES, AltyazidbClient } from './altyazidb.js';
import { officialSubtitles } from './official.js';
import { kitsuMap, kitsuSearch } from './kitsu.js';
import { seriesInfo } from './cinemeta.js';
import { pickSubtitle, rarSelfTest, UnsupportedArchiveError } from './archive.js';
import { assToSrt, decodeSubtitle, errorSrt, releaseSimilarity, stripHearingImpaired } from './subtitle.js';
import { parseRelease, releaseMatch } from './release.js';
import { fromStremioLang, isLanguage, languageName, stremioLang, subdlCode, subsourceName } from './languages.js';
import { configurePage } from './configure.js';
import { LOGO_PNG } from './logo.js';
import { createSealer, sha256 } from './crypto.js';
import { MemoryStore, createStore } from './store.js';
import { DEFAULT_UI, normalizeUi, t } from './i18n.js';

const VERSION = '3.8.0';
const MAX_LANGUAGES = 10;
// Kullanıcı isterse her dilde gösterilecek altyazı sayısını sınırlar; varsayılan sınırsızdır.
const MAX_PER_LANGUAGE = 50;
const ROUTES = new Set(['manifest.json', 'subtitles', 'sub', 'sd', 'ss', 'adb', 'message', 'configure', 'api']);

// stremio-addons.net'te eklentinin sahipliğini doğrulayan imza (gizli değildir; sitenin "Claim addon" penceresinden alınır).
const STREMIO_ADDONS_SIGNATURE = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..ol7BX2P9CbGPXdlfMscb9g.A8W2tVQPhKRsZ6J1cPK27PjeuR0cIjRgonPxHspaHUWmZQrQkq8KszM2iYtJS_2JfhzX1SOD-z7dGsfN5BX0RIv2khsB4sEOKvOZNhHrjDdyhQgbp4EG7uhbg2M2syVA.Cxx4hkhJSC88JRE506mSvA';

const SEARCH_TTL = 6 * 60 * 60;
// Bir kaynak yanıt vermediği için eksik kalan liste oynatıcıda uzun süre saklanmasın.
const PARTIAL_TTL = 60;
const KITSU_TTL = 24 * 60 * 60;
// Animelerde baştan sayılan bölüm numarası bu sürede bulunamazsa aramalar yalnızca sezon numarasıyla yapılır.
const NUMBERING_DEADLINE_MS = 4000;
// Bir kaynak bu sürede yanıt vermezse liste onu beklemeden gösterilir.
const SOURCE_DEADLINE_MS = 10000;
const FILE_TTL = 30 * 24 * 60 * 60;
const TOKEN_TTL = 23 * 60 * 60;
const LOGIN_BACKOFF = 5 * 60;
const CONNECT_ATTEMPTS = { max: 20, windowSec: 10 * 60 };
// Ayar sayfasındaki "kaynaklarımı dene" butonunun aradığı örnek film (The Shawshank Redemption).
const TEST_TITLE = 'tt0111161';
// Liste kısaltılırken her siteden en az bir altyazı kalsın diye kaynakların ait olduğu site.
const SITE = { official: 'os', pool: 'os', quota: 'os', subdl: 'subdl', subsource: 'subsource', altyazidb: 'altyazidb' };
// Aynı hesapla bu sürede en fazla bu kadar hak harcanır.
const QUOTA_BURST = { max: 1, windowSec: 5 };

const SRT = 'application/x-subrip; charset=utf-8';

class LoginError extends Error {}
class TimeoutError extends Error {}

/**
 * İş verilen sürede bitmezse hata verir. Asıl istek arkada sürer; biterse sonucu önbelleğe girer
 * ve liste bir sonraki açılışta eksiksiz gelir.
 */
function within(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${ms} ms içinde yanıt vermedi`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parseLanguages(value) {
  const codes = String(value || '').split(',').map((l) => l.trim().toLowerCase()).filter(isLanguage);
  return [...new Set(codes)].slice(0, MAX_LANGUAGES);
}

const isText = (value) => typeof value === 'string' && value.length > 0 && value.length < 500;
const maskKey = (key) => (key.length > 6 ? `…${key.slice(-4)}` : '…');
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const unb64 = (value) => {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

export function createAddon(env = process.env) {
  const sealer = createSealer(env.CONFIG_SECRET);
  const client = new OpenSubtitlesClient({ apiKey: env.OS_API_KEY });
  const store = createStore(env);
  const sessions = new MemoryStore(1000);
  const failedLogins = new MemoryStore(1000);
  const connectAttempts = new MemoryStore(1000);
  const quotaSpends = new MemoryStore(1000);
  const sourceDeadline = Number(env.SOURCE_DEADLINE_MS) || SOURCE_DEADLINE_MS;
  console.log(`[addon] Önbellek: ${store.persistent ? 'Upstash Redis' : 'sadece bellek'}`);

  /** Şifreli "auth" parçasındaki kaynakları okur: OpenSubtitles hesabı (u/p), SubDL (sd), SubSource (ss) ve AltyazıDB (ad) anahtarları. */
  function openSecrets(auth) {
    const data = auth && sealer ? sealer.open(auth) : null;
    if (!data || typeof data !== 'object') return {};
    const secrets = {};
    if (isText(data.u) && isText(data.p)) {
      secrets.u = data.u;
      secrets.p = data.p;
    }
    if (isText(data.sd)) secrets.sd = data.sd;
    if (isText(data.ss)) secrets.ss = data.ss;
    if (isText(data.ad)) secrets.ad = data.ad;
    return secrets;
  }

  /**
   * Adresteki ayar bölümünü okur: "languages=tr,en&ui=tr&auth=<şifreli kaynaklar>".
   * İsteğe bağlı: "max=10" (dil başına en fazla altyazı), "match=0" (akıllı sürüm eşleştirme kapalı),
   * "fb=1" (sonraki diller yalnızca yedek), "mt=0" (makine çevirileri gizli), "hi=last|hide" (işitme engelli
   * altyazılar sonda ya da gizli), "clean=1" (ses açıklamaları temizlenir).
   * Şifre çözülemezse kullanıcının hiç kaynağı yok sayılır.
   */
  function parseConfig(segment) {
    const params = new URLSearchParams(segment || '');
    const secrets = openSecrets(params.get('auth'));
    const max = Number(params.get('max'));
    const hi = params.get('hi');
    const config = {
      languages: parseLanguages(params.get('languages')),
      ui: normalizeUi(params.get('ui')),
      max: Number.isInteger(max) && max >= 1 && max <= MAX_PER_LANGUAGE ? max : null,
      match: params.get('match') !== '0',
      fallback: params.get('fb') === '1',
      machine: params.get('mt') !== '0',
      hi: hi === 'last' || hi === 'hide' ? hi : 'show',
      clean: params.get('clean') === '1',
      os: secrets.u ? { username: secrets.u, password: secrets.p } : null,
      subdl: secrets.sd || null,
      subsource: secrets.ss || null,
      altyazidb: secrets.ad || null,
    };
    config.hasSource = !!(config.os || config.subdl || config.subsource || config.altyazidb);
    config.auth = config.hasSource ? params.get('auth') : null;
    return config;
  }

  /** Altyazı dosyası adreslerine yazılan ayar bölümü; dosya açılırken gereken ayarları taşır. */
  function configSegment(config) {
    return `languages=${config.languages.join(',')}&ui=${config.ui || DEFAULT_UI}${config.clean ? '&clean=1' : ''}&auth=${config.auth}`;
  }

  function sourceSummary(config) {
    return {
      os: config.os?.username || null,
      subdl: config.subdl ? maskKey(config.subdl) : null,
      subsource: config.subsource ? maskKey(config.subsource) : null,
      altyazidb: config.altyazidb ? maskKey(config.altyazidb) : null,
    };
  }

  function buildManifest(config, baseUrl) {
    const ui = config.ui || DEFAULT_UI;
    const langs = config.languages.map((code) => languageName(code, ui)).join(', ') || '—';
    const sources = [config.os && 'OpenSubtitles', config.subdl && 'SubDL', config.subsource && 'SubSource', config.altyazidb && 'AltyazıDB']
      .filter(Boolean).join(', ') || '—';
    return {
      id: 'community.diavelin.subpool',
      version: VERSION,
      name: 'SubPool by Diavelin',
      description: t(ui, 'manifestDesc', { langs, sources }),
      logo: `${baseUrl}/logo.png`,
      resources: ['subtitles'],
      types: ['movie', 'series', 'anime'],
      idPrefixes: ['tt', 'kitsu'],
      catalogs: [],
      behaviorHints: { configurable: true, configurationRequired: !config.hasSource || !config.languages.length },
      ...(STREMIO_ADDONS_SIGNATURE && { stremioAddonsConfig: { issuer: 'https://stremio-addons.net', signature: STREMIO_ADDONS_SIGNATURE } }),
    };
  }

  async function cached(key, ttl, load) {
    const hit = await store.get(key);
    if (hit) return JSON.parse(hit);
    const value = await load();
    await store.set(key, JSON.stringify(value), ttl);
    return value;
  }

  // ---------- OpenSubtitles (kullanıcının kendi hesabı) ----------

  /** Kullanıcının OpenSubtitles oturumunu döndürür; gerekirse giriş yapar. Token'lar önbellekte şifreli tutulur. */
  async function getSession(creds, { fresh = false } = {}) {
    const key = sha256(`${creds.username}\n${creds.password}`);
    if (!fresh) {
      const saved = sessions.get(key) || sealer.open(await store.get(`tok:${key}`));
      if (saved?.token) {
        sessions.set(key, saved, TOKEN_TTL);
        return saved;
      }
    }
    if (failedLogins.get(key)) throw new LoginError();

    let session;
    try {
      session = await client.login(creds.username, creds.password);
    } catch (err) {
      if ([400, 401, 403].includes(err.status)) {
        failedLogins.set(key, true, LOGIN_BACKOFF);
        throw new LoginError();
      }
      throw err;
    }
    sessions.set(key, session, TOKEN_TTL);
    await store.set(`tok:${key}`, sealer.seal(session), TOKEN_TTL);
    return session;
  }

  async function requestDownload(creds, fileId) {
    try {
      return await client.download(fileId, await getSession(creds));
    } catch (err) {
      if (err.status !== 401) throw err;
    }
    // Token süresi dolmuş: yeniden giriş yapıp bir kez daha dene.
    return client.download(fileId, await getSession(creds, { fresh: true }));
  }

  function searchOpenSubtitles({ imdbId, season, episode, languages, moviehash }) {
    const key = `search2:${imdbId}:${season ?? ''}:${episode ?? ''}:${languages.join(',')}:${moviehash || ''}`;
    return cached(key, SEARCH_TTL, async () => {
      const results = await client.searchAll({ imdbId, season, episode, languages, moviehash });
      // Önbellekte yer kaplamasın diye sadece sıralama için gereken alanlar saklanır.
      const compact = [];
      for (const { attributes: a } of results) {
        // Birden fazla parçaya (CD1/CD2) bölünmüş eski altyazılar tek dosyalık videolara uymaz.
        if (!a?.files || a.files.length !== 1) continue;
        const file = a.files[0];
        compact.push({
          lang: (a.language || '').toLowerCase(),
          fileId: file.file_id,
          legacy: a.legacy_subtitle_id ? String(a.legacy_subtitle_id) : null,
          release: a.release || file.file_name || '',
          hash: a.moviehash_match ? 1 : 0,
          trusted: a.from_trusted ? 1 : 0,
          machine: a.ai_translated || a.machine_translated ? 1 : 0,
          downloads: a.download_count || 0,
          hi: a.hearing_impaired ? 1 : 0,
        });
      }
      return compact;
    });
  }

  /** Bu başlık için ortak havuzda (önbellekte) bulunan OpenSubtitles dosyaları: { "os:<fileId>": bitişZamanı } */
  async function getPool(titleId) {
    const raw = await store.get(`pool:${titleId}`);
    const pool = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    for (const [key, expires] of Object.entries(pool)) if (expires <= now) delete pool[key];
    return pool;
  }

  async function addToPool(titleId, key) {
    const pool = await getPool(titleId);
    // Dosyanın kendisinden biraz önce bitsin ki "havuzda" görünen altyazı her zaman gerçekten önbellekte olsun.
    pool[key] = Date.now() + (FILE_TTL - 24 * 60 * 60) * 1000;
    await store.set(`pool:${titleId}`, JSON.stringify(pool), FILE_TTL);
  }

  async function openSubtitlesItems(config, ctx) {
    const { type, titleId, imdbId, season, episode, moviehash, languages } = ctx;
    // Arama ile resmi eklenti birbirini beklemez: biri gecikir ya da hata verirse diğerinin sonuçları yine gösterilir.
    const orEmpty = (name, promise) => within(promise, sourceDeadline - 500).catch((err) => {
      console.error(`[${name}] ${titleId}: ${err.message}`);
      ctx.partial = true;
      return [];
    });
    const sorted = [...languages].sort();
    // Animelerde aynı bölüm sitede baştan sayılan numarayla da kayıtlı olabilir; o numaralarla da aranır.
    const alternates = ctx.numbering.then((numbering) => Promise.all((numbering?.alternates || []).map((alt) =>
      orEmpty('OpenSubtitles', searchOpenSubtitles({ imdbId, season: alt.season, episode: alt.episode, languages: sorted, moviehash })))));
    const [main, extra, official, pool] = await Promise.all([
      orEmpty('OpenSubtitles', searchOpenSubtitles({ imdbId, season, episode, languages: sorted, moviehash })),
      alternates,
      orEmpty('v3', cached(`v3:${type}:${titleId}`, SEARCH_TTL, () => officialSubtitles(type, titleId))),
      getPool(titleId),
    ]);

    const results = [...main, ...extra.flat()];
    const officialById = new Map(official.map((o) => [o.id, o]));
    const usedOfficial = new Set();
    const prefix = `${ctx.baseUrl}/${configSegment(config)}/sub`;
    const items = [];
    for (const r of results) {
      const match = r.legacy && officialById.get(r.legacy);
      let source;
      let url;
      if (match) {
        // Resmi eklentide de var: Stremio'nun sunucusundan, kimsenin hakkını harcamadan gelir.
        usedOfficial.add(match.id);
        source = 'official';
        url = match.url;
      } else {
        source = pool[`os:${r.fileId}`] ? 'pool' : 'quota';
        url = `${prefix}/${encodeURIComponent(r.lang)}/${encodeURIComponent(titleId)}/${r.fileId}.srt`;
      }
      items.push({ ...r, key: `os-${r.fileId}`, source, url });
    }

    // Resmi eklentide olup OpenSubtitles aramasında çıkmayanlar da ücretsiz olarak eklenir.
    for (const o of official) {
      const lang = fromStremioLang(o.lang);
      if (usedOfficial.has(o.id) || !lang || !languages.includes(lang)) continue;
      items.push({ key: `v3-${o.id}`, source: 'official', url: o.url, lang, release: o.release, downloads: 0 });
    }
    return items;
  }

  // ---------- SubDL, SubSource ve AltyazıDB (kullanıcının kendi anahtarı) ----------

  async function subdlItems(config, ctx) {
    const codes = new Map();
    for (const lang of ctx.languages) {
      const code = subdlCode(lang);
      if (code && !codes.has(code)) codes.set(code, lang);
    }
    if (!codes.size) return [];
    const { imdbId, season, episode } = ctx;
    const subdl = new SubdlClient({ apiKey: config.subdl, userAgent: USER_AGENT });
    const list = [...codes.keys()].sort().join(',');
    const alternates = ctx.numbering.then((numbering) => Promise.all((numbering?.alternates || []).map((alt) =>
      cached(`sd:${imdbId}:${alt.season}:${alt.episode}:${list}:strict`, SEARCH_TTL, () =>
        subdl.search({ imdbId, season: alt.season, episode: alt.episode, languages: [...codes.keys()], strict: true }))
        .catch((err) => (console.error(`[SubDL] ${ctx.titleId}: ${err.message}`), [])))));
    const [main, extra, numbering] = await Promise.all([
      cached(`sd:${imdbId}:${season ?? ''}:${episode ?? ''}:${list}`, SEARCH_TTL, () =>
        subdl.search({ imdbId, season, episode, languages: [...codes.keys()] })),
      alternates,
      ctx.numbering,
    ]);
    const results = [...main, ...extra.flat()];

    const prefix = `${ctx.baseUrl}/${configSegment(config)}/sd`;
    return results
      .filter((r) => codes.has(r.lang))
      .map((r) => {
        const lang = codes.get(r.lang);
        // Paketlerde istenen bölüm indirme sırasında ayıklanır; animelerde baştan sayılan numara da taşınır.
        const token = b64(r.direct || r.season === undefined
          ? { p: r.path }
          : { p: r.path, s: Number(season), e: Number(episode), a: numbering?.absolute, n: numbering?.seasonLength || undefined });
        return { key: `sd-${r.path}`, source: 'subdl', lang, release: r.release, releases: r.releases, hi: r.hi, downloads: 0, url: `${prefix}/${encodeURIComponent(lang)}/${token}.srt` };
      });
  }

  async function subsourceItems(config, ctx) {
    const names = new Map();
    for (const lang of ctx.languages) {
      const name = subsourceName(lang);
      if (name && !names.has(name)) names.set(name, lang);
    }
    if (!names.size) return [];
    const { imdbId, season, episode } = ctx;
    const subsource = new SubsourceClient({ apiKey: config.subsource, userAgent: USER_AGENT });
    const list = [...names.keys()].sort().join(',');
    const numbering = await ctx.numbering;
    const anime = !!numbering;
    const [main, ...extra] = await Promise.all([
      cached(`ss:${imdbId}:${season ?? ''}:${episode ?? ''}:${list}${anime ? ':anime' : ''}`, SEARCH_TTL, () =>
        subsource.search({ imdbId, season, episode, languages: [...names.keys()], anime })),
      ...(numbering?.alternates || []).map((alt) =>
        cached(`ss:${imdbId}:${alt.season}:${alt.episode}:${list}:strict`, SEARCH_TTL, () =>
          subsource.search({ imdbId, season: alt.season, episode: alt.episode, languages: [...names.keys()], anime: true, strict: true }))
          .catch((err) => (console.error(`[SubSource] ${ctx.titleId}: ${err.message}`), []))),
    ]);
    const results = [...main, ...extra.flat()];

    const prefix = `${ctx.baseUrl}/${configSegment(config)}/ss`;
    return results
      .filter((r) => names.has(r.lang))
      .map((r) => {
        const lang = names.get(r.lang);
        const file = `${r.id}-${season ?? 0}-${episode ?? 0}${numbering ? `-${numbering.absolute}-${numbering.seasonLength}` : ''}`;
        return { key: `ss-${r.id}`, source: 'subsource', lang, release: r.release, releases: r.releases, hi: r.hi, downloads: 0, url: `${prefix}/${encodeURIComponent(lang)}/${file}.srt` };
      });
  }

  async function altyazidbItems(config, ctx) {
    const languages = ctx.languages.filter((lang) => ALTYAZIDB_LANGUAGES.includes(lang));
    if (!languages.length) return [];
    const { imdbId, season, episode } = ctx;
    const key = `adb:${imdbId}:${season ?? ''}:${episode ?? ''}:${[...languages].sort().join(',')}`;
    const results = await cached(key, SEARCH_TTL, () =>
      new AltyazidbClient({ apiKey: config.altyazidb, userAgent: USER_AGENT }).search({ imdbId, season, episode, languages }));

    const prefix = `${ctx.baseUrl}/${configSegment(config)}/adb`;
    return results
      .filter((r) => languages.includes(r.lang))
      .map((r) => {
        // Sezon paketlerinde istenen bölüm indirme sırasında ayıklanır.
        const file = `${r.id}-${r.pack ? season : 0}-${r.pack ? episode : 0}`;
        return { key: `adb-${r.id}`, source: 'altyazidb', lang: r.lang, release: r.release, releases: r.releases, hi: r.hi, machine: r.machine, downloads: r.downloads, url: `${prefix}/${encodeURIComponent(r.lang)}/${file}.srt` };
      });
  }

  // ---------- Liste ----------

  /** Anime kataloglarındaki "kitsu:7442:3" gibi numaraları "tt2560140:1:3" biçimine çevirir; karşılığı yoksa null. */
  async function resolveKitsu(id) {
    const [, kitsuId, episode] = id.split(':');
    if (!/^\d+$/.test(kitsuId || '')) return null;
    const map = await cached(`kitsu:${kitsuId}`, KITSU_TTL, () => kitsuMap(kitsuId));
    if (map.movie || episode === undefined) return map.imdb;
    const found = map.episodes[episode];
    return found ? found.join(':') : null;
  }

  /**
   * Animelerde altyazı siteleri bölümleri çoğu zaman baştan sayar ("One Piece - 706"); IMDb ise sezonlara böler
   * (17. sezon 78. bölüm). Bölümün baştan sayılan numarasını bulur ki aramalar onunla da yapılabilsin.
   * `id` oynatıcının gönderdiği numaradır ("kitsu:12:706" ya da "tt0388629:17:78").
   * Sonuç: { absolute, seasonLength, alternates: [{ season, episode }] }; anime değilse ya da bulunamazsa null.
   */
  async function animeNumbering(id, imdbId, season, episode) {
    const s = Number(season);
    const e = Number(episode);
    if (!(s > 1) || !(e > 0)) return null;
    const info = await cached(`cinemeta:${imdbId}`, KITSU_TTL, () => seriesInfo(imdbId)).catch(() => null);
    const points = (map, ep) => {
      const found = map?.episodes[ep];
      return !!found && found[0] === imdbId && found[1] === s && found[2] === e;
    };

    // Bu bölümün Kitsu'daki kaydı ve oradaki bölüm numarası.
    let entry = null;
    if (id.startsWith('kitsu:')) {
      const [, kitsuId, kitsuEpisode] = id.split(':');
      const map = await cached(`kitsu:${kitsuId}`, KITSU_TTL, () => kitsuMap(kitsuId));
      if (points(map, kitsuEpisode)) entry = { map, episode: kitsuEpisode };
    } else if (info?.animation && info.name) {
      const ids = await cached(`kitsu-ids:${imdbId}`, KITSU_TTL, async () =>
        (await kitsuSearch(info.name)).filter((m) => m.imdb === imdbId).map((m) => m.id).slice(0, 12));
      const maps = await Promise.all(ids.map((kitsuId) =>
        cached(`kitsu:${kitsuId}`, KITSU_TTL, () => kitsuMap(kitsuId)).catch(() => null)));
      for (const map of maps) {
        const kitsuEpisode = Object.keys(map?.episodes || {}).find((ep) => points(map, ep));
        if (kitsuEpisode) entry = entry || { map, episode: kitsuEpisode };
      }
    }
    if (!entry) return null;

    // Kayıt dizinin ilk bölümünden başlıyorsa Kitsu numarası baştan sayılan numaradır; değilse önceki sezonlar toplanır.
    const first = entry.map.episodes['1'];
    let absolute = null;
    if (first && first[0] === imdbId && first[1] === 1 && first[2] === 1) {
      absolute = Number(entry.episode);
    } else if (info) {
      absolute = e;
      for (let i = 1; i < s; i++) absolute = info.seasons[i] > 0 ? absolute + info.seasons[i] : NaN;
    }
    if (!Number.isInteger(absolute) || absolute <= e) return null;

    const seasonLength = info?.seasons[s] || 0;
    // "1. sezon 25. bölüm" ve "2. sezon 25. bölüm" yazımları, ancak o sezonda gerçekten 25. bölüm yoksa başka bir bölümle karışmaz.
    const alternates = info?.seasons[1] >= absolute ? [] : [{ season: 1, episode: absolute }];
    if (seasonLength && absolute > seasonLength) alternates.push({ season: s, episode: absolute });
    return { absolute, seasonLength, alternates };
  }

  /** Sonuç: { subtitles, partial } — partial: bir kaynak yanıt vermediği için liste eksik olabilir. */
  async function getSubtitles(config, type, id, extra, baseUrl) {
    const ui = config.ui || DEFAULT_UI;
    if (!config.hasSource || !config.languages.length) {
      return {
        subtitles: [{
          id: 'subpool-setup-required',
          url: `${baseUrl}/message/${ui}/setup.srt`,
          lang: stremioLang(config.languages[0] || 'en'),
          label: t(ui, 'needAccountLabel'),
        }],
      };
    }

    const titleId = id.startsWith('kitsu:') ? await within(resolveKitsu(id), sourceDeadline) : id;
    const [imdbId, season, episode] = String(titleId || '').split(':');
    if (!/^tt\d+$/.test(imdbId)) return { subtitles: [] };
    const ctx = {
      type: season !== undefined ? 'series' : 'movie',
      titleId,
      imdbId,
      season,
      episode,
      moviehash: /^[0-9a-f]{16}$/i.test(extra.videoHash || '') ? extra.videoHash.toLowerCase() : undefined,
      languages: config.languages,
      baseUrl,
    };
    ctx.numbering = within(animeNumbering(id, imdbId, season, episode), NUMBERING_DEADLINE_MS).catch((err) => {
      console.error(`[numara] ${id}: ${err.message}`);
      if (err instanceof TimeoutError) ctx.partial = true;
      return null;
    });

    const tasks = [
      ['OpenSubtitles', config.os && openSubtitlesItems],
      ['SubDL', config.subdl && subdlItems],
      ['SubSource', config.subsource && subsourceItems],
      ['AltyazıDB', config.altyazidb && altyazidbItems],
    ].filter(([, fn]) => fn);
    // Yavaş kalan kaynak beklenmez; zamanında yanıt verenlerle liste gösterilir.
    const settled = await Promise.allSettled(tasks.map(([, fn]) => within(fn(config, ctx), sourceDeadline)));
    const all = [];
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') return all.push(...result.value);
      ctx.partial = true;
      console.error(`[${tasks[i][0]}] ${id}: ${result.reason?.message}`);
    });

    // Akıllı eşleştirme: sürüm adı parçalarına ayrılır (grup, kaynak, kurgu…) ve videonun dosya adıyla karşılaştırılır.
    const video = config.match && extra.filename ? parseRelease(extra.filename) : null;
    const seen = new Set();
    const items = [];
    for (const r of all) {
      if (seen.has(r.key)) continue;
      seen.add(r.key);
      let score = 0;
      let release = r.release;
      if (r.hash) score += 1000;
      if (video) {
        // Bir altyazı birden fazla sürüme uyabilir; videoya en çok uyan sürüm adı sayılır ve etikette o gösterilir.
        let best = -Infinity;
        for (const name of r.releases?.length ? r.releases : [r.release]) {
          const fit = releaseMatch(video, parseRelease(name)) + releaseSimilarity(name, extra.filename) * 40;
          if (fit > best) {
            best = fit;
            release = name;
          }
        }
        score += best;
      } else {
        score += releaseSimilarity(r.release, extra.filename) * 200;
      }
      if (r.trusted) score += 20;
      if (r.machine) score -= 500;
      score += Math.log10(1 + (r.downloads || 0)) * 10;
      items.push({ ...r, release, score });
    }

    // Liste filtreleri: makine çevirileri ve işitme engelli (HI) altyazılar isteğe bağlı olarak gizlenir.
    const visible = items.filter((r) => (config.machine || !r.machine) && (config.hi !== 'hide' || !r.hi));

    // Sıra: önce dil, sonra ücretsiz olanlar (hak harcayanlar hep altta), istenirse HI olanlar sonda, en son videoya uygunluk.
    const languages = config.languages;
    const order = (r) => {
      const index = languages.indexOf(r.lang);
      return (index === -1 ? 99 : index) * 4 + (r.source === 'quota' ? 2 : 0) + (config.hi === 'last' && r.hi ? 1 : 0);
    };
    visible.sort((x, y) => order(x) - order(y) || y.score - x.score);
    // Yedek dil: yalnızca altyazısı bulunan ilk dil gösterilir; sonraki diller o dilde hiç altyazı yoksa devreye girer.
    const first = config.fallback ? languages.find((lang) => visible.some((r) => r.lang === lang)) : null;
    const listed = first ? visible.filter((r) => r.lang === first) : visible;
    const shown = config.max ? limitPerLanguage(listed, config.max) : listed;

    const tags = {
      official: t(ui, 'tagOfficial'),
      pool: t(ui, 'tagPool'),
      quota: t(ui, 'tagQuota'),
      subdl: t(ui, 'tagSubdl'),
      subsource: t(ui, 'tagSubsource'),
      altyazidb: t(ui, 'tagAltyazidb'),
    };
    // Stremio `label`i gösterir; Nuvio TV ise `id`yi gösterir. Bu yüzden id de etiketi taşır (tekrarlar numaralanır).
    const used = new Map();
    const subtitles = shown.map((r) => {
      // HI: işitme engelliler için (ses ve müzik açıklamaları da yazılı).
      const label = `${tags[r.source]}${r.hi ? ' · HI' : ''} | ${r.release || languageName(r.lang, ui)}`;
      const count = (used.get(label) || 0) + 1;
      used.set(label, count);
      return {
        id: count > 1 ? `${label} (${count})` : label,
        url: r.url,
        lang: stremioLang(r.lang),
        label,
      };
    });
    return { subtitles, partial: !!ctx.partial };
  }

  /**
   * Sıralı listeyi her dilde en fazla `max` altyazıya indirir. Önce her sitenin en iyi altyazısı ayrılır
   * (tek bir site listeyi doldurup diğerlerini dışarıda bırakmasın), kalan yerler sıradaki en iyilerle dolar.
   */
  function limitPerLanguage(items, max) {
    const byLang = new Map();
    for (const r of items) byLang.set(r.lang, [...(byLang.get(r.lang) || []), r]);
    const kept = new Set();
    for (const group of byLang.values()) {
      const chosen = new Set();
      const sites = new Set();
      for (const r of group) {
        if (chosen.size >= max) break;
        if (sites.has(SITE[r.source])) continue;
        sites.add(SITE[r.source]);
        chosen.add(r);
      }
      for (const r of group) {
        if (chosen.size >= max) break;
        chosen.add(r);
      }
      for (const r of chosen) kept.add(r);
    }
    return items.filter((r) => kept.has(r));
  }

  // ---------- Dosyalar ----------

  /**
   * Kullanıcı istediyse ses açıklamalarını çıkarır. Önbellekteki dosya herkes için ortak olduğundan ona dokunulmaz;
   * temizlik her açılışta, yalnızca isteyen kullanıcıya giden metinde yapılır.
   */
  const tidy = (config, text) => (config.clean ? stripHearingImpaired(text) : text);

  /**
   * Kısa sürede art arda gelen hak harcayan istekleri durdurur. Bazı oynatıcılar listedeki bütün
   * altyazıları kendiliğinden çeker (ör. Nuvio'da video indirirken) ve günlük hakkı bir anda bitirebilir.
   */
  function quotaBurst(creds) {
    const key = sha256(creds.username);
    const now = Date.now();
    const recent = (quotaSpends.get(key) || []).filter((at) => now - at < QUOTA_BURST.windowSec * 1000);
    if (recent.length >= QUOTA_BURST.max) return true;
    quotaSpends.set(key, [...recent, now], QUOTA_BURST.windowSec);
    return false;
  }

  async function getOpenSubtitlesFile(config, lang, titleId, fileId) {
    const ui = config.ui || DEFAULT_UI;
    if (!config.os) return errorSrt(t(ui, 'needAccount'));

    // Önbellekteki altyazılar herkes için ortaktır ve kimsenin indirme hakkını harcamaz.
    const cacheKey = `sub:${fileId}`;
    const hit = await store.get(cacheKey);
    if (hit) return tidy(config, hit);

    if (quotaBurst(config.os)) return errorSrt([t(ui, 'burst'), t(ui, 'quotaHint')]);

    let info;
    try {
      info = await requestDownload(config.os, fileId);
    } catch (err) {
      if (err instanceof LoginError) return errorSrt(t(ui, 'loginFailed'));
      if (err.status === 406) {
        const reset = formatReset(err.data?.reset_time_utc, ui);
        return errorSrt([t(ui, 'quota'), reset ? t(ui, 'quotaReset', { time: reset }) : '', t(ui, 'quotaHint')].filter(Boolean));
      }
      throw err;
    }

    const res = await fetch(info.link, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Altyazı dosyası indirilemedi: ${res.status}`);
    const text = assToSrt(decodeSubtitle(new Uint8Array(await res.arrayBuffer()), lang));
    await store.set(cacheKey, text, FILE_TTL);
    if (titleId) await addToPool(titleId, `os:${fileId}`);
    console.log(`[os] İndirildi ${fileId} (kalan hak: ${info.remaining ?? '?'})`);
    return tidy(config, text);
  }

  async function archiveFile(config, lang, cacheKey, download, where) {
    const ui = config.ui || DEFAULT_UI;
    const hit = await store.get(cacheKey);
    if (hit) return tidy(config, hit);
    let bytes;
    try {
      bytes = await pickSubtitle(await download(), where);
    } catch (err) {
      if (err instanceof UnsupportedArchiveError) return errorSrt(t(ui, 'archiveUnsupported'));
      throw err;
    }
    if (!bytes) return errorSrt(t(ui, 'notInPack'));
    const text = assToSrt(decodeSubtitle(bytes, lang));
    await store.set(cacheKey, text, FILE_TTL);
    return tidy(config, text);
  }

  function getSubdlFile(config, lang, token) {
    const ui = config.ui || DEFAULT_UI;
    if (!config.subdl) return errorSrt(t(ui, 'needAccount'));
    const data = unb64(token);
    if (!data || typeof data.p !== 'string') return errorSrt([t(ui, 'failed'), 'bad link']);
    const where = { season: data.s, episode: data.e, absolute: data.a, seasonLength: data.n };
    const cacheKey = `sub:sd:${sha256(`${data.p}|${data.s ?? ''}|${data.e ?? ''}${data.a ? `|${data.a}|${data.n ?? ''}` : ''}`)}`;
    return archiveFile(config, lang, cacheKey, () => SubdlClient.download(data.p, USER_AGENT), where);
  }

  function getSubsourceFile(config, lang, file) {
    const ui = config.ui || DEFAULT_UI;
    if (!config.subsource) return errorSrt(t(ui, 'needAccount'));
    const [id, season, episode, absolute, seasonLength] = file.split('-').map(Number);
    const where = episode ? { season, episode, absolute, seasonLength } : {};
    const subsource = new SubsourceClient({ apiKey: config.subsource, userAgent: USER_AGENT });
    return archiveFile(config, lang, `sub:ss:${id}:${season}:${episode}${absolute ? `:${absolute}:${seasonLength}` : ''}`, async () => {
      try {
        return await subsource.download(id);
      } catch (err) {
        if ([401, 403].includes(err.status)) throw Object.assign(new Error('key'), { keyRejected: 'SubSource' });
        throw err;
      }
    }, where);
  }

  async function getAltyazidbFile(config, lang, file) {
    const ui = config.ui || DEFAULT_UI;
    if (!config.altyazidb) return errorSrt(t(ui, 'needAccount'));
    const [id, season, episode] = file.split('-').map(Number);
    const cacheKey = `sub:adb:${id}:${season}:${episode}`;
    const hit = await store.get(cacheKey);
    if (hit) return tidy(config, hit);

    let bytes;
    try {
      bytes = await new AltyazidbClient({ apiKey: config.altyazidb, userAgent: USER_AGENT }).download(id, episode ? { season, episode } : {});
    } catch (err) {
      if ([401, 403].includes(err.status)) throw Object.assign(new Error('key'), { keyRejected: 'AltyazıDB' });
      if (err.status === 404 && episode) return errorSrt(t(ui, 'notInPack'));
      throw err;
    }
    const text = assToSrt(decodeSubtitle(bytes, lang));
    await store.set(cacheKey, text, FILE_TTL);
    return tidy(config, text);
  }

  // ---------- Ayar sayfası: kaynak bağlama ----------

  /** Aynı adresten kısa sürede çok fazla bağlama/deneme isteği geldiyse true döner. */
  function tooManyAttempts(req) {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const attempts = (connectAttempts.get(ip) || 0) + 1;
    if (attempts > CONNECT_ATTEMPTS.max) return true;
    connectAttempts.set(ip, attempts, CONNECT_ATTEMPTS.windowSec);
    return false;
  }

  /**
   * Ayar sayfasındaki "bağla / kaldır" butonları. Mevcut şifreli parçayı açar, istenen kaynağı doğrulayıp ekler
   * (ya da kaldırır) ve yeni şifreli parçayı döndürür. Şifre ve anahtarlar sunucuda saklanmaz.
   */
  async function handleConnect(req, res) {
    if (!sealer || !env.OS_API_KEY) return sendJson(res, { error: 'server_misconfigured' }, 500);

    if (tooManyAttempts(req)) return sendJson(res, { error: 'too_many' }, 429);

    let body;
    try {
      body = JSON.parse(await readBody(req, 8192));
    } catch {
      return sendJson(res, { error: 'bad_request' }, 400);
    }
    const secrets = openSecrets(body?.auth);
    let allowedDownloads = null;

    if (body?.remove === 'os') {
      delete secrets.u;
      delete secrets.p;
    } else if (body?.remove === 'subdl') {
      delete secrets.sd;
    } else if (body?.remove === 'subsource') {
      delete secrets.ss;
    } else if (body?.remove === 'altyazidb') {
      delete secrets.ad;
    }

    if (body?.os) {
      const username = String(body.os.username || '').trim();
      const password = String(body.os.password || '');
      if (!isText(username) || !isText(password)) return sendJson(res, { error: 'bad_login' }, 401);
      let session;
      try {
        session = await client.login(username, password);
      } catch (err) {
        // OpenSubtitles'ın yanıtı günlüğe yazılır (kullanıcı adı ve şifre yazılmaz), sorun bildirildiğinde bakılabilsin.
        console.error(`[connect] OpenSubtitles girişi başarısız: ${String(err.message).slice(0, 200)}`);
        if ([400, 401].includes(err.status)) return sendJson(res, { error: 'bad_login' }, 401);
        // 403 "şifre yanlış" yanıtı değildir (yanlış şifrede 401 gelir); kullanıcıya ayrı söylenir.
        if (err.status === 403) return sendJson(res, { error: 'os_refused' }, 502);
        if (err.status === 429) return sendJson(res, { error: 'too_many' }, 429);
        throw err;
      }
      const key = sha256(`${username}\n${password}`);
      sessions.set(key, session, TOKEN_TTL);
      failedLogins.delete(key);
      await store.set(`tok:${key}`, sealer.seal(session), TOKEN_TTL);
      secrets.u = username;
      secrets.p = password;
      allowedDownloads = session.allowedDownloads ?? null;
    }

    for (const [field, name, Client] of [['subdl', 'sd', SubdlClient], ['subsource', 'ss', SubsourceClient], ['altyazidb', 'ad', AltyazidbClient]]) {
      if (body?.[field] === undefined) continue;
      const apiKey = String(body[field] || '').trim();
      if (!isText(apiKey) || !(await new Client({ apiKey, userAgent: USER_AGENT }).verify())) {
        return sendJson(res, { error: 'bad_key' }, 401);
      }
      secrets[name] = apiKey;
    }

    const auth = Object.keys(secrets).length ? sealer.seal(secrets) : null;
    const config = parseConfig(auth ? `auth=${auth}` : '');
    return sendJson(res, { auth, sources: sourceSummary(config), allowedDownloads });
  }

  /**
   * Ayar sayfasındaki "kaynaklarımı dene" butonu. Bağlı her kaynakta örnek bir film aranır ve kaç altyazı
   * bulunduğu söylenir. Yalnızca arama yapılır; altyazı indirilmez, kimsenin indirme hakkı harcanmaz.
   */
  async function handleTest(req, res) {
    if (!sealer || !env.OS_API_KEY) return sendJson(res, { error: 'server_misconfigured' }, 500);
    if (tooManyAttempts(req)) return sendJson(res, { error: 'too_many' }, 429);

    let body;
    try {
      body = JSON.parse(await readBody(req, 8192));
    } catch {
      return sendJson(res, { error: 'bad_request' }, 400);
    }
    const config = parseConfig(new URLSearchParams({
      languages: Array.isArray(body?.languages) ? body.languages.join(',') : '',
      auth: typeof body?.auth === 'string' ? body.auth : '',
    }).toString());
    const languages = config.languages.length ? config.languages : ['en'];
    const rejected = () => Object.assign(new Error('key'), { rejected: true });

    /** Kullanıcının anahtarıyla arama yapar; kaynak seçili dilleri hiç desteklemiyorsa yalnızca anahtarı doğrular. */
    const keySearch = async (client, codes) => {
      if (!codes.length) {
        if (!(await client.verify())) throw rejected();
        return { count: 0 };
      }
      return { count: (await client.search({ imdbId: TEST_TITLE, languages: codes })).length };
    };
    const tests = {
      os: config.os && (async () => {
        let session = await getSession(config.os);
        let remaining = null;
        try {
          ({ remaining } = await client.userInfo(session).catch(async (err) => {
            if (err.status !== 401) throw err;
            // Oturumun süresi dolmuş: yeniden giriş yapıp bir kez daha sor.
            session = await getSession(config.os, { fresh: true });
            return client.userInfo(session);
          }));
        } catch (err) {
          if (err instanceof LoginError) throw err;
          console.error(`[test] OpenSubtitles hak bilgisi alınamadı: ${err.message}`);
        }
        const found = await searchOpenSubtitles({ imdbId: TEST_TITLE, languages: [...languages].sort() });
        return { count: found.length, remaining };
      }),
      subdl: config.subdl && (() => keySearch(
        new SubdlClient({ apiKey: config.subdl, userAgent: USER_AGENT }),
        [...new Set(languages.map(subdlCode).filter(Boolean))],
      )),
      subsource: config.subsource && (() => keySearch(
        new SubsourceClient({ apiKey: config.subsource, userAgent: USER_AGENT }),
        [...new Set(languages.map(subsourceName).filter(Boolean))],
      )),
      altyazidb: config.altyazidb && (() => keySearch(
        new AltyazidbClient({ apiKey: config.altyazidb, userAgent: USER_AGENT }),
        languages.filter((lang) => ALTYAZIDB_LANGUAGES.includes(lang)),
      )),
    };

    const results = await Promise.all(Object.entries(tests).filter(([, run]) => run).map(async ([source, run]) => {
      try {
        return { source, status: 'ok', ...(await within(run(), sourceDeadline)) };
      } catch (err) {
        if (err instanceof LoginError) return { source, status: 'login' };
        const badKey = err.rejected || [401, 403].includes(err.status) || (source === 'subdl' && /auth|api.?key/i.test(err.message));
        if (source !== 'os' && badKey) return { source, status: 'key' };
        console.error(`[test] ${source}: ${err.message}`);
        return { source, status: 'error' };
      }
    }));
    return sendJson(res, { results });
  }

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return send(res, 204, '');

    const url = new URL(req.url, 'http://localhost');
    const baseUrl = (env.PUBLIC_URL || detectBaseUrl(req)).replace(/\/+$/, '');
    let parts;
    try {
      parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
      return sendJson(res, { error: 'bad request' }, 400);
    }

    // İlk bölüm bilinen bir yol değilse kullanıcı ayarıdır: /languages=tr,en&ui=tr&auth=.../manifest.json
    const config = parts.length > 1 && !ROUTES.has(parts[0]) ? parseConfig(parts.shift()) : parseConfig('');
    const ui = config.ui || DEFAULT_UI;

    try {
      if (parts.length === 0 || (parts.length === 1 && parts[0] === 'configure')) {
        const html = configurePage({
          baseUrl,
          selected: config.languages,
          ui: config.ui,
          auth: config.auth,
          sources: sourceSummary(config),
          max: config.max,
          match: config.match,
          fallback: config.fallback,
          machine: config.machine,
          hi: config.hi,
          clean: config.clean,
          maxLanguages: MAX_LANGUAGES,
          misconfigured: !env.OS_API_KEY || !sealer,
        });
        return send(res, 200, html, 'text/html; charset=utf-8');
      }
      if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'connect' && req.method === 'POST') {
        return await handleConnect(req, res);
      }
      if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'test' && req.method === 'POST') {
        return await handleTest(req, res);
      }
      // Tarayıcıda hatırlanan şifreli parçanın hâlâ geçerli olup olmadığını söyler; hiçbir dış servise istek atmaz.
      if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'status' && req.method === 'POST') {
        let body;
        try {
          body = JSON.parse(await readBody(req, 8192));
        } catch {
          return sendJson(res, { error: 'bad_request' }, 400);
        }
        const saved = isText(body?.auth) ? parseConfig(`auth=${body.auth}`) : parseConfig('');
        return sendJson(res, { sources: sourceSummary(saved) });
      }
      // Sunucunun sürümünü ve RAR açıcının çalıştığını gösterir; hiçbir dış servise istek atmaz.
      if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'health') {
        return sendJson(res, { version: VERSION, rar: await rarSelfTest() });
      }
      if (parts.length === 1 && parts[0] === 'manifest.json') {
        return sendJson(res, buildManifest(config, baseUrl));
      }
      if (parts.length === 1 && (parts[0] === 'logo.png' || parts[0] === 'favicon.ico')) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return send(res, 200, LOGO_PNG, 'image/png');
      }
      if (parts[0] === 'subtitles' && (parts.length === 3 || parts.length === 4)) {
        const last = parts.length - 1;
        parts[last] = parts[last].replace(/\.json$/, '');
        const [, type, id] = parts;
        const extra = parts.length === 4 ? Object.fromEntries(new URLSearchParams(parts[3])) : {};
        const { subtitles, partial } = await getSubtitles(config, type, id, extra, baseUrl);
        console.log(`[addon] ${id} [${config.languages.join(',')}]: ${subtitles.length} altyazı${partial ? ' (eksik)' : ''}${extra.filename ? ` (${extra.filename})` : ''}`);
        return sendJson(res, { subtitles, cacheMaxAge: !config.hasSource ? 0 : partial ? PARTIAL_TTL : SEARCH_TTL });
      }
      // /sub/{dil}/{başlık}/{dosya}.srt (eski adresler: /sub/{dil}/{dosya}.srt)
      if (parts[0] === 'sub' && (parts.length === 3 || parts.length === 4) && /^\d+\.srt$/.test(parts[parts.length - 1])) {
        const fileId = parts[parts.length - 1].replace(/\.srt$/, '');
        const titleId = parts.length === 4 ? parts[2] : null;
        return send(res, 200, await getOpenSubtitlesFile(config, parts[1], titleId, fileId), SRT);
      }
      if (parts[0] === 'sd' && parts.length === 3 && /^[\w-]+\.srt$/.test(parts[2])) {
        return send(res, 200, await getSubdlFile(config, parts[1], parts[2].replace(/\.srt$/, '')), SRT);
      }
      if (parts[0] === 'ss' && parts.length === 3 && /^\d+-\d+-\d+(-\d+-\d+)?\.srt$/.test(parts[2])) {
        return send(res, 200, await getSubsourceFile(config, parts[1], parts[2].replace(/\.srt$/, '')), SRT);
      }
      if (parts[0] === 'adb' && parts.length === 3 && /^\d+-\d+-\d+\.srt$/.test(parts[2])) {
        return send(res, 200, await getAltyazidbFile(config, parts[1], parts[2].replace(/\.srt$/, '')), SRT);
      }
      if (parts[0] === 'message' && parts.length === 3) {
        const messageUi = normalizeUi(parts[1]) || DEFAULT_UI;
        return send(res, 200, errorSrt(t(messageUi, 'needAccount')), SRT);
      }
      return sendJson(res, { error: 'not found' }, 404);
    } catch (err) {
      console.error(`[addon] ${parts[0]}: ${err.message}`);
      if (parts[0] === 'subtitles') return sendJson(res, { subtitles: [], cacheMaxAge: 60 });
      if (['sub', 'sd', 'ss', 'adb'].includes(parts[0])) {
        const lines = err.keyRejected ? t(ui, 'keyRejected', { source: err.keyRejected }) : [t(ui, 'failed'), err.message];
        return send(res, 200, errorSrt(lines), SRT);
      }
      if (parts[0] === 'api') return sendJson(res, { error: 'server_error' }, 502);
      return sendJson(res, { error: 'server_error' }, 500);
    }
  };
}

function formatReset(utc, ui) {
  const date = utc ? new Date(utc) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(ui, { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }).format(date) + ' UTC';
  } catch {
    return date.toISOString();
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function detectBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.statusCode = status;
  if (body) res.setHeader('Content-Type', contentType);
  res.end(body);
}

function sendJson(res, data, status = 200) {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
}
