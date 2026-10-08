// 3.14.0: "ASS/SSA stilini koru" ayarı. Hiçbir gerçek siteye istek gitmez, hak harcanmaz.
import { VERSION } from './setup.mjs';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { isAss, assToSrt } = await import('../src/subtitle.js');
const { STRINGS } = await import('../src/i18n.js');

const ARC = new URL('./fixtures/', import.meta.url);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 500) : ''}`); };

// ---------- Örnek altyazılar ----------
const ass = (lines, head = '[Script Info]') => [
  head, 'Title: deneme', 'ScriptType: v4.00+', '',
  '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour', 'Style: Default,Arial,48,&H00FFFFFF', 'Style: Sign,Impact,60,&H0000FFFF', '',
  '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ...lines, '',
].join('\r\n');
const ASS_TR = ass([
  'Dialogue: 0,0:00:05.00,0:00:07.00,Default,,0,0,0,,Merhaba, nasılsın? [kapı çarpar]',
  'Dialogue: 0,0:00:08.00,0:00:10.00,Sign,,0,0,0,,{\\an8\\c&H0000FF&}Tabela yazısı',
  'Dialogue: 0,0:00:20.00,0:00:22.00,Default,,0,0,0,,{\\i1}Güle güle.{\\i0}',
]);
const SRT_TR = ['1', '00:00:05,000 --> 00:00:07,000', 'Merhaba. [kapı çarpar]', '', '2', '00:00:08,000 --> 00:00:10,000', 'İyiyim.', ''].join('\n');
const SRT_EN = ['1', '00:00:05,000 --> 00:00:07,000', 'Hello, how are you?', '', '2', '00:00:08,000 --> 00:00:10,000', 'Sign text', '', '3', '00:00:20,000 --> 00:00:22,000', 'Goodbye.', ''].join('\n');
// 3 MB'tan büyük ASS: stiliyle saklanmaz, SRT'ye çevrilir.
const BIG = ass(Array.from({ length: 40000 }, (_, i) => `Dialogue: 0,0:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.00,0:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.90,Default,,0,0,0,,{\\an8}Satır ${i} ${'x'.repeat(40)}`));
// Yalnızca yorum satırı olan dosya: konuşma yok, ASS sayılmaz.
const NO_DIALOGUE = ass(['Comment: 0,0:00:05.00,0:00:07.00,Default,,0,0,0,,not']);

check('isAss: standart ASS dosyası tanınır', isAss(ASS_TR) && isAss('\n  ' + ASS_TR) && isAss(ASS_TR.replace('[Script Info]', '[script info]')));
check('isAss: SRT, boş metin, konuşmasız ya da [Script Info] ile başlamayan dosya ASS sayılmaz', !isAss(SRT_TR) && !isAss('') && !isAss(NO_DIALOGUE) && !isAss('; yorum\n' + ASS_TR) && !isAss(assToSrt(ASS_TR)));
check('örnek: büyük dosya 3 MB sınırının üstünde', Buffer.byteLength(BIG) > 3 * 1024 * 1024, Buffer.byteLength(BIG));

// ---------- Sahte siteler ----------
const realFetch = globalThis.fetch;
const calls = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const SHOW = 'aaaaaaaa-0000-4000-8000-000000000001';
const GD = {
  ass: '11111111-1111-4111-8111-111111111111', srt: '22222222-2222-4222-8222-222222222222', big: '33333333-3333-4333-8333-333333333333',
  bom: '44444444-4444-4444-8444-444444444444', none: '55555555-5555-4555-8555-555555555555', en: '66666666-6666-4666-8666-666666666666',
};
const GD_BODY = {
  [GD.ass]: ASS_TR, [GD.srt]: SRT_TR, [GD.big]: BIG, [GD.none]: NO_DIALOGUE, [GD.en]: SRT_EN,
  // Başında BOM ve boş satır olan dosya.
  [GD.bom]: '\uFEFF\r\n\r\n' + ASS_TR,
};
const gd = (id, version) => ({ subtitleId: id, version, completed: true, hearingImpaired: false, corrected: false, hd: false, downloadUri: `/subtitles/download/${id}`, language: 'x', downloadCount: 10, source: 'Addic7ed', qualities: [], release: null });
const SD_FILES = { '/subtitle/900-1.zip': 'assonly.zip', '/subtitle/900-2.zip': 'anime.rar', '/subtitle/900-3.zip': 'mixed.zip' };

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  const q = url.searchParams;
  calls.push(`${init?.method || 'GET'} ${url.hostname}${url.pathname}?${q}`.replace(/api_key=[^&]*/, 'api_key=…'));
  switch (url.hostname) {
    case 'opensubtitles-v3.strem.io':
      return json({ subtitles: [] });
    case 'v3-cinemeta.strem.io':
      if (url.pathname.startsWith('/meta/movie/')) return json({ meta: { name: 'Ornek Film' } });
      return json({ meta: { id: 'tt2000001', name: 'Ornek Dizi', releaseInfo: '2020-', genres: ['Drama'], tvdb_id: 555001, videos: [{ season: 1, episode: 1 }, { season: 1, episode: 2 }] } });
    case 'api.gestdown.info': {
      const path = url.pathname.split('/').filter(Boolean);
      if (path[0] === 'shows') return json({ shows: [{ id: SHOW, name: 'Ornek Dizi', tvDbId: 555001 }] });
      if (path[0] === 'subtitles' && path[1] === 'get') {
        const lang = path[5];
        if (lang === 'tr') return json({ matchingSubtitles: [gd(GD.ass, 'ASS'), gd(GD.srt, 'SRT'), gd(GD.big, 'BUYUK'), gd(GD.bom, 'BOM'), gd(GD.none, 'KONUSMASIZ')] });
        if (lang === 'en') return json({ matchingSubtitles: [gd(GD.en, 'ASS')] });
        return json({ matchingSubtitles: [] });
      }
      if (path[0] === 'subtitles' && path[1] === 'download') return new Response(new TextEncoder().encode(GD_BODY[path[2]]), { headers: { 'content-type': 'text/plain' } });
      break;
    }
    case 'api.subdl.com':
      return json({ status: true, subtitles: Object.keys(SD_FILES).map((path, i) => ({ url: path, language: 'TR', release_name: `Ornek.Film.2024.SURUM${i + 1}`, releases: [], hi: false })) });
    case 'dl.subdl.com':
      return new Response(new Uint8Array(readFileSync(new URL(SD_FILES[url.pathname], ARC))), { headers: { 'content-type': 'application/zip' } });
  }
  throw new Error('beklenmeyen dış istek: ' + url.hostname + url.pathname);
};

const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '' })).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const get = (path) => realFetch(base + path).then((res) => res.json());
const raw = (path) => realFetch(base + path).then(async (res) => ({ status: res.status, type: res.headers.get('content-type'), text: await res.text() }));
const pathOf = (item) => new URL(item.url).pathname;
const sd = createSealer(process.env.CONFIG_SECRET).seal({ sd: 'sahte-subdl-1234' });
const SRT_TYPE = 'application/x-subrip; charset=utf-8';
const ASS_TYPE = 'text/x-ssa; charset=utf-8';
const downloads = (host) => calls.filter((c) => c.includes(host)).length;
const off = (path) => path.replace('&ass=1', '');

const manifest = await get('/manifest.json');
check('sürüm 3.14.0', manifest.version === VERSION, manifest.version);

// ---------- Ayarın okunması ve adreslere yazılması ----------
const list = (await get('/languages=tr,en&ui=tr&gd=1&ass=1/subtitles/series/tt2000001:1:2.json')).subtitles;
const plain = (await get('/languages=tr,en&ui=tr&gd=1/subtitles/series/tt2000001:1:2.json')).subtitles;
console.log(list.map((s) => `   ${s.lang} | ${s.label ?? s.id} | ${pathOf(s).slice(0, 70)}`).join('\n'));
const files = list.filter((s) => /\/gd\//.test(s.url));
check('ayar açıkken dosya adresleri "&ass=1" taşır', files.length === 6 && files.every((s) => decodeURIComponent(pathOf(s)).includes('&ass=1')), files.length);
check('ayar kapalıyken adreslerde "ass" geçmez; liste aynı sayıdadır', plain.length === list.length && plain.every((s) => !s.url.includes('ass=')));
check('adresler ".srt" ile bitmeye devam eder', files.every((s) => s.url.endsWith('.srt')));
const wrong = (await get('/languages=tr,en&ui=tr&gd=1&ass=evet/subtitles/series/tt2000001:1:2.json')).subtitles;
check('"ass=1" dışındaki değer ayarı açmaz', wrong.every((s) => !s.url.includes('ass=')));
const find = (id) => pathOf(files.find((s) => s.url.includes(id)));

// ---------- Gestdown: ASS dosyası ----------
let before = downloads('/subtitles/download/');
let out = await raw(find(GD.ass));
check('ASS + ayar açık: dosya değiştirilmeden verilir', out.status === 200 && out.text === ASS_TR, out.text.slice(0, 120));
check('ASS + ayar açık: içerik türü text/x-ssa, dosya "[Script Info]" ile başlar', out.type === ASS_TYPE && out.text.startsWith('[Script Info]'), out.type);
check('ASS + ayar açık: stil satırları ve konum/renk etiketleri korunur', out.text.includes('Style: Sign,Impact,60') && out.text.includes('{\\an8\\c&H0000FF&}'));
check('ASS: dosya kaynaktan bir kez indirilir', downloads('/subtitles/download/') === before + 1);
before = downloads('/subtitles/download/');
out = await raw(off(find(GD.ass)));
check('aynı dosya + ayar kapalı: SRT olarak verilir', out.type === SRT_TYPE && out.text === assToSrt(ASS_TR) && out.text.includes('00:00:08,000 --> 00:00:10,000\nTabela yazısı') && !out.text.includes('[Script Info]') && !out.text.includes('{'), out.text.slice(0, 200));
check('aynı dosya + ayar kapalı: italik korunur', out.text.includes('<i>Güle güle.</i>'));
check('ayar değişince dosya yeniden indirilmez (aynı önbellek kaydı)', downloads('/subtitles/download/') === before);
out = await raw(find(GD.ass));
check('ayar tekrar açılınca önbellekten yine stilli dosya gelir', out.type === ASS_TYPE && out.text === ASS_TR && downloads('/subtitles/download/') === before);

// ---------- Ses açıklaması temizliği ----------
out = await raw(find(GD.ass).replace('&ass=1', '&clean=1&ass=1'));
check('ASS + temizlik + ayar açık: dosyaya dokunulmaz', out.type === ASS_TYPE && out.text === ASS_TR);
out = await raw(find(GD.ass).replace('&ass=1', '&clean=1'));
check('ASS + temizlik + ayar kapalı: SRT, açıklama silinir', out.type === SRT_TYPE && out.text.includes('Merhaba, nasılsın?') && !out.text.includes('kapı çarpar'), out.text.slice(0, 120));
out = await raw(find(GD.srt).replace('&ass=1', '&clean=1&ass=1'));
check('SRT + temizlik + ayar açık: SRT dosyası temizlenir', out.type === SRT_TYPE && out.text.includes('Merhaba.') && !out.text.includes('kapı çarpar'), out.text);
out = await raw(find(GD.srt));
check('SRT + ayar açık: dosya SRT olarak, değişmeden gelir', out.type === SRT_TYPE && out.text.includes('Merhaba. [kapı çarpar]') && out.text.includes('-->'));

// ---------- Sınır durumları ----------
out = await raw(find(GD.big));
check('3 MB\'tan büyük ASS: ayar açık olsa da SRT\'ye çevrilir', out.type === SRT_TYPE && !out.text.includes('[Script Info]') && out.text.includes('Satır 39999') && !out.text.includes('{\\an8}'), out.text.slice(0, 100));
out = await raw(find(GD.bom));
check('başında BOM ve boş satır olan ASS: "[Script Info]" ile başlayarak verilir', out.type === ASS_TYPE && out.text.startsWith('[Script Info]') && out.text.includes('Tabela yazısı'), JSON.stringify(out.text.slice(0, 30)));
out = await raw(find(GD.none));
check('konuşma satırı olmayan dosya ASS olarak sunulmaz', out.type === SRT_TYPE, out.type);

// ---------- Çift dilli altyazı ----------
const dualList = (await get('/languages=tr,en&ui=tr&gd=1&ass=1&dual=1/subtitles/series/tt2000001:1:2.json')).subtitles;
const dual = dualList.filter((s) => s.url.includes('/dual/'));
check('çift dilli altyazı ayar açıkken de listelenir', dual.length >= 1, dual.length);
before = downloads('/subtitles/download/');
const first = dual.find((s) => Buffer.from(pathOf(s).match(/\/dual\/([\w-]+)\.srt$/)[1], 'base64url').toString().includes(GD.ass));
out = first ? await raw(pathOf(first)) : { text: '' };
check('çift dilli: ASS dosyası SRT\'ye çevrilip birleştirilir', !!first && out.type === SRT_TYPE && out.text.includes('Tabela yazısı\n<i>Sign text</i>') && !out.text.includes('[Script Info]') && !out.text.includes('{'), out.text.slice(0, 300));

// ---------- SubDL: arşivden çıkan ASS ----------
const movie = (await get(`/languages=tr&ui=tr&ass=1&auth=${sd}/subtitles/movie/tt1000001.json`)).subtitles.filter((s) => /\/sd\//.test(s.url));
check('SubDL: üç altyazı listelenir, adresler "&ass=1" taşır', movie.length === 3 && movie.every((s) => decodeURIComponent(pathOf(s)).includes('&ass=1')), movie.length);
const bodies = [];
for (const item of movie) bodies.push(await raw(pathOf(item)));
const ANIME = readFileSync(new URL('anime.ass', ARC), 'utf8');
const fromZip = bodies.filter((b) => b.type === ASS_TYPE);
check('SubDL: ZIP ve RAR içindeki .ass dosyaları stiliyle verilir', fromZip.length === 2 && fromZip.every((b) => b.text.startsWith('[Script Info]') && b.text.includes('[V4+ Styles]')), bodies.map((b) => b.type).join(' | '));
check('SubDL: RAR\'daki dosya çizim ve karaoke satırlarıyla, değişmeden gelir', fromZip.some((b) => b.text.trim() === ANIME.trim()), fromZip.map((b) => b.text.length).join(' '));
check('SubDL: arşivde hem .srt hem .ass varsa .srt verilir', bodies.filter((b) => b.type === SRT_TYPE && b.text.includes('rar ok')).length === 1);
before = downloads('dl.subdl.com');
const again = [];
for (const item of movie) again.push(await raw(off(pathOf(item))));
check('SubDL + ayar kapalı: aynı dosyalar SRT olarak gelir, yeniden indirilmez', again.every((b) => b.type === SRT_TYPE && b.text.includes('-->') && !b.text.includes('[Script Info]')) && downloads('dl.subdl.com') === before);
check('SubDL + ayar kapalı: çizim ve karaoke atılır', again.some((b) => b.text.includes('<i>Merhaba</i>, dünya')) && again.every((b) => !b.text.includes('m 0 0') && !b.text.includes('{')));

// ---------- Ayar sayfası ----------
let page = (await raw('/languages=tr&ui=tr&ass=1/configure')).text;
check('ayar sayfası: düğme var ve adresteki ayar sayfaya taşınır', page.includes('id="ass"') && page.includes('let ass = true;') && page.includes('data-i18n="assLabel"') && page.includes('data-i18n="assHint"'));
page = (await raw('/configure')).text;
check('ayar sayfası: ayar varsayılan olarak kapalı', page.includes('let ass = false;'));
check('ayar sayfası: adrese "&ass=1" yazılır, kayıtlı ayarlara eklenir', page.includes("(ass ? '&ass=1' : '')") && /hi, forced, clean, ass, gestdown/.test(page) && page.includes('if (saved?.ass === true) ass = true;'));
check('ayar sayfası: "Altyazı ara ve indir" dosyayı her zaman SRT olarak ister', page.includes("fetch(item.url.replace('&ass=1', ''))"));
const langs = Object.keys(STRINGS);
check('12 dilde ayarın adı ve açıklaması var', langs.length === 12 && langs.every((l) => STRINGS[l].assLabel && STRINGS[l].assHint && STRINGS[l].assLabel.includes('ASS/SSA') && STRINGS[l].assHint.includes('OpenSubtitles')), langs.filter((l) => !STRINGS[l].assLabel || !STRINGS[l].assHint).join());
check('açıklamalar başka dilin metnini kopyalamaz', new Set(langs.map((l) => STRINGS[l].assHint)).size === 12 && new Set(langs.map((l) => STRINGS[l].assLabel)).size === 12);

// ---------- Deneme altyazısı (ass=test) ----------
const { assSample } = await import('../src/subtitle.js');
const testList = (await get('/languages=tr,en&ui=tr&gd=1&ass=test/subtitles/series/tt2000001:1:2.json')).subtitles;
const samples = testList.filter((s) => s.id.startsWith('subpool-ass-test-'));
check('ass=test: listenin başına iki deneme altyazısı eklenir (.srt ve .ass adresli)', samples.length === 2 && testList[0] === samples[0] && testList[1] === samples[1]
  && samples[0].url === `${new URL(samples[0].url).origin}/message/tr/asstest.srt` && samples[1].url.endsWith('/message/tr/asstest.ass') && samples[0].lang === 'ASS test (.srt)' && samples[1].lang === 'ASS test (.ass)', JSON.stringify(samples));
check('ass=test: gerçek dosya adresleri "&ass=1" taşır, liste eksilmez', testList.length === list.length + 2 && testList.slice(2).filter((s) => /\/gd\//.test(s.url)).every((s) => decodeURIComponent(pathOf(s)).includes('&ass=1') && !s.url.includes('ass=test')));
check('ass=1 ve ayarsız listede deneme altyazısı yok', ![...list, ...plain, ...dualList].some((s) => String(s.id).startsWith('subpool-ass-test')));
for (const item of samples) {
  out = await raw(pathOf(item));
  check(`deneme dosyası ${pathOf(item).split('/').pop()}: ASS olarak gelir, dört stil ve renk etiketi içerir`, out.status === 200 && out.type === ASS_TYPE && isAss(out.text) && out.text === assSample(true)
    && ['Style: Top,', 'Style: Middle,', 'Style: Corner,', 'Style: Default,'].every((s) => out.text.includes(s)) && out.text.includes('{\\c&H00FF00&}YEŞİL') && (out.text.match(/^Dialogue:/gm) || []).length === 4, out.text.slice(0, 80));
}
out = await raw('/message/en/asstest.ass');
check('deneme dosyası Türkçe dışındaki sayfa dillerinde İngilizce', out.type === ASS_TYPE && out.text === assSample(false) && out.text.includes('RED and at the TOP'));
out = await raw('/message/tr/setup.srt');
check('kurulum mesajı eskisi gibi SRT', out.type === SRT_TYPE && out.text.startsWith('1\n00:00:00,000 --> '));
const noSource = (await get('/languages=tr&ui=tr&ass=test/subtitles/movie/tt1000001.json')).subtitles;
check('ass=test: kaynak bağlı değilken de deneme altyazıları gelir', noSource.length === 3 && noSource[0].id === 'subpool-ass-test-srt' && noSource[2].id === 'subpool-setup-required', noSource.map((s) => s.id).join());

// ---------- Hak harcanmadı ----------
check('OpenSubtitles\'a hiç istek gitmedi (hak harcanmadı, giriş yapılmadı)', !calls.some((c) => c.includes('api.opensubtitles.com')), calls.filter((c) => c.includes('api.opensubtitles.com')).join(' | '));

server.close();
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
