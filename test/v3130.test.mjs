// 3.13.0: MyAnimeList, AniList ve AniDB numaraları. Hiçbir gerçek siteye istek gitmez, hak harcanmaz.
import { VERSION } from './setup.mjs';
import { createServer } from 'node:http';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { ANIME_SITES, kitsuMap } = await import('../src/kitsu.js');

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 500) : ''}`); };

// ---------- Sahte siteler ----------
const realFetch = globalThis.fetch;
const calls = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const os = (file, release) => ({ attributes: { language: 'tr', legacy_subtitle_id: null, release, moviehash_match: false, from_trusted: false, ai_translated: false, machine_translated: false, download_count: 10, hearing_impaired: false, files: [{ file_id: file, file_name: 'x.srt' }] } });
const OS = {
  '2560140:1:3': [os(103, 'Shingeki.no.Kyojin.S01E03.1080p.BluRay')],
  '2560140:1:1': [os(101, 'Shingeki.no.Kyojin.S01E01.1080p.BluRay')],
  '2560140:2:5': [os(205, 'Shingeki.no.Kyojin.S02E05.1080p.BluRay')],
  '2560140:1:30': [os(130, '[Grup] Shingeki no Kyojin - 30 [1080p]')],
  '2098220:1:75': [os(7501, '[HorribleSubs] Hunter X Hunter - 75 [720p]')],
  '2098220:2:75': [os(9901, 'YANLIS BOLUM')],
  'film:5311514': [os(500, 'Kimi.no.Na.wa.2016.1080p.BluRay.x264')],
  'film:1000001': [os(900, 'Ornek.Film.2024.1080p.BluRay')],
};
const video = (id, s, e) => ({ id, imdb_id: undefined, imdbSeason: s, imdbEpisode: e });
// Gerçek servis MAL/AniList/AniDB numarasıyla sorulduğunda da Kitsu kaydını ("kitsu:7442:N") döndürür.
const season1 = { id: 'kitsu:7442', type: 'series', imdb_id: 'tt2560140', videos: [video('kitsu:7442:1', 1, 1), video('kitsu:7442:3', 1, 3), video('kitsu:7442:25', 1, 25)] };
const season2 = { id: 'kitsu:8671', type: 'series', imdb_id: 'tt2560140', videos: [video('kitsu:8671:1', 2, 1), video('kitsu:8671:5', 2, 5)] };
const film = { id: 'kitsu:11614', type: 'movie', imdb_id: 'tt5311514', videos: [{ id: 'kitsu:11614' }] };
const hxh = { id: 'kitsu:6448', type: 'series', imdb_id: 'tt2098220', videos: [video('kitsu:6448:1', 1, 1), video('kitsu:6448:75', 2, 17)] };
const ANIME = {
  'kitsu:7442': season1, 'mal:16498': season1, 'anilist:16498': season1, 'anidb:9541': season1,
  'kitsu:8671': season2, 'mal:25777': season2, 'anilist:20958': season2, 'anidb:10944': season2,
  'kitsu:11614': film, 'mal:32281': film, 'anilist:21519': film, 'anidb:11829': film,
  'kitsu:6448': hxh, 'mal:11061': hxh,
  'mal:999': { id: 'kitsu:999', type: 'series', videos: [{ id: 'kitsu:999:1' }] },
};
const seasons = (lengths) => Object.entries(lengths).flatMap(([s, n]) => Array.from({ length: n }, (_, i) => ({ season: Number(s), episode: i + 1 })));
const CINEMETA = {
  tt2560140: { name: 'Attack on Titan', genres: ['Animation'], videos: seasons({ 1: 25, 2: 12 }) },
  tt2098220: { name: 'Hunter x Hunter', genres: ['Animation', 'Action'], videos: seasons({ 1: 58, 2: 78, 3: 12 }) },
};

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  const q = url.searchParams;
  calls.push(`${url.hostname}${decodeURIComponent(url.pathname)}?${q}`.replace(/api_key=[^&]*/, 'api_key=…'));
  switch (url.hostname) {
    case 'api.opensubtitles.com': {
      if (url.pathname !== '/api/v1/subtitles') throw new Error('hak harcayan/giriş isteği yapılmamalı: ' + url.pathname);
      const key = q.get('parent_imdb_id') ? `${q.get('parent_imdb_id')}:${q.get('season_number')}:${q.get('episode_number')}` : `film:${q.get('imdb_id')}`;
      return json({ total_pages: 1, data: OS[key] || [] });
    }
    case 'opensubtitles-v3.strem.io':
      return json({ subtitles: [] });
    case 'v3-cinemeta.strem.io': {
      const meta = CINEMETA[url.pathname.match(/(tt\d+)\.json$/)?.[1]];
      return meta ? json({ meta }) : json({ err: 'yok' }, 500);
    }
    case 'anime-kitsu.strem.fun': {
      const key = decodeURIComponent(url.pathname).match(/^\/meta\/series\/([a-z]+:\d+)\.json$/)?.[1];
      return ANIME[key] ? json({ meta: ANIME[key] }) : json({ err: 'yok' }, 500);
    }
    case 'api.subdl.com':
      return json({ status: true, subtitles: [] });
    case 'api.subsource.net':
      return json({ success: true, data: [] });
  }
  throw new Error('beklenmeyen dış istek: ' + url.hostname);
};

const start = async () => {
  const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '' })).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, get: (path) => realFetch(base + path).then((res) => res.json()) };
};
const sealer = createSealer(process.env.CONFIG_SECRET);
const authOs = sealer.seal({ u: 'sahte-kullanici', p: 'sahte-sifre' });
const authAll = sealer.seal({ u: 'sahte-kullanici', p: 'sahte-sifre', sd: 'sahte-subdl-1234', ss: 'sahte-subsource-1234' });
const seg = (auth) => `languages=tr&ui=tr${auth ? '&auth=' + auth : ''}`;
const subs = (id, type = 'anime', auth = authOs) => `/${seg(auth)}/subtitles/${type}/${encodeURIComponent(id)}.json`;
const osCalls = () => calls.filter((c) => c.includes('api.opensubtitles.com')).map((c) => (c.includes('parent_imdb_id') ? `S${c.match(/season_number=(\d+)/)?.[1]}E${c.match(/episode_number=(\d+)/)?.[1]}` : `film${c.match(/imdb_id=(\d+)/)?.[1]}`)).sort().join(' ');
const kitsuCalls = () => calls.filter((c) => c.includes('anime-kitsu')).map((c) => c.match(/series\/(.+)\.json/)?.[1]).join(' ');
const urls = (res) => res.subtitles.map((s) => decodeURIComponent(s.url).replace(/^https?:\/\/[^/]+\/[^/]+/, '')).join(' ');
const labels = (res) => res.subtitles.map((s) => s.label).join(' / ');

// ---------- Tanınan siteler ----------
check('tanınan siteler: kitsu, mal, anilist, anidb', JSON.stringify(ANIME_SITES) === '["kitsu","mal","anilist","anidb"]', JSON.stringify(ANIME_SITES));
let a = await start();
const health = await a.get('/api/health');
check('sürüm 3.13.0', health.version === VERSION, health.version);
const manifest = await a.get(`/${seg(authOs)}/manifest.json`);
check('manifest: numara önekleri tt, kitsu, mal, anilist, anidb', manifest.version === VERSION && JSON.stringify(manifest.idPrefixes) === '["tt","kitsu","mal","anilist","anidb"]', JSON.stringify(manifest.idPrefixes));
check('manifest: türler aynı', JSON.stringify(manifest.types) === '["movie","series","anime"]' && JSON.stringify(manifest.resources) === '["subtitles"]');
check('ayarsız manifest de aynı önekleri taşır', JSON.stringify((await a.get('/manifest.json')).idPrefixes) === JSON.stringify(manifest.idPrefixes));

// ---------- Dizi: üç sitenin numarası da aynı bölüme çevrilir ----------
const lists = {};
for (const id of ['mal:16498:3', 'anilist:16498:3', 'anidb:9541:3', 'kitsu:7442:3']) {
  a.server.close();
  a = await start();
  calls.length = 0;
  const res = await a.get(subs(id));
  const site = id.split(':').slice(0, 2).join(':');
  lists[id] = urls(res);
  check(`${id}: servise kendi numarasıyla, bir kez sorulur`, kitsuCalls() === site, kitsuCalls());
  check(`${id}: IMDb + 1. sezon 3. bölüm ile aranır`, osCalls() === 'S1E3' && calls.some((c) => c.includes('parent_imdb_id=2560140')), `${osCalls()} | ${calls.filter((c) => c.includes('opensubtitles.com')).join(' ')}`);
  check(`${id}: resmi eklentiye dizi olarak sorulur`, calls.some((c) => c.startsWith('opensubtitles-v3.strem.io/subtitles/series/tt2560140:1:3.json')), calls.filter((c) => c.includes('v3.strem')).join(' '));
  check(`${id}: indirme adresi IMDb numarasını taşır`, res.subtitles.length === 1 && lists[id].includes('/sub/tr/tt2560140:1:3/103.srt'), lists[id]);
  check(`${id}: 1. sezonda Cinemeta'ya ve Kitsu aramasına gidilmez`, !calls.some((c) => c.includes('cinemeta') || c.includes('search=')), calls.join(' '));
}
check('dört numara da aynı listeyi verir', new Set(Object.values(lists)).size === 1, JSON.stringify(lists));

