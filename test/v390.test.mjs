// v3.9.0: Gestdown kaynağı ve çift dilli altyazı.
import { VERSION } from './setup.mjs';
// Hiçbir gerçek siteye istek gitmez; bütün dış servisler sahtedir.
import { createServer } from 'node:http';
import vm from 'node:vm';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { mergeSubtitles, withNotice } = await import('../src/subtitle.js');
const { LANGUAGES, gestdownCode } = await import('../src/languages.js');
const { STRINGS } = await import('../src/i18n.js');

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 600) : ''}`); };

// ---------- Örnek altyazılar ----------
const TR_SRT = [
  '1', '00:00:05,000 --> 00:00:07,000', 'Merhaba, nasılsın?', '',
  '2', '00:00:08,000 --> 00:00:10,000', 'İyiyim, teşekkürler.', 'Sen nasılsın?', '',
  '3', '00:00:20,000 --> 00:00:22,000', 'Güle güle.', '',
].join('\r\n') + '\r\n';
const EN_SRT = [
  '1', '00:00:05,100 --> 00:00:06,900', 'Hello, how are you?', '',
  '2', '00:00:08,200 --> 00:00:10,100', "<i>I'm fine,</i>", '{\\an8}thanks.', '',
  '3', '00:00:14,000 --> 00:00:15,000', 'Alone line.', '',
  '4', '00:00:20,000 --> 00:00:22,000', 'Goodbye.', '',
].join('\n') + '\n';
const MERGED = [
  '1', '00:00:05,000 --> 00:00:07,000', 'Merhaba, nasılsın?', '<i>Hello, how are you?</i>', '',
  '2', '00:00:08,000 --> 00:00:10,000', 'İyiyim, teşekkürler.', 'Sen nasılsın?', "<i>I'm fine, thanks.</i>", '',
  '3', '00:00:14,000 --> 00:00:15,000', '<i>Alone line.</i>', '',
  '4', '00:00:20,000 --> 00:00:22,000', 'Güle güle.', '<i>Goodbye.</i>', '',
].join('\n');
const NOTICE = 'İkinci dildeki altyazı alınamadı; yalnızca birinci dil gösteriliyor.';
const ALONE = [
  '1', '00:00:00,000 --> 00:00:04,800', NOTICE, '',
  '2', '00:00:05,000 --> 00:00:07,000', 'Merhaba, nasılsın?', '',
  '3', '00:00:08,000 --> 00:00:10,000', 'İyiyim, teşekkürler.', 'Sen nasılsın?', '',
  '4', '00:00:20,000 --> 00:00:22,000', 'Güle güle.', '',
].join('\n');
// Türkçe altyazı Gestdown'dan eski kodlamayla (windows-1254) gelir.
const WIN1254 = { 'ı': 0xfd, 'ş': 0xfe, 'ğ': 0xf0, 'İ': 0xdd, 'Ş': 0xde, 'Ğ': 0xd0 };
const win1254 = (text) => Uint8Array.from([...text].map((ch) => WIN1254[ch] ?? ch.charCodeAt(0)));

// ---------- Birleştirme (doğrudan) ----------
check('birleştirme: üstte birinci dil, altında italik ikinci dil; karşılığı olmayan satır tek başına', mergeSubtitles(TR_SRT, EN_SRT) === MERGED, '\n' + mergeSubtitles(TR_SRT, EN_SRT));
check('birleştirme: iki satırlı ikinci dil tek satıra iner, konum ve italik etiketleri atılır', MERGED.includes("<i>I'm fine, thanks.</i>") && !mergeSubtitles(TR_SRT, EN_SRT).includes('{\\an8}'));
check('birleştirme: tek satırlık hata mesajı altyazı sayılmaz', mergeSubtitles(TR_SRT, '1\n00:00:00,000 --> 00:00:15,000\nhata\n') === null && mergeSubtitles('1\n00:00:00,000 --> 00:00:15,000\nhata\n', EN_SRT) === null);
check('birleştirme: SRT olmayan metin birleştirilmez', mergeSubtitles(TR_SRT, 'düz metin') === null && mergeSubtitles('WEBVTT', EN_SRT) === null);
const shifted = EN_SRT.replace('00:00:05,100 --> 00:00:06,900', '00:00:06,800 --> 00:00:07,900');
check('birleştirme: çok az örtüşen satır birinci dilin altına yazılmaz', mergeSubtitles(TR_SRT, shifted).includes('00:00:06,800 --> 00:00:07,900\n<i>Hello, how are you?</i>'));
// Aynı videonun başka bir sürümü için hazırlanmış ikinci dil: bütün satırlar aynı süre kaymış.
const moveSrt = (text, ms) => text.replace(/(\d\d):(\d\d):(\d\d),(\d\d\d)/g, (_, h, m, s, f) => {
  const total = Math.max(0, ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(f) + ms);
  const pad = (n, size = 2) => String(n).padStart(size, '0');
  return `${pad(Math.floor(total / 3600000))}:${pad(Math.floor(total / 60000) % 60)}:${pad(Math.floor(total / 1000) % 60)},${pad(total % 1000, 3)}`;
});
const LONG_TR = Array.from({ length: 40 }, (_, i) => `${i + 1}\n${moveSrt('00:00:10,000 --> 00:00:12,000', i * 7300 + (i % 3) * 400)}\nSatır ${i + 1}\n`).join('\n');
const LONG_EN = LONG_TR.replaceAll('Satır', 'Line');
// Birinci dilin kaç satırının altına kendi karşılığı yazıldı?
const pairsOf = (text) => [...text.matchAll(/Satır (\d+)\n<i>Line (\d+)<\/i>/g)].filter((m) => m[1] === m[2]).length;
check('kayma: ikinci dil 2 saniye erkense düzeltilir, her satır kendi karşılığıyla eşleşir', pairsOf(mergeSubtitles(LONG_TR, moveSrt(LONG_EN, -2000))) === 40, pairsOf(mergeSubtitles(LONG_TR, moveSrt(LONG_EN, -2000))));
check('kayma: ikinci dil 9,5 saniye geçse de düzeltilir', pairsOf(mergeSubtitles(LONG_TR, moveSrt(LONG_EN, 9500))) === 40, pairsOf(mergeSubtitles(LONG_TR, moveSrt(LONG_EN, 9500))));
check('kayma: düzeltilen altyazıda birinci dilin zamanları değişmez', mergeSubtitles(LONG_TR, moveSrt(LONG_EN, -2000)) === mergeSubtitles(LONG_TR, LONG_EN));
// Kaydırma yapılmadığı, birinci dilde karşılığı olmayan satırın zamanından anlaşılır.
const EXTRA = '\n41\n00:10:00,000 --> 00:10:02,000\nExtra\n';
check('kayma: uyumlu altyazılara ve küçük farklara (0,1 sn) dokunulmaz', pairsOf(mergeSubtitles(LONG_TR, LONG_EN)) === 40 && pairsOf(mergeSubtitles(LONG_TR, moveSrt(LONG_EN + EXTRA, 100))) === 40 && mergeSubtitles(LONG_TR, moveSrt(LONG_EN + EXTRA, 100)).includes('00:10:00,100 --> 00:10:02,100\n<i>Extra</i>'));
const UNRELATED = Array.from({ length: 40 }, (_, i) => `${i + 1}\n${moveSrt('00:00:10,000 --> 00:00:11,000', i * 5100 + ((i * 7919) % 3300))}\nLine ${i + 1}\n`).join('\n');
check('kayma: birbirine benzemeyen altyazılar kaydırılmaz', UNRELATED.trim().split(/\n\n/).filter((cue) => mergeSubtitles(LONG_TR, UNRELATED).includes(cue.split('\n')[1].split(' --> ')[0])).length >= 20);
check('bilgi satırı: ilk konuşmadan önce biter', withNotice(TR_SRT, NOTICE) === ALONE, '\n' + withNotice(TR_SRT, NOTICE));
const early = TR_SRT.replace('00:00:05,000 --> 00:00:07,000', '00:00:01,000 --> 00:00:03,000');
check('bilgi satırı: ilk konuşma çok erkense altyazıya dokunulmaz', withNotice(early, NOTICE) === early && withNotice('düz metin', NOTICE) === 'düz metin');
check('diller: Gestdown 105 dilin 88\'inde aranır; kodu farklı olanlar çevrilir', LANGUAGES.length === 105 && LANGUAGES.filter((l) => gestdownCode(l.code)).length === 88
  && gestdownCode('tr') === 'tr' && gestdownCode('zh-cn') === 'zh-hans' && gestdownCode('pt-pt') === 'pt' && gestdownCode('pt-br') === 'pt-br' && gestdownCode('tl') === null && gestdownCode('yok') === null);

// ---------- Sahte siteler ----------
const realFetch = globalThis.fetch;
const calls = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const os = (o) => ({ attributes: { language: 'tr', legacy_subtitle_id: null, release: '', moviehash_match: false, from_trusted: false, ai_translated: false, machine_translated: false, download_count: 10, hearing_impaired: false, ...o, files: [{ file_id: o.file, file_name: 'x.srt' }] } });
const official = (id, lang, release = '') => ({ id: String(id), url: `https://subs5.strem.io/${lang}/download/file/${id}`, lang, movieReleaseName: release });
const SHOW = 'aaaaaaaa-0000-4000-8000-000000000001';
const SHOW_BUSY = 'aaaaaaaa-0000-4000-8000-000000000004';
const SHOW_TEST = 'aaaaaaaa-0000-4000-8000-0000000000bb';
const GD = { tr1: '11111111-1111-4111-8111-111111111111', tr2: '22222222-2222-4222-8222-222222222222', en1: '33333333-3333-4333-8333-333333333333', en2: '44444444-4444-4444-8444-444444444444' };
const gd = (id, version, o = {}) => ({ subtitleId: id, version, completed: true, hearingImpaired: false, corrected: false, hd: false, downloadUri: `/subtitles/download/${id}`, language: 'x', downloadCount: 10, source: 'Addic7ed', qualities: [], release: null, ...o });

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  // 3.10.1'dan beri AniSub varsayılan olarak açık; bu testlerde hiç altyazı vermez ve çağrı listesine yazılmaz.
  if (url.hostname === 'anisub.co') return new Response(JSON.stringify({ subtitles: [] }), { headers: { 'content-type': 'application/json' } });
  const q = url.searchParams;
  calls.push(`${init?.method || 'GET'} ${url.hostname}${url.pathname}?${q}`.replace(/api_key=[^&]*/, 'api_key=…'));
  switch (url.hostname) {
    case 'api.opensubtitles.com': {
      if (url.pathname === '/api/v1/login') return json({ token: 'sahte-oturum', user: { allowed_downloads: 20 } });
      if (url.pathname === '/api/v1/infos/user') return json({ data: { allowed_downloads: 20, remaining_downloads: 17 } });
      if (url.pathname !== '/api/v1/subtitles') throw new Error('hak harcayan istek yapılmamalı: ' + url.pathname);
      return json({ total_pages: 1, data: [
        os({ file: 1, legacy_subtitle_id: 9001, release: 'Ornek.Film.2024.1080p.WEB-DL.H264-FLUX', download_count: 5000 }),
        os({ file: 2, release: 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS', from_trusted: true, download_count: 9000 }),
        os({ file: 4, language: 'en', legacy_subtitle_id: 9004, release: 'Ornek.Film.2024.EXTENDED.BluRay-GRP' }),
        os({ file: 6, language: 'en', release: 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS' }),
      ] });
    }
    case 'opensubtitles-v3.strem.io':
      return json({ subtitles: [official(9001, 'tur'), official(9004, 'eng')] });
    case 'altyazidb.com': {
      if (url.pathname.endsWith('/me')) return json({ success: true });
      if (url.pathname.endsWith('/search')) {
        const item = (id, release, o = {}) => ({ id, language: q.get('lang'), releases: [release], hearing_impaired: 0, ai_ceviri: 0, downloads: 5, ...o });
        if (q.get('lang') === 'tr') {
          return json({ data: [
            item(700, 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS'),
            item(701, 'Ornek.Film.2024.1080p.WEB-DL.H264-FLUX'),
            item(702, 'Ornek.Film.2024.HDTV.x264-LOL', { hearing_impaired: 1 }),
            item(703, 'Ornek.Film.2024.DVDRip.XviD-OLD'),
          ] });
        }
        if (q.get('lang') === 'en') return json({ data: [item(800, 'Ornek.Film.2024.1080p.WEB-DL.H264-FLUX'), item(801, 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS')] });
        return json({ data: [] });
      }
      if (url.pathname.endsWith('/subtitle')) {
        const id = q.get('sub_id');
        if (id === '800') return json({ error: 'bakım' }, 503);
        const text = id.startsWith('8') ? EN_SRT : id === '702' ? TR_SRT.replace('Güle güle.', 'Güle güle. [kapı kapanır]') : TR_SRT;
        return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
      break;
    }
    case 'v3-cinemeta.strem.io': {
      if (url.pathname.startsWith('/catalog/')) {
        const query = decodeURIComponent(url.pathname.match(/search=([^/]*)\.json$/)?.[1] || '');
        if (query === 'hata') return json({ error: 'bakım' }, 500);
        if (query === 'yok') return json({ metas: [] });
        if (url.pathname.includes('/catalog/series/')) return json({ metas: [{ id: 'tt2000001', type: 'series', name: 'Ornek Dizi', releaseInfo: '2020-' }, { id: 'kitsu:1', type: 'series', name: 'Kimliği uymayan' }] });
        return json({ metas: [{ id: 'tt1000001', type: 'movie', name: 'Ornek Film', releaseInfo: '2024' }, { id: 'tt1000002', type: 'movie', name: 'Ornek Dizinin Yapımı', releaseInfo: '2021' }] });
      }
      if (url.pathname.startsWith('/meta/movie/')) return json({ meta: {} });
      const tvdb = { tt2000001: 555001, tt2000003: 555003, tt2000004: 555004 }[url.pathname.match(/tt\d+/)?.[0]];
      return json({ meta: { id: url.pathname.match(/tt\d+/)?.[0], name: 'Ornek Dizi', releaseInfo: '2020-', genres: ['Drama'], ...(tvdb ? { tvdb_id: tvdb } : {}), videos: [{ season: 1, episode: 1 }, { season: 1, episode: 2 }] } });
    }
    case 'api.gestdown.info': {
      const path = url.pathname.split('/').filter(Boolean);
      if (path[0] === 'shows' && path[1] === 'external' && path[2] === 'tvdb') {
        const id = { 555001: SHOW, 555004: SHOW_BUSY, 81189: SHOW_TEST }[path[3]];
        return id ? json({ shows: [{ id, name: 'Ornek Dizi', tvDbId: Number(path[3]) }] }) : json({ error: 'not found' }, 404);
      }
      if (path[0] === 'subtitles' && path[1] === 'get') {
        const [showId, season, episode, lang] = path.slice(2);
        if (showId === SHOW_BUSY) return json({ message: 'Refreshing the show' }, 423);
        if (showId === SHOW_TEST) return json({ matchingSubtitles: lang === 'en' && season === '1' && episode === '1' ? [gd(GD.en1, 'a'), gd(GD.en2, 'b'), gd(GD.tr1, 'c')] : [] });
        if (showId !== SHOW || season !== '1' || episode !== '2') return json({ matchingSubtitles: [] });
        if (lang === 'tr') {
          return json({ matchingSubtitles: [
            gd(GD.tr1, ' WEB.FLUX ', { downloadCount: 50 }),
            gd(GD.tr2.toUpperCase(), 'HDTV.KILLERS', { hearingImpaired: true }),
            gd('55555555-5555-4555-8555-555555555555', 'YARIM', { completed: false }),
            gd('bozuk-kimlik', 'BOZUK'),
          ] });
        }
        if (lang === 'en') return json({ matchingSubtitles: [gd(GD.en1, 'WEB.FLUX'), gd(GD.en2, 'HDTV.KILLERS')] });
        return json({ matchingSubtitles: [] });
      }
      if (path[0] === 'subtitles' && path[1] === 'download') {
        if (path[2] === GD.en2) return json({ message: 'bozuk' }, 500);
        const body = path[2] === GD.en1 ? new TextEncoder().encode(EN_SRT) : win1254(TR_SRT);
        return new Response(body, { headers: { 'content-type': 'text/srt' } });
      }
      break;
    }
  }
  throw new Error('beklenmeyen dış istek: ' + url.hostname + url.pathname);
};

const start = async () => {
  const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '' })).listen(0, '127.0.0.1');
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
// OpenSubtitles hesabı + AltyazıDB anahtarı (ikisi de sahte).
const auth = sealer.seal({ u: 'sahte-kullanici', p: 'sahte-sifre', ad: 'sahte-altyazidb-1234' });
const osOnly = sealer.seal({ u: 'sahte-kullanici', p: 'sahte-sifre' });
const seg = (options = '', languages = 'tr,en', key = auth) => `languages=${languages}&ui=tr${options}${key ? `&auth=${key}` : ''}`;
const FILE = encodeURIComponent('Ornek.Film.2024.1080p.BluRay.x264-SPARKS.mkv');
const show = (list) => console.log(list.map((s) => `   ${s.lang} | ${s.label}`).join('\n'));
const isDual = (s) => s.url.includes('/dual/');
const refs = (s) => JSON.parse(Buffer.from(s.url.match(/\/dual\/([\w-]+)\.srt$/)[1], 'base64url').toString());
const token = (list) => Buffer.from(JSON.stringify(list)).toString('base64url');
const gdCalls = () => calls.filter((c) => c.includes('api.gestdown.info'));
const a = await start();
const movie = (options, languages, key) => a.get(`/${seg(options, languages, key)}/subtitles/movie/tt1000001/filename=${FILE}.json`).then((res) => res.subtitles);
const series = (id, options = '&gd=1', languages = 'tr,en', key = null) => a.get(`/${seg(options, languages, key)}/subtitles/series/${id}.json`);

// ---------- Varsayılan davranış değişmedi ----------
const health = await a.get('/api/health');
check('sürüm 3.9.0', health.version === VERSION && (await a.get(`/${seg()}/manifest.json`)).version === VERSION, JSON.stringify(health));
const base = await movie();
show(base);
check('varsayılan: çift dilli altyazı ve Gestdown yok, adresler eskisi gibi', base.length === 10 && !base.some(isDual) && !base.some((s) => s.url.includes('/gd/')) && base.filter((s) => !s.url.includes('strem.io')).every((s) => s.url.startsWith(`${a.base}/languages=tr,en&ui=tr&auth=${auth}/`)), base.length);
let res = await series('tt2000001:1:2', '', 'tr,en', auth);
check('varsayılan: gd=1 yokken dizilerde Gestdown\'a hiç istek gitmez', gdCalls().length === 0 && !res.subtitles.some((s) => s.url.includes('/gd/')));
res = await a.get('/languages=tr,en&ui=tr/subtitles/movie/tt1000001.json');
check('kaynaksız adres eskisi gibi kurulum uyarısı verir', res.subtitles.length === 1 && res.subtitles[0].id === 'subpool-setup-required' && res.cacheMaxAge === 0, JSON.stringify(res).slice(0, 200));

// ---------- Gestdown ----------
calls.length = 0;
res = await series('tt2000001:1:2');
show(res.subtitles);
let list = res.subtitles;
check('Gestdown tek başına kaynak sayılır (hesap/anahtar yok): 2 Türkçe + 2 İngilizce', list.length === 4 && list.filter((s) => s.lang === 'tur').length === 2 && res.cacheMaxAge > 60, JSON.stringify(res).slice(0, 300));
check('Gestdown: etiket, sürüm adı ve HI', list[0].label === '[Gestdown] ✓ Ücretsiz | WEB.FLUX' && list[1].label === '[Gestdown] ✓ Ücretsiz · HI | HDTV.KILLERS', list.map((s) => s.label).join(' / '));
check('Gestdown: yarım çeviri ve bozuk kimlik listeye alınmaz', !list.some((s) => s.label.includes('YARIM') || s.label.includes('BOZUK')));
check('Gestdown: dosya adresinde şifreli parça yok, kimlik küçük harfli', list[0].url === `${a.base}/languages=tr,en&ui=tr/gd/tr/${GD.tr1}.srt` && list[1].url.endsWith(`/gd/tr/${GD.tr2}.srt`), list[0].url);
check('Gestdown: dizi TheTVDB numarasıyla, bölüm dil diliyle sorulur', gdCalls().length === 3 && gdCalls().some((c) => c.includes('/shows/external/tvdb/555001')) && gdCalls().some((c) => c.includes(`/subtitles/get/${SHOW}/1/2/tr`)) && gdCalls().some((c) => c.includes(`/subtitles/get/${SHOW}/1/2/en`)), gdCalls().join(' | '));
check('Gestdown: başka hiçbir siteye (OpenSubtitles, SubDL…) istek gitmez', calls.every((c) => c.includes('api.gestdown.info') || c.includes('v3-cinemeta.strem.io')), calls.join(' | '));
const manifest = await a.get('/languages=tr,en&ui=tr&gd=1/manifest.json');
check('Gestdown: kurulum adresi hesap olmadan da geçerli', manifest.behaviorHints.configurationRequired === false && manifest.description.includes('Gestdown'), manifest.description);
calls.length = 0;
await series('tt2000001:1:2');
check('Gestdown: aynı bölüm yeniden sorulunca önbellekten gelir', calls.length === 0, calls.join(' | '));
let file = await realFetch(list[0].url).then((r) => r.text());
check('Gestdown: dosya açılır, eski kodlamadaki Türkçe harfler düzelir', file.includes('Merhaba, nasılsın?') && file.includes('İyiyim, teşekkürler.') && file.includes('Güle güle.'), file.slice(0, 120));
await realFetch(list[0].url);
check('Gestdown: dosya bir kez indirilir, sonra önbellekten verilir', gdCalls().filter((c) => c.includes('/subtitles/download/')).length === 1);
res = await a.text(`/languages=tr&ui=tr&gd=1/gd/tr/${GD.en2}.srt`);
check('Gestdown: indirilemeyen dosya oynatıcıda hata mesajı olarak görünür', res.includes('00:00:00,000 --> 00:00:15,000') && res.includes('Gestdown 500'), res);
res = await realFetch(`${a.base}/languages=tr&ui=tr&gd=1/gd/tr/kotu-kimlik.srt`);
check('Gestdown: geçersiz kimlik reddedilir', res.status === 404, res.status);

calls.length = 0;
res = await a.get(`/${seg('&gd=1', 'tr,en', null)}/subtitles/movie/tt1000001/filename=${FILE}.json`);
check('Gestdown: filmlerde aranmaz, liste boş döner', res.subtitles.length === 0 && calls.length === 0, calls.join(' | '));
res = await series('tt2000002:1:2');
check('Gestdown: TheTVDB numarası olmayan dizi → boş liste, Gestdown\'a istek yok', res.subtitles.length === 0 && gdCalls().length === 0);
res = await series('tt2000003:1:2');
check('Gestdown: dizi Gestdown\'da yoksa boş liste', res.subtitles.length === 0 && gdCalls().length === 1 && res.cacheMaxAge > 60, gdCalls().join(' | '));
res = await series('tt2000004:1:2');
check('Gestdown: dizi yenileniyorsa (423) liste boş ve yalnızca 1 dakika saklanır', res.subtitles.length === 0 && res.cacheMaxAge === 60, JSON.stringify(res));
res = await series('tt2000001:1:9');
check('Gestdown: altyazısı olmayan bölüm → boş liste', res.subtitles.length === 0);
calls.length = 0;
await series('tt2000001:1:2', '&gd=1', 'zh-cn,pt-pt,tl');
check('Gestdown: dil kodları çevrilir (zh-cn → zh-hans, pt-pt → pt), tanınmayan dil sorulmaz', gdCalls().length === 2 && gdCalls().some((c) => c.endsWith('/1/2/zh-hans?')) && gdCalls().some((c) => c.endsWith('/1/2/pt?')), gdCalls().join(' | '));
calls.length = 0;
res = await series('tt2000001:1:2', '&gd=1', 'tr,en', auth);
check('Gestdown diğer kaynakların yanında da çalışır', res.subtitles.filter((s) => s.url.includes('/gd/')).length === 4 && res.subtitles.find((s) => s.url.includes('/gd/')).url.includes(`&auth=${auth}/gd/tr/`), res.subtitles.length);

// ---------- Çift dilli altyazı ----------
list = await movie('&dual=1');
show(list);
const dual = list.filter(isDual);
check('çift dilli: listenin başına en fazla 3 altyazı eklenir', dual.length === 3 && list.slice(0, 3).every(isDual) && !list.slice(3).some(isDual));
check('çift dilli: kalan liste aynen durur', JSON.stringify(list.slice(3)) === JSON.stringify(base));
check('çift dilli: etiket ve dil', dual[0].label === '[Çift dilli] ✓ Ücretsiz · Türkçe + İngilizce · Sürüm adı uyuyor | Ornek.Film.2024.1080p.BluRay.x264-SPARKS' && dual[1].label === '[Çift dilli] ✓ Ücretsiz · Türkçe + İngilizce | Ornek.Film.2024.1080p.WEB-DL.H264-FLUX' && dual.every((s) => s.lang === 'tur'), dual.map((s) => s.label).join(' / '));
console.log('   ' + dual.map((s) => JSON.stringify(refs(s))).join(' '));
check('çift dilli: birinci dilin altyazısı, ikinci dilde aynı sürümün altyazısıyla eşlenir', JSON.stringify(refs(dual[0])) === '["adb/tr/700-0-0.srt","adb/en/801-0-0.srt"]' && JSON.stringify(refs(dual[1])) === '["adb/tr/701-0-0.srt","adb/en/800-0-0.srt"]');
check('çift dilli: "Resmi" ve hak harcayan altyazılar hiç kullanılmaz', dual.every((s) => refs(s).every((ref) => ref.startsWith('adb/'))) && dual.every((s) => s.url.startsWith(`${a.base}/languages=tr,en&ui=tr&auth=${auth}/dual/`)));
check('çift dilli: HI işareti birinci dilin altyazısından gelir', list.filter(isDual).filter((s) => s.label.includes(' · HI | ')).length === dual.filter((s) => refs(s)[0].includes('/702-')).length);
file = await realFetch(dual[0].url).then((r) => r.text());
check('çift dilli: dosyada iki dil birlikte', file === MERGED, '\n' + file);
file = await realFetch(dual[1].url).then((r) => r.text());
check('çift dilli: ikinci dil alınamazsa birinci dil tek başına + bilgi satırı', file === ALONE, '\n' + file);

list = await movie('&dual=1&max=1');
check('çift dilli: dil başına sınıra dahil değildir', list.filter(isDual).length === 3 && list.filter((s) => !isDual(s) && s.lang === 'tur').length >= 1 && list.length < 10, list.length);
list = await movie('&dual=1&hi=hide');
check('çift dilli: gizlenen HI altyazılar birleştirilmez', list.filter(isDual).length === 3 && !list.filter(isDual).some((s) => refs(s)[0].includes('/702-')));
list = await movie('&dual=1', 'tr');
check('çift dilli: tek dil seçiliyse üretilmez', !list.some(isDual));
list = await movie('&dual=1', 'tr,de');
check('çift dilli: ikinci dilde uygun altyazı yoksa üretilmez', !list.some(isDual));
list = await movie('&dual=1', 'en,tr');
check('çift dilli: diller sıraya göre (önce İngilizce)', list.filter(isDual).length === 2 && list[0].label.startsWith('[Çift dilli] ✓ Ücretsiz · İngilizce + Türkçe · Sürüm adı uyuyor | ') && list[0].lang === 'eng' && refs(list[0])[0].startsWith('adb/en/'), list[0].label);
list = await movie('&dual=1', 'tr,en', osOnly);
check('çift dilli: yalnızca OpenSubtitles bağlıyken (Resmi + hak harcayan) üretilmez', list.length === 4 && !list.some(isDual), list.length);
list = await movie('&dual=1&clean=1');
file = await realFetch(list.find((s) => isDual(s) && refs(s)[0].includes('/702-')).url).then((r) => r.text());
check('çift dilli + temizlik: adres ayarı taşır, açıklamalar birleşik dosyada da silinir', list.filter(isDual).every((s) => s.url.includes('&clean=1&auth=')) && file.includes('Güle güle.\n<i>Goodbye.</i>') && !file.includes('['), '\n' + file);

// Çift dilli adres hak harcayan bir altyazıyı gösterecek biçimde elle değiştirilse bile hak harcanmaz.
calls.length = 0;
res = await a.text(`/${seg()}/dual/${token(['sub/tr/tt1000001/2.srt', 'adb/en/801-0-0.srt'])}.srt`);
check('çift dilli: önbellekte olmayan OpenSubtitles dosyası indirilmez (birinci dil)', res.includes('bad link') && !calls.some((c) => c.includes('api.opensubtitles.com')), res + calls.join(' | '));
res = await a.text(`/${seg()}/dual/${token(['adb/tr/700-0-0.srt', 'sub/en/tt1000001/6.srt'])}.srt`);
check('çift dilli: önbellekte olmayan OpenSubtitles dosyası indirilmez (ikinci dil)', res === ALONE && !calls.some((c) => c.includes('api.opensubtitles.com')), res + calls.join(' | '));
for (const [name, bad] of [['iç içe çift dilli adres', token([`dual/${token(['adb/tr/700-0-0.srt', 'adb/en/801-0-0.srt'])}.srt`, 'adb/en/801-0-0.srt'])], ['tek yol', token(['adb/tr/700-0-0.srt'])], ['metin olmayan yol', token([1, 2])], ['bozuk veri', 'bozuk'], ['tanınmayan yol', token(['x/y/z.srt', 'adb/en/801-0-0.srt'])], ['bozuk kodlama', token(['adb/%E0/700-0-0.srt', 'adb/en/801-0-0.srt'])]]) {
  res = await a.text(`/${seg()}/dual/${bad}.srt`);
  check(`çift dilli: ${name} → hata mesajı`, res.includes('00:00:00,000 --> 00:00:15,000') && res.includes('bad link'), res);
}

// Gestdown altyazıları da birleştirilir (hesap ve anahtar olmadan).
res = await series('tt2000001:1:2', '&gd=1&dual=1');
show(res.subtitles);
list = res.subtitles;
check('çift dilli + Gestdown: 2 birleşik + 4 tekil altyazı', list.length === 6 && list.filter(isDual).length === 2 && list[0].label === '[Çift dilli] ✓ Ücretsiz · Türkçe + İngilizce | WEB.FLUX' && list[1].label === '[Çift dilli] ✓ Ücretsiz · Türkçe + İngilizce · HI | HDTV.KILLERS', list.map((s) => s.label).join(' / '));
check('çift dilli + Gestdown: aynı sürümler eşlenir', JSON.stringify(refs(list[0])) === JSON.stringify([`gd/tr/${GD.tr1}.srt`, `gd/en/${GD.en1}.srt`]) && JSON.stringify(refs(list[1])) === JSON.stringify([`gd/tr/${GD.tr2}.srt`, `gd/en/${GD.en2}.srt`]));
file = await realFetch(list[0].url).then((r) => r.text());
check('çift dilli + Gestdown: dosyada iki dil birlikte', file === MERGED, '\n' + file);
file = await realFetch(list[1].url).then((r) => r.text());
check('çift dilli + Gestdown: ikinci dil indirilemezse birinci dil tek başına', file === ALONE, '\n' + file);

// ---------- Kaynak denemesi ----------
calls.length = 0;
res = await a.post('/api/test', { languages: ['tr', 'en', 'tl'], gestdown: true });
console.log('   ' + JSON.stringify(res.data));
check('deneme: Gestdown tek başına denenir, örnek dizi bölümü aranır', res.status === 200 && res.data.results.length === 1 && res.data.results[0].source === 'gestdown' && res.data.results[0].status === 'ok' && res.data.results[0].count === 3 && res.data.results[0].series === true, JSON.stringify(res.data));
check('deneme: Breaking Bad 1. sezon 1. bölüm, yalnızca arama', gdCalls().length === 3 && gdCalls().some((c) => c.includes('/shows/external/tvdb/81189')) && gdCalls().every((c) => !c.includes('/download')) && gdCalls().filter((c) => c.includes(`/subtitles/get/${SHOW_TEST}/1/1/`)).length === 2, gdCalls().join(' | '));
res = await a.post('/api/test', { auth, languages: ['tr', 'en'], gestdown: true });
check('deneme: Gestdown diğer kaynaklarla birlikte', res.data.results.map((r) => r.source).join(',') === 'os,altyazidb,gestdown' && res.data.results.every((r) => r.status === 'ok'), JSON.stringify(res.data));
res = await a.post('/api/test', { auth, languages: ['tr', 'en'] });
check('deneme: Gestdown kapalıyken denenmez', res.data.results.map((r) => r.source).join(',') === 'os,altyazidb', JSON.stringify(res.data));
res = await a.post('/api/test', { languages: ['tr'], gestdown: '1' });
check('deneme: bozuk gestdown değeri → kapalı sayılır', res.data.results.length === 0);

// ---------- Ayar sayfası ----------
const downloads = [];
const blobs = [];
class FakeURL extends URL {
  static createObjectURL(blob) { blobs.push(blob); return 'blob:' + blobs.length; }
  static revokeObjectURL() {}
}
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
    document: { getElementById: $, querySelectorAll: () => [], createElement: () => element(null), documentElement: {}, body: { append: (el) => downloads.push(el) } },
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    navigator: { languages: ['tr-TR'], clipboard: { writeText: async () => {} } },
    Option: function Option(text, value) { this.text = text; this.value = value; },
    fetch: (url, init = {}) => (String(url).startsWith('http://127.0.0.1') ? realFetch(url, { ...init, headers: { ...init.headers, 'x-forwarded-for': '10.0.0.7' } }) : globalThis.fetch(url, init)),
    Intl, setTimeout, setInterval: () => 0, clearInterval() {}, performance: { now: () => 0 }, location: { hash: '', pathname: '/configure', search: '' }, history: { replaceState() {} }, addEventListener() {}, matchMedia: () => ({ matches: false }), console, JSON, Object, Array, Map, Set, String, Number, Boolean, Promise, URL: FakeURL, Blob,
  });
  for (const code of [...pageHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1])) vm.runInContext(code, context);
  return { $, storage };
}
const html = await a.text('/languages=tr,en&ui=tr&gd=1&dual=1/configure');
check('sayfa: yeni denetimler var', ['id="gestdownPanel"', 'id="gestdown"', 'id="dual"', 'data-i18n="gestdownIntro"', 'data-i18n="dualHint"', 'data-i18n="howGestdown"', 'data-i18n="howDual"'].every((s) => html.includes(s)));
check('sayfa: sunucuya özel metin (dualMissing) sayfaya gömülmez', !html.includes('dualMissing') && !html.includes(NOTICE));
const keys = Object.keys(STRINGS.tr);
check('metinler: 12 dilde aynı anahtarlar, boş metin yok', Object.keys(STRINGS).length === 12 && Object.values(STRINGS).every((s) => JSON.stringify(Object.keys(s)) === JSON.stringify(keys) && Object.values(s).every((v) => (Array.isArray(v) ? v.length : v))));
check('metinler: yer tutucular her dilde aynı', Object.values(STRINGS).every((s) => keys.every((k) => JSON.stringify(String(s[k]).match(/\{\w+\}/g)?.sort()) === JSON.stringify(String(STRINGS.tr[k]).match(/\{\w+\}/g)?.sort()))));
check('metinler: 12 dilde Gestdown etiketi ve örnek dizi adı', Object.values(STRINGS).every((s) => s.tagGestdown.startsWith('[Gestdown] ✓ ') && s.tagDual.startsWith('[') && s.testOkSeries.includes('Breaking Bad') && s.testEmptySeries.includes('Breaking Bad') && s.gestdownIntro.includes('api.gestdown.info')));
check('sayfa: "açık kaynak" denmez', !/açık kaynak|open[- ]source/i.test(html));
let page;
try {
  page = runPage(html);
  check('sayfa: betik hatasız çalışır', true);
} catch (err) {
  check('sayfa: betik hatasız çalışır', false, err.stack);
}
if (page) {
  const { $, storage } = page;
  const link = () => $('url').textContent;
  check('sayfa: adresteki ayarlar kutulara yansır', $('gestdown').checked === true && $('dual').checked === true);
  check('sayfa: hesap olmadan, yalnızca Gestdown ile kurulum adresi oluşur', link() === `${a.base}/languages=tr,en&ui=tr&gd=1&dual=1/manifest.json` && $('needSetup').hidden === true && $('copy').disabled === false && $('install').href === link().replace('http://', 'stremio://'), link());
  check('sayfa: silinecek hesap bilgisi olmadığı için "sil" butonu gizli, deneme butonu açık', $('forget').hidden === true && $('test').disabled === false);
  const configured = await a.get(link().replace(a.base, '').replace('/manifest.json', '') + '/subtitles/series/tt2000001:1:2.json');
  check('sayfanın ürettiği adres sunucuda çalışır', configured.subtitles.length === 6 && configured.subtitles.filter(isDual).length === 2, configured.subtitles.length);
  const pending = $('test').fire('click');
  check('sayfa: deneme sürerken buton kapanır', $('test').disabled === true);
  await pending;
  const lines = $('testResult').children.map((p) => p.textContent);
  console.log(lines.map((l) => '   ' + l).join('\n'));
  check('sayfa: Gestdown deneme sonucu örnek diziyi söyler', lines.length === 1 && /^✓ Gestdown: çalışıyor, örnek dizi bölümünde \(Breaking Bad, 1\. sezon 1\. bölüm\) 3 altyazı bulundu\. \(\d+ ms\)$/.test(lines[0]), lines.join(' | '));
  $('dual').checked = false; $('dual').fire('change');
  check('sayfa: çift dilli kapatılınca adresten çıkar, deneme sonucu durur', link() === `${a.base}/languages=tr,en&ui=tr&gd=1/manifest.json` && $('testResult').children.length === 1, link());
  check('sayfa: ayarlar tarayıcıda hatırlanır', JSON.parse(storage.get('saved')).gestdown === true && JSON.parse(storage.get('saved')).dual === false);
  $('gestdown').checked = false; $('gestdown').fire('change');
  check('sayfa: Gestdown kapatılınca kaynak kalmaz: adres yok, uyarı görünür, deneme sonucu silinir', link() === '—' && $('needSetup').hidden === false && $('copy').disabled === true && $('test').disabled === true && $('testResult').children.length === 0, link());
  $('gestdown').checked = true; $('gestdown').fire('change');
  check('sayfa: Gestdown yeniden açılınca adres geri gelir', link() === `${a.base}/languages=tr,en&ui=tr&gd=1/manifest.json`);
}
// Hesap bağlıyken ayarlar şifreli parçadan önce yazılır.
page = runPage(await a.text(`/${seg('&max=10&clean=1&gd=1&dual=1')}/configure`));
check('sayfa: hesapla birlikte adres sırası', page.$('url').textContent === `${a.base}/languages=tr,en&ui=tr&max=10&clean=1&gd=1&dual=1&auth=${auth}/manifest.json`, page.$('url').textContent.slice(0, 160));
{
  const pending = page.$('test').fire('click');
  await pending;
  const lines = page.$('testResult').children.map((p) => p.textContent);
  console.log(lines.map((l) => '   ' + l).join('\n'));
  check('sayfa: deneme hesap + Gestdown için ayrı satırlar yazar', lines.length === 3 && lines[0].startsWith('✓ OpenSubtitles: çalışıyor, örnek filmde') && lines[2].startsWith('✓ Gestdown: çalışıyor, örnek dizi bölümünde'), lines.join(' | '));
}
page = runPage(await a.text(`/${seg()}/configure`));
check('sayfa: ayarlar kapalıyken adres eskisiyle aynı', page.$('url').textContent === `${a.base}/languages=tr,en&ui=tr&auth=${auth}/manifest.json` && page.$('gestdown').checked === false && page.$('dual').checked === false);
// Tarayıcıda hatırlanan ayarlar, ayarsız açılan sayfaya yüklenir.
page = runPage(await a.text('/configure'), { auth: null, sources: { os: null }, selected: ['tr', 'en'], max: null, match: true, gestdown: true, dual: true });
check('sayfa: hesapsız hatırlanan ayarlar (Gestdown + çift dilli) yüklenir', page.$('url').textContent === `${a.base}/languages=tr,en&ui=tr&gd=1&dual=1/manifest.json`, page.$('url').textContent);
page = runPage(await a.text('/configure'), { auth, sources: { os: 'sahte-kullanici' }, selected: ['tr'], max: null, match: true });
check('sayfa: eski sürümde kaydedilmiş ayarlar bozulmaz', page.$('url').textContent === `${a.base}/languages=tr&ui=tr&auth=${auth}/manifest.json`, page.$('url').textContent.slice(0, 140));
page = runPage(await a.text('/configure'));
check('sayfa: ilk kez gelen kullanıcıda iki ayar da kapalı, adres yok', page.$('gestdown').checked === false && page.$('dual').checked === false && page.$('url').textContent === '—');

// ---------- Altyazı ara ve indir (ayar sayfası) ----------
{
  const flush = () => new Promise((resolve) => setTimeout(resolve, 50));
  const texts = (id, p) => p.$(id).children.map((c) => c.textContent);
  const rows = (p) => p.$('findSubs').children.map((li) => ({ text: (li.children[0].children[0].children.map((c) => c.textContent).join('') + ' | ' + li.children[0].children[1].textContent), button: li.children[1] }));
  const search = async (p, query) => { p.$('findQuery').value = query; await p.$('findForm').fire('submit'); };
  // Hazır olmayan sayfada arama kutusu yerine kurulum uyarısı görünür.
  let p = runPage(await a.text('/configure'));
  check('arama: kaynak yokken arama kutusu gizli, uyarı görünür', p.$('findForm').hidden === true && p.$('findSetup').hidden === false);
  check('arama: açıklama gerçek etiketleri kullanır', (p.$('findSum').textContent + ' ' + p.$('findRest').textContent).includes('"[OpenSubtitles] 1 hak harcar"') && (p.$('findSum').textContent + ' ' + p.$('findRest').textContent).includes('"[OpenSubtitles] ✓ Ücretsiz · Resmi"') && (p.$('findSum').textContent + ' ' + p.$('findRest').textContent).includes('v3-cinemeta.strem.io'));

  // Hesapsız, yalnızca Gestdown + çift dilli.
  p = runPage(await a.text('/languages=tr,en&ui=tr&gd=1&dual=1/configure'));
  check('arama: kaynak varken arama kutusu görünür', p.$('findForm').hidden === false && p.$('findSetup').hidden === true);
  calls.length = 0;
  await search(p, 'ornek dizi');
  check('arama: film ve dizi birlikte aranır, adı tam tutan öne gelir', JSON.stringify(p.$('findTitles').children.map((c) => c.title)) === JSON.stringify(['Ornek Dizi (2020-) · Dizi', 'Ornek Dizinin Yapımı (2021) · Film', 'Ornek Film (2024) · Film']), JSON.stringify(p.$('findTitles').children.map((c) => c.title)));
  check('arama: aramalar Cinemeta\'ya gider, hesap bilgisi gitmez', calls.length === 2 && calls.every((c) => c.startsWith('GET v3-cinemeta.strem.io/catalog/') && c.includes('search=ornek%20dizi')), calls.join(' | '));
  await p.$('findTitles').children[0].fire('click');
  check('arama: dizi seçilince sezon ve bölüm listesi gelir', p.$('findEpisode').hidden === false && p.$('findSeason').children.map((o) => o.value).join() === '1' && p.$('findEp').children.map((o) => o.value).join() === '1,2');
  p.$('findEp').value = '2';
  p.$('findEp').fire('change');
  await p.$('findList').fire('click');
  let list = rows(p);
  console.log(list.map((r) => '   ' + r.text).join('\n'));
  check('arama: bölümün altyazıları kurulum adresindeki ayarlarla gelir', list.length === 6 && list.filter((r) => r.text.includes('[Çift dilli]')).length === 2 && list[0].text.startsWith('Türkçe · [Çift dilli]'), list.length);
  const before = downloads.length;
  await list[0].button.fire('click');
  const saved = downloads.slice(before);
  const savedText = saved.length ? await blobs[blobs.length - 1].text() : '';
  check('arama: çift dilli altyazı dosya olarak kaydedilir', saved.length === 1 && saved[0].clicked && saved[0].download === 'Ornek Dizi S01E02.dual.tur.srt' && savedText.includes('<i>') && blobs[blobs.length - 1].type === 'application/x-subrip', saved[0]?.download);
  check('arama: indirilen satırda "İndirildi ✓" yazar', rows(p)[0].button.textContent === 'İndirildi ✓' && rows(p)[1].button.textContent === 'İndir');
  const gdRow = rows(p).find((r) => r.text.startsWith('İngilizce · [Gestdown]') && r.text.includes('WEB.FLUX'));
  await gdRow.button.fire('click');
  check('arama: Gestdown altyazısı dil koduyla kaydedilir', downloads[downloads.length - 1].download === 'Ornek Dizi S01E02.eng.srt' && (await blobs[blobs.length - 1].text()).includes('Hello'), downloads[downloads.length - 1].download);
  p.$('dual').checked = false; p.$('dual').fire('change');
  check('arama: ayar değişince eski liste kaldırılır, seçim durur', p.$('findSubs').hidden === true && p.$('findEpisode').hidden === false);
  await p.$('findList').fire('click');
  check('arama: yeni ayarla yeniden getirilir (çift dilli yok)', rows(p).length === 4 && !rows(p).some((r) => r.text.includes('[Çift dilli]')), rows(p).length);
  await search(p, 'yok');
  check('arama: sonuç yoksa söylenir, eski liste temizlenir', p.$('findMsg').textContent === 'Sonuç bulunamadı.' && p.$('findTitles').children.length === 0 && p.$('findSubs').hidden === true && p.$('findEpisode').hidden === true);
  await search(p, 'hata');
  check('arama: Cinemeta yanıt vermezse hata yazılır', p.$('findMsg').textContent === 'Sunucuya ulaşılamadı, tekrar dene.' && p.$('findMsg').className.includes('error'));
  await search(p, 'https://www.imdb.com/title/tt2000001/');
  check('arama: IMDb adresi ya da numarası da kabul edilir', JSON.stringify(p.$('findTitles').children.map((c) => c.title)) === JSON.stringify(['Ornek Dizi (2020-) · Dizi']), JSON.stringify(p.$('findTitles').children.map((c) => c.title)));

  // Hesap bağlı: "Resmi" altyazılar listelenmez, hata dönen altyazı kaydedilmez.
  p = runPage(await a.text(`/${seg()}/configure`));
  await search(p, 'ornek film');
  await p.$('findTitles').children.find((c) => c.title.startsWith('Ornek Film')).fire('click');
  list = rows(p);
  console.log(list.map((r) => '   ' + r.text).join('\n'));
  const server = await a.get(`/${seg()}/subtitles/movie/tt1000001.json`);
  check('arama: film seçilince altyazılar hemen gelir, "Resmi" olanlar çıkarılır', list.length === server.subtitles.filter((s) => !s.url.includes('strem.io')).length && list.length > 0 && server.subtitles.some((s) => s.url.includes('subs5.strem.io')) && !list.some((r) => r.text.includes('Resmi')), `${list.length}/${server.subtitles.length}`);
  check('arama: hak harcayan altyazı etiketiyle görünür', list.some((r) => r.text.includes('[OpenSubtitles] 1 hak harcar')));
  const bad = list.find((r) => r.text.startsWith('İngilizce · [AltyazıDB]') && r.text.includes('FLUX'));
  const count = downloads.length;
  await bad.button.fire('click');
  check('arama: altyazı yerine uyarı dönerse dosya kaydedilmez, uyarı sayfada yazar', downloads.length === count && p.$('findMsg').textContent.startsWith('Altyazı alınamadı:') && p.$('findMsg').className.includes('error'), p.$('findMsg').textContent);
}

await new Promise((resolve) => setTimeout(resolve, 300));
a.server.close();
check('hiçbir testte altyazı indirme hakkı harcayan istek yapılmadı', !calls.some((c) => c.includes('opensubtitles.com/api/v1/download')));
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
