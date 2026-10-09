// 3.15.0: Subs.ro kaynağı ve "yabancı konuşma altyazıları (forced)" ayarı.
// Hiçbir gerçek siteye istek gitmez; bütün dış servisler sahtedir, hak harcanmaz.
import { VERSION } from './setup.mjs';
import { createServer } from 'node:http';
import { crc32 } from 'node:zlib';
import vm from 'node:vm';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { forcedRelease } = await import('../src/release.js');
const { seasonsOf, subsroPick, SubsroClient } = await import('../src/subsro.js');
const { subsroCode, stremioLang } = await import('../src/languages.js');
const { pickSubtitle } = await import('../src/archive.js');
const { STRINGS } = await import('../src/i18n.js');

const realFetch = globalThis.fetch;
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).replace(/\s*\n\s*/g, ' ⏎ ').slice(0, 900) : ''}`); };
const T = STRINGS.tr;

// ---------- Örnek dosyalar (hepsi burada üretilir) ----------
const srt = (line) => ['1', '00:00:05,000 --> 00:00:07,000', line, '', '2', '00:00:08,000 --> 00:00:10,000', 'İkinci satır.', ''].join('\n') + '\n';
/** Sıkıştırmasız ("stored") ZIP üretir: [[ad, metin], …] */
function zip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, body] of files) {
    const n = enc.encode(name);
    const d = enc.encode(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt32LE(crc32(d), 14); local.writeUInt32LE(d.length, 18); local.writeUInt32LE(d.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8);
    central.writeUInt32LE(crc32(d), 16); central.writeUInt32LE(d.length, 20); central.writeUInt32LE(d.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, n, d);
    centrals.push(central, n);
    offset += 30 + n.length + d.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, dir, end]));
}
const read = async (promise) => { const bytes = await promise; return bytes ? new TextDecoder().decode(bytes) : null; };
const ONE = zip([['Ornek.Film.2024.1080p.BluRay.srt', srt('Film altyazısı.')]]);
const PACK = zip([1, 2, 3].map((n) => [`Ornek.Dizi.S01E0${n}.1080p.WEB-DL.srt`, srt(`Birinci sezon ${n}. bölüm.`)]));
const FIFTH = zip([['Ornek.Dizi.S01E05.1080p.WEB-DL.srt', srt('Beşinci bölüm.')]]);
const UNNAMED = zip([['altyazi.srt', srt('Adında bölüm yazmayan dosya.')]]);
// Aynı altyazının birkaç sürümünü taşıyan arşiv (Subs.ro'da olağan); klasör adları da sürümü söyler.
const VARIANTS = zip([
  ['BluRay 2 variante/Ornek.Film.2024.1080p-720p.BluRay.x264-SPARKS.srt', srt('BluRay sürümü.')],
  ['WEB-DL 2 variante/Ornek.Film.2024.1080p.NF.WEB-DL.H264-FLUX.srt', srt('NF WEB-DL sürümü.')],
  ['WEB-DL 2 variante/Ornek.Film.2024.2160p.MA.WEB-DL.H265-HONE.srt', srt('MA WEB-DL sürümü, arşivin en büyük dosyası budur.')],
  ['DVD/Romanian.srt', srt('DVD sürümü.')],
]);
const DISCS = zip([
  ['Ornek.Film.2024.CD1.DVDRip.XviD-ABC.srt', srt('Birinci disk: filmin yalnızca ilk yarısı, ama arşivin en büyük dosyası budur.')],
  ['Ornek.Film.2024.CD2.DVDRip.XviD-ABC.srt', srt('İkinci disk.')],
  ['Ornek.Film.2024.DVDRip.XviD-XYZ.srt', srt('Bütün film.')],
]);
const BOTH = zip([1, 2].flatMap((n) => [
  [`Ornek.Dizi.S01E0${n}.720p.BluRay.x264-SPARKS.srt`, srt(`BluRay ${n}. bölüm.`)],
  [`Ornek.Dizi.S01E0${n}.2160p.NF.WEB-DL.HEVC-FLUX.srt`, srt(`WEB-DL ${n}. bölüm, daha büyük dosya.`)],
]));

// ---------- Kurallar (doğrudan) ----------
check('forced adı: başlıktan sonra geçen "forced" sayılır', forcedRelease('Ornek.Film.2024.1080p.BluRay.Forced.x264-SPARKS') && forcedRelease('Ornek Film (2024) FORCED 1080p') && forcedRelease('Ornek.Dizi.S01E02.Forced.WEB-DL.srt'));
check('forced adı: başlığın parçası olan "Forced" sayılmaz', !forcedRelease('Forced.Vengeance.1982.720p.BluRay') && !forcedRelease('Forced.Entry.S01E02.1080p.WEB-DL'));
check('forced adı: sözcük yoksa ya da başlığın bittiği yer anlaşılmıyorsa sayılmaz', !forcedRelease('Ornek.Film.2024.1080p.BluRay') && !forcedRelease('Ornek Film Forced') && !forcedRelease('Forced') && !forcedRelease('') && !forcedRelease('Ornek.Film.2024.Enforced.1080p'));

const seasons = (text) => JSON.stringify(seasonsOf(text));
check('sezon: tek sezon ("Sezonul 1", "Season 2", "S02", "S02E05")', seasons('Pluribus - Sezonul 1') === '[1,1]' && seasons('Season 2 complete') === '[2,2]' && seasons('Ornek Dizi S02 WEB-DL') === '[2,2]' && seasons('Ornek.Dizi.S02E05.1080p') === '[2,2]' && seasons('Sezonul 1 complet, 9 episoade, pentru WEB-DL.') === '[1,1]',
  ['Pluribus - Sezonul 1', 'Season 2 complete', 'Ornek Dizi S02 WEB-DL', 'Ornek.Dizi.S02E05.1080p', 'Sezonul 1 complet, 9 episoade, pentru WEB-DL.'].map(seasons).join(' '));
check('sezon: aralık ("Sezoanele 1-3", "Sezoanele 1, 2 și 3", "Sezonul 1-3", "S01-S03")', seasons('Ornek Dizi - Sezoanele 1-3') === '[1,3]' && seasons('Sezoanele 1, 2 și 3') === '[1,3]' && seasons('Sezoanele 2 si 4') === '[2,4]' && seasons('Sezonul 1-3') === '[1,3]' && seasons('Ornek.Dizi.S01-S03.BluRay') === '[1,3]',
  ['Ornek Dizi - Sezoanele 1-3', 'Sezoanele 1, 2 și 3', 'Sezoanele 2 si 4', 'Sezonul 1-3', 'Ornek.Dizi.S01-S03.BluRay'].map(seasons).join(' '));
check('sezon: çözünürlük sezon sanılmaz', seasons('Sezoanele 1-3 1080p BluRay') === '[1,3]' && seasons('Sezonul 2 - 1080p') === '[2,2]' && seasons('Sezonul 2-1080p') === '[2,2]',
  ['Sezoanele 1-3 1080p BluRay', 'Sezonul 2 - 1080p', 'Sezonul 2-1080p'].map(seasons).join(' '));
check('sezon: yazmıyorsa null', seasonsOf('Ornek Film 2024 BluRay') === null && seasonsOf('subs 1080p x264 DTS5') === null && seasonsOf('') === null && seasonsOf(null) === null);

const ITEMS = [
  { id: 1, lang: 'ro', title: 'Ornek Dizi - Sezonul 1', text: 'Sezonul 1 complet, 9 episoade, pentru WEB-DL. Enjoy!' },
  { id: 2, lang: 'ro', title: 'Ornek Dizi - Sezonul 2', text: '' },
  { id: 3, lang: 'en', title: 'Ornek Dizi', text: 'Season 1' },
  { id: 4, lang: 'ro', title: 'Ornek Dizi', text: 'Sezoanele 1-3' },
  { id: 5, lang: 'ro', title: 'Ornek Dizi', text: 'Pentru WEB-DL' },
  { id: 6, lang: 'ro', title: 'Ornek Dizi', text: `${'Foarte lung '.repeat(12)}sfarsit` },
];
const ids = (list) => list.map((r) => r.id).join();
check('seçim: dil süzülür', ids(subsroPick(ITEMS, { languages: ['en'] })) === '3' && ids(subsroPick(ITEMS, { languages: ['ro', 'en'] })) === '1,2,3,4,5,6' && ids(subsroPick(ITEMS)) === '1,2,3,4,5,6');
check('seçim: başka sezon yazanlar atlanır, sezon yazmayanlar kalır', ids(subsroPick(ITEMS, { season: 1 })) === '1,3,4,5,6' && ids(subsroPick(ITEMS, { season: 2 })) === '2,4,5,6' && ids(subsroPick(ITEMS, { season: 4 })) === '5,6', [1, 2, 4].map((s) => ids(subsroPick(ITEMS, { season: s }))).join(' / '));
check('seçim: filmde (sezon yok) hiçbiri atlanmaz', ids(subsroPick(ITEMS, { season: undefined })) === '1,2,3,4,5,6');
const EPISODES = [
  { id: 1, lang: 'en', title: 'Ornek Dizi', text: 'ornek.dizi.s01e06.720p.brrip.x264-grp' },
  { id: 2, lang: 'ro', title: 'Ornek Dizi - Sezonul 1', text: 'Sezonul 1 complet, pentru Ornek.Dizi.S01E01.WEB-DL' },
  { id: 3, lang: 'en', title: 'Ornek Dizi', text: 'BDRip DVDRip HDTV' },
  { id: 4, lang: 'en', title: 'Ornek Dizi', text: 'ornek.dizi.s01e02.hdtv ornek.dizi.s01e03.hdtv' },
];
check('seçim: yalnızca tek tek bölümlerin sürüm adını yazan altyazı başka bölümlerde atlanır; paketler kalır',
  ids(subsroPick(EPISODES, { season: 1, episode: 3 })) === '2,3,4' && ids(subsroPick(EPISODES, { season: 1, episode: 6 })) === '1,2,3' && ids(subsroPick(EPISODES, { season: 1 })) === '1,2,3,4' && ids(subsroPick(EPISODES, { season: 2, episode: 6 })) === '3',
  [[1, 3], [1, 6], [1], [2, 6]].map(([season, episode]) => ids(subsroPick(EPISODES, { season, episode }))).join(' / '));
const picked = subsroPick(ITEMS);
check('seçim: ad açıklamadan gelir, açıklama yoksa başlıktan', picked[0].release === 'Sezonul 1 complet, 9 episoade, pentru WEB-DL. Enjoy!' && picked[1].release === 'Ornek Dizi - Sezonul 2' && JSON.stringify(picked[1].releases) === '["Ornek Dizi - Sezonul 2"]');
check('seçim: uzun açıklama 80 karakterde, sözcük ortasından bölünmeden kısaltılır', picked[5].release.length <= 81 && picked[5].release.endsWith('…') && ITEMS[5].text.startsWith(picked[5].release.slice(0, -1) + ' '), picked[5].release);

check('dil kodu: Subs.ro\'nun ayırdığı diller', subsroCode('ro') === 'ro' && subsroCode('en') === 'en' && subsroCode('it') === 'ita' && subsroCode('fr') === 'fra' && subsroCode('de') === 'ger' && subsroCode('hu') === 'ung' && subsroCode('el') === 'gre' && subsroCode('pt-br') === 'por' && subsroCode('pt-pt') === 'por' && subsroCode('es') === 'spa');
check('dil kodu: ayırmadığı diller null', subsroCode('tr') === null && subsroCode('ja') === null && subsroCode('alt') === null && subsroCode('') === null);

const SE = { season: 1, episode: 2 };
check('arşiv: tek dosya, sıkı denetim yokken olduğu gibi verilir', (await read(pickSubtitle(FIFTH, SE)))?.includes('Beşinci bölüm'));
check('arşiv: sıkı denetimde tek dosyanın adı başka bölümü gösteriyorsa verilmez', (await pickSubtitle(FIFTH, { ...SE, strict: true })) === null);
check('arşiv: sıkı denetimde doğru bölüm verilir', (await read(pickSubtitle(FIFTH, { season: 1, episode: 5, strict: true })))?.includes('Beşinci bölüm'));
check('arşiv: sıkı denetimde adında bölüm yazmayan tek dosya verilir', (await read(pickSubtitle(UNNAMED, { ...SE, strict: true })))?.includes('Adında bölüm yazmayan'));
check('arşiv: sıkı denetimde sezon paketinden istenen bölüm seçilir, olmayan bölüm verilmez', (await read(pickSubtitle(PACK, { ...SE, strict: true })))?.includes('2. bölüm') && (await pickSubtitle(PACK, { season: 1, episode: 7, strict: true })) === null);
check('arşiv: filmde (bölüm yok) sıkı denetim bir şeyi değiştirmez', (await read(pickSubtitle(FIFTH, { strict: true })))?.includes('Beşinci bölüm'));

const variant = async (video, archive = VARIANTS, where = {}) => (await read(pickSubtitle(archive, { ...where, video })))?.split('\n')[2];
check('arşiv: videonun adı bilinmiyorsa eskisi gibi en büyük dosya verilir', (await variant('')) === 'MA WEB-DL sürümü, arşivin en büyük dosyası budur.', await variant(''));
const fits = [
  await variant('Ornek.Film.2024.1080p.BluRay.x264-SPARKS.mkv'),
  await variant('Ornek.Film.2024.1080p.NF.WEB-DL.H264-FLUX.mkv'),
  await variant('Ornek.Film.2024.2160p.MA.WEB-DL.H265-HONE.mkv'),
  await variant('Ornek.Film.2024.DVDRip.XviD-QQQ.avi'),
];
check('arşiv: birkaç sürüm varsa videonun sürümüne uyan dosya verilir (BluRay, WEB-DL, DVD)',
  fits.join(' | ') === 'BluRay sürümü. | NF WEB-DL sürümü. | MA WEB-DL sürümü, arşivin en büyük dosyası budur. | DVD sürümü.', fits.join(' | '));
check('arşiv: grup tutmasa da kaynağı tutan dosya verilir', (await variant('Ornek.Film.2024.REMASTERED.1080p.BluRay.x265-YTS.mp4')) === 'BluRay sürümü.', await variant('Ornek.Film.2024.REMASTERED.1080p.BluRay.x265-YTS.mp4'));
check('arşiv: disklere bölünmüş parça bütün filmin önüne geçmez (video o sürüm olsa da)',
  (await variant('', DISCS)) === 'Bütün film.' && (await variant('Ornek.Film.2024.CD1.DVDRip.XviD-ABC.avi', DISCS)) === 'Bütün film.', `${await variant('', DISCS)} | ${await variant('Ornek.Film.2024.CD1.DVDRip.XviD-ABC.avi', DISCS)}`);
const E2 = { season: 1, episode: 2, strict: true };
const episodes = [
  await variant('Ornek.Dizi.S01E02.1080p.BluRay.x264-GRP.mkv', BOTH, E2),
  await variant('Ornek.Dizi.S01E02.1080p.WEB-DL.x264-GRP.mkv', BOTH, E2),
  await variant('', BOTH, E2),
  // Videonun adı başka bölümü gösterse de istenen bölüm verilir.
  await variant('Ornek.Dizi.S01E01.1080p.BluRay.x264-GRP.mkv', BOTH, E2),
];
check('arşiv: sezon paketinde önce bölüm tutar, sürüm videoya göre seçilir',
  episodes.join(' | ') === 'BluRay 2. bölüm. | WEB-DL 2. bölüm, daha büyük dosya. | WEB-DL 2. bölüm, daha büyük dosya. | BluRay 2. bölüm.', episodes.join(' | '));
check('arşiv: sürüm seçimi pakette olmayan bölümü vermez', (await pickSubtitle(BOTH, { season: 1, episode: 7, strict: true, video: 'Ornek.Dizi.S01E07.1080p.BluRay.x264-GRP.mkv' })) === null);

let keyless = 0;
globalThis.fetch = async () => { keyless++; throw new Error('istek gönderildi'); };
const noKey = await new SubsroClient({ apiKey: '', userAgent: 'deneme' }).list('tt3100001').then(() => 'yanıt', (err) => err.status);
check('istemci: anahtar yoksa hiç istek gönderilmez', noKey === 401 && keyless === 0, `${noKey} / ${keyless}`);

// ---------- Sahte siteler ----------
const calls = [];
const sroCalls = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const KEY = 'sahte-subsro-1234';
const SPARKS = 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS';
const os = (o) => ({ attributes: { language: 'tr', legacy_subtitle_id: null, release: SPARKS, moviehash_match: false, from_trusted: false, ai_translated: false, machine_translated: false, download_count: 10, hearing_impaired: false, foreign_parts_only: false, ...o, files: [{ file_id: o.file, file_name: 'x.srt' }] } });
const official = (id, lang) => ({ id: String(id), url: `https://subs5.strem.io/${lang}/download/file/${id}`, lang });
const sro = (id, language, title, description = '') => ({ id, title, description, language, year: 2024, imdbid: 'tt3100001', type: 'movie', link: `https://subs.ro/subtitrare/${id}`, downloadLink: `https://api.subs.ro/v1.0/subtitle/${id}/download` });
const SRO_MOVIE = [
  sro(501, 'ro', 'Ornek Film', `⭐  Pentru   ${SPARKS} |  Enjoy!`),
  sro(502, 'en', 'Ornek Film'),
  sro(503, 'alt', 'Ornek Film', 'Altă limbă'),
  sro(504, 'ita', 'Ornek Film', 'Versione italiana'),
  sro('bozuk', 'ro', 'Ornek Film', 'kimliği sayı olmayan kayıt'),
];
const SRO_SERIES = [
  sro(601, 'ro', 'Ornek Dizi - Sezonul 1', '⭐  Sezonul 1 complet, 3 episoade,   pentru   WEB-DL.   Enjoy!'),
  sro(602, 'ro', 'Ornek Dizi - Sezonul 2', 'Sezonul 2 complet'),
  sro(603, 'ro', 'Ornek Dizi - Sezoanele 1-3', 'Toate sezoanele'),
  sro(604, 'ro', 'Ornek Dizi', 'Un singur episod, WEB-DL'),
  sro(605, 'ro', 'Ornek Dizi', ''),
];
// Gerçek sitede görülen biçimler: HTML kaçışlı açıklama, "Release(s):" etiketi, tek bölümlük yükleme, birkaç sürümlü arşiv.
const SRO_EXTRA = [
  sro(701, 'ro', 'Ornek Film 2', 'Release(s): Sue&#241;o &amp; Fuga,'),
  sro(702, 'ro', 'Ornek Film 2', 'pentru BluRay, WEB-DL & DVD'),
];
const SRO_EPISODES = [
  sro(801, 'en', 'Ornek Dizi 2', 'Release(s): ornek.dizi.s01e06.720p.brrip.x264-grp,'),
  sro(802, 'ro', 'Ornek Dizi 2 - Sezonul 1', 'Sezonul 1 complet, 2 episoade, pentru BluRay & WEB-DL.'),
];
const SRO_FILES = { 501: ONE, 502: zip([['Ornek.Film.2024.en.srt', srt('Movie subtitle.')]]), 601: PACK, 604: FIFTH, 605: UNNAMED, 702: VARIANTS, 802: BOTH };

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  const q = url.searchParams;
  calls.push(`${init?.method || 'GET'} ${url.hostname}${url.pathname}?${q}`.replace(/api_key=[^&]*/, 'api_key=…'));
  switch (url.hostname) {
    case 'api.subs.ro': {
      const key = new Headers(init?.headers).get('x-subs-api-key');
      sroCalls.push({ path: url.pathname, key, query: url.search });
      // Gerçek site tanımadığı anahtara 403 verir.
      if (key === 'sahte-red') return json({ message: 'Invalid API key', status: 403 }, 403);
      // Sitenin önündeki bir katman (ör. güvenlik duvarı) isteği API'ye ulaşmadan geri çevirirse gövde JSON olmaz.
      if (key === 'sahte-engel') return new Response('<html><body>Access denied</body></html>', { status: 403, headers: { 'content-type': 'text/html', server: 'sahte-duvar' } });
      if (url.pathname === '/v1.0/quota') {
        // Gerçek sitenin yanıtı: { remaining, total, type, used }. Belgesindeki alan adları başkadır; o da tanınır.
        if (key === 'sahte-belge') return json({ status: 200, meta: { requestId: 'sahte' }, quota: { total_quota: 100, used_quota: 1, remaining_quota: 99, quota_type: 'api_key', api_key: 'sahte…' } });
        return json({ status: 200, meta: { requestId: 'sahte' }, quota: { remaining: 299, total: 300, type: key === KEY ? 'api_key' : 'anonymous', used: 1 } });
      }
      if (url.pathname.startsWith('/v1.0/search/imdbid/')) {
        const id = url.pathname.split('/').pop();
        if (id === 'tt3100429') return json({ status: 429, message: 'Too Many Requests' }, 429);
        const items = id === 'tt3100002' ? SRO_SERIES : id === 'tt3100003' ? SRO_EXTRA : id === 'tt3100004' ? SRO_EPISODES : ['tt3100001', 'tt0111161'].includes(id) ? SRO_MOVIE : [];
        return json({ status: 200, meta: { requestId: 'sahte' }, count: items.length, items });
      }
      const m = url.pathname.match(/^\/v1\.0\/subtitle\/(\d+)\/download$/);
      if (m) {
        if (m[1] === '602') return json({ status: 429, message: 'Too Many Requests' }, 429);
        if (m[1] === '603') return json({ status: 401, message: 'Invalid API key' }, 401);
        if (SRO_FILES[m[1]]) return new Response(SRO_FILES[m[1]], { headers: { 'content-type': 'application/zip' } });
        return json({ status: 404, message: 'Not Found' }, 404);
      }
      break;
    }
    case 'api.opensubtitles.com': {
      if (url.pathname === '/api/v1/login') return json({ token: 'sahte-oturum', user: { allowed_downloads: 20 } });
      if (url.pathname === '/api/v1/infos/user') return json({ data: { allowed_downloads: 20, remaining_downloads: 17 } });
      if (url.pathname !== '/api/v1/subtitles') throw new Error('beklenmeyen istek: ' + url.pathname);
      return json({ total_pages: 1, data: [
        os({ file: 1, legacy_subtitle_id: 9001 }),
        os({ file: 3 }),
        os({ file: 4, foreign_parts_only: true, download_count: 90000 }),
        os({ file: 5, legacy_subtitle_id: 9005, foreign_parts_only: true }),
      ] });
    }
    case 'opensubtitles-v3.strem.io':
      return json({ subtitles: url.pathname.includes('tt3000001') ? [official(9001, 'tur'), official(9005, 'tur')] : [] });
    case 'api.subdl.com': {
      if (q.get('imdb_id') !== 'tt3000001') return json({ status: true, subtitles: [] });
      const sd = (n, release_name, releases = []) => ({ url: `/subtitle/1-${n}.zip`, language: 'TR', release_name, releases, hi: false });
      return json({ status: true, subtitles: [
        sd(1, SPARKS),
        sd(2, 'Ornek.Film.2024.1080p.BluRay.Forced.x264-SPARKS'),
        // Başlığında "Forced" geçen film: yalnızca yabancı konuşmalar sayılmaz.
        sd(3, 'Forced.Vengeance.1982.720p.BluRay.x264-GRP'),
        // Sürüm adlarından yalnızca biri "forced" diyor: sayılmaz.
        sd(4, 'Ornek.Film.2024.Forced.WEB-DL.x264-GRP', ['Ornek.Film.2024.WEB-DL.x264-GRP']),
      ] });
    }
    case 'altyazidb.com': {
      if (url.pathname.endsWith('/me')) return json({ success: true });
      if (url.pathname.endsWith('/search')) {
        const item = (id, forced) => ({ id, language: q.get('lang'), releases: ['Ornek.Film.2024.1080p.WEB-DL.H264-FLUX'], hearing_impaired: 0, ai_ceviri: 0, downloads: 5, forced });
        if (q.get('lang') === 'tr') return json({ data: [item(700, 1), item(701, 0)] });
        if (q.get('lang') === 'en') return json({ data: [item(800, 0)] });
        return json({ data: [] });
      }
      break;
    }
    case 'v3-cinemeta.strem.io':
      if (url.pathname.startsWith('/meta/movie/')) return json({ meta: { name: 'Ornek Film' } });
      return json({ meta: { id: 'tt3100002', name: 'Ornek Dizi', releaseInfo: '2020-', genres: ['Drama'], videos: [1, 2, 3, 4, 5].flatMap((e) => [{ season: 1, episode: e }, { season: 2, episode: e }]) } });
  }
  throw new Error('beklenmeyen dış istek: ' + url.hostname + url.pathname);
};