// ---------- Önbellek ----------
calls.length = 0;
let res = await a.get(subs('kitsu:7442:1'));
check('aynı kaydın başka bölümü: çeviri önbellekten', kitsuCalls() === '' && osCalls() === 'S1E1' && res.subtitles.length === 1, `${kitsuCalls()} | ${osCalls()}`);
a.server.close();
a = await start();
calls.length = 0;
await a.get(subs('mal:16498:3'));
await a.get(subs('mal:16498:1'));
await a.get(subs('anilist:16498:1'));
check('çeviri her site ve numara için ayrı saklanır', kitsuCalls() === 'mal:16498 anilist:16498', kitsuCalls());
check('aynı bölüm ikinci siteden istenince altyazı sitelerine yeniden sorulmaz', osCalls() === 'S1E1 S1E3', osCalls());

// ---------- Tür: series ve anime ----------
calls.length = 0;
res = await a.get(subs('mal:16498:3', 'series'));
check('tür "series" olsa da çalışır', res.subtitles.length === 1 && urls(res).includes('/sub/tr/tt2560140:1:3/103.srt'), urls(res));

// ---------- Sonraki sezonun kaydı ----------
const second = {};
for (const id of ['mal:25777:5', 'anilist:20958:5', 'anidb:10944:5', 'kitsu:8671:5']) {
  a.server.close();
  a = await start();
  calls.length = 0;
  res = await a.get(subs(id));
  second[id] = urls(res);
  check(`${id}: 2. sezon 5. bölüm; baştan sayılan numarayla (30) da aranır`, osCalls() === 'S1E30 S2E30 S2E5', osCalls());
  check(`${id}: iki yazımla kayıtlı altyazılar listede, adres asıl bölümü taşır`, res.subtitles.length === 2 && second[id].includes('/sub/tr/tt2560140:2:5/205.srt') && second[id].includes('/sub/tr/tt2560140:2:5/130.srt'), second[id]);
}
check('2. sezonda dört numara da aynı listeyi verir', new Set(Object.values(second)).size === 1, JSON.stringify(second));

