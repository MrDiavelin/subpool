// v3.7.0: animelerde baştan sayılan bölüm numarası ve anime dosya adları. Hiçbir gerçek siteye istek gitmez.
import { VERSION } from './setup.mjs';
import { createServer } from 'node:http';
import { crc32 } from 'node:zlib';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { episodeOf } = await import('../src/release.js');
const { episodeFiles, pickSubtitle } = await import('../src/archive.js');

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 500) : ''}`); };

// ---------- Dosya adından bölüm numarası ----------
for (const [name, s, e] of [
  ['[SubsPlease] One Piece - 1000 (1080p) [BC5B1138].srt', null, 1000],
  ['[HorribleSubs] Hunter X Hunter - 75 [720p].ass', null, 75],
  ['[Coalgirls]_Hunter_X_Hunter_148_(1280x720_Blu-ray_FLAC)_[7A0A16FD].ass', null, 148],
  ['Hunter 75.srt', null, 75],
  ['Jujutsu Kaisen - S02E01 - Hidden Inventory.srt', 2, 1],
  ['Jujutsu Kaisen S2 - 05 [1080p].srt', 2, 5],
  ['[Erai-raws] Jujutsu Kaisen 2nd Season - 05 [1080p][Multiple Subtitle].ass', 2, 5],
  ['Mob Psycho 100 - 05v2 [720p].srt', null, 5],
  ['Mob.Psycho.100.05.1080p.x264.srt', null, 5],
  ['86 - Eighty Six - 07 [1080p].srt', null, 7],
  ['Naruto Shippuuden 251 [720p] [H.264] [AAC 2.0].srt', null, 251],
  ['[Grup][Spy x Family][07][1080p].srt', null, 7],
  ['Show.S01E02.720p.srt', 1, 2],
  ['Show 1x02.srt', 1, 2],
  ['Dizi Bölüm 3.srt', null, 3],
  ['Show.Name.2019.1080p.BluRay.DDP5.1.x264.srt', null, null],
  ['Hunter x Hunter (2011) 1-148 Complete', null, null],
  ['[Grup] Ad - 01-12 [BD]', null, null],
  ['Jujutsu.Kaisen.S02.1080p.WEB.H264', 2, null],
]) {
  const r = episodeOf(name);
  check(`ad: ${name}`, r.season === s && r.episode === e, JSON.stringify(r));
}

// ---------- Paketten bölüm seçimi ----------
const names = (list) => list.map((n) => ({ name: n }));
const picked = (list, where) => episodeFiles(names(list), where).map((f) => f.name).join(' | ');
const range = (from, to, make) => Array.from({ length: to - from + 1 }, (_, i) => make(String(from + i).padStart(2, '0')));
check('paket: S01E02 yazımı eskisi gibi', picked(['Show.S01E01.srt', 'Show.S01E02.srt', 'Show.S02E02.srt'], { season: 1, episode: 2 }) === 'Show.S01E02.srt');
check('paket: başka sezonun dosyası seçilmez', picked(['Show.S02E02.srt'], { season: 1, episode: 2 }) === '');
check('paket: "Ad - 05" yazımı tanınır', picked(range(1, 12, (n) => `[Grup] Ad - ${n} [1080p].srt`), { season: 1, episode: 5 }) === '[Grup] Ad - 05 [1080p].srt');
const absPack = range(1, 47, (n) => `[Grup] JJK - ${n}.srt`);
check('paket baştan sayıyor (1-47): 2. sezon 1. bölüm → 25', picked(absPack, { season: 2, episode: 1, absolute: 25, seasonLength: 23 }) === '[Grup] JJK - 25.srt');
const seasonPack = range(1, 23, (n) => `[Grup] JJK S2 - ${n}.srt`);
check('paket sezon içinden sayıyor ve adında S2 var: 1. bölüm', picked(seasonPack, { season: 2, episode: 1, absolute: 25, seasonLength: 23 }) === '[Grup] JJK S2 - 01.srt');
const plainSeason = range(1, 23, (n) => `JJK - ${n}.srt`);
check('paket sezon içinden sayıyor (1-23): 1. bölüm', picked(plainSeason, { season: 2, episode: 1, absolute: 25, seasonLength: 23 }) === 'JJK - 01.srt');
const hxhSeason = range(1, 78, (n) => `HxH - ${n}.srt`);
check('HxH 2. sezon paketi (1-78): 17. bölüm, 75 değil', picked(hxhSeason, { season: 2, episode: 17, absolute: 75, seasonLength: 78 }) === 'HxH - 17.srt');
const hxhAll = range(1, 148, (n) => `HxH - ${n}.srt`);
check('HxH tüm dizi paketi (1-148): 75. dosya, 17 değil', picked(hxhAll, { season: 2, episode: 17, absolute: 75, seasonLength: 78 }) === 'HxH - 75.srt');
check('paket: "S01E75" yazımı baştan sayılan numara olarak kabul edilir', picked(['HxH.S01E74.srt', 'HxH.S01E75.srt', 'HxH.S02E75.srt'], { season: 2, episode: 17, absolute: 75, seasonLength: 78 }) === 'HxH.S01E75.srt');
check('paket: "S02E25" yalnızca sezonda 25. bölüm yoksa kabul edilir', picked(['JJK.S02E25.srt'], { season: 2, episode: 1, absolute: 25, seasonLength: 23 }) === 'JJK.S02E25.srt' && picked(['HxH.S02E75.srt'], { season: 2, episode: 17, absolute: 75, seasonLength: 78 }) === '');
check('paket: sezon uzunluğu bilinmiyorsa önce sezon içi numara', picked(hxhAll, { season: 2, episode: 17, absolute: 75 }) === 'HxH - 17.srt' && picked(range(59, 136, (n) => `HxH - ${n}.srt`), { season: 2, episode: 3, absolute: 61 }) === 'HxH - 61.srt');
check('paket: bölüm yoksa boş', picked(plainSeason, { season: 2, episode: 40, absolute: 64, seasonLength: 23 }) === '');

// ---------- Sahte ZIP ----------
function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const n = Buffer.from(name, 'utf8');
    const d = Buffer.from(text, 'utf8');
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x800, 6);
    head.writeUInt32LE(crc32(d), 14); head.writeUInt32LE(d.length, 18); head.writeUInt32LE(d.length, 22); head.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x800, 8);
    cen.writeUInt32LE(crc32(d), 16); cen.writeUInt32LE(d.length, 20); cen.writeUInt32LE(d.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(offset, 42);
    parts.push(head, n, d);
    central.push(cen, n);
    offset += 30 + n.length + d.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}
const srt = (text) => `1\n00:00:01,000 --> 00:00:02,000\n${text}\n`;
const absZip = zip(range(1, 47, (n) => [`[Grup] Jujutsu Kaisen - ${n} [1080p].srt`, srt(`mutlak ${n}`)]));
const seasonZip = zip(range(1, 23, (n) => [`Jujutsu.Kaisen.S02E${n}.srt`, srt(`sezon ${n}`)]));
let out = new TextDecoder().decode(await pickSubtitle(absZip, { season: 2, episode: 1, absolute: 25, seasonLength: 23 }));
check('ZIP (baştan sayan): 25. dosya açılır', out.includes('mutlak 25'), out);

// ---------- Sahte siteler ----------
const realFetch = globalThis.fetch;
const calls = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const os = (file, release) => ({ attributes: { language: 'tr', legacy_subtitle_id: null, release, moviehash_match: false, from_trusted: false, ai_translated: false, machine_translated: false, download_count: 10, hearing_impaired: false, files: [{ file_id: file, file_name: 'x.srt' }] } });
const OS = {
  '2098220:1:75': [os(7501, '[HorribleSubs] Hunter X Hunter - 75 [720p]')],
  '2098220:2:75': [os(9901, 'YANLIS BOLUM')],
  '2098220:1:5': [os(105, 'Hunter x Hunter - 05')],
  '12343534:2:1': [os(2101, 'Jujutsu.Kaisen.S02E01.1080p.WEB')],
  '12343534:2:25': [os(2125, 'Saklı Envanter'), os(2101, 'Jujutsu.Kaisen.S02E01.1080p.WEB')],
  '388629:1:706': [os(706, '[SubsPlease] One Piece - 706 (1080p)')],
  '388629:1:705': [os(9902, 'YANLIS BOLUM')],
  '903747:2:1': [os(1, 'Breaking.Bad.S02E01.720p.BluRay')],
  '7777777:1:30': [os(3030, 'Cinemeta kapalıyken - 30')],
  '8888888:2:3': [os(803, 'Yavas.S02E03')],
};
const video = (id, s, e, imdb) => ({ id, imdb_id: imdb, imdbSeason: s, imdbEpisode: e });
const KITSU = {
  6448: { type: 'series', imdb_id: 'tt2098220', videos: [video('kitsu:6448:1', 1, 1), video('kitsu:6448:5', 1, 5), video('kitsu:6448:75', 2, 17)] },
  42765: { type: 'series', imdb_id: 'tt12343534', videos: [video('kitsu:42765:1', 1, 1), video('kitsu:42765:24', 1, 24)] },
  45857: { type: 'series', imdb_id: 'tt12343534', videos: [video('kitsu:45857:1', 2, 1), video('kitsu:45857:23', 2, 23)] },
  12: { type: 'series', imdb_id: 'tt0388629', videos: [video('kitsu:12:1', 1, 1), { id: 'kitsu:12:590' }, video('kitsu:12:706', 17, 78)] },
  777: { type: 'series', imdb_id: 'tt7777777', videos: [video('kitsu:777:1', 1, 1), video('kitsu:777:30', 2, 5)] },
};
const SEARCH = {
  'Jujutsu Kaisen': [{ id: 'kitsu:42765', type: 'series', imdb_id: 'tt12343534' }, { id: 'kitsu:43748', type: 'series' }, { id: 'kitsu:45857', type: 'series', imdb_id: 'tt12343534' }, { id: 'kitsu:44212', type: 'movie', imdb_id: 'tt14331144' }, { id: 'kitsu:6448', type: 'series', imdb_id: 'tt2098220' }],
  'One Piece': [{ id: 'kitsu:12', type: 'series', imdb_id: 'tt0388629' }],
  'Kitsu\'da Olmayan Çizgi Dizi': [],
};
const seasons = (lengths) => Object.entries(lengths).flatMap(([s, n]) => Array.from({ length: n }, (_, i) => ({ season: Number(s), episode: i + 1 })));
const onePiece = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 1, i < 15 ? 40 : i === 15 ? 27 : 118]));
const CINEMETA = {
  tt2098220: { name: 'Hunter x Hunter', genres: ['Animation', 'Action'], videos: seasons({ 1: 58, 2: 78, 3: 12 }) },
  tt12343534: { name: 'Jujutsu Kaisen', genres: ['Animation'], videos: [{ season: 0, episode: 1 }, ...seasons({ 1: 24, 2: 23 })] },
  tt0388629: { name: 'One Piece', genres: ['Animation'], videos: seasons(onePiece) },
  tt0903747: { name: 'Breaking Bad', genres: ['Crime', 'Drama'], videos: seasons({ 1: 7, 2: 13 }) },
  tt8888888: { name: 'Yavaş Anime', genres: ['Animation'], videos: seasons({ 1: 12, 2: 12 }) },
  tt6666666: { name: 'Kitsu\'da Olmayan Çizgi Dizi', genres: ['Animation'], videos: seasons({ 1: 10, 2: 10 }) },
};

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  // 3.10.1'dan beri AniSub varsayılan olarak açık; bu testlerde hiç altyazı vermez ve çağrı listesine yazılmaz.
  if (url.hostname === 'anisub.co') return new Response(JSON.stringify({ subtitles: [] }), { headers: { 'content-type': 'application/json' } });
  const q = url.searchParams;
  calls.push(`${url.hostname}${decodeURIComponent(url.pathname)}?${q}`.replace(/api_key=[^&]*/, 'api_key=…'));
  switch (url.hostname) {
    case 'api.opensubtitles.com':
      if (url.pathname !== '/api/v1/subtitles') throw new Error('hak harcayan/giriş isteği yapılmamalı: ' + url.pathname);
      return json({ total_pages: 1, data: OS[`${q.get('parent_imdb_id')}:${q.get('season_number')}:${q.get('episode_number')}`] || [] });
    case 'opensubtitles-v3.strem.io':
      return json({ subtitles: [] });
    case 'v3-cinemeta.strem.io': {
      const meta = CINEMETA[url.pathname.match(/(tt\d+)\.json$/)?.[1]];
      return meta ? json({ meta }) : json({ err: 'kapalı' }, 500);
    }
    case 'anime-kitsu.strem.fun': {
      const search = decodeURIComponent(url.pathname).match(/search=(.+)\.json$/)?.[1];
      if (search) {
        if (search === 'Yavaş Anime') await sleep(5500);
        return json({ metas: SEARCH[search] || [] });
      }
      const meta = KITSU[url.pathname.match(/kitsu(?::|%3A)(\d+)\.json$/)?.[1]];
      return meta ? json({ meta }) : json({ err: 'yok' }, 500);
    }
    case 'api.subdl.com': {
      if (q.get('imdb_id') !== 'tt12343534') return json({ status: true, subtitles: [] });
      const key = `${q.get('season_number')}:${q.get('episode_number')}`;
      if (key === '2:1') return json({ status: true, subtitles: [
        { url: '/subtitle/jjk-abs.zip', language: 'TR', release_name: 'Jujutsu Kaisen 01-47 [Grup]', season: 2, full_season: true },
        { url: '/subtitle/jjk-s2.zip', language: 'TR', release_name: 'Jujutsu.Kaisen.S02.1080p.WEB', season: 2, full_season: true },
      ] });
      if (key === '2:25') return json({ status: true, subtitles: [
        { url: '/subtitle/jjk-25.srt', language: 'TR', release_name: '[Grup] Jujutsu Kaisen - 25', season: 2, episode: 25 },
        { url: '/subtitle/jjk-s2.zip', language: 'TR', release_name: 'Jujutsu.Kaisen.S02.1080p.WEB', season: 2, full_season: true },
      ] });
      if (key === '1:25') return json({ status: true, subtitles: [
        { url: '/subtitle/jjk-s1.zip', language: 'TR', release_name: 'Jujutsu.Kaisen.S01.1080p.BluRay', season: 1, full_season: true },
      ] });
      return json({ status: true, subtitles: [] });
    }
    case 'dl.subdl.com':
      if (url.pathname === '/subtitle/jjk-abs.zip') return new Response(absZip);
      if (url.pathname === '/subtitle/jjk-s2.zip') return new Response(seasonZip);
      if (url.pathname === '/subtitle/jjk-25.srt') return new Response(srt('tek dosya 25'));
      return new Response('yok', { status: 404 });
    case 'api.subsource.net': {
      if (url.pathname.endsWith('/movies/search')) return json({ success: true, data: q.get('imdb') === 'tt12343534' ? [{ movieId: 80 + Number(q.get('season')), type: 'tvseries', season: Number(q.get('season')) }] : [] });
      if (url.pathname.endsWith('/602/download')) return new Response(absZip);
      if (url.pathname.endsWith('/download')) return new Response(srt('subsource tek dosya'));
      if (q.get('language') !== 'turkish' || q.get('movieId') !== '82') return json({ success: true, data: [] });
      return json({ success: true, data: [
        { subtitleId: 601, language: 'turkish', releaseInfo: ['[Grup] Jujutsu Kaisen - 25 [1080p]'] },
        { subtitleId: 602, language: 'turkish', releaseInfo: ['Jujutsu Kaisen 01-47 Complete'] },
        { subtitleId: 603, language: 'turkish', releaseInfo: ['Jujutsu.Kaisen.S02E01.1080p.WEB'] },
        { subtitleId: 604, language: 'turkish', releaseInfo: ['[Grup] Jujutsu Kaisen - 26 [1080p]'] },
      ] });
    }
  }
  throw new Error('beklenmeyen dış istek: ' + url.hostname);
};

const start = async () => {
  const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '' })).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base, get: (path) => realFetch(base + path).then((res) => res.json()), text: (url) => realFetch(url.replace(/^https?:\/\/[^/]+/, base)).then((res) => res.text()) };
};
const sealer = createSealer(process.env.CONFIG_SECRET);
const authOs = sealer.seal({ u: 'sahte-kullanici', p: 'sahte-sifre' });
const authAll = sealer.seal({ u: 'sahte-kullanici', p: 'sahte-sifre', sd: 'sahte-subdl-1234', ss: 'sahte-subsource-1234' });
const seg = (auth) => `languages=tr&ui=tr&auth=${auth}`;
const osCalls = () => calls.filter((c) => c.includes('api.opensubtitles.com')).map((c) => `S${c.match(/season_number=(\d+)/)?.[1]}E${c.match(/episode_number=(\d+)/)?.[1]}`).sort().join(' ');
const labels = (res) => res.subtitles.map((s) => s.label).join(' / ');
const show = (res) => console.log(res.subtitles.map((s) => `   ${s.label}`).join('\n'));
const subs = (id, auth = authOs, type = 'series') => `/${seg(auth)}/subtitles/${type}/${encodeURIComponent(id)}.json`;

let a = await start();
const health = await a.get('/api/health');
check('sürüm 3.7.1', health.version === VERSION, health.version);

// ---------- Kitsu: tek kayıtlı uzun anime (Hunter x Hunter) ----------
calls.length = 0;
let res = await a.get(subs('kitsu:6448:75', authOs, 'anime'));
show(res);
check('HxH kitsu 75: S2E17 ve S1E75 aranır, S2E75 aranmaz', osCalls() === 'S1E75 S2E17', osCalls());
check('HxH kitsu 75: baştan sayılan numarayla kayıtlı altyazı listede', res.subtitles.length === 1 && labels(res).includes('Hunter X Hunter - 75') && !labels(res).includes('YANLIS'), labels(res));
check('HxH: indirme adresi asıl bölümü (tt2098220:2:17) taşır', res.subtitles[0].url.includes(`/sub/tr/${encodeURIComponent('tt2098220:2:17')}/7501.srt`), res.subtitles[0].url);
check('HxH: tam liste 6 saat saklanır', res.cacheMaxAge === 21600, res.cacheMaxAge);
calls.length = 0;
res = await a.get(subs('kitsu:6448:5', authOs, 'anime'));
check('1. sezon bölümü: tek arama, Cinemeta\'ya sorulmaz', osCalls() === 'S1E5' && !calls.some((c) => c.includes('cinemeta')) && res.subtitles.length === 1, `${osCalls()} | ${calls.filter((c) => c.includes('cinemeta')).length}`);

// ---------- Kitsu: sezon sezon kayıtlı anime (Jujutsu Kaisen 2. sezon) ----------
calls.length = 0;
res = await a.get(subs('kitsu:45857:1', authOs, 'anime'));
show(res);
check('JJK S2E1 (kitsu): S2E1, S1E25 ve S2E25 aranır', osCalls() === 'S1E25 S2E1 S2E25', osCalls());
check('JJK S2E1: iki kayıt da listede, aynı dosya bir kez', res.subtitles.length === 2 && labels(res).includes('Saklı Envanter') && labels(res).includes('S02E01'), labels(res));
check('JJK kitsu yolu: Kitsu araması yapılmaz', !calls.some((c) => c.includes('search=')));

// ---------- IMDb numarasıyla gelen anime (Cinemeta kataloğu) ----------
a.server.close();
a = await start();
calls.length = 0;
res = await a.get(subs('tt12343534:2:1'));
check('JJK tt yolu: Cinemeta + Kitsu araması ile aynı sonuç', osCalls() === 'S1E25 S2E1 S2E25' && res.subtitles.length === 2, `${osCalls()} | ${labels(res)}`);
check('JJK tt yolu: yalnızca aynı IMDb numaralı Kitsu kayıtlarına bakılır', calls.filter((c) => c.includes('/meta/series/kitsu:')).map((c) => c.match(/kitsu:(\d+)/)[1]).sort().join(',') === '42765,45857', calls.filter((c) => c.includes('kitsu')).join(' '));
calls.length = 0;
res = await a.get(subs('tt12343534:2:1'));
check('ikinci açılışta her şey önbellekten', calls.length === 0, calls.join(' '));

calls.length = 0;
res = await a.get(subs('tt0388629:17:78'));
show(res);
check('One Piece tt yolu: Kitsu numarası (706) kullanılır, Cinemeta toplamı (705) değil', osCalls() === 'S17E706 S17E78 S1E706' && labels(res).includes('One Piece - 706') && !labels(res).includes('YANLIS'), `${osCalls()} | ${labels(res)}`);
calls.length = 0;
res = await a.get(subs('kitsu:12:706', authOs, 'anime'));
check('One Piece kitsu yolu: aynı sonuç', labels(res).includes('One Piece - 706') && res.subtitles.length === 1 && !calls.some((c) => c.includes('opensubtitles.com')), labels(res));

calls.length = 0;
res = await a.get(subs('tt0903747:2:1'));
check('anime olmayan dizi: tek arama, Kitsu\'ya sorulmaz', osCalls() === 'S2E1' && !calls.some((c) => c.includes('kitsu')) && res.subtitles.length === 1 && res.cacheMaxAge === 21600, `${osCalls()} | ${calls.join(' ')}`);
calls.length = 0;
res = await a.get(subs('tt6666666:2:3'));
check('Kitsu\'da kaydı olmayan çizgi dizi: ek arama yok', osCalls() === 'S2E3' && res.cacheMaxAge === 21600, osCalls());
calls.length = 0;
res = await a.get(`/${seg(authOs)}/subtitles/movie/tt1234567.json`);
check('film: Cinemeta/Kitsu\'ya sorulmaz', !calls.some((c) => c.includes('cinemeta') || c.includes('kitsu')), calls.join(' '));

// ---------- Yardımcı servisler çalışmazsa ----------
calls.length = 0;
res = await a.get(subs('kitsu:777:30', authOs, 'anime'));
check('Cinemeta kapalı + tek kayıtlı anime: Kitsu numarasıyla yine aranır', osCalls() === 'S1E30 S2E5' && labels(res).includes('- 30') && res.cacheMaxAge === 21600, `${osCalls()} | ${labels(res)} | ${res.cacheMaxAge}`);
calls.length = 0;
let t0 = Date.now();
res = await a.get(subs('tt8888888:2:3'));
let took = Date.now() - t0;
check('Kitsu araması çok yavaş: 4 sn sonra beklenmez, asıl sonuç gösterilir, liste 1 dakika saklanır', took < 5200 && res.subtitles.length === 1 && res.cacheMaxAge === 60, `${took} ms, ${labels(res)}, ${res.cacheMaxAge}`);

// ---------- SubDL ve SubSource ----------
a.server.close();
a = await start();
calls.length = 0;
res = await a.get(subs('kitsu:45857:1', authAll, 'anime'));
show(res);
const sd = res.subtitles.filter((s) => s.label.startsWith('[SubDL]'));
const ss = res.subtitles.filter((s) => s.label.startsWith('[SubSource]'));
const sdCalls = calls.filter((c) => c.includes('api.subdl.com')).map((c) => `S${c.match(/season_number=(\d+)/)[1]}E${c.match(/episode_number=(\d+)/)[1]}`).sort().join(' ');
check('SubDL: üç numarayla da aranır', sdCalls === 'S1E25 S2E1 S2E25', sdCalls);
check('SubDL: iki sezon paketi + 25. bölüm dosyası; 1. sezon paketi alınmaz, aynı paket bir kez', sd.length === 3 && !labels(res).includes('S01.1080p'), sd.map((s) => s.label).join(' / '));
const sdText = async (part) => a.text(sd.find((s) => s.label.includes(part)).url);
out = await sdText('01-47');
check('SubDL baştan sayan paket: 25. dosya gelir', out.includes('mutlak 25'), out);
out = await sdText('S02.1080p');
check('SubDL sezon paketi (S02E01…): 1. bölüm gelir', out.includes('sezon 01'), out);
out = await sdText('Jujutsu Kaisen - 25');
check('SubDL tek dosya (25. bölüm) olduğu gibi gelir', out.includes('tek dosya 25'), out);
check('SubSource: 25 (ek aramadan), paket ve S02E01 gelir; 26 gelmez', ss.length === 3 && ['- 25', '01-47', 'S02E01'].every((part) => ss.some((s) => s.label.includes(part))) && !ss.some((s) => s.label.includes('- 26')), ss.map((s) => s.label).join(' / '));
const ssPack = ss.find((s) => s.label.includes('01-47'));
check('SubSource adresi baştan sayılan numarayı taşır', /\/ss\/tr\/602-2-1-25-23\.srt$/.test(ssPack.url), ssPack.url);
out = await a.text(ssPack.url);
check('SubSource baştan sayan paket: 25. dosya gelir', out.includes('mutlak 25'), out);
out = await a.text(ss.find((s) => s.label.includes('- 25')).url);
check('SubSource tek dosya gelir', out.includes('subsource tek dosya'), out);
res = await a.get(subs('tt0903747:2:1', authAll));
check('anime olmayan dizide SubDL/SubSource adresleri eski biçimde', res.subtitles.every((s) => !/\/ss\/tr\/\d+-\d+-\d+-/.test(s.url)));
a.server.close();

check('hiçbir testte giriş/indirme isteği yapılmadı', !calls.some((c) => c.includes('/login') || c.includes('opensubtitles.com/api/v1/download')));
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
