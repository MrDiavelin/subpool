// AniSub kaynağı ve iletişim satırı. Hiçbir gerçek siteye istek gitmez; bütün dış servisler sahtedir.
import { VERSION } from './setup.mjs';
import { createServer } from 'node:http';
import vm from 'node:vm';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { anisubSubtitles, anisubReachable } = await import('../src/anisub.js');
const { STRINGS } = await import('../src/i18n.js');

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 600) : ''}`); };

const TR_SRT = '1\n00:00:05,000 --> 00:00:07,000\nMerhaba, nasılsın?\n\n2\n00:00:08,000 --> 00:00:10,000\nİyiyim.\n\n3\n00:00:20,000 --> 00:00:22,000\nGüle güle.\n';
const EN_SRT = '1\n00:00:05,000 --> 00:00:07,000\nHello, how are you?\n\n2\n00:00:08,000 --> 00:00:10,000\nI am fine.\n\n3\n00:00:20,000 --> 00:00:22,000\nGoodbye.\n';

// ---------- Sahte siteler ----------
const realFetch = globalThis.fetch;
const calls = [];
let anisubDown = false;
let manifestBad = false;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
// AniSub'ın gerçek cevabındaki biçim (kullanıcının tarayıcıda açtığı Frieren 1. bölüm cevabı gibi).
const as = (id, o = {}) => ({ id: `anisub-${id}`, url: `https://anisub.co/stremio/subtitle/${id}`, lang: 'Turkish', format: 'ASS', ...o });

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  calls.push({ host: url.hostname, path: url.pathname, ua: init?.headers?.['User-Agent'] || '' });
  switch (url.hostname) {
    case 'anisub.co': {
      if (anisubDown) return json({ error: 'bakım' }, 503);
      if (url.pathname === '/manifest.json') return manifestBad ? json({ name: 'x' }) : json({ id: 'co.anisub.stremio', version: '1.0.0', resources: ['subtitles'], types: ['movie', 'series'] });
      const m = url.pathname.match(/^\/subtitles\/(movie|series)\/(.+)\.json$/);
      if (!m) throw new Error('AniSub\'da beklenmeyen adres: ' + url.pathname);
      const id = decodeURIComponent(m[2]);
      if (id === 'tt3000001:1:2') {
        return json({ subtitles: [
          as(101, { releaseInfo: 'HolySubs' }),
          as(102, { lang: '' }),
          as(103, { lang: 'English', releaseInfo: 'EngSubs' }),
          { id: 'anisub-104', url: 'https://kotu.example/stremio/subtitle/104', lang: 'Turkish' },
          { id: 'anisub-105', url: 'http://anisub.co/stremio/subtitle/105', lang: 'Turkish' },
          { url: 'https://anisub.co/stremio/subtitle/106', lang: 'Turkish' },
          as(107, { lang: 'tur', releaseInfo: '  Hoşumuza Giden Şeyler  ' }),
        ] });
      }
      if (id === 'tt1000001') return json({ subtitles: [as(201, { releaseInfo: 'Film Fansub' })] });
      return json({ subtitles: [] });
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
const asCalls = () => calls.filter((c) => c.host === 'anisub.co');
const labels = (list) => list.map((s) => `${s.lang} | ${s.label}`).join(' / ');

// ---------- Doğrudan ----------
let found = await anisubSubtitles('series', 'tt3000001:1:2', 'deneme');
check('ayıklama: yalnızca https://anisub.co/ adresli ve kimlikli altyazılar alınır', found.map((s) => s.id).join() === 'anisub-101,anisub-102,anisub-103,anisub-107', JSON.stringify(found));
check('ayıklama: fansub adı releaseInfo alanından, boşluklar kırpılır', found[0].fansub === 'HolySubs' && found[3].fansub === 'Hoşumuza Giden Şeyler' && found[1].fansub === '', JSON.stringify(found));
check('ayıklama: adresler olduğu gibi kalır', found[0].url === 'https://anisub.co/stremio/subtitle/101');
check('ulaşılabilirlik: manifest uygunsa true', (await anisubReachable('deneme')) === true);
manifestBad = true;
check('ulaşılabilirlik: manifest beklenmedikse hata', await anisubReachable('deneme').then(() => false, () => true));
manifestBad = false;

// ---------- Liste ----------
calls.length = 0;
let res = await get('/languages=tr&ui=tr&as=1/subtitles/series/tt3000001:1:2.json');
console.log('   ' + labels(res.subtitles));
const asItems = res.subtitles.filter((s) => s.label.startsWith('[AniSub]'));
check('liste: hesapsız, yalnızca as=1 ile çalışır', asItems.length === 3, labels(res.subtitles));
check('liste: "Turkish" ve "tur" Türkçe sayılır, İngilizce işaretli alınmaz, dili boş olan Türkçe sayılır', asItems.some((s) => s.url.endsWith('/101')) && asItems.some((s) => s.url.endsWith('/107')) && !asItems.some((s) => s.url.endsWith('/103')) && asItems.some((s) => s.url.endsWith('/102')) && asItems.every((s) => s.lang === 'tur'));
check('liste: fansub adı "Çeviri: …" olarak yazar; adı yoksa dil adı', asItems.map((s) => s.label).join(' / ') === '[AniSub] ✓ Ücretsiz | Çeviri: HolySubs / [AniSub] ✓ Ücretsiz | Türkçe / [AniSub] ✓ Ücretsiz | Çeviri: Hoşumuza Giden Şeyler', asItems.map((s) => s.label).join(' / '));
res = await get('/languages=tr&ui=en&as=1/subtitles/series/tt3000001:1:2.json');
check('liste: arayüz İngilizceyse "Translated by …"', res.subtitles[0].label === '[AniSub] ✓ Free | Translated by HolySubs', res.subtitles[0].label);
check('liste: adresler doğrudan AniSub\'ın verdiği adresler', asItems.every((s) => /^https:\/\/anisub\.co\/stremio\/subtitle\/\d+$/.test(s.url)), asItems.map((s) => s.url).join(' '));
check('liste: sunucu yalnızca altyazı listesini sordu, dosyaya dokunmadı', asCalls().length === 1 && asCalls()[0].path === '/subtitles/series/tt3000001%3A1%3A2.json' && !calls.some((c) => c.path.startsWith('/stremio/')), JSON.stringify(asCalls()));
check('liste: isteklerde eklentinin adı ve iletişim adresi yazar', asCalls()[0].ua === `SubPool/${VERSION} (+https://github.com/MrDiavelin/subpool; https://x.com/Diavelin)`, asCalls()[0].ua);
calls.length = 0;
await get('/languages=tr&ui=tr&as=1/subtitles/series/tt3000001:1:2.json');
check('liste: sonuç önbellekte tutulur, aynı bölüm yeniden sorulmaz', asCalls().length === 0);
calls.length = 0;
res = await get('/languages=en,de&ui=tr&as=1/subtitles/series/tt3000001:1:2.json');
check('liste: Türkçe seçili değilse AniSub\'a hiç sorulmaz', asCalls().length === 0 && !res.subtitles.some((s) => s.label.startsWith('[AniSub]')), labels(res.subtitles));
calls.length = 0;
res = await get('/languages=tr&ui=tr/subtitles/series/tt3000001:1:2.json');
check('liste: as=1 yoksa AniSub kullanılmaz (varsayılan kapalı), kurulum uyarısı', asCalls().length === 0 && res.subtitles.length === 1 && res.subtitles[0].id === 'subpool-setup-required', JSON.stringify(res).slice(0, 200));
res = await get('/languages=tr&ui=tr&as=0/subtitles/series/tt3000001:1:2.json');
check('liste: as=0 de kapalı sayılır', asCalls().length === 0 && !res.subtitles.some((s) => s.label.startsWith('[AniSub]')));
anisubDown = true;
res = await get('/languages=tr&ui=tr&as=1/subtitles/series/tt3999999:1:1.json');
check('liste: AniSub yanıt vermezse liste yine gelir', Array.isArray(res.subtitles), JSON.stringify(res).slice(0, 200));
anisubDown = false;

// ---------- Öne alma, çift dilli ----------
const key = (opts) => `/languages=tr,en&ui=tr${opts}&auth=${adb}/subtitles/movie/tt1000001.json`;
res = await get(key('&as=1'));
console.log('   ' + labels(res.subtitles));
const trList = (list) => list.filter((s) => s.lang === 'tur').map((s) => (s.label.startsWith('[AniSub]') ? 'as' : s.label.startsWith('[AltyazıDB]') ? 'adb' : s.label.startsWith('[Çift dilli]') ? 'dual' : '?'));
check('öne alma: ayar yokken AniSub altyazısı da listede', trList(res.subtitles).includes('as') && trList(res.subtitles).includes('adb'), trList(res.subtitles).join());
res = await get(key('&as=1&pri=as'));
check('öne alma: pri=as ile AniSub Türkçede en üstte', trList(res.subtitles)[0] === 'as', trList(res.subtitles).join());
res = await get(key('&as=1&pri=adb'));
check('öne alma: pri=adb ile AltyazıDB AniSub\'ın üstünde', trList(res.subtitles)[0] === 'adb', trList(res.subtitles).join());
res = await get(key('&as=1&dual=1'));
const duals = res.subtitles.filter((s) => s.url.includes('/dual/'));
check('çift dilli: AniSub altyazısı birleştirmeye girmez', duals.length >= 1 && duals.every((s) => {
  const refs = JSON.parse(Buffer.from(s.url.match(/\/dual\/([\w-]+)\.srt$/)[1], 'base64url').toString());
  return !JSON.stringify(refs).includes('anisub');
}), duals.map((s) => s.url).join(' '));
check('çift dilli: AniSub adresi hiçbir dosya adresinin içinde yok', res.subtitles.filter((s) => !s.label.startsWith('[AniSub]')).every((s) => !s.url.includes('anisub')));

// ---------- Manifest ----------
const manifest = await get('/languages=tr&ui=tr&as=1/manifest.json');
check('manifest: açıklamada AniSub kaynağı yazar', manifest.description.includes('AniSub'), manifest.description);
check('manifest: yalnızca AniSub açıkken yapılandırma tamam', manifest.behaviorHints.configurationRequired === false);
check('manifest: as=1 yoksa yapılandırma gerekli, kaynaklar arasında AniSub yazmaz', (await get('/languages=tr&ui=tr/manifest.json')).behaviorHints.configurationRequired === true
  && (await get('/languages=tr&ui=tr/manifest.json')).description.includes('Kaynaklar: —.') && (await get('/manifest.json')).behaviorHints.configurationRequired === true);

// ---------- Kaynak denemesi ----------
calls.length = 0;
res = await post('/api/test', { languages: ['tr'], anisub: true }, '10.9.0.1');
check('deneme: yalnızca AniSub açıkken çalışır ve ulaşılabilirliği söyler', res.status === 200 && JSON.stringify(res.data.results.map(({ ms, ...rest }) => rest)) === JSON.stringify([{ source: 'anisub', status: 'ok', reachable: true }]) && Number.isInteger(res.data.results[0].ms), JSON.stringify(res.data));
check('deneme: yalnızca manifest okunur', asCalls().length === 1 && asCalls()[0].path === '/manifest.json', JSON.stringify(asCalls()));
anisubDown = true;
res = await post('/api/test', { languages: ['tr'], anisub: true }, '10.9.0.2');
check('deneme: AniSub yanıt vermezse "çalışmıyor" (anahtar hatası değil)', JSON.stringify(res.data.results.map(({ ms, ...rest }) => rest)) === JSON.stringify([{ source: 'anisub', status: 'error' }]) && Number.isInteger(res.data.results[0].ms), JSON.stringify(res.data));
anisubDown = false;
res = await post('/api/test', { languages: ['tr'], anisub: 'evet' }, '10.9.0.3');
check('deneme: anisub yalnızca true ise açılır', !res.data.results?.some((r) => r.source === 'anisub'), JSON.stringify(res.data));

// ---------- Metinler ----------
const keys = Object.keys(STRINGS.tr);
check('metinler: 13 dilde aynı anahtarlar, boş metin yok', Object.keys(STRINGS).length === 13 && Object.values(STRINGS).every((s) => JSON.stringify(Object.keys(s)) === JSON.stringify(keys) && Object.values(s).every((v) => (Array.isArray(v) ? v.length : v))));
check('metinler: yer tutucular her dilde aynı', Object.values(STRINGS).every((s) => keys.every((k) => JSON.stringify(String(s[k]).match(/\{\w+\}/g)?.sort()) === JSON.stringify(String(STRINGS.tr[k]).match(/\{\w+\}/g)?.sort()))));
check('metinler: AniSub etiketi her dilde "AniSub" adını taşır', Object.values(STRINGS).every((s) => s.tagAnisub.includes('[AniSub]')));

// ---------- Ayar sayfası ----------
const downloads = [];
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
    fetch: (url, init = {}) => (String(url).startsWith('http://127.0.0.1') ? realFetch(url, { ...init, headers: { ...init.headers, 'x-forwarded-for': '10.0.0.8' } }) : globalThis.fetch(url, init)),
    Intl, setTimeout, setInterval: () => 0, clearInterval() {}, performance: { now: () => 0 }, location: { hash: '', pathname: '/configure', search: '' }, history: { replaceState() {} }, addEventListener() {}, matchMedia: () => ({ matches: false }), console, JSON, Object, Array, Map, Set, String, Number, Boolean, Promise, URL, Blob,
  });
  for (const code of [...pageHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1])) vm.runInContext(code, context);
  return { $, storage };
}
const link = (p) => p.$('url').textContent;
const html = await text('/configure');
check('sayfa: AniSub bölümü, kutusu ve açıklama satırı var', ['id="anisubPanel"', 'id="anisub"', 'data-i18n="anisubIntro"', 'data-i18n="anisubLabel"', 'data-i18n="tagAnisub"', 'data-i18n="howAnisub"'].every((s) => html.includes(s)));
check('sayfa: iletişim satırı (X ve Discord)', html.includes('<a href="https://x.com/Diavelin" target="_blank" rel="noopener">X (@Diavelin)</a>') && html.includes('<a href="https://discord.com/users/163213047597498368" target="_blank" rel="noopener">Discord (diavelin)</a>') && html.includes('data-i18n="contactText"'));
let page = runPage(html);
check('sayfa: başta kapalı, adres hazır değil, deneme kapalı', page.$('anisub').checked === false && link(page) === '—' && page.$('test').disabled === true, link(page));
check('sayfa: site Türkçeyken AniSub bölümü ve açıklama satırı görünür', page.$('anisubPanel').hidden === false && page.$('anisubLegend').hidden === false);
check('sayfa: öne alma listesinde AniSub var', page.$('pri').children.map((o) => o.value).join() === ',os,sd,ss,sro,adb,gd,tdb,as' && page.$('pri').children.at(-1).text === 'AniSub');
check('sayfa: arama bölümü açıklamasında AniSub notu', (page.$('findSum').textContent + ' ' + page.$('findRest').textContent).endsWith(STRINGS.tr.findAnisub.replace('{anisub}', STRINGS.tr.tagAnisub)), (page.$('findSum').textContent + ' ' + page.$('findRest').textContent));
page.$('anisub').checked = true; page.$('anisub').fire('change');
check('sayfa: AniSub tek başına yeterli, adrese as=1 eklenir', link(page) === `${BASE}/languages=tr&ui=tr&as=1/manifest.json` && page.$('test').disabled === false, link(page));
check('sayfa: ayar hatırlanır', JSON.parse(page.storage.get('saved')).anisub === true);
await page.$('test').fire('click');
check('sayfa: deneme sonucu "bağlantı çalışıyor"', /^✓ AniSub: bağlantı çalışıyor\. \(\d+ ms\)$/.test(page.$('testResult').children.map((c) => c.textContent).join()), page.$('testResult').children.map((c) => c.textContent).join(' | '));
page.$('pri').value = 'as'; page.$('pri').fire('change');
page.$('ui').value = 'en'; page.$('ui').fire('change');
check('sayfa: site İngilizceye geçince AniSub bölümü, açıklama satırı ve arama notu gizlenir', page.$('anisubPanel').hidden === true && page.$('anisubLegend').hidden === true && !(page.$('findSum').textContent + ' ' + page.$('findRest').textContent).includes(STRINGS.en.findAnisub.replace('{anisub}', STRINGS.en.tagAnisub)), (page.$('findSum').textContent + ' ' + page.$('findRest').textContent));
check('sayfa: gizliyken AniSub (ve onu öne alma) adrese yazılmaz; tek kaynak oysa adres yok, deneme sonucu silinir', link(page) === '—' && page.$('test').disabled === true && page.$('testResult').children.length === 0, link(page));
check('sayfa: gizliyken öne alma listesinde AniSub yok', page.$('pri').children.map((o) => o.value).join() === ',os,sd,ss,sro,adb,gd,tdb' && page.$('pri').value === '');
page.$('ui').value = 'tr'; page.$('ui').fire('change');
check('sayfa: Türkçeye dönünce seçim geri gelir', page.$('anisubPanel').hidden === false && page.$('anisub').checked === true && link(page) === `${BASE}/languages=tr&ui=tr&as=1&pri=as/manifest.json` && page.$('pri').value === 'as', link(page));
page.$('anisub').checked = false; page.$('anisub').fire('change');
check('sayfa: kapatılınca adres yok, deneme kapalı', link(page) === '—' && page.$('test').disabled === true, link(page));
check('sayfa: kapalı olduğu hatırlanır', JSON.parse(page.storage.get('saved')).anisub === false);
page = runPage(await text(`/languages=tr,en&ui=tr&max=10&clean=1&gd=1&as=1&dual=1&pri=as&auth=${adb}/configure`));
check('sayfa: bütün ayarlarla adres sırası (as=1 gd=1 sonrasında)', link(page) === `${BASE}/languages=tr,en&ui=tr&max=10&clean=1&gd=1&as=1&dual=1&pri=as&auth=${adb}/manifest.json` && page.$('anisub').checked === true && page.$('pri').value === 'as', link(page));
page = runPage(await text(`/languages=tr,en&ui=en&gd=1&as=1&pri=as&auth=${adb}/configure`));
check('sayfa: arayüzü İngilizce adres açılınca AniSub bölümü gizli, adreste AniSub yazmaz', page.$('anisubPanel').hidden === true && link(page) === `${BASE}/languages=tr,en&ui=en&gd=1&auth=${adb}/manifest.json`, link(page));
page = runPage(await text('/configure'), { auth: null, sources: { os: null }, selected: ['tr'], max: null, match: true, gestdown: true, anisub: true, prefer: 'as' });
check('sayfa: hatırlanan ayar yüklenir', link(page) === `${BASE}/languages=tr&ui=tr&gd=1&as=1&pri=as/manifest.json` && page.$('anisub').checked === true, link(page));
page = runPage(await text('/configure'), { auth: null, sources: { os: null }, selected: ['tr'], max: null, match: true, anisub: 'evet' });
check('sayfa: bozuk hatırlanan değer yok sayılır (kapalı kalır)', page.$('anisub').checked === false && link(page) === '—');

// Altyazı ara ve indir: AniSub altyazıları gösterilmez.
page = runPage(await text(`/languages=tr,en&ui=tr&as=1&auth=${adb}/configure`));
page.$('findQuery').value = 'ornek film';
await page.$('findForm').fire('submit');
await page.$('findTitles').children[0].fire('click');
await new Promise((resolve) => setTimeout(resolve, 200));
const rows = page.$('findSubs').children.map((li) => (li.children[0].children[0].children.map((c) => c.textContent).join('') + ' | ' + li.children[0].children[1].textContent));
check('arama: AniSub altyazıları listelenmez, diğerleri listelenir', rows.length >= 2 && rows.every((r) => !r.includes('AniSub')), rows.join(' / '));

await new Promise((resolve) => setTimeout(resolve, 200));
server.close();
check('AniSub\'da hiçbir zaman dosya adresine (/stremio/) istek gitmedi', !calls.some((c) => c.host === 'anisub.co' && c.path.startsWith('/stremio/')));
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