// ---------- Tek kayıtlı uzun anime ----------
a.server.close();
a = await start();
calls.length = 0;
res = await a.get(subs('mal:11061:75'));
check('mal uzun anime: S2E17 ve S1E75 aranır, S2E75 aranmaz', osCalls() === 'S1E75 S2E17', osCalls());
check('mal uzun anime: baştan sayılan numarayla kayıtlı altyazı listede', res.subtitles.length === 1 && labels(res).includes('Hunter X Hunter - 75') && !labels(res).includes('YANLIS') && urls(res).includes('/sub/tr/tt2098220:2:17/7501.srt'), `${labels(res)} | ${urls(res)}`);
calls.length = 0;
const viaKitsu = await a.get(subs('kitsu:6448:75'));
check('mal ve kitsu yolu aynı sonucu verir', urls(viaKitsu) === urls(res) && osCalls() === '', `${urls(viaKitsu)} | ${osCalls()}`);

// ---------- Film ----------
for (const id of ['mal:32281', 'anilist:21519', 'anidb:11829', 'kitsu:11614']) {
  a.server.close();
  a = await start();
  calls.length = 0;
  res = await a.get(subs(id, 'movie'));
  check(`${id} (film): IMDb ile film olarak aranır`, osCalls() === 'film5311514' && calls.some((c) => c.startsWith('opensubtitles-v3.strem.io/subtitles/movie/tt5311514.json')) && urls(res).includes('/sub/tr/tt5311514/500.srt'), `${osCalls()} | ${urls(res)}`);
}
calls.length = 0;
res = await a.get(subs('mal:32281:1', 'anime'));
check('film numarasına bölüm eklenmiş olsa da film bulunur', urls(res).includes('/sub/tr/tt5311514/500.srt'), urls(res));