const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '' })).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;
const get = (path) => realFetch(BASE + path, { headers: { connection: 'close' } }).then((res) => res.json());
const text = (path) => realFetch(BASE + path, { headers: { connection: 'close' } }).then((res) => res.text());
let ip = 0;
const post = (path, body) => realFetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.15.0.${++ip}`, connection: 'close' }, body: JSON.stringify(body) })
  .then(async (res) => ({ status: res.status, data: await res.json() }));
const sealer = createSealer(process.env.CONFIG_SECRET);
const tag = (s) => s.label.split(' | ')[0];
const show = (list) => console.log(list.map((s) => `   ${s.lang} | ${s.label} | ${s.url.replace(/auth=[^/]+/, 'auth=…').replace(BASE, '')}`).join('\n'));

const health = await get('/api/health');
check(`sürüm ${VERSION}`, health.version === VERSION && (await get('/manifest.json')).version === VERSION, JSON.stringify(health));

// ================= Yabancı konuşma altyazıları (forced) =================
const full = sealer.seal({ u: 'sahte-kullanici', p: 'sahte-sifre', sd: 'sahte-subdl-1234', ad: 'sahte-altyazidb-1234' });
const movie = (options = '', languages = 'tr,en') => get(`/languages=${languages}&ui=tr${options}&auth=${full}/subtitles/movie/tt3000001.json`).then((res) => res.subtitles);
const isDual = (s) => s.url.includes('/dual/');
const isQuota = (s) => s.label.startsWith(T.tagQuota);
const isForced = (s) => tag(s).includes(T.forced);
// Türkçe grubun sırası: f = ücretsiz, F = ücretsiz + yabancı konuşmalar, q = hak harcayan, Q = hak harcayan + yabancı konuşmalar.
const shape = (list) => list.filter((s) => s.lang === 'tur' && !isDual(s)).map((s) => (isQuota(s) ? (isForced(s) ? 'Q' : 'q') : (isForced(s) ? 'F' : 'f'))).join('');
const sdPath = (s) => (s.url.includes('/sd/') ? JSON.parse(Buffer.from(s.url.match(/\/([\w-]+)\.srt$/)[1], 'base64url').toString()).p : null);
const sd = (list, n) => list.find((s) => sdPath(s) === `/subtitle/1-${n}.zip`);
const adb = (list, id) => list.find((s) => s.url.includes(`/adb/tr/${id}`) && !isDual(s));

let list = await movie();
show(list);
check('forced: SubDL\'de sürüm adı "forced" diyen altyazı işaretlenir', !!sd(list, 2) && tag(sd(list, 2)) === `${T.tagSubdl} · ${T.forced}` && tag(sd(list, 1)) === T.tagSubdl, [1, 2].map((n) => sd(list, n)?.label).join(' / '));
check('forced: başlığında "Forced" geçen ya da adlarının hepsi "forced" demeyen altyazı işaretlenmez', !!sd(list, 3) && !isForced(sd(list, 3)) && !!sd(list, 4) && !isForced(sd(list, 4)), [3, 4].map((n) => sd(list, n)?.label).join(' / '));
check('forced: AltyazıDB\'nin işaretlediği altyazı artık listelenir ve işaretlidir', !!adb(list, 700) && isForced(adb(list, 700)) && !!adb(list, 701) && !isForced(adb(list, 701)), [700, 701].map((id) => adb(list, id)?.label).join(' / '));
check('forced: varsayılan sıra — ücretsizler, ücretsiz yabancı konuşmalar, hak harcayanlar, hak harcayan yabancı konuşmalar', /^f+F{3}q+Q+$/.test(shape(list)), shape(list));
const base = shape(list);

list = await movie('&fo=first');
show(list);
check('forced öne al: her grupta yabancı konuşmalar üstte, ücretsizler yine hak harcayanların üstünde', /^F{3}f+Q+q+$/.test(shape(list)) && shape(list).length === base.length, shape(list));
check('forced öne al: etiketler aynı kalır', tag(sd(list, 2)) === `${T.tagSubdl} · ${T.forced}` && isForced(adb(list, 700)));
list = await movie('&fo=first&max=1');
check('forced öne al + dil başına 1: Türkçede kalan altyazı yabancı konuşmalar altyazısıdır', shape(list) === 'F', shape(list));
list = await movie('&max=1');
check('varsayılan + dil başına 1: kalan altyazı normal altyazıdır', shape(list) === 'f', shape(list));
list = await movie('&fo=first&pri=sd');
check('forced öne al + öne alınan kaynak: ilk sırada SubDL\'nin yabancı konuşmalar altyazısı', list.find((s) => s.lang === 'tur') === sd(list, 2) && /^F{3}f+Q+q+$/.test(shape(list)), shape(list));

list = await movie('&fo=hide');
check('forced gizle: hiçbir kaynaktan yabancı konuşmalar altyazısı gelmez', /^f+q+$/.test(shape(list)) && !sd(list, 2) && !adb(list, 700) && list.every((s) => !s.label.includes(T.forced)) && !!sd(list, 3) && !!sd(list, 4), shape(list));
list = await movie('&fo=bozuk');
check('forced: tanınmayan değer varsayılan gibi davranır', shape(list) === base, shape(list));

list = await movie('&fo=first&dual=1');
const duals = list.filter(isDual);
const refs = (s) => JSON.parse(Buffer.from(s.url.match(/\/dual\/([\w-]+)\.srt$/)[1], 'base64url').toString());
const forcedUrls = list.filter((s) => !isDual(s) && isForced(s)).map((s) => s.url);
check('forced öne al + çift dilli: yabancı konuşmalar altyazısı çift dilliye katılmaz', duals.length > 0 && forcedUrls.length === 4 && duals.every((s) => refs(s).every((ref) => !forcedUrls.some((u) => u.endsWith(ref)))), `${duals.length} çift dilli / ${duals.map((s) => refs(s).join(' + ')).join(' / ').slice(0, 300)}`);
check('forced: hiçbir denetimde indirme hakkı harcanmadı', !calls.some((c) => c.includes('/api/v1/download')));

// ================= Subs.ro =================
const count = (path) => sroCalls.filter((c) => c.path.includes(path)).length;

// ---------- Anahtarı bağlama ----------
let res = await post('/api/connect', { subsro: KEY });
const auth = res.data.auth;
check('bağlama: geçerli anahtar kabul edilir, anahtar yanıtta açık yazmaz', res.status === 200 && typeof auth === 'string' && !!res.data.sources.subsro && !JSON.stringify(res.data).includes(KEY), JSON.stringify(res.data.sources));
check('bağlama: anahtar yalnızca /quota ile doğrulanır', sroCalls.length === 1 && sroCalls[0].path === '/v1.0/quota' && sroCalls[0].key === KEY, JSON.stringify(sroCalls.map((c) => c.path)));
check('bağlama: adrese açık anahtar yazılmaz', !auth.includes(KEY) && !auth.includes(Buffer.from(KEY).toString('base64url')));
res = await post('/api/connect', { subsro: 'sahte-anonim' });
check('bağlama: sitenin "anonymous" kotasıyla yanıtladığı anahtar reddedilir', res.status === 401 && res.data.error === 'bad_key', JSON.stringify(res.data));
res = await post('/api/connect', { subsro: 'sahte-red' });
check('bağlama: sitenin 403 verdiği (tanımadığı) anahtar reddedilir', res.status === 401 && res.data.error === 'bad_key', JSON.stringify(res.data));
res = await post('/api/connect', { subsro: 'sahte-engel' });
check('bağlama: API\'den gelmeyen 403 (aradaki bir katman) "anahtar yanlış" sayılmaz', res.status === 502 && res.data.error === 'source_refused' && !res.data.auth, JSON.stringify(res.data));
res = await post('/api/connect', { subsro: 'sahte-belge' });
check('bağlama: kota yanıtı belgedeki alan adlarıyla gelse de anahtar tanınır', res.status === 200 && !!res.data.sources.subsro, JSON.stringify(res.data.sources));
res = await post('/api/connect', { subsro: '   ' });
check('bağlama: boş anahtar reddedilir, siteye sorulmaz', res.status === 401 && count('/quota') === 5, `${res.status} / ${count('/quota')}`);
res = await post('/api/connect', { auth, remove: 'subsro' });
check('bağlama: kaldırınca kaynak gider', res.status === 200 && res.data.sources.subsro === null && res.data.auth === null, JSON.stringify(res.data));
res = await post('/api/connect', { auth: sealer.seal({ sd: 'sahte-subdl-1234', sr: KEY }), remove: 'subsro' });
check('bağlama: kaldırınca diğer anahtarlar kalır', res.status === 200 && res.data.sources.subsro === null && !!res.data.sources.subdl, JSON.stringify(res.data.sources));

const manifest = await get(`/languages=ro,en&ui=tr&auth=${auth}/manifest.json`);
check('manifest: kaynaklarda Subs.ro yazar', manifest.description.includes('Subs.ro') && !JSON.stringify(manifest).includes(KEY), manifest.description);

// ---------- Film listesi ----------
const subs = (id, languages = 'ro,en,tr', options = '', type = 'movie') => get(`/languages=${languages}&ui=tr${options}&auth=${auth}/subtitles/${type}/${id}.json`).then((r) => r.subtitles);
const item = (l, id) => l.find((s) => new RegExp(`/sro/[\\w-]+/(?:[\\w.-]+/)?${id}-`).test(s.url));
sroCalls.length = 0;
list = await subs('tt3100001');
show(list);
check('film: seçili dillerdeki altyazılar gelir; "alt", seçilmemiş dil ve bozuk kayıt gelmez', list.length === 2 && !!item(list, 501) && !!item(list, 502) && !item(list, 503) && !item(list, 504), list.map((s) => s.label).join(' / '));
check('film: dil Stremio koduyla, adres /sro/<dil>/<id>-0-0.srt', item(list, 501).lang === stremioLang('ro') && item(list, 501).url.endsWith('/sro/ro/501-0-0.srt') && item(list, 502).lang === stremioLang('en') && item(list, 502).url.endsWith('/sro/en/502-0-0.srt'));
check('film: etiket Subs.ro, ad temizlenmiş açıklama (emoji ve ayraç yok)', item(list, 501).label === `${T.tagSubsro} | Pentru ${SPARKS} Enjoy!`, item(list, 501).label);
check('film: açıklama yoksa ad başlıktan gelir', item(list, 502).label === `${T.tagSubsro} | Ornek Film`, item(list, 502).label);
check('film: tek arama, dil süzgeci gönderilmez, anahtar başlıkta', sroCalls.length === 1 && sroCalls[0].path === '/v1.0/search/imdbid/tt3100001' && sroCalls[0].query === '' && sroCalls[0].key === KEY, JSON.stringify(sroCalls));
list = await subs('tt3100001', 'it,ro');
check('film: başka dil seçilince yeni arama yapılmaz (aynı yapım)', sroCalls.length === 1 && list.length === 2 && item(list, 504)?.url.endsWith('/sro/it/504-0-0.srt') && list[0] === item(list, 504), `${sroCalls.length} arama / ${list.map((s) => s.label).join(' / ')}`);
list = await subs('tt3100001', 'tr,ja');
check('film: Subs.ro\'nun ayırmadığı dillerde hiç istek gitmez', list.length === 0 && sroCalls.length === 1, `${list.length} / ${sroCalls.length}`);
list = await subs('tt3100001', 'ro,en', '&fo=first');
check('film: Subs.ro altyazıları forced sayılmaz (ayar sırayı değiştirmez)', list.length === 2 && list.every((s) => !s.label.includes(T.forced)) && list[0] === item(list, 501));
list = await subs('tt3100001', 'pt-br,es');
check('film: sonuç yoksa liste boş', Array.isArray(list) && list.length === 0);

// ---------- Dizi listesi ----------
sroCalls.length = 0;
list = await subs('tt3100002:1:2', 'ro', '', 'series');
show(list);
check('dizi 1. sezon: o sezonun, onu kapsayan aralığın ve sezon yazmayanların altyazıları gelir; 2. sezonunki gelmez', [601, 603, 604, 605].every((id) => item(list, id)) && !item(list, 602) && list.length === 4, list.map((s) => s.label).join(' / '));
check('dizi: adres sezonu ve bölümü taşır', item(list, 601).url.endsWith('/sro/ro/601-1-2.srt'), item(list, 601).url.replace(/auth=[^/]+/, 'auth=…'));
check('dizi: ad açıklamadan gelir', item(list, 601).label === `${T.tagSubsro} | Sezonul 1 complet, 3 episoade, pentru WEB-DL. Enjoy!`, item(list, 601).label);
list = await subs('tt3100002:2:1', 'ro', '', 'series');
check('dizi 2. sezon: 1. sezonunki gelmez', [602, 603, 604, 605].every((id) => item(list, id)) && !item(list, 601) && item(list, 602).url.endsWith('/sro/ro/602-2-1.srt'), list.map((s) => s.label).join(' / '));
list = await subs('tt3100002:1:5', 'ro', '', 'series');
check('dizi: bütün bölümler ve sezonlar için tek arama', count('/search/') === 1 && list.length === 4, `${count('/search/')} arama`);

// ---------- Sınır dolunca arama ----------
list = await subs('tt3100429');
check('arama 429: liste boş gelir, hata vermez', Array.isArray(list) && list.length === 0);
const before = count('/search/imdbid/tt3100429');
await subs('tt3100429');
check('arama 429: hata yanıtı saklanmaz (sonraki istekte yeniden sorulur)', count('/search/imdbid/tt3100429') === before + 1, `${before} → ${count('/search/imdbid/tt3100429')}`);

// ---------- İndirme ----------
const file = (path, key = auth) => text(`/languages=ro,en&ui=tr${key ? `&auth=${key}` : ''}/sro/ro/${path}.srt`);
sroCalls.length = 0;
let body = await file('501-0-0');
check('indirme: arşivden altyazı çıkarılır', body.includes('Film altyazısı.') && count('/subtitle/501/download') === 1 && sroCalls[0].key === KEY, body.slice(0, 120));
body = await file('501-0-0');
check('indirme: ikinci istekte siteye yeniden gidilmez', body.includes('Film altyazısı.') && count('/subtitle/501/download') === 1);
body = await file('601-1-2');
check('indirme: sezon paketinden istenen bölüm seçilir', body.includes('Birinci sezon 2. bölüm.'), body.slice(0, 120));
body = await file('601-1-3');
check('indirme: aynı paketin başka bölümü ayrı seçilir', body.includes('Birinci sezon 3. bölüm.'), body.slice(0, 120));
body = await file('601-1-9');
check('indirme: pakette olmayan bölüm için "pakette yok" yazılır', body.includes(T.notInPack[0]) && !body.includes('Birinci sezon'), body.slice(0, 200));
body = await file('604-1-2');
check('indirme: arşivdeki tek dosya başka bölümse verilmez', body.includes(T.notInPack[0]) && !body.includes('Beşinci bölüm'), body.slice(0, 200));
body = await file('604-1-5');
check('indirme: arşivdeki tek dosya istenen bölümse verilir', body.includes('Beşinci bölüm.'), body.slice(0, 120));
body = await file('605-1-2');
check('indirme: adında bölüm yazmayan tek dosya verilir', body.includes('Adında bölüm yazmayan dosya.'), body.slice(0, 120));
body = await file('602-2-1');
check('indirme 429: sorgu sınırı mesajı yazılır', T.subsroLimit.every((line) => body.includes(line)), body.slice(0, 300));
body = await file('603-1-2');
check('indirme 401: anahtarın reddedildiği söylenir', body.includes('Subs.ro') && T.subsroLimit.every((line) => !body.includes(line)) && !body.includes(KEY), body.slice(0, 300));
sroCalls.length = 0;
body = await file('501-0-0', null);
check('indirme: anahtar yoksa siteye gidilmez', sroCalls.length === 0 && !body.includes('Film altyazısı.'), body.slice(0, 200));
res = await realFetch(`${BASE}/languages=ro&ui=tr&auth=${auth}/sro/ro/501.srt`, { headers: { connection: 'close' } });
const odd = await res.text();
check('indirme: bozuk adres siteye gitmez', sroCalls.length === 0 && !odd.includes('Film altyazısı.'), `${res.status} ${odd.slice(0, 80)}`);

// ---------- Gerçek sitede görülen biçimler ----------
const path = (s) => s.url.slice(s.url.indexOf('/sro/'));
const watch = (id, name, options = '', type = 'movie', languages = 'ro,en') => get(`/languages=${languages}&ui=tr${options}&auth=${auth}/subtitles/${type}/${id}/filename=${encodeURIComponent(name)}.json`).then((r) => r.subtitles);
list = await subs('tt3100003', 'ro');
check('açıklama: HTML kaçışları çözülür, "Release(s):" etiketi ve sondaki virgül atılır', item(list, 701)?.label === `${T.tagSubsro} | Sueño & Fuga`, item(list, 701)?.label);
check('sürüm seçimi: videonun adı bilinmiyorsa adres eskisi gibidir', path(item(list, 702)) === '/sro/ro/702-0-0.srt', path(item(list, 702)));
list = await watch('tt3100003', 'Ornek Film (2024) [1080p] NF WEB-DL H264-FLUX.mkv');
check('sürüm seçimi: videonun adı adrese yalnızca harf, rakam, nokta ve tireyle yazılır', path(item(list, 702)) === '/sro/ro/Ornek.Film.2024.1080p.NF.WEB-DL.H264-FLUX/702-0-0.srt', path(item(list, 702)));
sroCalls.length = 0;
const open = (s) => text(s.url.replace(BASE, ''));
body = await open(item(list, 702));
check('sürüm seçimi: arşivden videonun sürümü verilir (WEB-DL)', body.includes('NF WEB-DL sürümü.') && count('/subtitle/702/download') === 1, body.slice(0, 120));
body = await open(item(list, 702));
check('sürüm seçimi: aynı video için siteye yeniden gidilmez', body.includes('NF WEB-DL sürümü.') && count('/subtitle/702/download') === 1, `${count('/subtitle/702/download')} indirme`);
list = await watch('tt3100003', 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS.mkv');
body = await open(item(list, 702));
check('sürüm seçimi: başka sürümdeki video kendi dosyasını alır (BluRay)', body.includes('BluRay sürümü.') && !body.includes('WEB-DL'), body.slice(0, 120));
body = await file('702-0-0');
check('sürüm seçimi: videonun adı olmayan adres çalışmaya devam eder', body.includes('MA WEB-DL sürümü'), body.slice(0, 120));
list = await watch('tt3100003', 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS.mkv', '&match=0');
check('sürüm seçimi: akıllı eşleştirme kapalıysa videonun adı adrese yazılmaz', path(item(list, 702)) === '/sro/ro/702-0-0.srt', path(item(list, 702)));
list = await watch('tt3100003', `${'Cok.Uzun.Bir.Ad.'.repeat(12)}2024.1080p.BluRay.x264-SPARKS.mkv`);
const longHint = path(item(list, 702)).split('/')[3];
body = await open(item(list, 702));
check('sürüm seçimi: uzun adın sonu alınır (en çok 100 karakter) ve adres çalışır', longHint.length <= 100 && longHint.endsWith('2024.1080p.BluRay.x264-SPARKS') && /^[A-Za-z0-9]/.test(longHint) && body.includes('BluRay sürümü.'), `${longHint.length}: ${longHint}`);
list = await watch('tt3100003', '../../etc/şifre dosyası?.mkv');
check('sürüm seçimi: addaki özel karakterler adrese geçmez', /^\/sro\/ro\/[A-Za-z0-9][A-Za-z0-9.-]*\/702-0-0\.srt$/.test(path(item(list, 702))), path(item(list, 702)));
sroCalls.length = 0;
res = await realFetch(`${BASE}/languages=ro&ui=tr&auth=${auth}/sro/ro/bozuk_ad!/702-0-0.srt`, { headers: { connection: 'close' } });
check('sürüm seçimi: bozuk video adı taşıyan adres siteye gitmez', sroCalls.length === 0 && !(await res.text()).includes('sürümü'), String(res.status));

list = await watch('tt3100004:1:2', 'Ornek.Dizi.2.S01E02.1080p.BluRay.x264-GRP.mkv', '', 'series');
check('tek bölümlük altyazı başka bölümde listelenmez, sezon paketi listelenir', !item(list, 801) && !!item(list, 802), list.map((s) => s.label).join(' / '));
body = await open(item(list, 802));
check('sezon paketi: istenen bölümün videoya uyan sürümü verilir', body.includes('BluRay 2. bölüm.'), body.slice(0, 120));
list = await watch('tt3100004:1:6', 'Ornek.Dizi.2.S01E06.720p.BRRip.x264-GRP.mkv', '', 'series');
check('tek bölümlük altyazı kendi bölümünde listelenir', !!item(list, 801) && item(list, 801).label.startsWith(T.tagSubsro) && item(list, 801).label.endsWith('| ornek.dizi.s01e06.720p.brrip.x264-grp'), list.map((s) => s.label).join(' / '));

// ---------- Çift dilli ----------
list = await watch('tt3100001', 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS.mkv', '&dual=1');
const hinted = list.find(isDual);
body = hinted ? await text(hinted.url.replace(BASE, '')) : '';
check('çift dilli: videonun adını taşıyan adresler de birleştirilir', !!hinted && refs(hinted).every((r) => r.startsWith('sro/') && r.split('/').length === 4) && body.includes('Film altyazısı.') && body.includes('Movie subtitle.'), hinted ? refs(hinted).join(' + ') : 'yok');
list = await subs('tt3100001', 'ro,en', '&dual=1');
const pair = list.find(isDual);
check('çift dilli: Subs.ro altyazıları birleştirilebilir', !!pair && pair.label.startsWith(T.tagDual) && JSON.stringify(refs(pair)) === JSON.stringify(['sro/ro/501-0-0.srt', 'sro/en/502-0-0.srt']), pair ? `${pair.label} / ${refs(pair).join(' + ')}` : 'yok');
body = await text(pair.url.replace(BASE, ''));
check('çift dilli: iki dilin satırları tek altyazıda', body.includes('Film altyazısı.') && body.includes('Movie subtitle.'), body.slice(0, 200));

// ---------- Kaynaklarımı dene ----------
const strip = (r) => JSON.stringify(r.data.results?.map(({ ms, ...rest }) => rest));
sroCalls.length = 0;
res = await post('/api/test', { auth, languages: ['ro', 'en'] });
check('deneme: örnek filmde arama yapılır, bulunan sayı söylenir', strip(res) === JSON.stringify([{ source: 'subsro', status: 'ok', count: 2 }]) && count('/search/imdbid/tt0111161') === 1 && count('/download') === 0, JSON.stringify(res.data));
sroCalls.length = 0;
res = await post('/api/test', { auth, languages: ['tr'] });
check('deneme: Subs.ro\'nun ayırmadığı dilde yalnızca anahtar doğrulanır', strip(res) === JSON.stringify([{ source: 'subsro', status: 'ok', count: 0 }]) && sroCalls.length === 1 && sroCalls[0].path === '/v1.0/quota', JSON.stringify(res.data));
res = await post('/api/test', { auth: sealer.seal({ sr: 'sahte-red' }), languages: ['ro'] });
check('deneme: sonradan reddedilen anahtar "anahtar" hatası verir', strip(res) === JSON.stringify([{ source: 'subsro', status: 'key' }]), JSON.stringify(res.data));
res = await post('/api/test', { auth: sealer.seal({ sr: 'sahte-engel' }), languages: ['ro'] });
check('deneme: API\'den gelmeyen 403 "anahtar" değil genel hata verir', strip(res) === JSON.stringify([{ source: 'subsro', status: 'error' }]), JSON.stringify(res.data));
res = await post('/api/test', { auth: sealer.seal({ sr: 'sahte-anonim' }), languages: ['tr'] });
check('deneme: "anonymous" kotasıyla yanıtlanan anahtar "anahtar" hatası verir', strip(res) === JSON.stringify([{ source: 'subsro', status: 'key' }]), JSON.stringify(res.data));
check('istekler: Subs.ro\'ya giden her istek bir anahtar taşıdı', sroCalls.every((c) => c.key));

// ---------- Metinler ----------
const keys = Object.keys(T);
check('metinler: 12 dilde aynı anahtarlar, boş metin yok', Object.keys(STRINGS).length === 12 && Object.values(STRINGS).every((s) => JSON.stringify(Object.keys(s)) === JSON.stringify(keys) && Object.values(s).every((v) => (Array.isArray(v) ? v.length && v.every(Boolean) : v))));
check('metinler: Subs.ro etiketi her dilde adı taşır, sınır mesajı üç satır', Object.values(STRINGS).every((s) => s.tagSubsro.startsWith('[Subs.ro] ✓ ') && Array.isArray(s.subsroLimit) && s.subsroLimit.length === 3 && s.subsroIntro.includes('subs.ro') && s.howSubsro.includes('OpenSubtitles')));
check('metinler: forced ayarının beş metni her dilde var', Object.values(STRINGS).every((s) => ['forcedLabel', 'forcedLast', 'forcedFirst', 'forcedHide', 'forcedHint'].every((k) => typeof s[k] === 'string' && s[k])));
check('metinler: tanıtım cümlelerinde Subs.ro yalnızca Romencede geçer', Object.entries(STRINGS).every(([code, s]) => ['tagline', 'manifestDesc', 'dualHint'].every((k) => s[k].includes('Subs.ro') === (code === 'ro'))), Object.entries(STRINGS).filter(([code, s]) => !['tagline', 'manifestDesc', 'dualHint'].every((k) => s[k].includes('Subs.ro') === (code === 'ro'))).map(([code]) => code).join());
check('metinler: Romence tanıtım yalnızca Romence sayfada görünen kaynakları sayar', ['tagline', 'manifestDesc'].every((k) => STRINGS.ro[k].includes('SubSource, Subs.ro și Gestdown') && !STRINGS.ro[k].includes('AltyazıDB') && !STRINGS.ro[k].includes('AniSub')));
check('metinler: Romence kartta "gratuit" iddiası yok (yalnızca sorgu sınırı yazar)', /limită/.test(STRINGS.ro.subsroIntro) && !/gratuit/i.test(STRINGS.ro.subsroIntro));
check('metinler: Subs.ro için "ücretsiz" iddiası kartta yok (yalnızca sorgu sınırı yazar)', /sınır/.test(T.subsroIntro) && !/ücretsiz/i.test(T.subsroIntro) && /limit/.test(STRINGS.en.subsroIntro) && !/free/i.test(STRINGS.en.subsroIntro));

// ---------- Ayar sayfası ----------
function runPage(pageHtml, saved = null) {
  const elements = new Map();
  const element = (id) => {
    const handlers = {};
    const el = {
      id, children: [], dataset: {}, attributes: {}, textContent: '', value: '', checked: false, hidden: false, disabled: false, className: '', placeholder: '', href: '',
      addEventListener: (type, fn) => { handlers[type] = fn; },
      fire: (type, event = {}) => handlers[type]({ preventDefault() {}, target: el, ...event }),
      replaceChildren: (...kids) => { el.children = kids; },
      append: (...kids) => { el.children.push(...kids); },
      setAttribute: (name, value) => { el.attributes[name] = value; },
      querySelectorAll: () => [],
      reset: () => {},
      click: () => { el.clicked = true; },
      remove: () => {},
    };
    return el;
  };
  const $ = (id) => elements.get(id) || (elements.set(id, element(id)), elements.get(id));
  const storage = new Map(saved ? [['saved', JSON.stringify(saved)]] : []);
  const context = vm.createContext({
    document: { getElementById: $, querySelectorAll: () => [], createElement: () => element(null), documentElement: {}, body: { append() {} } },
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    navigator: { languages: ['tr-TR'], clipboard: { writeText: async () => {} } },
    Option: function Option(label, value) { this.text = label; this.value = value; },
    fetch: (url, init = {}) => (String(url).startsWith('http://127.0.0.1') ? realFetch(url, { ...init, headers: { ...init.headers, 'x-forwarded-for': '10.15.1.8' } }) : globalThis.fetch(url, init)),
    Intl, setTimeout, setInterval: () => 0, clearInterval() {}, performance: { now: () => 0 }, location: { hash: '', pathname: '/configure', search: '' }, history: { replaceState() {} }, addEventListener() {}, matchMedia: () => ({ matches: false }), console, JSON, Object, Array, Map, Set, String, Number, Boolean, Promise, URL, Blob,
  });
  for (const code of [...pageHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1])) vm.runInContext(code, context);
  return { $, storage };
}
const link = (p) => p.$('url').textContent;
const html = await text('/configure');
check('sayfa: Subs.ro kartı, anahtar kutusu, anahtar alma bağlantısı ve açıklama satırı var', ['id="subsroPanel"', 'id="subsroKey"', 'id="subsroForm"', 'data-remove="subsro"', 'href="https://subs.ro/api"', 'data-i18n="subsroIntro"', 'data-i18n="tagSubsro"', 'data-i18n="howSubsro"'].every((s) => html.includes(s)), ['id="subsroPanel"', 'id="subsroKey"', 'id="subsroForm"', 'data-remove="subsro"', 'href="https://subs.ro/api"', 'data-i18n="subsroIntro"', 'data-i18n="tagSubsro"', 'data-i18n="howSubsro"'].filter((s) => !html.includes(s)).join());
check('sayfa: forced seçimi var, sunucu mesajı sayfaya gömülmez', html.includes('id="forced"') && html.includes('data-i18n="forcedHint"') && !html.includes(T.subsroLimit[0]));

let page = runPage(await text(`/languages=ro,en&ui=tr&auth=${auth}/configure`));
check('sayfa: bağlı Subs.ro anahtarı gösterilir (gizlenmiş), kutu kapanır', page.$('subsroForm').hidden === true && page.$('subsroDone').hidden === false && page.$('subsroStatus').textContent.length > 0 && !page.$('subsroStatus').textContent.includes(KEY), page.$('subsroStatus').textContent);
check('sayfa: Subs.ro tek başına yeterli, adres hazır', link(page) === `${BASE}/languages=ro,en&ui=tr&auth=${auth}/manifest.json`, link(page).replace(/auth=[^/]+/, 'auth=…'));
check('sayfa: öne alma listesinde Subs.ro, SubSource\'tan sonra', page.$('pri').children.map((o) => o.value).join().startsWith(',os,sd,ss,sro,adb') && page.$('pri').children.find((o) => o.value === 'sro').text === 'Subs.ro' && page.$('pri').children.find((o) => o.value === 'sro').disabled !== true, page.$('pri').children.map((o) => `${o.value}${o.disabled ? '(kapalı)' : ''}`).join());
check('sayfa: önizlemede Romence ve İngilizce için birer Subs.ro satırı', page.$('pvTitle').textContent.endsWith(T.count.replace('{n}', 2).replace('{f}', 2)), page.$('pvTitle').textContent);
page.$('pri').value = 'sro'; page.$('pri').fire('change');
check('sayfa: Subs.ro öne alınınca adrese pri=sro yazılır', link(page) === `${BASE}/languages=ro,en&ui=tr&pri=sro&auth=${auth}/manifest.json`, link(page).replace(/auth=[^/]+/, 'auth=…'));
check('sayfa: ayarlar hatırlanır', JSON.parse(page.storage.get('saved')).prefer === 'sro' && JSON.parse(page.storage.get('saved')).forced === 'last', page.storage.get('saved').replace(/"auth":"[^"]+"/, '"auth":"…"'));
page.$('pri').value = ''; page.$('pri').fire('change');
page.$('forced').value = 'first'; page.$('forced').fire('change');
check('sayfa: forced "öne al" seçilince adrese fo=first yazılır', link(page) === `${BASE}/languages=ro,en&ui=tr&fo=first&auth=${auth}/manifest.json` && JSON.parse(page.storage.get('saved')).forced === 'first', link(page).replace(/auth=[^/]+/, 'auth=…'));
page.$('forced').value = 'hide'; page.$('forced').fire('change');
check('sayfa: forced "gizle" seçilince adrese fo=hide yazılır', link(page) === `${BASE}/languages=ro,en&ui=tr&fo=hide&auth=${auth}/manifest.json`, link(page).replace(/auth=[^/]+/, 'auth=…'));
page.$('forced').value = 'last'; page.$('forced').fire('change');
check('sayfa: forced varsayılana dönünce adresten kalkar (eski adresler değişmez)', link(page) === `${BASE}/languages=ro,en&ui=tr&auth=${auth}/manifest.json`, link(page).replace(/auth=[^/]+/, 'auth=…'));
check('sayfa: forced seçenekleri üç tane ve arayüz dilinde', page.$('forced').children.map((o) => `${o.value}=${o.text}`).join() === `last=${T.forcedLast},first=${T.forcedFirst},hide=${T.forcedHide}`, page.$('forced').children.map((o) => `${o.value}=${o.text}`).join());

page = runPage(await text(`/languages=tr,ro&ui=en&hi=last&fo=first&pri=sro&auth=${auth}/configure`));
check('sayfa: adresteki fo ve pri=sro geri okunur, sıra korunur', page.$('forced').value === 'first' && page.$('pri').value === 'sro' && link(page) === `${BASE}/languages=tr,ro&ui=en&hi=last&fo=first&pri=sro&auth=${auth}/manifest.json`, link(page).replace(/auth=[^/]+/, 'auth=…'));
page = runPage(await text(`/languages=tr&ui=tr&fo=bozuk&auth=${auth}/configure`));
check('sayfa: tanınmayan fo değeri varsayılan sayılır', page.$('forced').value === 'last' && !link(page).includes('fo='), link(page).replace(/auth=[^/]+/, 'auth=…'));
check('sayfa: Subs.ro\'nun ayırmadığı dil seçiliyken önizlemede satırı yok', page.$('pvTitle').textContent.includes(T.listEmpty), page.$('pvTitle').textContent);
page = runPage(await text('/configure'), { auth: null, sources: { os: null }, selected: ['tr'], max: null, match: true, gestdown: true, forced: 'hide' });
check('sayfa: hatırlanan forced ayarı yüklenir', page.$('forced').value === 'hide' && link(page) === `${BASE}/languages=tr&ui=tr&fo=hide&gd=1/manifest.json`, link(page));
page = runPage(await text('/configure'), { auth: null, sources: { os: null }, selected: ['tr'], max: null, match: true, gestdown: true, forced: 'evet' });
check('sayfa: bozuk hatırlanan forced değeri yok sayılır', page.$('forced').value === 'last' && link(page) === `${BASE}/languages=tr&ui=tr&gd=1/manifest.json`, link(page));

// Subs.ro bir Romen sitesi: kartı yalnızca site Romenceyken görünür; anahtarı bağlı olan her dilde görür.
check('sayfa: dil listesinde Romence var', html.includes('"ro":"Română"') && STRINGS.ro.uiLanguage === 'Limba paginii', '');
page = runPage(await text('/languages=ro&ui=ro/configure'));
check('sayfa: Romence sayfada Subs.ro kartı ve açıklama satırı görünür', page.$('subsroPanel').hidden === false && page.$('subsroLegend').hidden === false && page.$('altyazidbPanel').hidden === true && page.$('anisubPanel').hidden === true);
check('sayfa: Romence sayfa adrese ui=ro yazar (kaynak yokken adres hazır değil)', link(page) === '—' && page.$('subsroKey').placeholder === STRINGS.ro.apiKey, link(page));
for (const other of ['tr', 'en', 'de']) {
  page = runPage(await text(`/languages=ro&ui=${other}/configure`));
  check(`sayfa: ${other} sayfada, anahtar bağlı değilken Subs.ro kartı ve açıklama satırı gizli`, page.$('subsroPanel').hidden === true && page.$('subsroLegend').hidden === true);
}
page = runPage(await text(`/languages=ro&ui=en&auth=${auth}/configure`));
check('sayfa: anahtarı bağlı olan Subs.ro kartını başka dilde de görür', page.$('subsroPanel').hidden === false && page.$('subsroLegend').hidden === false && page.$('subsroDone').hidden === false);
page = runPage(await text(`/languages=ro&ui=ro&auth=${auth}/configure`));
check('sayfa: Romence sayfada adres ui=ro ile kurulur', link(page) === `${BASE}/languages=ro&ui=ro&auth=${auth}/manifest.json`, link(page).replace(/auth=[^/]+/, 'auth=…'));
const roManifest = await get(`/languages=ro,en&ui=ro&auth=${auth}/manifest.json`);
check('Romence: manifest açıklaması Romence, Subs.ro\'yu sayar', roManifest.description.startsWith('Adună subtitrările de pe OpenSubtitles, SubDL, SubSource, Subs.ro și Gestdown') && roManifest.description.includes('Surse: ') && roManifest.description.includes('Subs.ro') && roManifest.description.includes('Limbi: Română'), roManifest.description);
const roList = (await get(`/languages=ro&ui=ro&auth=${auth}/subtitles/movie/tt3100001.json`)).subtitles;
check('Romence: etiketler Romence yazılır', roList.length > 0 && roList.every((s) => s.label.startsWith('[Subs.ro] ✓ Gratuit')), roList.map((s) => s.label).join(' / '));

// Örnek karedeki altyazı sayfanın dilinde yazılır; çift dillide seçili ilk iki dil alt alta durur.
const caps = (p) => (p.$('playerCaps').children[0]?.children || []).map((c) => c.textContent).join(' | ');
page = runPage(await text('/languages=tr&ui=ro&gd=1/configure'));
check('önizleme: karedeki altyazı sayfa dilinde (Romence sayfa, Türkçe altyazı seçili)', caps(page) === 'Ce cauți aici?', caps(page));
page.$('ui').value = 'de'; page.$('ui').fire('change');
check('önizleme: sayfa dili değişince karedeki altyazı da değişir', caps(page) === 'Was machst du hier?', caps(page));
page.$('ui').value = 'tr'; page.$('ui').fire('change');
check('önizleme: Türkçe sayfada Türkçe', caps(page) === 'Burada ne arıyorsun?', caps(page));
page = runPage(await text('/languages=tr,en&ui=ro&gd=1&dual=1/configure'));
check('önizleme: çift dillide de üstteki satır sayfa dilinde, altında seçili ikinci dil', caps(page) === 'Ce cauți aici? | What are you doing here?', caps(page));
page = runPage(await text('/languages=tr,en&ui=tr&gd=1&dual=1/configure'));
check('önizleme: çift dilli, Türkçe sayfa: üstte Türkçe, altta İngilizce', caps(page) === 'Burada ne arıyorsun? | What are you doing here?', caps(page));
page = runPage(await text('/languages=tr,en&ui=en&gd=1&dual=1/configure'));
check('önizleme: çift dilli, ikinci dil sayfanın diliyse aynı replik iki kez yazılmaz (altta ilk dil)', caps(page) === 'What are you doing here? | Burada ne arıyorsun?', caps(page));
page.$('ui').value = 'de'; page.$('ui').fire('change');
check('önizleme: çift dillide sayfa dili değişince üst satır değişir', caps(page) === 'Was machst du hier? | What are you doing here?', caps(page));
page = runPage(await text('/languages=tr,en&ui=ro&gd=1/configure'));
check('önizleme: çift dilli kapalıyken tek satır, sayfa dilinde', caps(page) === 'Ce cauți aici?', caps(page));

check('hiçbir denetimde indirme hakkı harcanmadı', !calls.some((c) => c.includes('/api/v1/download')), calls.filter((c) => c.includes('/api/v1/download')).join(' | '));

globalThis.fetch = realFetch;
server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exitCode = fails ? 1 : 0;
