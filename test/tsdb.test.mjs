// TheSubtitleDB kaynağı. Hiçbir gerçek siteye istek gitmez; bütün dış servisler sahtedir.
import { VERSION } from './setup.mjs';
import { createServer } from 'node:http';
import vm from 'node:vm';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { TsdbClient, TsdbError } = await import('../src/tsdb.js');
const { tsdbCode } = await import('../src/languages.js');
const { STRINGS } = await import('../src/i18n.js');

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 600) : ''}`); };

const TR_SRT = '1\n00:00:05,000 --> 00:00:07,000\nMerhaba, nasılsın?\n\n2\n00:00:08,000 --> 00:00:10,000\nİyiyim.\n\n3\n00:00:20,000 --> 00:00:22,000\nGüle güle.\n';
const EN_SRT = '1\n00:00:05,000 --> 00:00:07,000\nHello, how are you?\n\n2\n00:00:08,000 --> 00:00:10,000\nI am fine.\n\n3\n00:00:20,000 --> 00:00:22,000\nGoodbye.\n';

// ---------- Sahte siteler ----------
const realFetch = globalThis.fetch;
const calls = [];
let tsdbStatus = 0;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const API = 'https://api.thesubtitledb.org';
// Sitenin gerçek cevabındaki biçim (thesubtitledb.org/llms.txt).
const sub = (id, o = {}) => ({ id, language: 'tr', format: 'srt', cues: 1200, duration_s: 7000, bytes: 90000, encoding: 'UTF-8', release_name: `Surum.${id}`, hearing_impaired: false, fps: null, added_at: '2026-01-01T00:00:00Z', download_url: `${API}/get/${id}`, ...o });
const page = (items) => json({ subtitles: { total: items.length, limit: 100, offset: 0, items } });
const TITLES = {
  '/v1/by-imdb/tt1000001': {
    tr: [
      sub(301, { release_name: 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS' }),
      sub(302, { format: 'vtt', release_name: '  Ornek.Film.2024.720p.WEB  ', hearing_impaired: true }),
      sub(303, { format: 'ass' }),
      sub(304, { language: 'en' }),
      sub(305, { download_url: 'https://kotu.example/get/305' }),
      sub(306, { download_url: `${API}/get/999` }),
      sub('307'),
      sub(308, { release_name: null }),
    ],
    en: [sub(401, { language: 'en', release_name: 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS' })],
    pb: [sub(501, { language: 'pb' })],
    // Site tanımadığı kodu yok sayıp bütün dilleri döndürür.
    'zh-ca': [sub(301), sub(401, { language: 'en' })],
  },
  '/v1/by-imdb/tt3000001/season/1/episode/2': { tr: [sub(601, { release_name: 'Dizi.S01E02.720p.WEB' })] },
  '/v1/by-imdb/tt0111161': { tr: [sub(701), sub(702)], en: [sub(703, { language: 'en' })] },
};

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  calls.push({ host: url.hostname, path: url.pathname, query: url.search, lang: url.searchParams.get('lang'), ua: init?.headers?.['User-Agent'] || '' });
  switch (url.hostname) {
    case 'api.thesubtitledb.org': {
      if (!url.pathname.startsWith('/v1/by-imdb/')) throw new Error('TheSubtitleDB\'de beklenmeyen adres: ' + url.pathname);
      if (tsdbStatus) return json({ error: 'hata', message: 'deneme' }, tsdbStatus);
      const title = TITLES[url.pathname];
      if (!title) return json({ error: 'not_found', message: 'yok' }, 404);
      return page(title[url.searchParams.get('lang')] || []);
    }
    case 'opensubtitles-v3.strem.io':
      return json({ subtitles: [] });
    case 'altyazidb.com': {
      if (url.pathname.endsWith('/me')) return json({ success: true });
      if (url.pathname.endsWith('/search')) {
        const lang = url.searchParams.get('lang');
        return json({ data: lang === 'tr' || lang === 'en' ? [{ id: lang === 'tr' ? 700 : 800, language: lang, releases: ['Ornek.Film.2024.1080p.BluRay.x264-SPARKS'], hearing_impaired: 0, ai_ceviri: 0, downloads: 5 }] : [] });
      }
      if (url.pathname.endsWith('/subtitle')) return new Response(url.searchParams.get('sub_id') === '800' ? EN_SRT : TR_SRT, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      break;
    }
    case 'v3-cinemeta.strem.io': {
      if (url.pathname.startsWith('/catalog/movie/')) return json({ metas: [{ id: 'tt1000001', type: 'movie', name: 'Ornek Film', releaseInfo: '2024' }] });
      if (url.pathname.startsWith('/catalog/')) return json({ metas: [] });
      return json({ meta: {} });
    }
  }
  throw new Error('beklenmeyen dış istek: ' + url.hostname + url.pathname);
};

const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '' })).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;
const get = (path) => realFetch(BASE + path).then((res) => res.json());
const text = (path) => realFetch(BASE + path).then((res) => res.text());
const post = (path, body, ip) => realFetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) })
  .then(async (res) => ({ status: res.status, data: await res.json() }));
const sealer = createSealer(process.env.CONFIG_SECRET);
const adb = sealer.seal({ ad: 'sahte-altyazidb-1234' });
const tsdbCalls = () => calls.filter((c) => c.host === 'api.thesubtitledb.org');
const labels = (list) => list.map((s) => `${s.lang} | ${s.label}`).join(' / ');
const AGENT = `SubPool/${VERSION} (+https://github.com/MrDiavelin/subpool; https://x.com/Diavelin)`;

// ---------- Diller ----------
check('diller: çoğu kod aynı kalır', tsdbCode('tr') === 'tr' && tsdbCode('en') === 'en' && tsdbCode('he') === 'he' && tsdbCode('ze') === 'ze');
check('diller: kodu farklı olanlar çevrilir', tsdbCode('pt-br') === 'pb' && tsdbCode('pt-pt') === 'pt' && tsdbCode('zh-cn') === 'zh' && tsdbCode('zh-tw') === 'zt' && tsdbCode('az-az') === 'az' && tsdbCode('sp') === 'es' && tsdbCode('ea') === 'es');
check('diller: sitede ayrı durmayanlar ve bilinmeyen kodlar sorulmaz', tsdbCode('zh-ca') === null && tsdbCode('az-zb') === null && tsdbCode('tm-td') === null && tsdbCode('xx') === null);

// ---------- Doğrudan ----------
const client = new TsdbClient({ userAgent: 'deneme' });
let found = await client.search({ imdbId: 'tt1000001', language: 'tr' });
check('ayıklama: yalnızca istenen dildeki srt ve vtt dosyaları, adresi sitenin kendi indirme adresi olanlar alınır', found.map((s) => s.id).join() === '301,302,308', JSON.stringify(found));
check('ayıklama: adresler olduğu gibi kalır', found.map((s) => s.url).join() === `${API}/get/301,${API}/get/302,${API}/get/308`);
check('ayıklama: sürüm adı kırpılır, yoksa boş; işitme engelli işareti alınır', found[1].release === 'Ornek.Film.2024.720p.WEB' && found[1].hi === 1 && found[0].hi === 0 && found[2].release === '', JSON.stringify(found));
check('arama: tek dil, en çok indirilen önce, en fazla 100 sonuç istenir', tsdbCalls().at(-1).path === '/v1/by-imdb/tt1000001' && tsdbCalls().at(-1).query === '?lang=tr&sort=downloads&limit=100' && tsdbCalls().at(-1).ua === 'deneme', JSON.stringify(tsdbCalls().at(-1)));
found = await client.search({ imdbId: 'tt1000001', language: 'zh-ca' });
check('ayıklama: site bütün dilleri döndürürse başka dildekiler alınmaz', found.length === 0, JSON.stringify(found));
await client.search({ imdbId: 'tt3000001', season: '1', episode: '02', language: 'tr' });
check('arama: dizide sezon ve bölüm adreste yazar', tsdbCalls().at(-1).path === '/v1/by-imdb/tt3000001/season/1/episode/2', tsdbCalls().at(-1).path);
check('arama: sitede kaydı olmayan film (404) boş liste verir', (await client.search({ imdbId: 'tt1999999', language: 'tr' })).length === 0);
tsdbStatus = 503;
check('arama: site hata verirse TsdbError', await client.search({ imdbId: 'tt1000001', language: 'tr' }).then(() => false, (err) => err instanceof TsdbError && err.status === 503));
tsdbStatus = 0;

// ---------- Liste ----------
calls.length = 0;
let res = await get('/languages=tr,en&ui=tr&tdb=1/subtitles/movie/tt1000001.json');
console.log('   ' + labels(res.subtitles));
let items = res.subtitles.filter((s) => s.label.startsWith('[TheSubtitleDB]'));
check('liste: hesapsız, yalnızca tdb=1 ile çalışır', items.length === 4 && items.length === res.subtitles.length, labels(res.subtitles));
check('liste: etiket, dil ve HI notu', labels(items.filter((s) => s.lang === 'tur')) === 'tur | [TheSubtitleDB] ✓ Ücretsiz | Ornek.Film.2024.1080p.BluRay.x264-SPARKS / tur | [TheSubtitleDB] ✓ Ücretsiz · HI | Ornek.Film.2024.720p.WEB / tur | [TheSubtitleDB] ✓ Ücretsiz | Türkçe'
  && labels(items.filter((s) => s.lang === 'eng')) === 'eng | [TheSubtitleDB] ✓ Ücretsiz | Ornek.Film.2024.1080p.BluRay.x264-SPARKS', labels(items));
check('liste: adresler doğrudan sitenin verdiği indirme adresleri', items.map((s) => s.url).sort().join() === `${API}/get/301,${API}/get/302,${API}/get/308,${API}/get/401`, items.map((s) => s.url).join(' '));
check('liste: her dil için tek arama yapıldı', tsdbCalls().map((c) => `${c.path}${c.query}`).sort().join(' ') === '/v1/by-imdb/tt1000001?lang=en&sort=downloads&limit=100 /v1/by-imdb/tt1000001?lang=tr&sort=downloads&limit=100', JSON.stringify(tsdbCalls()));
check('liste: isteklerde eklentinin adı ve iletişim adresi yazar', tsdbCalls().every((c) => c.ua === AGENT), tsdbCalls()[0].ua);
calls.length = 0;
res = await get('/languages=tr&ui=en&tdb=1/subtitles/movie/tt1000001.json');
check('liste: sonuç dil dil önbellekte tutulur, aynı film yeniden sorulmaz', tsdbCalls().length === 0 && res.subtitles.length === 3, labels(res.subtitles));
check('liste: arayüz İngilizceyse etiket İngilizce', res.subtitles[0].label === '[TheSubtitleDB] ✓ Free | Ornek.Film.2024.1080p.BluRay.x264-SPARKS', res.subtitles[0].label);
calls.length = 0;
res = await get('/languages=pt-br,zh-ca&ui=tr&tdb=1/subtitles/movie/tt1000001.json');
check('liste: dil sitenin koduyla sorulur, sitede olmayan dil hiç sorulmaz', tsdbCalls().map((c) => c.lang).join() === 'pb' && labels(res.subtitles) === 'pob | [TheSubtitleDB] ✓ Ücretsiz | Surum.501', JSON.stringify(tsdbCalls()) + ' ' + labels(res.subtitles));
calls.length = 0;
res = await get('/languages=tr&ui=tr&tdb=1/subtitles/series/tt3000001:1:2.json');
check('liste: dizi bölümü', tsdbCalls().length === 1 && tsdbCalls()[0].path === '/v1/by-imdb/tt3000001/season/1/episode/2' && labels(res.subtitles) === 'tur | [TheSubtitleDB] ✓ Ücretsiz | Dizi.S01E02.720p.WEB', labels(res.subtitles));
calls.length = 0;
res = await get('/languages=tr&ui=tr&tdb=1/subtitles/movie/tt1999999.json');
check('liste: sitede olmayan filmde liste boş', Array.isArray(res.subtitles) && res.subtitles.length === 0, JSON.stringify(res).slice(0, 200));
calls.length = 0;
res = await get('/languages=tr&ui=tr/subtitles/movie/tt1000001.json');
check('liste: tdb=1 yoksa TheSubtitleDB kullanılmaz (varsayılan kapalı), kurulum uyarısı', tsdbCalls().length === 0 && res.subtitles.length === 1 && res.subtitles[0].id === 'subpool-setup-required', JSON.stringify(res).slice(0, 200));
res = await get('/languages=tr&ui=tr&tdb=0/subtitles/movie/tt1000001.json');
check('liste: tdb=0 da kapalı sayılır', tsdbCalls().length === 0 && res.subtitles[0].id === 'subpool-setup-required');
tsdbStatus = 503;
res = await get('/languages=tr&ui=tr&tdb=1/subtitles/movie/tt1000002.json');
check('liste: TheSubtitleDB yanıt vermezse liste yine gelir', Array.isArray(res.subtitles), JSON.stringify(res).slice(0, 200));
tsdbStatus = 0;

// ---------- Öne alma, çift dilli ----------
const key = (opts) => `/languages=tr,en&ui=tr${opts}&auth=${adb}/subtitles/movie/tt1000001.json`;
res = await get(key('&tdb=1'));
console.log('   ' + labels(res.subtitles));
const trList = (list) => list.filter((s) => s.lang === 'tur').map((s) => (s.label.startsWith('[TheSubtitleDB]') ? 'tdb' : s.label.startsWith('[AltyazıDB]') ? 'adb' : s.label.startsWith('[Çift dilli]') ? 'dual' : '?'));
check('öne alma: ayar yokken iki kaynak da listede', trList(res.subtitles).includes('tdb') && trList(res.subtitles).includes('adb'), trList(res.subtitles).join());
res = await get(key('&tdb=1&pri=tdb'));
check('öne alma: pri=tdb ile TheSubtitleDB en üstte', trList(res.subtitles)[0] === 'tdb', trList(res.subtitles).join());
res = await get(key('&tdb=1&pri=adb'));
check('öne alma: pri=adb ile AltyazıDB TheSubtitleDB\'nin üstünde', trList(res.subtitles)[0] === 'adb', trList(res.subtitles).join());
res = await get(key('&tdb=1&dual=1'));
const duals = res.subtitles.filter((s) => s.url.includes('/dual/'));
check('çift dilli: TheSubtitleDB altyazısı birleştirmeye girmez', duals.length >= 1 && duals.every((s) => {
  const refs = JSON.parse(Buffer.from(s.url.match(/\/dual\/([\w-]+)\.srt$/)[1], 'base64url').toString());
  return !JSON.stringify(refs).includes('tsdb');
}), duals.map((s) => s.url).join(' '));
check('çift dilli: TheSubtitleDB adresi hiçbir dosya adresinin içinde yok', res.subtitles.filter((s) => !s.label.startsWith('[TheSubtitleDB]')).every((s) => !s.url.includes('thesubtitledb')));
res = await get(key('&tdb=1&clean=1'));
check('temizlik: açıkken de TheSubtitleDB adresleri olduğu gibi kalır', res.subtitles.filter((s) => s.label.startsWith('[TheSubtitleDB]')).every((s) => /^https:\/\/api\.thesubtitledb\.org\/get\/\d+$/.test(s.url)), labels(res.subtitles));

// ---------- Manifest ----------
const manifest = await get('/languages=tr&ui=tr&tdb=1/manifest.json');
check('manifest: açıklamada TheSubtitleDB kaynağı yazar', manifest.description.includes('Kaynaklar: TheSubtitleDB.'), manifest.description);
check('manifest: yalnızca TheSubtitleDB açıkken yapılandırma tamam', manifest.behaviorHints.configurationRequired === false);
check('manifest: tdb=1 yoksa yapılandırma gerekli', (await get('/languages=tr&ui=tr/manifest.json')).behaviorHints.configurationRequired === true);
check('manifest: kaynak sırası Gestdown, TheSubtitleDB, AniSub', (await get('/languages=tr&ui=tr&gd=1&tdb=1&as=1/manifest.json')).description.includes('Gestdown, TheSubtitleDB, AniSub'));

// ---------- Kaynak denemesi ----------
const plain = (data) => JSON.stringify(data.results.map(({ ms, ...rest }) => rest));
calls.length = 0;
res = await post('/api/test', { languages: ['tr', 'en'], tsdb: true }, '10.8.0.1');
check('deneme: yalnızca TheSubtitleDB açıkken çalışır, örnek filmdeki altyazıları sayar', res.status === 200 && plain(res.data) === JSON.stringify([{ source: 'tsdb', status: 'ok', count: 3 }]) && Number.isInteger(res.data.results[0].ms), JSON.stringify(res.data));
check('deneme: yalnızca örnek film arandı', tsdbCalls().length === 2 && tsdbCalls().every((c) => c.path === '/v1/by-imdb/tt0111161'), JSON.stringify(tsdbCalls()));
tsdbStatus = 403;
res = await post('/api/test', { languages: ['tr'], tsdb: true }, '10.8.0.2');
check('deneme: site reddederse "çalışmıyor" (anahtar hatası değil)', plain(res.data) === JSON.stringify([{ source: 'tsdb', status: 'error' }]), JSON.stringify(res.data));
tsdbStatus = 0;
res = await post('/api/test', { languages: ['tr'], tsdb: 'evet' }, '10.8.0.3');
check('deneme: tsdb yalnızca true ise açılır', !res.data.results?.some((r) => r.source === 'tsdb'), JSON.stringify(res.data));

// ---------- Metinler ----------
check('metinler: etiket her dilde "TheSubtitleDB" adını taşır', Object.values(STRINGS).every((s) => s.tagTsdb.startsWith('[TheSubtitleDB] ✓ ')));
check('metinler: açıklama her dilde sitenin adresini ve saatlik sınırı söyler', Object.values(STRINGS).every((s) => s.tsdbIntro.includes('api.thesubtitledb.org') && s.tsdbIntro.includes('150')));
check('metinler: arama notunda etiket yer tutucusu var', Object.values(STRINGS).every((s) => s.findTsdb.includes('{tsdb}')));

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
    Option: function Option(text, value) { this.text = text; this.value = value; },
    fetch: (url, init = {}) => (String(url).startsWith('http://127.0.0.1') ? realFetch(url, { ...init, headers: { ...init.headers, 'x-forwarded-for': '10.0.0.9' } }) : globalThis.fetch(url, init)),
    Intl, setTimeout, setInterval: () => 0, clearInterval() {}, performance: { now: () => 0 }, location: { hash: '', pathname: '/configure', search: '' }, history: { replaceState() {} }, addEventListener() {}, matchMedia: () => ({ matches: false }), console, JSON, Object, Array, Map, Set, String, Number, Boolean, Promise, URL, Blob,
  });
  for (const code of [...pageHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1])) vm.runInContext(code, context);
  return { $, storage };
}
const link = (p) => p.$('url').textContent;
const findText = (p) => p.$('findSum').textContent + ' ' + p.$('findRest').textContent;
const note = (lang) => STRINGS[lang].findTsdb.replace('{tsdb}', STRINGS[lang].tagTsdb);
const html = await text('/configure');
check('sayfa: TheSubtitleDB bölümü, kutusu ve açıklama satırı var', ['id="tsdbPanel"', 'id="tsdb"', 'data-i18n="tsdbIntro"', 'data-i18n="tsdbLabel"', 'data-i18n="tagTsdb"', 'data-i18n="howTsdb"'].every((s) => html.includes(s)));
check('sayfa: kart Gestdown ile AniSub arasında', html.indexOf('id="gestdownPanel"') < html.indexOf('id="tsdbPanel"') && html.indexOf('id="tsdbPanel"') < html.indexOf('id="anisubPanel"'));
let pg = runPage(html);
check('sayfa: başta kapalı, adres hazır değil, deneme kapalı', pg.$('tsdb').checked === false && link(pg) === '—' && pg.$('test').disabled === true, link(pg));
check('sayfa: kapalıyken arama bölümünde TheSubtitleDB notu yok', !findText(pg).includes('TheSubtitleDB'), findText(pg));
pg.$('tsdb').checked = true; pg.$('tsdb').fire('change');
check('sayfa: TheSubtitleDB tek başına yeterli, adrese tdb=1 eklenir', link(pg) === `${BASE}/languages=tr&ui=tr&tdb=1/manifest.json` && pg.$('test').disabled === false, link(pg));
check('sayfa: açılınca arama bölümüne notu eklenir', findText(pg).includes(note('tr')), findText(pg));
check('sayfa: ayar hatırlanır', JSON.parse(pg.storage.get('saved')).tsdb === true);
await pg.$('test').fire('click');
check('sayfa: deneme sonucu örnek filmdeki altyazı sayısını yazar', /^✓ TheSubtitleDB: çalışıyor, örnek filmde 2 altyazı bulundu\. \(\d+ ms\)$/.test(pg.$('testResult').children.map((c) => c.textContent).join()), pg.$('testResult').children.map((c) => c.textContent).join(' | '));
pg.$('pri').value = 'tdb'; pg.$('pri').fire('change');
check('sayfa: öne alma adrese pri=tdb olarak yazılır', link(pg) === `${BASE}/languages=tr&ui=tr&tdb=1&pri=tdb/manifest.json`, link(pg));
check('sayfa: öne alma listesinde adı TheSubtitleDB', pg.$('pri').children.find((o) => o.value === 'tdb').text === 'TheSubtitleDB');
pg.$('ui').value = 'en'; pg.$('ui').fire('change');
check('sayfa: bölüm başka dillerde de görünür, seçim ve not kalır', pg.$('tsdb').checked === true && link(pg) === `${BASE}/languages=tr&ui=en&tdb=1&pri=tdb/manifest.json` && findText(pg).includes(note('en')), link(pg) + ' ' + findText(pg));
pg.$('ui').value = 'tr'; pg.$('ui').fire('change');
pg.$('tsdb').checked = false; pg.$('tsdb').fire('change');
check('sayfa: kapatılınca adres yok, deneme kapalı, arama notu kalkar', link(pg) === '—' && pg.$('test').disabled === true && !findText(pg).includes('TheSubtitleDB'), link(pg));
check('sayfa: kapalı olduğu hatırlanır', JSON.parse(pg.storage.get('saved')).tsdb === false);
pg = runPage(await text(`/languages=tr,en&ui=tr&max=10&clean=1&gd=1&tdb=1&as=1&dual=1&pri=tdb&auth=${adb}/configure`));
check('sayfa: bütün ayarlarla adres sırası (tdb=1, gd=1 ile as=1 arasında)', link(pg) === `${BASE}/languages=tr,en&ui=tr&max=10&clean=1&gd=1&tdb=1&as=1&dual=1&pri=tdb&auth=${adb}/manifest.json` && pg.$('tsdb').checked === true && pg.$('pri').value === 'tdb', link(pg));
pg = runPage(await text('/configure'), { auth: null, sources: { os: null }, selected: ['tr'], max: null, match: true, gestdown: true, tsdb: true, prefer: 'tdb' });
check('sayfa: hatırlanan ayar yüklenir', link(pg) === `${BASE}/languages=tr&ui=tr&gd=1&tdb=1&pri=tdb/manifest.json` && pg.$('tsdb').checked === true, link(pg));
pg = runPage(await text('/configure'), { auth: null, sources: { os: null }, selected: ['tr'], max: null, match: true, tsdb: 'evet' });
check('sayfa: bozuk hatırlanan değer yok sayılır (kapalı kalır)', pg.$('tsdb').checked === false && link(pg) === '—');

// Altyazı ara ve indir: TheSubtitleDB altyazıları gösterilmez.
pg = runPage(await text(`/languages=tr,en&ui=tr&tdb=1&auth=${adb}/configure`));
pg.$('findQuery').value = 'ornek film';
await pg.$('findForm').fire('submit');
await pg.$('findTitles').children[0].fire('click');
await new Promise((resolve) => setTimeout(resolve, 200));
const rows = pg.$('findSubs').children.map((li) => (li.children[0].children[0].children.map((c) => c.textContent).join('') + ' | ' + li.children[0].children[1].textContent));
check('arama: TheSubtitleDB altyazıları listelenmez, diğerleri listelenir', rows.length >= 2 && rows.every((r) => !r.includes('TheSubtitleDB')), rows.join(' / '));

await new Promise((resolve) => setTimeout(resolve, 200));
server.close();
check('TheSubtitleDB\'de hiçbir zaman dosya adresine (/get/) istek gitmedi', !calls.some((c) => c.host.endsWith('thesubtitledb.org') && !c.path.startsWith('/v1/by-imdb/')));
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
