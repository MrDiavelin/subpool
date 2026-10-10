// v3.12.0: uyum notları (dosya eşleşmesi / sürüm adı), yabancı konuşmalar, kaynak denemesinde süre, tanıtım metinleri.
import { VERSION } from './setup.mjs';
// Hiçbir gerçek siteye istek gitmez; bütün dış servisler sahtedir, hak harcanmaz.
import { createServer } from 'node:http';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { parseRelease, sameRelease } = await import('../src/release.js');
const { STRINGS } = await import('../src/i18n.js');

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 900) : ''}`); };

const TR_SRT = ['1', '00:00:05,000 --> 00:00:07,000', 'Merhaba, nasılsın?', '', '2', '00:00:08,000 --> 00:00:10,000', 'İyiyim.', '', '3', '00:00:20,000 --> 00:00:22,000', 'Güle güle.', ''].join('\n') + '\n';
const EN_SRT = ['1', '00:00:05,100 --> 00:00:06,900', 'Hello, how are you?', '', '2', '00:00:08,200 --> 00:00:10,100', 'Fine.', '', '3', '00:00:20,000 --> 00:00:22,000', 'Goodbye.', ''].join('\n') + '\n';
const SPARKS = 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS';
const FLUX = 'Ornek.Film.2024.1080p.WEB-DL.H264-FLUX';

// ---------- Kural (doğrudan) ----------
const same = (video, sub) => sameRelease(parseRelease(video), parseRelease(sub));
check('kural: aynı grup, aynı kaynak, aynı kurgu → uyuyor', same(`${SPARKS}.mkv`, SPARKS) && same(`${SPARKS}.mkv`, 'Ornek.Film.2024.720p.BluRay.x264-SPARKS'));
check('kural: grup farklıysa uymaz', !same(`${SPARKS}.mkv`, 'Ornek.Film.2024.1080p.BluRay.x264-OTHER'));
check('kural: kaynak farklıysa uymaz (aynı grup olsa da)', !same(`${SPARKS}.mkv`, 'Ornek.Film.2024.1080p.WEB-DL.x264-SPARKS'));
check('kural: kurgu farklıysa uymaz', !same(`${SPARKS}.mkv`, 'Ornek.Film.2024.EXTENDED.1080p.BluRay.x264-SPARKS') && same('Ornek.Film.2024.EXTENDED.1080p.BluRay.x264-SPARKS.mkv', 'Ornek.Film.2024.Extended.720p.BluRay.x264-SPARKS'));
check('kural: grubu ya da kaynağı okunamayan adlarda hiçbir şey söylenmez', !same('Ornek.Film.2024.mkv', 'Ornek.Film.2024') && !same('Ornek.Film.2024.1080p.x264-SPARKS.mkv', 'Ornek.Film.2024.1080p.x264-SPARKS') && !same(`${SPARKS}.mkv`, 'Ornek Film'));
check('kural: bölüm ya da sezon çelişirse uymaz', same('Ornek.Dizi.S01E02.1080p.WEB-DL.x264-NTb.mkv', 'Ornek.Dizi.S01E02.720p.WEB-DL.x264-NTb')
  && !same('Ornek.Dizi.S01E02.1080p.WEB-DL.x264-NTb.mkv', 'Ornek.Dizi.S01E03.1080p.WEB-DL.x264-NTb') && !same('Ornek.Dizi.S01E02.1080p.WEB-DL.x264-NTb.mkv', 'Ornek.Dizi.S02E02.1080p.WEB-DL.x264-NTb'));

// ---------- Sahte siteler ----------
const realFetch = globalThis.fetch;
const calls = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const os = (o) => ({ attributes: { language: 'tr', legacy_subtitle_id: null, release: '', moviehash_match: false, from_trusted: false, ai_translated: false, machine_translated: false, download_count: 10, hearing_impaired: false, foreign_parts_only: false, ...o, files: [{ file_id: o.file, file_name: 'x.srt' }] } });
const official = (id, lang) => ({ id: String(id), url: `https://subs5.strem.io/${lang}/download/file/${id}`, lang });

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  if (url.hostname === 'anisub.co') return json({ subtitles: [] });
  const q = url.searchParams;
  calls.push(`${init?.method || 'GET'} ${url.hostname}${url.pathname}?${q}`.replace(/api_key=[^&]*/, 'api_key=…'));
  switch (url.hostname) {
    case 'api.opensubtitles.com': {
      if (url.pathname === '/api/v1/login') return json({ token: 'sahte-oturum', user: { allowed_downloads: 20 } });
      if (url.pathname === '/api/v1/infos/user') return json({ data: { allowed_downloads: 20, remaining_downloads: 17 } });
      // Sahte indirme: gerçek siteye gitmez, hak harcanmaz.
      if (url.pathname === '/api/v1/download') return json({ link: `https://dl.sahte.test/${JSON.parse(init.body).file_id}.srt`, remaining: 12 });
      if (url.pathname !== '/api/v1/subtitles') throw new Error('beklenmeyen istek: ' + url.pathname);
      // OpenSubtitles dosya eşleşmesini yalnızca aramada dosyanın hash'i gönderildiyse bildirir.
      const hashed = !!q.get('moviehash');
      return json({ total_pages: 1, data: [
        os({ file: 1, legacy_subtitle_id: 9001, release: SPARKS }),
        os({ file: 2, release: FLUX, moviehash_match: hashed }),
        os({ file: 3, release: SPARKS, moviehash_match: hashed }),
        os({ file: 4, release: SPARKS, moviehash_match: hashed, foreign_parts_only: true, download_count: 90000 }),
        os({ file: 5, legacy_subtitle_id: 9005, release: SPARKS, foreign_parts_only: true, hearing_impaired: true }),
        os({ file: 7, release: 'Ornek.Film.2024.1080p.WEB-DL.x264-SPARKS' }),
        os({ file: 8, release: 'Ornek.Film.2024.EXTENDED.1080p.BluRay.x264-SPARKS' }),
        os({ file: 9, release: 'Ornek.Film.2024.1080p.BluRay.x264-OTHER' }),
        os({ file: 10, language: 'en', release: SPARKS }),
      ] });
    }
    case 'dl.sahte.test':
      return new Response(TR_SRT, { headers: { 'content-type': 'text/plain' } });
    case 'opensubtitles-v3.strem.io':
      return json({ subtitles: [official(9001, 'tur'), official(9005, 'tur')] });
    case 'altyazidb.com': {
      if (url.pathname.endsWith('/me')) return json({ success: true });
      if (url.pathname.endsWith('/search')) {
        const item = (id, release) => ({ id, language: q.get('lang'), releases: [release], hearing_impaired: 0, ai_ceviri: 0, downloads: 5 });
        if (q.get('lang') === 'tr') return json({ data: [item(700, FLUX)] });
        if (q.get('lang') === 'en') return json({ data: [item(800, FLUX)] });
        return json({ data: [] });
      }
      if (url.pathname.endsWith('/subtitle')) return new Response(q.get('sub_id') === '800' ? EN_SRT : TR_SRT, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      break;
    }
    case 'v3-cinemeta.strem.io':
      return json({ meta: {} });
  }
  throw new Error('beklenmeyen dış istek: ' + url.hostname + url.pathname);
};

