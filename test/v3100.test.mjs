// v3.10.1: kalan hak, öne alınacak kaynak, kare hızı farkı, indirirken kaydırma.
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
let infoFails = false;
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
      if (url.pathname === '/api/v1/infos/user') return infoFails ? json({ message: 'bakım' }, 500) : json({ data: { allowed_downloads: 20, remaining_downloads: 17 } });
      // Sahte indirme: gerçek siteye gitmez, hak harcanmaz. 2 → kalan 12, 4 → sunucu hatası, 6 → günlük hak bitti.
      if (url.pathname === '/api/v1/download') {
        const fileId = JSON.parse(init.body).file_id;
        if (fileId === 4) return json({ message: 'bakım' }, 500);
        if (fileId === 6) return json({ message: 'limit', remaining: 0, reset_time_utc: '2030-01-01T00:00:00.000Z' }, 406);
        return json({ link: `https://dl.sahte.test/${fileId}.srt`, remaining: 12 });
      }
      if (url.pathname !== '/api/v1/subtitles') throw new Error('beklenmeyen istek: ' + url.pathname);
      return json({ total_pages: 1, data: [
        os({ file: 1, legacy_subtitle_id: 9001, release: 'Ornek.Film.2024.1080p.WEB-DL.H264-FLUX', download_count: 5000 }),
        os({ file: 2, release: 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS', from_trusted: true, download_count: 9000 }),
        os({ file: 4, language: 'en', legacy_subtitle_id: 9004, release: 'Ornek.Film.2024.EXTENDED.BluRay-GRP' }),
        os({ file: 6, language: 'en', release: 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS' }),
      ] });
    }
    case 'dl.sahte.test':
      return new Response(TR_SRT, { headers: { 'content-type': 'text/plain' } });
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

const health = await a.get('/api/health');
check('sürüm 3.10.1', health.version === VERSION && (await a.get(`/${seg()}/manifest.json`)).version === VERSION, JSON.stringify(health));
const base = await movie();
show(base);
const site = (s) => (s.label.includes('hak harcar') ? 'quota' : s.label.startsWith('[AltyazıDB]') ? 'adb' : s.label.startsWith('[OpenSubtitles]') ? 'os' : s.label.startsWith('[Çift dilli]') ? 'dual' : '?');
const groups = (list) => ['tur', 'eng'].map((lang) => list.filter((s) => s.lang === lang && site(s) !== 'dual').map(site));
// Bir dilin listesi: önce öne alınan kaynak, sonra diğer ücretsizler, en sonda hak harcayanlar.
const ordered = (sites, first) => {
  const rank = (x) => (x === 'quota' ? 2 : x === first ? 0 : 1);
  return sites.every((x, i) => i === 0 || rank(sites[i - 1]) <= rank(x));
};

// ---------- Öne alınacak kaynak ----------
check('öne alma: ayar yokken sıra eskisi gibi', JSON.stringify(await movie('&pri=')) === JSON.stringify(base) && JSON.stringify(await movie('&pri=xyz')) === JSON.stringify(base));
let list = await movie('&pri=adb');
show(list);
check('öne alma: AltyazıDB her dilde ücretsizlerin en üstünde, hak harcayan en altta', groups(list).every((g) => g[0] === 'adb' && ordered(g, 'adb') && g.at(-1) === 'quota'), JSON.stringify(groups(list)));
check('öne alma: aynı altyazılar, yalnızca sıra değişir', list.length === base.length && JSON.stringify(list.map((s) => s.url).sort()) === JSON.stringify(base.map((s) => s.url).sort()));
check('öne alma: kendi içinde uygunluk sırası korunur', JSON.stringify(list.filter((s) => site(s) === 'adb').map((s) => s.url)) === JSON.stringify(base.filter((s) => site(s) === 'adb').map((s) => s.url)));
list = await movie('&pri=os');
show(list);
check('öne alma: OpenSubtitles seçilince ücretsiz OpenSubtitles altyazıları üstte, hak harcayanlar yine en altta', groups(list).every((g) => g[0] === 'os' && ordered(g, 'os') && g.at(-1) === 'quota'), JSON.stringify(groups(list)));
list = await movie('&pri=adb', 'tr,en', osOnly);
check('öne alma: seçilen kaynak bağlı değilse liste değişmez', JSON.stringify(list) === JSON.stringify(await movie('', 'tr,en', osOnly)));
list = await movie('&pri=adb&hi=last');
check('öne alma + HI sona: HI olan altyazı öne alınan kaynaktan olsa da HI olmayanların altında', list.filter((s) => s.lang === 'tur' && site(s) !== 'quota').at(-1).label.includes(' · HI'), list.map((s) => s.label).join(' / '));
list = await movie('&pri=os&dual=1');
check('öne alma + çift dilli: çift dilliler yine en üstte', list.slice(0, 3).every(isDual) && !list.slice(3).some(isDual), list.map((s) => s.label).join(' / '));
check('öne alma: dosya adreslerine yazılmaz (önbellek ortak kalır)', !list.some((s) => s.url.includes('pri=')));
let res = await series('tt2000001:1:2', '&gd=1&pri=gd', 'tr,en', auth);
check('öne alma: Gestdown dizilerde öne alınır', ['tur', 'eng'].every((lang) => res.subtitles.filter((s) => s.lang === lang)[0].url.includes('/gd/')), res.subtitles.map((s) => s.label).join(' / '));

// ---------- Kalan hak ----------
const u = (name) => sealer.seal({ u: name, p: 'sahte-sifre' });
const quotaLabels = (list) => list.filter((s) => s.label.includes('hak harcar')).map((s) => s.label);
const osCalls = (part) => calls.filter((c) => c.includes(`api.opensubtitles.com/api/v1/${part}`)).length;
const movieRes = (key, ui = 'tr') => a.get(`/languages=tr,en&ui=${ui}&auth=${key}/subtitles/movie/tt1000001.json`);
calls.length = 0;
let key = u('kalan-bir');
res = await movieRes(key);
check('kalan hak: oturum yokken gösterilmez, giriş ya da soru yapılmaz', quotaLabels(res.subtitles).length === 2 && quotaLabels(res.subtitles).every((l) => !l.includes('kaldı')) && osCalls('login') === 0 && osCalls('infos') === 0 && res.cacheMaxAge === 21600, quotaLabels(res.subtitles).join(' / ') + ' ' + calls.join(' | '));
res = await a.post('/api/test', { auth: key, languages: ['tr', 'en'] }, '10.0.1.1');
check('kalan hak: kaynak denemesi kalanı söyler', res.data.results[0].remaining === 17, JSON.stringify(res.data));
calls.length = 0;
res = await movieRes(key);
show(res.subtitles);
check('kalan hak: denemeden sonra listede "bugün 17 kaldı" yazar, yeni istek yapılmaz', quotaLabels(res.subtitles).length === 2 && quotaLabels(res.subtitles).every((l) => l.startsWith('[OpenSubtitles] 1 hak harcar · bugün 17 kaldı | ')) && osCalls('login') === 0 && osCalls('infos') === 0, quotaLabels(res.subtitles).join(' / '));
check('kalan hak: sayı yazan liste 5 dakikadan uzun saklanmaz', res.cacheMaxAge === 300, res.cacheMaxAge);
check('kalan hak: ücretsiz etiketlere eklenmez', res.subtitles.filter((s) => !s.label.includes('hak harcar')).every((s) => !s.label.includes('kaldı')));
calls.length = 0;
let text = await a.text(`/languages=tr,en&ui=tr&auth=${key}/sub/tr/tt1000001/2.srt`);
check('kalan hak: (sahte) indirme yapılır', text.includes('Merhaba') && osCalls('download') === 1, text.slice(0, 80));
res = await movieRes(key);
check('kalan hak: indirmeden sonra yeni sayı (12) görünür', quotaLabels(res.subtitles).length > 0 && quotaLabels(res.subtitles).every((l) => l.includes('bugün 12 kaldı')) && osCalls('infos') === 0, quotaLabels(res.subtitles).join(' / '));
res = await movieRes(key, 'en');
check('kalan hak: arayüz dilinde yazılır', res.subtitles.some((s) => s.label.includes(' · 12 left today | ')), res.subtitles.map((s) => s.label).join(' / '));
res = await movieRes(u('kalan-baska'));
check('kalan hak: başka kullanıcının sayısı görünmez', quotaLabels(res.subtitles).length === 1 && quotaLabels(res.subtitles).every((l) => !l.includes('kaldı')));

key = u('kalan-iki');
text = await a.text(`/languages=tr,en&ui=tr&auth=${key}/sub/en/tt1000001/6.srt`);
res = await movieRes(key);
check('kalan hak: hak bitince "bugün 0 kaldı" yazar', text.includes('00:00:00,000 --> 00:00:15,000') && quotaLabels(res.subtitles).length === 1 && quotaLabels(res.subtitles).every((l) => l.includes('bugün 0 kaldı')), quotaLabels(res.subtitles).join(' / '));

// Oturum açık ama sayı bilinmiyor (indirme sunucu hatasıyla bitti): OpenSubtitles'a sorulur, giriş yapılmaz.
key = u('kalan-uc');
await a.text(`/languages=tr,en&ui=tr&auth=${key}/sub/tr/tt1000001/4.srt`);
calls.length = 0;
res = await movieRes(key);
check('kalan hak: açık oturumla sorulur (hak harcamaz), giriş yapılmaz', quotaLabels(res.subtitles).length === 1 && quotaLabels(res.subtitles).every((l) => l.includes('bugün 17 kaldı')) && osCalls('infos') === 1 && osCalls('login') === 0 && osCalls('download') === 0, calls.join(' | '));
calls.length = 0;
await movieRes(key);
check('kalan hak: sorulan sayı bir süre hatırlanır', osCalls('infos') === 0, calls.join(' | '));
res = await movie('&max=1', 'tr,en', key);
check('kalan hak: dil başına sınırla hak harcayanlar gizlenince sayı da yazmaz', quotaLabels(res).length === 0 && !res.some((s) => s.label.includes('kaldı')), res.map((s) => s.label).join(' / '));
key = u('kalan-dort');
await a.text(`/languages=tr,en&ui=tr&auth=${key}/sub/tr/tt1000001/4.srt`);
infoFails = true;
calls.length = 0;
res = await movieRes(key);
infoFails = false;
check('kalan hak: sorulamazsa liste sayısız gelir, giriş yapılmaz', quotaLabels(res.subtitles).length === 1 && quotaLabels(res.subtitles).every((l) => !l.includes('kaldı')) && osCalls('infos') === 1 && osCalls('login') === 0 && res.cacheMaxAge === 21600, quotaLabels(res.subtitles).join(' / '));
calls.length = 0;
res = await movie('', 'tr,en', sealer.seal({ ad: 'sahte-altyazidb-1234' }));
check('kalan hak: OpenSubtitles hesabı yoksa hiç sorulmaz', res.length > 0 && osCalls('infos') === 0 && osCalls('login') === 0);

// ---------- Kare hızı farkı (çift dilli) ----------
const scaleSrt = (text, ratio, ms = 0) => text.replace(/(\d\d):(\d\d):(\d\d),(\d\d\d)/g, (_, h, m, s, f) => {
  const total = Math.max(0, Math.round((((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(f)) * ratio + ms));
  const pad = (n, size = 2) => String(n).padStart(size, '0');
  return `${pad(Math.floor(total / 3600000))}:${pad(Math.floor(total / 60000) % 60)}:${pad(Math.floor(total / 1000) % 60)},${pad(total % 1000, 3)}`;
});
const exact = mergeSubtitles(LONG_TR, LONG_EN);
const lastStart = (text) => {
  const [h, m, s, f] = text.trim().split(/\n\n/).at(-1).split('\n')[1].split(' --> ')[0].split(/[:,]/).map(Number);
  return ((h * 60 + m) * 60 + s) * 1000 + f;
};
check('kare hızı: örnekte son satır 10 saniyeden fazla kaymış (deneme anlamlı)', lastStart(LONG_EN) - lastStart(scaleSrt(LONG_EN, 23.976 / 25)) > 10000, lastStart(LONG_EN) - lastStart(scaleSrt(LONG_EN, 23.976 / 25)));
for (const [name, ratio, ms] of [['25 → 23,976', 23.976 / 25, 0], ['23,976 → 25', 25 / 23.976, 0], ['24 → 25', 25 / 24, 0], ['25 → 24, üstüne 3 sn kayma', 24 / 25, -3000], ['23,976 → 24, üstüne 1,5 sn kayma', 24 / 23.976, 1500]]) {
  const merged = mergeSubtitles(LONG_TR, scaleSrt(LONG_EN, ratio, ms));
  check(`kare hızı: ${name} düzeltilir, her satır kendi karşılığıyla eşleşir`, pairsOf(merged) === 40 && merged === exact, pairsOf(merged));
}
check('kare hızı: uyumlu altyazılar, sabit kayma ve benzemeyenler eskisi gibi', pairsOf(mergeSubtitles(LONG_TR, moveSrt(LONG_EN, -2000))) === 40 && mergeSubtitles(LONG_TR, moveSrt(LONG_EN + EXTRA, 100)).includes('00:10:00,100 --> 00:10:02,100\n<i>Extra</i>')
  && UNRELATED.trim().split(/\n\n/).filter((cue) => mergeSubtitles(LONG_TR, UNRELATED).includes(cue.split('\n')[1].split(' --> ')[0])).length >= 20);
check('kare hızı: kısa örnek dosya değişmez', mergeSubtitles(TR_SRT, EN_SRT) === MERGED);

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

// ---------- Ayar sayfası ----------
const keys = Object.keys(STRINGS.tr);
check('metinler: 13 dilde aynı anahtarlar, boş metin yok', Object.keys(STRINGS).length === 13 && Object.values(STRINGS).every((s) => JSON.stringify(Object.keys(s)) === JSON.stringify(keys) && Object.values(s).every((v) => (Array.isArray(v) ? v.length : v))));
check('metinler: yer tutucular her dilde aynı', Object.values(STRINGS).every((s) => keys.every((k) => JSON.stringify(String(s[k]).match(/\{\w+\}/g)?.sort()) === JSON.stringify(String(STRINGS.tr[k]).match(/\{\w+\}/g)?.sort()))));
check('metinler: kalan hak metni her dilde sayıyı taşır', Object.values(STRINGS).every((s) => s.quotaLeft.includes('{n}')));
let html = await a.text(`/${seg('&pri=adb')}/configure`);
check('sayfa: yeni denetimler var', ['id="pri"', 'data-i18n="priLabel"', 'data-i18n="priHint"', 'id="findShift"', 'data-i18n="shiftLabel"', 'data-i18n="shiftHint"'].every((s) => html.includes(s)));
check('sayfa: kalan hak metni önizleme için sayfada, sunucuya özel metinler değil', html.includes('quotaLeft') && !html.includes('fansubBy') && !html.includes('quotaHint') && !html.includes(STRINGS.tr.quotaHint));
let page = runPage(html);
const link = (p) => p.$('url').textContent;
check('sayfa: öne alma seçenekleri ve adresteki değer', page.$('pri').children.map((o) => o.value).join() === ',os,sd,ss,sro,adb,gd,tdb,as' && page.$('pri').children[0].text === 'Yok' && page.$('pri').children[5].text === 'AltyazıDB' && page.$('pri').value === 'adb', page.$('pri').children.map((o) => o.text).join());
check('sayfa: öne alma adreste şifreli parçadan önce yazılır', link(page) === `${a.base}/languages=tr,en&ui=tr&pri=adb&auth=${auth}/manifest.json`, link(page).slice(0, 120));
page.$('pri').value = 'gd'; page.$('pri').fire('change');
check('sayfa: seçim değişince adres değişir ve hatırlanır', link(page).includes('&pri=gd&auth=') && JSON.parse(page.storage.get('saved')).prefer === 'gd');
page.$('pri').value = ''; page.$('pri').fire('change');
check('sayfa: "Yok" seçilince adresten çıkar', link(page) === `${a.base}/languages=tr,en&ui=tr&auth=${auth}/manifest.json`);
page.$('pri').value = 'bozuk'; page.$('pri').fire('change');
check('sayfa: tanınmayan değer yok sayılır', link(page) === `${a.base}/languages=tr,en&ui=tr&auth=${auth}/manifest.json`);
page = runPage(await a.text(`/${seg('&max=10&clean=1&gd=1&dual=1&pri=os')}/configure`));
check('sayfa: bütün ayarlarla adres sırası', link(page) === `${a.base}/languages=tr,en&ui=tr&max=10&clean=1&gd=1&dual=1&pri=os&auth=${auth}/manifest.json`, link(page).slice(0, 160));
page = runPage(await a.text('/configure'), { auth: null, sources: { os: null }, selected: ['tr', 'en'], max: null, match: true, gestdown: true, prefer: 'gd' });
check('sayfa: hatırlanan öne alma ayarı yüklenir', link(page) === `${a.base}/languages=tr,en&ui=tr&gd=1&pri=gd/manifest.json` && page.$('pri').value === 'gd', link(page));
page = runPage(await a.text('/configure'), { auth: null, sources: { os: null }, selected: ['tr'], max: null, match: true, gestdown: true, prefer: 'kötü' });
check('sayfa: bozuk hatırlanan değer yok sayılır', link(page) === `${a.base}/languages=tr&ui=tr&gd=1/manifest.json` && page.$('pri').value === '', link(page));
page = runPage(await a.text(`/${seg()}/configure`));
check('sayfa: ayar yokken adres eskisiyle aynı', link(page) === `${a.base}/languages=tr,en&ui=tr&auth=${auth}/manifest.json` && page.$('pri').value === '');

// ---------- İndirirken kaydırma ----------
{
  const rows = (p) => p.$('findSubs').children.map((li) => ({ text: (li.children[0].children[0].children.map((c) => c.textContent).join('') + ' | ' + li.children[0].children[1].textContent), button: li.children[1] }));
  const p = runPage(await a.text('/languages=tr,en&ui=tr&gd=1&dual=1/configure'));
  check('kaydırma: liste yokken kutu gizli', /<div id="findShiftBox" hidden>/.test(await a.text('/configure')) && /id="findShift" value="0"/.test(await a.text('/configure')));
  p.$('findQuery').value = 'ornek dizi';
  await p.$('findForm').fire('submit');
  await p.$('findTitles').children[0].fire('click');
  p.$('findEp').value = '2';
  p.$('findEp').fire('change');
  await p.$('findList').fire('click');
  check('kaydırma: liste gelince kutu görünür', p.$('findShiftBox').hidden === false && rows(p).length === 6);
  const save = async (match, shift) => {
    p.$('findShift').value = shift;
    const count = downloads.length;
    await rows(p).find((r) => r.text.startsWith(match)).button.fire('click');
    return downloads.length > count ? blobs[blobs.length - 1].text() : null;
  };
  const gdEn = 'İngilizce · [Gestdown] ✓ Ücretsiz | WEB.FLUX';
  const plain = await save(gdEn, '0');
  check('kaydırma: 0 iken dosya aynen kaydedilir', plain === EN_SRT, plain);
  let got = await save(gdEn, '1.5');
  check('kaydırma: 1,5 sn ileri alınır, metin değişmez', got === moveSrt(EN_SRT, 1500), '\n' + got);
  got = await save(gdEn, '-2,5');
  check('kaydırma: virgüllü değer sayı sayılmaz → kaydırılmaz', got === EN_SRT, '\n' + got);
  got = await save(gdEn, '-5.5');
  check('kaydırma: geri alınınca 0\'ın altına düşen başlangıç 0 olur', got.startsWith('1\n00:00:00,000 --> 00:00:01,400\nHello') && got.includes('00:00:14,500 --> 00:00:16,500'), '\n' + got);
  got = await save(gdEn, '-7');
  check('kaydırma: tamamen başa sıkışan satır çıkarılır', !got.includes('Hello') && got.startsWith('2\n00:00:01,200 --> 00:00:03,100'), '\n' + got);
  got = await save(gdEn, '9999');
  check('kaydırma: en fazla 600 sn', got.includes('00:10:05,100 --> 00:10:06,900'), '\n' + got);
  got = await save(gdEn, 'abc');
  check('kaydırma: sayı olmayan değer → kaydırılmaz', got === EN_SRT);
  got = await save('Türkçe · [Çift dilli]', '2');
  check('kaydırma: çift dilli dosyada iki dil birlikte kayar', got.startsWith('1\n00:00:07,000 --> 00:00:09,000\nMerhaba, nasılsın?\n<i>Hello, how are you?</i>'), '\n' + got);
  // Sunucu hata satırı döndürürse kaydırma yapılmaz, dosya kaydedilmez.
  const count = downloads.length;
  p.$('findShift').value = '3';
  await rows(p).find((r) => r.text.startsWith('İngilizce · [Gestdown]') && r.text.includes('HDTV')).button.fire('click');
  check('kaydırma: uyarı dönen altyazı yine kaydedilmez', downloads.length === count && p.$('findMsg').textContent.startsWith('Altyazı alınamadı:'), p.$('findMsg').textContent);
  p.$('findQuery').value = 'yok';
  await p.$('findForm').fire('submit');
  check('kaydırma: liste kalkınca kutu gizlenir', p.$('findShiftBox').hidden === true);
}

await new Promise((resolve) => setTimeout(resolve, 300));
a.server.close();
check('indirme isteği yalnızca sahte siteye gitti', calls.every((c) => !c.includes('/api/v1/download') || c.startsWith('POST api.opensubtitles.com/api/v1/download')) && !calls.some((c) => c.includes('dl.opensubtitles')));
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