// ---------- Diğer kaynaklar ----------
a.server.close();
a = await start();
calls.length = 0;
res = await a.get(subs('anidb:9541:3', 'anime', authAll));
check('SubDL ve SubSource da IMDb ile aranır', calls.some((c) => c.includes('api.subdl.com') && c.includes('imdb_id=tt2560140') && c.includes('season_number=1') && c.includes('episode_number=3')) && calls.some((c) => c.includes('api.subsource.net') && c.includes('tt2560140')), calls.filter((c) => c.includes('subdl') || c.includes('subsource')).join(' '));

// ---------- Karşılığı olmayan ve bozuk numaralar ----------
calls.length = 0;
res = await a.get(subs('mal:999:1'));
check('IMDb karşılığı yok → boş liste, altyazı sitelerine istek yok', res.subtitles.length === 0 && calls.length === 1 && kitsuCalls() === 'mal:999', calls.join(' '));
calls.length = 0;
res = await a.get(subs('mal:16498:99'));
check('olmayan bölüm → boş liste, altyazı sitelerine istek yok', res.subtitles.length === 0 && calls.every((c) => c.includes('anime-kitsu')), calls.join(' '));
for (const id of ['mal:5:1', 'anilist:5:1', 'anidb:5:1']) {
  calls.length = 0;
  res = await a.get(subs(id));
  check(`${id}: servis tanımıyorsa boş liste, 1 dakika saklanır`, res.subtitles.length === 0 && res.cacheMaxAge === 60 && calls.length === 1, JSON.stringify(res));
}
calls.length = 0;
await a.get(subs('mal:5:1'));
check('tanınmayan numara saklanmaz, sonraki istekte yeniden sorulur', kitsuCalls() === 'mal:5', kitsuCalls());
for (const id of ['mal:abc:1', 'mal::1', 'mal:', 'mal', 'anilist:12a:1', 'anidb:-5:1', 'mal:1.5:1', 'mal:16498/../x:1']) {
  calls.length = 0;
  res = await a.get(subs(id));
  check(`bozuk numara "${id}" → boş liste, dışarıya istek yok`, res.subtitles.length === 0 && calls.length === 0, calls.join(' '));
}
for (const id of ['tmdb:1429:1:3', 'tvdb:267440:1:3', 'malx:16498:3', 'MAL:16498:3', 'myanimelist:16498:3']) {
  calls.length = 0;
  res = await a.get(subs(id));
  check(`tanınmayan önek "${id}" → boş liste, dışarıya istek yok`, res.subtitles.length === 0 && calls.length === 0, calls.join(' '));
}

// ---------- Kaynak bağlı değilken ----------
calls.length = 0;
res = await a.get(subs('mal:16498:3', 'anime', ''));
check('kaynak bağlı değilken: yalnızca kurulum uyarısı, dışarıya istek yok', res.subtitles.length === 1 && res.subtitles[0].id === 'subpool-setup-required' && calls.length === 0, JSON.stringify(res).slice(0, 200));

// ---------- IMDb numaraları eskisi gibi ----------
calls.length = 0;
res = await a.get(subs('tt1000001', 'movie'));
check('IMDb numaralı film eskisi gibi: anime servisine sorulmaz', osCalls() === 'film1000001' && kitsuCalls() === '' && urls(res).includes('/sub/tr/tt1000001/900.srt'), `${osCalls()} | ${urls(res)}`);
calls.length = 0;
res = await a.get(subs('tt2560140:1:3', 'series'));
check('IMDb numaralı dizi bölümü eskisi gibi', urls(res).includes('/sub/tr/tt2560140:1:3/103.srt') && kitsuCalls() === '', `${urls(res)} | ${kitsuCalls()}`);
a.server.close();

// ---------- kitsuMap doğrudan ----------
calls.length = 0;
const map = await kitsuMap('anidb', '9541');
check('kitsuMap: adres site:numara biçiminde', calls[0] === 'anime-kitsu.strem.fun/meta/series/anidb:9541.json?', calls[0]);
check('kitsuMap: bölüm anahtarı kayıttaki bölüm numarası', JSON.stringify(map) === '{"movie":false,"imdb":"tt2560140","episodes":{"1":["tt2560140",1,1],"3":["tt2560140",1,3],"25":["tt2560140",1,25]}}', JSON.stringify(map));
check('hak harcayan ya da giriş yapan istek olmadı', !calls.some((c) => c.includes('/download') || c.includes('/login')));

console.log(fails ? `${fails} HATA` : 'Hepsi geçti');