const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '' })).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const get = (path) => realFetch(base + path).then((res) => res.json());
const text = (path) => realFetch(base + path).then((res) => res.text());
const post = (path, body, ip = '10.0.0.1') => realFetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) })
  .then(async (res) => ({ status: res.status, data: await res.json() }));
const sealer = createSealer(process.env.CONFIG_SECRET);
// OpenSubtitles hesabı + AltyazıDB anahtarı (ikisi de sahte).
const account = (name) => sealer.seal({ u: name, p: 'sahte-sifre', ad: 'sahte-altyazidb-1234' });
const auth = account('sahte-kullanici');
const FILE = encodeURIComponent(`${SPARKS}.mkv`);
const HASH = '0123456789abcdef';
const movie = ({ options = '', languages = 'tr,en', ui = 'tr', file = true, hash = true, key = auth } = {}) => {
  const extra = [file && `filename=${FILE}`, hash && `videoHash=${HASH}`].filter(Boolean).join('&');
  return get(`/languages=${languages}&ui=${ui}${options}&auth=${key}/subtitles/movie/tt1000001${extra ? '/' + extra : ''}.json`).then((res) => res.subtitles);
};
const show = (list) => console.log(list.map((s) => `   ${s.lang} | ${s.label}`).join('\n'));
const file = (list, n) => list.find((s) => s.url.endsWith(`/tt1000001/${n}.srt`));
const off = (list, id) => list.find((s) => s.url.endsWith(`/download/file/${id}`));
const adb = (list, lang) => list.find((s) => s.url.includes(`/adb/${lang}/`) && !s.url.includes('/dual/'));
const tag = (s) => s.label.split(' | ')[0];
const T = STRINGS.tr;

