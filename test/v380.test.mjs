// v3.8.0: liste filtreleri, yedek dil, ses açıklaması temizliği, kaynak denemesi ve ayar sayfası.
import { VERSION } from './setup.mjs';
// Hiçbir gerçek siteye istek gitmez; giriş ve hak bilgisi de sahte sunucudan gelir.
import { createServer } from 'node:http';
import vm from 'node:vm';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { stripHearingImpaired } = await import('../src/subtitle.js');
const { STRINGS } = await import('../src/i18n.js');

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 500) : ''}`); };

// ---------- Ses açıklaması temizliği (doğrudan) ----------
const HI_SRT = [
  '1', '00:00:01,000 --> 00:00:02,000', '[kapı çarpar]', '',
  '2', '00:00:03,000 --> 00:00:04,000', 'JOHN: Selam, nasılsın?', '',
  '3', '00:00:05,000 --> 00:00:06,000', '- (iç çeker) Bilmiyorum.', '- MARY: Ben biliyorum.', '',
  '4', '00:00:07,000 --> 00:00:08,000', '♪ La la la ♪', '',
  '5', '00:00:09,000 --> 00:00:10,000', '<i>[telefon çalar]</i>', 'Açsana şunu.', '',
  '6', '00:00:11,000 --> 00:00:12,000', '[uzaktan', 'köpek havlar]', 'Duydun mu?', '',
  '7', '00:00:13,000 --> 00:00:14,000', 'Saat 10:30 gibi gelirim.', '',
  '8', '00:00:15,000 --> 00:00:16,000', '...', '',
  '9', '00:00:17,000 --> 00:00:18,000', 'DİKKAT ET: O GELİYOR', '',
  '10', '00:00:19,000 --> 00:00:20,000', '<i>♪ Şarkı sözü', 'devam ediyor ♪</i>', '',
  '11', '00:00:21,000 --> 00:00:22,000', '1984', '',
  '12', '00:00:23,000 --> 00:00:24,000', '<i>ANLATICI: Uzun zaman önce...', '(rüzgâr eser)</i>', '',
  '13', '00:00:25,000 --> 00:00:26,000', '- [iç çeker]', '- Tamam.', '',
  '14', '00:00:27,000 --> 00:00:28,000', '<i>(fısıltıyla)', 'Buradayım.</i>', '',
].join('\r\n');
const cleaned = stripHearingImpaired(HI_SRT);
console.log(cleaned.split('\n').map((l) => '   ' + l).join('\n'));
const cueTexts = cleaned.trim().split(/\n\n/).map((block) => block.split('\n').slice(2).join('|'));
check('temizlik: yalnızca açıklama olan satır atılır, kalanlar yeniden numaralanır', cueTexts.length === 11 && cleaned.startsWith('1\n00:00:03,000 --> 00:00:04,000\n'), cueTexts.length);
check('temizlik: açıklaması silinen tireli satır tek başına "-" olarak kalmaz', cueTexts[9] === '- Tamam.', cueTexts[9]);
check('temizlik: tek başına kalan açılış etiketi sonraki satıra taşınır', cueTexts[10] === '<i>Buradayım.</i>', cueTexts[10]);
check('temizlik: konuşmacı adı çıkar, konuşma kalır', cueTexts[0] === 'Selam, nasılsın?', cueTexts[0]);
check('temizlik: (parantez) ve tireli konuşmacı', cueTexts[1] === '- Bilmiyorum.|- Ben biliyorum.', cueTexts[1]);
check('temizlik: ♪ satırları atılır', !cleaned.includes('♪') && !cleaned.includes('La la') && !cleaned.includes('devam ediyor'));
check('temizlik: boş kalan <i></i> silinir', cueTexts[2] === 'Açsana şunu.', cueTexts[2]);
check('temizlik: iki satıra bölünmüş açıklama', cueTexts[3] === 'Duydun mu?', cueTexts[3]);
check('temizlik: saat (10:30) konuşmacı sanılmaz', cueTexts[4] === 'Saat 10:30 gibi gelirim.', cueTexts[4]);
check('temizlik: dokunulmamış "..." satırı kalır', cueTexts[5] === '...', cueTexts[5]);
check('temizlik: tamamı büyük harfli konuşma silinmez', cueTexts[6] === 'DİKKAT ET: O GELİYOR', cueTexts[6]);
check('temizlik: sayıdan ibaret konuşma (1984) sıra numarası sanılmaz', cueTexts[7] === '1984', cueTexts[7]);
check('temizlik: etiket dengesi korunur', cueTexts[8] === '<i>Uzun zaman önce...</i>', cueTexts[8]);
check('temizlik: zaman satırları aynen kalır', cleaned.includes('00:00:27,000 --> 00:00:28,000') && !cleaned.includes('\r'));
const plain = '1\n00:00:01,000 --> 00:00:02,000\nMerhaba.\n\n2\n00:00:03,000 --> 00:00:04,000\nNasılsın?\n';
check('temizlik: açıklaması olmayan altyazının metni değişmez', stripHearingImpaired(plain).replace(/\s+/g, ' ').trim() === plain.replace(/\s+/g, ' ').trim());
check('temizlik: SRT olmayan metne dokunulmaz', stripHearingImpaired('WEBVTT\n\n00:01.000 --> 00:02.000\n[ses]') === 'WEBVTT\n\n00:01.000 --> 00:02.000\n[ses]' && stripHearingImpaired('düz metin [ses]') === 'düz metin [ses]');
const onlyHi = '1\n00:00:01,000 --> 00:00:02,000\n[müzik]\n';
check('temizlik: her şey silinecekse dosya olduğu gibi kalır (boş altyazı dönmez)', stripHearingImpaired(onlyHi) === onlyHi);

// ---------- Sahte siteler ----------
const realFetch = globalThis.fetch;
const calls = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const os = (o) => ({ attributes: { language: 'tr', legacy_subtitle_id: null, release: '', moviehash_match: false, from_trusted: false, ai_translated: false, machine_translated: false, download_count: 10, hearing_impaired: false, ...o, files: [{ file_id: o.file, file_name: 'x.srt' }] } });
const official = (id, lang, release = '') => ({ id: String(id), url: `https://subs5.strem.io/${lang}/download/file/${id}`, lang, movieReleaseName: release });
const flags = { infoStatus: 200 };

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  // 3.10.1'dan beri AniSub varsayılan olarak açık; bu testlerde hiç altyazı vermez ve çağrı listesine yazılmaz.
  if (url.hostname === 'anisub.co') return new Response(JSON.stringify({ subtitles: [] }), { headers: { 'content-type': 'application/json' } });
  const q = url.searchParams;
  const headers = new Headers(init?.headers || {});
  calls.push(`${init?.method || 'GET'} ${url.hostname}${url.pathname}?${q}`.replace(/api_key=[^&]*/, 'api_key=…'));
  switch (url.hostname) {
    case 'api.opensubtitles.com': {
      if (url.pathname === '/api/v1/login') {
        const body = JSON.parse(init.body);
        if (body.username === 'yanlis-kullanici') return json({ message: 'Error, invalid username/password' }, 401);
        if (body.username === 'reddedilen-kullanici') return json({ message: 'Forbidden' }, 403);
        return json({ token: 'sahte-oturum', user: { allowed_downloads: 20 } });
      }
      if (url.pathname === '/api/v1/infos/user') {
        if (headers.get('authorization') !== 'Bearer sahte-oturum') return json({ errors: ['Invalid token'] }, 401);
        if (flags.infoStatus !== 200) return json({ message: 'bakım' }, flags.infoStatus);
        return json({ data: { allowed_downloads: 20, remaining_downloads: 17 } });
      }
      if (url.pathname !== '/api/v1/subtitles') throw new Error('hak harcayan istek yapılmamalı: ' + url.pathname);
      return json({ total_pages: 1, data: [
        os({ file: 1, legacy_subtitle_id: 9001, release: 'Ornek.Film.2024.1080p.WEB-DL.H264-FLUX', download_count: 5000 }),
        os({ file: 2, release: 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS', from_trusted: true, download_count: 9000 }),
        os({ file: 3, release: 'Ornek.Film.2024.HDTV.x264', hearing_impaired: true }),
        os({ file: 4, language: 'en', legacy_subtitle_id: 9004, release: 'Ornek.Film.2024.EXTENDED.BluRay-GRP' }),
        os({ file: 5, legacy_subtitle_id: 9005, ai_translated: true, release: 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS' }),
        os({ file: 6, language: 'en', release: 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS' }),
      ] });
    }
    case 'opensubtitles-v3.strem.io':
      return json({ subtitles: [official(9001, 'tur'), official(9004, 'eng'), official(9005, 'tur'), official(9009, 'tur', 'Ornek.Film.2024.720p.BluRay.x264-SPARKS')] });
    case 'api.subdl.com':
      if (q.get('api_key') === 'kotu-subdl-anahtari') return json({ status: false, error: 'Invalid api key' });
      return json({ status: true, subtitles: [
        { url: '/subtitle/111-1.zip', language: 'TR', release_name: 'Ornek.Film.2024.WEBRip.x264', releases: ['Ornek.Film.2024.WEBRip.x264', 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS'], hi: true },
        { url: '/subtitle/111-2.zip', language: 'TR', release_name: 'Ornek.Film.2024.DVDRip.XviD-OLD', releases: [], hi: false },
      ] });
    case 'api.subsource.net':
      if (headers.get('x-api-key') === 'kotu-subsource-anahtari') return json({ message: 'unauthorized' }, 401);
      if (headers.get('x-api-key') === 'bozuk-subsource') return json({ message: 'bakım' }, 503);
      if (url.pathname.endsWith('/movies/search')) return json({ success: true, data: [{ movieId: 77, type: 'movie' }] });
      if (q.get('language') !== 'turkish') return json({ success: true, data: [] });
      return json({ success: true, data: [
        { subtitleId: 501, language: 'turkish', releaseInfo: ['Ornek.Film.2024.1080p.BluRay.x264-SPARKS'], hearingImpaired: false },
        { subtitleId: 502, language: 'turkish', releaseInfo: ['Ornek.Film.2024.HDCAM'], hearingImpaired: false },
        { subtitleId: 503, language: 'turkish', releaseInfo: ['Ornek.Film.2024.BluRay.720p'], hearingImpaired: false },
      ] });
    case 'altyazidb.com':
      if (url.pathname.endsWith('/me')) return json({ success: true });
      if (url.pathname.endsWith('/search')) {
        return json({ data: q.get('lang') !== 'tr' ? [] : [
          { id: 700, language: 'tr', releases: ['Ornek.Film.2024.BluRay.1080p'], hearing_impaired: 1, ai_ceviri: 0, downloads: 5 },
          { id: 701, language: 'tr', releases: ['Ornek.Film.2024.WEB'], hearing_impaired: 0, ai_ceviri: 1, downloads: 5 },
        ] });
      }
      if (url.pathname.endsWith('/subtitle')) return new Response(HI_SRT, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      break;
  }
  throw new Error('beklenmeyen dış istek: ' + url.hostname + url.pathname);
};

const start = async (extraEnv = {}) => {
  const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '', ...extraEnv })).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    server,
    base,
    get: (path) => realFetch(base + path).then((res) => res.json()),
    text: (path) => realFetch(base + path).then((res) => res.text()),
    post: (path, body, ip = '10.0.0.1') => realFetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) })
      .then(async (res) => ({ status: res.status, data: await res.json() })),
  };
};
const sealer = createSealer(process.env.CONFIG_SECRET);
const auth = sealer.seal({ u: 'sahte-kullanici', p: 'sahte-sifre', sd: 'sahte-subdl-1234', ss: 'sahte-subsource-1234', ad: 'sahte-altyazidb-1234' });
const seg = (options = '', languages = 'tr,en') => `languages=${languages}&ui=tr${options}&auth=${auth}`;
const FILE = encodeURIComponent('Ornek.Film.2024.1080p.BluRay.x264-SPARKS.mkv');
const show = (list) => console.log(list.map((s) => `   ${s.lang} | ${s.label}`).join('\n'));
const isQuota = (s) => s.label.includes('1 hak harcar');
const isHi = (s) => s.label.includes(' · HI | ');
const rank = (s) => (isQuota(s) ? 2 : 0) + (isHi(s) ? 1 : 0);
const sortedBy = (list, fn) => list.every((s, i) => i === 0 || fn(list[i - 1]) <= fn(s));
const a = await start();
const titles = (options, languages) => a.get(`/${seg(options, languages)}/subtitles/movie/tt1000001/filename=${FILE}.json`).then((res) => res.subtitles);

// ---------- Varsayılan davranış değişmedi ----------
const health = await a.get('/api/health');
check('sürüm 3.9.0', health.version === VERSION && (await a.get(`/${seg()}/manifest.json`)).version === VERSION, JSON.stringify(health));
const base = await titles();
show(base);
const tr = base.filter((s) => s.lang === 'tur');
const en = base.filter((s) => s.lang === 'eng');
check('varsayılan: 12 Türkçe + 2 İngilizce, makine çevirileri ve HI listede', tr.length === 12 && en.length === 2 && tr.filter(isHi).length === 3 && tr.some((s) => s.url.endsWith('/9005')), `${tr.length} ${en.length}`);
check('varsayılan: ücretsizler üstte, HI altyazılar yerinde kalır (sona atılmaz)', sortedBy(tr, (s) => (isQuota(s) ? 1 : 0)) && !sortedBy(tr, rank));
check('varsayılan: dosya adreslerinde yeni ayar yok', base.every((s) => !s.url.includes('clean=') && !s.url.includes('fb=') && !s.url.includes('mt=') && !s.url.includes('hi=')));

// ---------- Makine çevirilerini gizle ----------
let list = await titles('&mt=0');
check('mt=0: makine çevirileri (OpenSubtitles 9005, AltyazıDB 701) listede yok', list.length === 12 && !list.some((s) => s.url.endsWith('/9005') || s.url.includes('/adb/tr/701-')) && list.filter((s) => s.lang === 'eng').length === 2, list.length);
check('mt=0: kalanların sırası değişmez', JSON.stringify(list.map((s) => s.url)) === JSON.stringify(base.filter((s) => !s.url.endsWith('/9005') && !s.url.includes('/adb/tr/701-')).map((s) => s.url)));

// ---------- İşitme engelli altyazılar ----------
list = await titles('&hi=hide');
check('hi=hide: HI altyazı kalmaz, diğerleri durur', list.length === 11 && !list.some(isHi) && JSON.stringify(list.map((s) => s.url)) === JSON.stringify(base.filter((s) => !isHi(s)).map((s) => s.url)), list.length);
list = await titles('&hi=last');
show(list);
const trLast = list.filter((s) => s.lang === 'tur');
check('hi=last: hiçbir altyazı eksilmez', list.length === 14 && trLast.length === 12);
check('hi=last: ücretsiz → ücretsiz HI → hak harcayan → hak harcayan HI', sortedBy(trLast, rank) && trLast.filter(isHi).length === 3, trLast.map(rank).join(''));
check('hi=last: ücretsiz HI altyazı, hak harcayanın yine üstünde', trLast.findIndex(isHi) < trLast.findIndex(isQuota));
for (const bad of ['x', 'LAST', '1']) {
  list = await titles('&hi=' + bad);
  check(`hi=${bad}: geçersiz → varsayılan`, JSON.stringify(list.map((s) => s.url)) === JSON.stringify(base.map((s) => s.url)));
}

// ---------- Yedek dil ----------
list = await titles('&fb=1');
check('fb=1: yalnızca birinci dil (Türkçe) gösterilir', list.length === 12 && list.every((s) => s.lang === 'tur'), list.length);
list = await titles('&fb=1', 'de,en,tr');
check('fb=1: birinci dilde (Almanca) altyazı yoksa ikinci dile (İngilizce) geçilir', list.length === 2 && list.every((s) => s.lang === 'eng'), list.map((s) => s.lang).join(','));
list = await titles('', 'de,en,tr');
check('fb kapalı: bütün diller sırayla gösterilir', list.length === 14 && list[0].lang === 'eng' && list.at(-1).lang === 'tur');
list = await titles('&fb=1&hi=hide&mt=0&max=3');
check('ayarlar birlikte: yedek dil + HI gizli + makine gizli + en fazla 3', list.length === 3 && list.every((s) => s.lang === 'tur' && !isHi(s)), list.map((s) => s.label).join(' / '));

// ---------- Ses açıklaması temizliği (dosya açılırken) ----------
list = await titles('&clean=1');
const own = list.filter((s) => !s.url.includes('strem.io'));
check('clean=1: eklentinin kendi dosya adresleri ayarı taşır', own.length > 0 && own.every((s) => s.url.includes('&clean=1&auth=')), own[0]?.url.slice(0, 120));
check('clean=1: resmi (Stremio sunucusu) adresleri aynen kalır', list.filter((s) => s.url.includes('strem.io')).every((s) => /^https:\/\/subs5\.strem\.io\/\w+\/download\/file\/\d+$/.test(s.url)));
check('clean=1: liste aynı (yalnızca adresler değişir)', JSON.stringify(list.map((s) => s.label)) === JSON.stringify(base.map((s) => s.label)));
const adb = list.find((s) => s.url.includes('/adb/tr/700-'));
const cleanedFile = await realFetch(adb.url).then((res) => res.text());
check('clean=1: açılan dosyada açıklamalar yok', cleanedFile === cleaned && !cleanedFile.includes('[') && !cleanedFile.includes('♪'), cleanedFile.slice(0, 80));
const rawFile = await realFetch(base.find((s) => s.url.includes('/adb/tr/700-')).url).then((res) => res.text());
check('ayar kapalıyken aynı dosya olduğu gibi gelir (ortak önbellek temizlenmiş metni saklamaz)', rawFile === HI_SRT);
check('önbellekten gelen dosya da temizlenir', (await realFetch(adb.url).then((res) => res.text())) === cleaned && calls.filter((c) => c.includes('altyazidb.com/api/v1/subtitle')).length === 1);
const notice = await a.text('/languages=tr&ui=tr&clean=1/adb/tr/700-0-0.srt');
check('uyarı metinleri temizlenmez (parantezli satır durur)', notice.includes('(OpenSubtitles hesabı, SubDL ya da SubSource anahtarı).'), notice.slice(0, 200));

// ---------- Kaynak denemesi ----------
calls.length = 0;
let res = await a.post('/api/test', { auth, languages: ['tr', 'en'] });
console.log('   ' + JSON.stringify(res.data));
const by = (data) => Object.fromEntries((data.results || []).map((r) => [r.source, r]));
let got = by(res.data);
check('deneme: dört kaynak da çalışıyor', res.status === 200 && ['os', 'subdl', 'subsource', 'altyazidb'].every((s) => got[s]?.status === 'ok'));
check('deneme: bulunan altyazı sayıları', got.os.count === 6 && got.subdl.count === 2 && got.subsource.count === 3 && got.altyazidb.count === 2, JSON.stringify(res.data));
check('deneme: kalan indirme hakkı gösterilir', got.os.remaining === 17);
check('deneme: örnek film aranır', calls.some((c) => c.includes('api.opensubtitles.com/api/v1/subtitles') && c.includes('imdb_id=111161')) && calls.some((c) => c.includes('api.subdl.com') && c.includes('imdb_id=tt0111161')));
check('deneme: hiçbir indirme isteği yapılmaz', !calls.some((c) => c.includes('/download') || c.includes('dl.subdl.com') || c.includes('/subtitle?') || c.includes('/extract_ep')), calls.join(' | '));
check('deneme: yanıtta şifre ya da anahtar yok', !JSON.stringify(res.data).includes('sahte-'));

flags.infoStatus = 503;
res = await a.post('/api/test', { auth, languages: ['tr'] });
got = by(res.data);
check('deneme: hak bilgisi alınamazsa kaynak yine "çalışıyor" görünür', got.os.status === 'ok' && got.os.remaining === null && got.os.count === 6, JSON.stringify(got.os));
flags.infoStatus = 200;

res = await a.post('/api/test', { auth: sealer.seal({ u: 'yanlis-kullanici', p: 'x', sd: 'kotu-subdl-anahtari', ss: 'kotu-subsource-anahtari' }), languages: ['tr'] });
got = by(res.data);
check('deneme: yanlış şifre → giriş hatası', got.os.status === 'login', JSON.stringify(got.os));
check('deneme: reddedilen anahtarlar', got.subdl.status === 'key' && got.subsource.status === 'key' && !got.altyazidb, JSON.stringify(res.data));
res = await a.post('/api/test', { auth: sealer.seal({ ss: 'bozuk-subsource' }), languages: ['tr'] });
check('deneme: yanıt vermeyen kaynak → "yanıt vermedi" (anahtar hatası değil)', res.data.results.length === 1 && res.data.results[0].status === 'error', JSON.stringify(res.data));
calls.length = 0;
res = await a.post('/api/test', { auth: sealer.seal({ ad: 'sahte-altyazidb-1234', sd: 'sahte-subdl-1234' }), languages: ['ja'] });
got = by(res.data);
check('deneme: kaynağın desteklemediği dilde anahtar yine doğrulanır, 0 altyazı', got.altyazidb.status === 'ok' && got.altyazidb.count === 0 && calls.some((c) => c.includes('altyazidb.com/api/v1/me')), JSON.stringify(res.data));
res = await a.post('/api/test', { auth: 'bozuk', languages: ['tr'] });
check('deneme: geçersiz ayar → boş sonuç, dış istek yok', res.status === 200 && res.data.results.length === 0);
res = await a.post('/api/test', { languages: 'tr' });
check('deneme: bozuk istek gövdesi hata vermez', res.status === 200 && res.data.results.length === 0);
let last;
for (let i = 0; i < 21; i++) last = await a.post('/api/test', { auth: 'bozuk' }, '10.9.9.9');
check('deneme: aynı adresten 20 denemeden sonra durdurulur', last.status === 429, last.status);

// ---------- Giriş hataları ----------
res = await a.post('/api/connect', { os: { username: 'yanlis-kullanici', password: 'gizli-sifre-9' } }, '10.0.0.3');
check('giriş: OpenSubtitles 401 → "kullanıcı adı veya şifre hatalı"', res.status === 401 && res.data.error === 'bad_login', JSON.stringify(res));
res = await a.post('/api/connect', { os: { username: 'reddedilen-kullanici', password: 'gizli-sifre-9' } }, '10.0.0.3');
check('giriş: OpenSubtitles 403 → "şifre hatası" denmez, ayrı mesaj', res.status === 502 && res.data.error === 'os_refused', JSON.stringify(res));
res = await a.post('/api/connect', { os: { username: '  sahte-kullanici  ', password: ' Özel "şifre" \\ ~ ' } }, '10.0.0.3');
check('giriş: doğru bilgilerle bağlanır', res.status === 200 && res.data.sources?.os === 'sahte-kullanici', JSON.stringify(res.data.sources));
check('giriş metni: 12 dilde .org/.com ayrımı ve aktarma adresi', Object.values(STRINGS).every((s) => s.badLogin.includes('opensubtitles.org') && s.badLogin.includes('opensubtitles.com/en/users/import') && s.osRefused));

// ---------- Ayar sayfası ----------
const html = await a.text(`/${seg('&fb=1&mt=0&hi=last&clean=1&max=10')}/configure`);
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
check('sayfa: yeni denetimler var', ['id="fallback"', 'id="machine"', 'id="hi"', 'id="clean"', 'id="test"', 'id="testResult"', 'https://github.com/MrDiavelin/subpool'].every((s) => html.includes(s)));
const keys = Object.keys(STRINGS.tr);
check('metinler: 12 dilde aynı anahtarlar, boş metin yok', Object.keys(STRINGS).length === 12 && Object.values(STRINGS).every((s) => JSON.stringify(Object.keys(s)) === JSON.stringify(keys) && Object.values(s).every((v) => (Array.isArray(v) ? v.length : v))));
check('metinler: yer tutucular her dilde aynı', Object.values(STRINGS).every((s) => keys.every((k) => JSON.stringify(String(s[k]).match(/\{\w+\}/g)?.sort()) === JSON.stringify(String(STRINGS.tr[k]).match(/\{\w+\}/g)?.sort()))));
check('sayfa: "açık kaynak" denmez', !/açık kaynak|open[- ]source/i.test(html));

// Sayfanın betiği sahte bir tarayıcıda gerçekten çalıştırılır.
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
    };
    return el;
  };
  const $ = (id) => elements.get(id) || (elements.set(id, element(id)), elements.get(id));
  const storage = new Map(saved ? [['saved', JSON.stringify(saved)]] : []);
  const context = vm.createContext({
    document: { getElementById: $, querySelectorAll: () => [], createElement: () => element(null), documentElement: {} },
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    navigator: { languages: ['tr-TR'], clipboard: { writeText: async () => {} } },
    Option: function Option(text, value) { this.text = text; this.value = value; },
    fetch: (url, init) => realFetch(url, { ...init, headers: { ...init.headers, 'x-forwarded-for': '10.0.0.7' } }),
    Intl, setTimeout, setInterval: () => 0, clearInterval() {}, performance: { now: () => 0 }, location: { hash: '', pathname: '/configure', search: '' }, history: { replaceState() {} }, addEventListener() {}, matchMedia: () => ({ matches: false }), console, JSON, Object, Array, Map, Set, String, Number, Boolean, Promise, URL,
  });
  for (const code of [...pageHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1])) vm.runInContext(code, context);
  return { $, storage };
}
let page;
try {
  for (const code of scripts) new vm.Script(code);
  page = runPage(html);
  check('sayfa: betik hatasız çalışır', true);
} catch (err) {
  check('sayfa: betik hatasız çalışır', false, err.stack);
}
if (page) {
  const { $, storage } = page;
  const link = () => $('url').textContent;
  check('sayfa: adresteki ayarlar denetimlere yansır', $('fallback').checked && $('machine').checked && $('hi').value === 'last' && $('clean').checked && $('limit').value === '10');
  check('sayfa: kurulum adresi ayarları taşır', link().includes('&max=10&fb=1&mt=0&hi=last&clean=1&auth=') && link().endsWith('/manifest.json'), link().slice(0, 140));
  $('fallback').checked = false; $('fallback').fire('change');
  $('machine').checked = false; $('machine').fire('change');
  $('hi').value = 'show'; $('hi').fire('change');
  $('clean').checked = false; $('clean').fire('change');
  $('limit').value = ''; $('limit').fire('change');
  check('sayfa: ayarlar kapatılınca adres eskisi gibi olur', link() === `${a.base}/languages=tr,en&ui=tr&auth=${auth}/manifest.json`, link().slice(0, 140));
  $('hi').value = 'hide'; $('hi').fire('change');
  check('sayfa: hi=hide adrese yazılır', link().includes('&ui=tr&hi=hide&auth='));
  check('sayfa: ayarlar tarayıcıda hatırlanır', JSON.parse(storage.get('saved')).hi === 'hide' && JSON.parse(storage.get('saved')).machine === true);
  const configured = await a.get(link().replace(a.base, '').replace('/manifest.json', '') + `/subtitles/movie/tt1000001/filename=${FILE}.json`);
  check('sayfanın ürettiği adres sunucuda çalışır', configured.subtitles.length === 11 && !configured.subtitles.some(isHi), configured.subtitles.length);

  check('sayfa: kaynak bağlıyken deneme butonu açık', $('test').disabled === false);
  const pending = $('test').fire('click');
  check('sayfa: deneme sürerken "Deneniyor…" yazar ve buton kapanır', $('testResult').children[0]?.textContent === STRINGS.tr.testRunning && $('test').disabled === true);
  await pending;
  const lines = $('testResult').children.map((p) => p.textContent);
  console.log(lines.map((l) => '   ' + l).join('\n'));
  check('sayfa: deneme sonuçları yazılır', lines.length === 4 && /^✓ OpenSubtitles: çalışıyor, örnek filmde 6 altyazı bulundu\. Bugün kalan indirme hakkın: 17\. \(\d+ ms\)$/.test(lines[0]) && lines[3].startsWith('✓ AltyazıDB: çalışıyor'), lines.join(' | '));
  check('sayfa: deneme bitince buton yeniden açılır', $('test').disabled === false);
  $('forget').fire('click');
  check('sayfa: bilgiler silinince sonuçlar temizlenir, buton kapanır', $('testResult').children.length === 0 && $('test').disabled === true);
}
// Tarayıcıda hatırlanan ayarlar, ayarsız açılan sayfaya yüklenir.
const restored = runPage(await a.text('/configure'), { auth, sources: { os: 'sahte-kullanici' }, selected: ['tr'], max: null, match: true, fallback: true, machine: false, hi: 'last', clean: true });
check('sayfa: hatırlanan yeni ayarlar yüklenir', restored.$('url').textContent.includes('languages=tr&ui=tr&fb=1&mt=0&hi=last&clean=1&auth='), restored.$('url').textContent.slice(0, 140));
const old = runPage(await a.text('/configure'), { auth, sources: { os: 'sahte-kullanici' }, selected: ['tr'], max: null, match: true });
check('sayfa: eski sürümde kaydedilmiş ayarlar bozulmaz', old.$('url').textContent === `${a.base}/languages=tr&ui=tr&auth=${auth}/manifest.json`, old.$('url').textContent.slice(0, 140));
await new Promise((resolve) => setTimeout(resolve, 300));
a.server.close();

check('hiçbir testte altyazı indirme hakkı harcayan istek yapılmadı', !calls.some((c) => c.includes('opensubtitles.com/api/v1/download')));
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