const health = await get('/api/health');
check('sürüm 3.12.0', health.version === VERSION && (await get('/manifest.json')).version === VERSION, JSON.stringify(health));

// ---------- Uyum notları ----------
let list = await movie();
show(list);
check('dosya eşleşmesi: hash eşleşen altyazıda "Tam dosya eşleşmesi" yazar', tag(file(list, 2)) === `${T.tagQuota} · Tam dosya eşleşmesi` && file(list, 2).label === `${T.tagQuota} · Tam dosya eşleşmesi | ${FLUX}`, file(list, 2).label);
check('tek not: hem dosya hem sürüm adı uyuyorsa yalnızca dosya eşleşmesi yazar', tag(file(list, 3)) === `${T.tagQuota} · Tam dosya eşleşmesi`, file(list, 3).label);
check('sürüm adı: aynı grup + kaynak + kurgu olan altyazıda "Sürüm adı uyuyor" yazar', tag(off(list, 9001)) === `${T.tagOfficial} · Sürüm adı uyuyor`, off(list, 9001).label);
check('sürüm adı: kaynağı, kurgusu ya da grubu farklı olanlarda not yok', [7, 8, 9].every((n) => tag(file(list, n)) === T.tagQuota) && tag(adb(list, 'tr')) === T.tagAltyazidb, [7, 8, 9].map((n) => file(list, n).label).join(' / '));
check('notlar: bir satırda en fazla bir uyum notu', list.every((s) => !(s.label.includes('Tam dosya eşleşmesi') && s.label.includes('Sürüm adı uyuyor'))));
check('notlar: id de etiketi taşır (Nuvio TV)', list.every((s) => s.id.startsWith(s.label)));
check('notlar: adreslere yazılmaz', list.every((s) => !/eşleşmesi|uyuyor|match/i.test(decodeURIComponent(s.url))));

list = await movie({ hash: false });
check('dosya eşleşmesi: oynatıcı hash göndermezse yazmaz, sürüm adı notu kalır', !list.some((s) => s.label.includes('Tam dosya eşleşmesi')) && tag(file(list, 3)) === `${T.tagQuota} · Sürüm adı uyuyor` && tag(off(list, 9001)) === `${T.tagOfficial} · Sürüm adı uyuyor`, list.map(tag).join(' / '));
list = await movie({ file: false });
check('sürüm adı: dosya adı gelmezse yazmaz, dosya eşleşmesi kalır', !list.some((s) => s.label.includes('Sürüm adı uyuyor')) && tag(file(list, 3)) === `${T.tagQuota} · Tam dosya eşleşmesi`, list.map(tag).join(' / '));
list = await movie({ options: '&match=0' });
check('sürüm adı: akıllı eşleştirme kapalıyken yazmaz, dosya eşleşmesi kalır', !list.some((s) => s.label.includes('Sürüm adı uyuyor')) && tag(file(list, 2)) === `${T.tagQuota} · Tam dosya eşleşmesi` && tag(off(list, 9001)) === T.tagOfficial, list.map(tag).join(' / '));
list = await movie({ file: false, hash: false });
check('notlar: dosya adı ve hash yokken etiketler eskisi gibi', list.every((s) => !/eşleşmesi|uyuyor/.test(s.label)) && tag(file(list, 3)) === T.tagQuota, list.map(tag).join(' / '));
list = await movie({ ui: 'en' });
check('notlar: arayüz dilinde yazılır', tag(file(list, 3)) === `${STRINGS.en.tagQuota} · Exact file match` && tag(off(list, 9001)) === `${STRINGS.en.tagOfficial} · Release name matches` && tag(file(list, 10)) === `${STRINGS.en.tagQuota} · Release name matches`
  && tag(off(list, 9005)) === `${STRINGS.en.tagOfficial} · Release name matches · Foreign parts only · HI`, list.map(tag).join(' / '));

// ---------- Yabancı konuşmalar ----------
list = await movie();
const tr = list.filter((s) => s.lang === 'tur');
const at = (s) => tr.indexOf(s);
const isQuota = (s) => s.label.startsWith(T.tagQuota);
check('yabancı konuşmalar: etiket uyum notundan sonra, HI\'dan önce yazılır', tag(off(list, 9005)) === `${T.tagOfficial} · Sürüm adı uyuyor · Yabancı konuşmalar · HI`, off(list, 9005).label);
check('yabancı konuşmalar: uyum notundan sonra yazılır', tag(file(list, 4)) === `${T.tagQuota} · Tam dosya eşleşmesi · Yabancı konuşmalar`, file(list, 4).label);
check('yabancı konuşmalar: ücretsiz olan, diğer ücretsizlerin altında ama hak harcayanların üstünde', tr.filter((s) => !isQuota(s)).at(-1) === off(list, 9005) && at(off(list, 9005)) < Math.min(...tr.filter(isQuota).map(at)), tr.map(tag).join(' / '));
check('yabancı konuşmalar: hak harcayan, dosyası eşleşse ve çok indirilmiş olsa da grubunun sonunda', tr.at(-1) === file(list, 4) && at(file(list, 3)) < at(file(list, 4)), tr.map(tag).join(' / '));
check('sıra: ücretsizler yine hak harcayanların üstünde, dosyası eşleşen hak harcayanların başında', tr.findIndex(isQuota) === tr.filter((s) => !isQuota(s)).length && [2, 3].includes(Number(tr.find(isQuota).url.match(/(\d+)\.srt$/)[1])), tr.map(tag).join(' / '));
list = await movie({ options: '&pri=os' });
check('yabancı konuşmalar: öne alınan kaynaktan olsa da diğer ücretsizlerin altında', list.filter((s) => s.lang === 'tur' && !isQuota(s)).at(-1) === off(list, 9005) && list.filter((s) => s.lang === 'tur')[0] === off(list, 9001), list.filter((s) => s.lang === 'tur').map(tag).join(' / '));
list = await movie({ options: '&hi=hide' });
check('yabancı konuşmalar: HI gizlenince HI olan gider, olmayan kalır', !off(list, 9005) && !!file(list, 4));
list = await movie({ options: '&max=2' });
check('dil başına sınır: yabancı konuşmalar normal altyazıların önüne geçmez', list.filter((s) => s.lang === 'tur').every((s) => !s.label.includes('Yabancı konuşmalar')), list.map(tag).join(' / '));

// ---------- Çift dilli ----------
// İki altyazı (biri yalnızca yabancı konuşmalar) sahte indirmeyle havuza girer; ayrı hesaplar, çünkü hesap başına 5 saniyede bir indirme olur.
calls.length = 0;
const first = await text(`/languages=tr,en&ui=tr&auth=${account('havuz-bir')}/sub/tr/tt1000001/4.srt`);
const second = await text(`/languages=tr,en&ui=tr&auth=${account('havuz-iki')}/sub/tr/tt1000001/3.srt`);
check('havuz: iki (sahte) indirme yapıldı', first.includes('Merhaba') && second.includes('Merhaba') && calls.filter((c) => c.includes('/api/v1/download')).length === 2, calls.join(' | '));
list = await movie({ options: '&dual=1' });
show(list);
const isDual = (s) => s.url.includes('/dual/');
const refs = (s) => JSON.parse(Buffer.from(s.url.match(/\/dual\/([\w-]+)\.srt$/)[1], 'base64url').toString());
const duals = list.filter(isDual);
check('havuz: indirilenler ücretsiz görünür, yabancı konuşmalar notu kalır', tag(file(list, 4)) === `${T.tagPool} · Tam dosya eşleşmesi · Yabancı konuşmalar` && tag(file(list, 3)) === `${T.tagPool} · Tam dosya eşleşmesi`, [3, 4].map((n) => file(list, n).label).join(' / '));
check('çift dilli: havuzdaki normal altyazı kullanılır', duals.some((s) => refs(s)[0].endsWith('/tt1000001/3.srt')), duals.map((s) => refs(s).join(' + ')).join(' / '));
check('çift dilli: yalnızca yabancı konuşmaları içeren altyazı kullanılmaz', duals.length > 0 && duals.every((s) => refs(s).every((ref) => !ref.endsWith('/tt1000001/4.srt'))), duals.map((s) => refs(s).join(' + ')).join(' / '));
const dualPool = duals.find((s) => refs(s)[0].endsWith('/tt1000001/3.srt'));
check('çift dilli: uyum notu birinci dilin altyazısından gelir', dualPool.label === `${T.tagDual} · Türkçe + İngilizce · Tam dosya eşleşmesi | ${SPARKS}` && duals.every((s) => !s.label.includes('Yabancı konuşmalar')), duals.map((s) => s.label).join(' / '));
calls.length = 0;
const merged = await text(dualPool.url.replace(base, ''));
check('çift dilli: birleşik altyazı açılır, hak harcamaz', merged.includes('Merhaba') && merged.includes('<i>Hello, how are you?</i>') && !calls.some((c) => c.includes('/api/v1/download')), merged.slice(0, 120));

// ---------- Kaynak denemesi: süre ----------
let res = await post('/api/test', { auth, languages: ['tr', 'en'] });
check('deneme: her kaynağın süresi milisaniye olarak gelir', res.status === 200 && res.data.results.length === 2 && res.data.results.every((r) => r.status === 'ok' && Number.isInteger(r.ms) && r.ms >= 0 && r.ms < 10000), JSON.stringify(res.data));
check('deneme: eski alanlar duruyor', res.data.results[0].source === 'os' && res.data.results[0].count === 9 && res.data.results[0].remaining === 17 && res.data.results[1].source === 'altyazidb' && res.data.results[1].count === 2, JSON.stringify(res.data));
res = await post('/api/test', { auth: sealer.seal({ ss: 'sahte-subsource-1234' }), languages: ['tr'] }, '10.0.0.2');
check('deneme: çalışmayan kaynakta da süre gelir', res.data.results.length === 1 && res.data.results[0].status !== 'ok' && Number.isInteger(res.data.results[0].ms), JSON.stringify(res.data));

// ---------- Metinler ----------
const uis = Object.keys(STRINGS);
check('metinler: üç yeni not 13 dilde var, ayraç içermez', uis.length === 13 && uis.every((ui) => ['matchFile', 'matchRelease', 'forced'].every((k) => STRINGS[ui][k] && !/[|·]/.test(STRINGS[ui][k]))));
check('metinler: notlar dilden dile farklı (çevrilmiş)', new Set(uis.map((ui) => STRINGS[ui].matchFile)).size === 13 && new Set(uis.map((ui) => STRINGS[ui].forced)).size === 13);
check('tanıtım: her dilde Gestdown, yalnızca Türkçe ve İngilizcede AltyazıDB, yalnızca Türkçede AniSub', uis.every((ui) => ['tagline', 'manifestDesc'].every((k) => STRINGS[ui][k].includes('Gestdown')
  && STRINGS[ui][k].includes('AltyazıDB') === (ui === 'tr' || ui === 'en') && STRINGS[ui][k].includes('AniSub') === (ui === 'tr'))), uis.filter((ui) => !STRINGS[ui].tagline.includes('Gestdown')).join());
check('tanıtım: yer tutucular duruyor', uis.every((ui) => STRINGS[ui].manifestDesc.includes('{sources}') && STRINGS[ui].manifestDesc.includes('{langs}')));
let manifest = await get(`/languages=tr,en&ui=tr&gd=1&auth=${auth}/manifest.json`);
check('manifest: Türkçe açıklama', manifest.description === 'OpenSubtitles, SubDL, SubSource, AltyazıDB, Gestdown ve AniSub altyazılarını tek listede toplar; ücretsiz olanları işaretler. Kaynaklar: OpenSubtitles, AltyazıDB, Gestdown. Diller: Türkçe, İngilizce.', manifest.description);
manifest = await get(`/languages=en&ui=en&auth=${auth}/manifest.json`);
check('manifest: İngilizce açıklama', manifest.description === 'Gathers OpenSubtitles, SubDL, SubSource, AltyazıDB and Gestdown subtitles into one list and marks the free ones. Sources: OpenSubtitles, AltyazıDB. Languages: English.', manifest.description);
manifest = await get('/languages=de&ui=de&gd=1/manifest.json');
check('manifest: Almanca açıklama', manifest.description.startsWith('Fasst Untertitel von OpenSubtitles, SubDL, SubSource und Gestdown in einer Liste zusammen') && !manifest.description.includes('AniSub'), manifest.description);
const html = await text('/configure');
check('sayfa: yeni tanıtım cümlesi sayfada, sunucuya özel uyum notları değil', html.includes("AltyazıDB, Gestdown ve AniSub'daki") && html.includes('SubSource, AltyazıDB and Gestdown into one list') && !html.includes('matchRelease') && !html.includes('matchFile'));
check('sayfa: deneme süresi satıra yazılır', html.includes("' (' + r.ms + ' ms)'"));

server.close();
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
