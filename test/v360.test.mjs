// v3.7.1: sıralama, limit, HI işareti, süre sınırı, Kitsu ve /api/health. Hiçbir gerçek siteye istek gitmez.
import { VERSION } from './setup.mjs';
import { createServer } from 'node:http';
const { createAddon } = await import('../src/addon.js');
const { createSealer } = await import('../src/crypto.js');
const { parseRelease, releaseMatch } = await import('../src/release.js');

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 400) : ''}`); };

// ---------- Sürüm adı çözümleme ----------
const p = parseRelease;
let r = p('The.Matrix.1999.1080p.BluRay.x264-SPARKS.mkv');
check('ad: BluRay + grup', r.group === 'sparks' && r.source === 'bluray' && r.resolution === '1080', JSON.stringify(r));
r = p('Spider-Man.No.Way.Home.2021.2160p.WEB-DL.DDP5.1.Atmos.HEVC-FLUX');
check('ad: WEB-DL + grup, "Spider-Man" grup sanılmaz', r.group === 'flux' && r.source === 'web' && r.resolution === '2160', JSON.stringify(r));
check('ad: yalnız "Spider-Man" → grup yok', p('Spider-Man').group === '' && p('Movie.2020.1080p.WEB-DL').group === '');
r = p('The.Lord.of.the.Rings.2001.EXTENDED.1080p.BluRay.x265-RARBG');
check('ad: uzatılmış kurgu', r.edition === 'extended' && r.group === 'rarbg', JSON.stringify(r));
r = p('[SubsPlease] Sousou no Frieren - 03 (1080p) [ABCD1234].mkv');
check('ad: anime grubu', r.group === 'subsplease' && r.resolution === '1080', JSON.stringify(r));
r = p('Show.S02E05.720p.HDTV.x264-KILLERS[rartv]');
check('ad: dizi bölümü', r.group === 'killers' && r.source === 'tv' && r.season === 2 && r.episode === 5, JSON.stringify(r));
r = p('Movie.2019.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTG');
check('ad: servis', r.service === 'amzn' && r.source === 'web' && r.group === 'ntg', JSON.stringify(r));
r = p('Movie.2010.720p.BrRip.x264.YIFY');
check('ad: YIFY', r.group === 'yts' && r.source === 'bluray', JSON.stringify(r));
r = p('Ornek Film (2024) BluRay 1080p Türkçe');
check('ad: boşluklu yazım', r.source === 'bluray' && r.resolution === '1080' && r.group === '', JSON.stringify(r));
const video = p('The.Matrix.1999.1080p.BluRay.x264-SPARKS.mkv');
const same = releaseMatch(video, p('The.Matrix.1999.1080p.BluRay.x264-SPARKS'));
const otherGroup = releaseMatch(video, p('The.Matrix.1999.720p.BluRay.x264-AMIABLE'));
const web = releaseMatch(video, p('The.Matrix.1999.1080p.WEB-DL.H264-FLUX'));
const unknown = releaseMatch(video, p('The Matrix'));
check('uyum: aynı sürüm > aynı kaynak > bilinmeyen > farklı kaynak', same > otherGroup && otherGroup > unknown && unknown > web, `${same} ${otherGroup} ${unknown} ${web}`);
check('uyum: farklı kurgu geride', releaseMatch(video, p('The.Matrix.1999.EXTENDED.1080p.BluRay.x264-SPARKS')) < same);
check('uyum: yanlış bölüm çok geride', releaseMatch(p('Show.S01E02.1080p.WEB.H264-GRP'), p('Show.S01E03.1080p.WEB.H264-GRP')) < 0);

// ---------- Sahte siteler ----------
const realFetch = globalThis.fetch;
const calls = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const os = (o) => ({ attributes: { language: 'tr', legacy_subtitle_id: null, release: '', moviehash_match: false, from_trusted: false, ai_translated: false, machine_translated: false, download_count: 10, hearing_impaired: false, ...o, files: [{ file_id: o.file, file_name: 'x.srt' }] } });
const official = (id, lang, release = '') => ({ id: String(id), url: `https://subs5.strem.io/${lang}/download/file/${id}`, lang, movieReleaseName: release });
const slow = { subdl: new Set(['tt1000002']), os: new Set(['1000003']) };

globalThis.fetch = async (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  // 3.10.1'dan beri AniSub varsayılan olarak açık; bu testlerde hiç altyazı vermez ve çağrı listesine yazılmaz.
  if (url.hostname === 'anisub.co') return new Response(JSON.stringify({ subtitles: [] }), { headers: { 'content-type': 'application/json' } });
  const q = url.searchParams;
  calls.push(`${url.hostname}${url.pathname}?${q}`.replace(/api_key=[^&]*/, 'api_key=…'));
  switch (url.hostname) {
    case 'api.opensubtitles.com': {
      if (url.pathname !== '/api/v1/subtitles') throw new Error('hak harcayan/giriş isteği yapılmamalı: ' + url.pathname);
      if (slow.os.has(q.get('imdb_id'))) await sleep(2500);
      if (q.get('parent_imdb_id')) return json({ total_pages: 1, data: [os({ file: 31, release: 'Anime.S01E03.1080p.WEB.H264-GRP' })] });
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
      return json({ subtitles: [official(9001, 'tur'), official(9004, 'eng'), official(9005, 'tur'), official(9009, 'tur', 'Ornek.Film.2024.720p.BluRay.x264-SPARKS'), official(9010, 'fre')] });
    case 'api.subdl.com':
      if (slow.subdl.has(q.get('imdb_id'))) await sleep(2500);
      return json({ status: true, subtitles: [
        { url: '/subtitle/111-1.zip', language: 'TR', release_name: 'Ornek.Film.2024.WEBRip.x264', releases: ['Ornek.Film.2024.WEBRip.x264', 'Ornek.Film.2024.1080p.BluRay.x264-SPARKS'], hi: true },
        { url: '/subtitle/111-2.zip', language: 'TR', release_name: 'Ornek.Film.2024.DVDRip.XviD-OLD', releases: [], hi: false },
      ] });
    case 'api.subsource.net':
      if (url.pathname.endsWith('/movies/search')) return json({ success: true, data: [{ movieId: 77, type: 'movie', season: q.get('season') }] });
      if (q.get('language') !== 'turkish') return json({ success: true, data: [] });
      return json({ success: true, data: [
        { subtitleId: 501, language: 'turkish', releaseInfo: ['Ornek.Film.2024.1080p.BluRay.x264-SPARKS'], hearingImpaired: false },
        { subtitleId: 502, language: 'turkish', releaseInfo: ['Ornek.Film.2024.HDCAM'], hearingImpaired: false },
        { subtitleId: 503, language: 'turkish', releaseInfo: ['Ornek.Film.2024.BluRay.720p'], hearingImpaired: false },
      ] });
    case 'anime-kitsu.strem.fun': {
      const id = url.pathname.match(/kitsu:(\d+)\.json$/)?.[1];
      if (id === '7442') return json({ meta: { type: 'series', imdb_id: 'tt2560140', videos: [
        { id: 'kitsu:7442:1', imdb_id: 'tt2560140', imdbSeason: 1, imdbEpisode: 1 },
        { id: 'kitsu:7442:3', imdb_id: 'tt2560140', imdbSeason: 1, imdbEpisode: 3 },
        { id: 'kitsu:7442:27', imdb_id: 'tt2560140', imdbSeason: 2, imdbEpisode: 2 },
      ] } });
      if (id === '11614') return json({ meta: { type: 'movie', imdb_id: 'tt5311514', videos: [{ id: 'kitsu:11614' }] } });
      if (id === '999') return json({ meta: { type: 'series', videos: [{ id: 'kitsu:999:1' }] } });
      return json({ err: 'yok' }, 500);
    }
  }
  throw new Error('beklenmeyen dış istek: ' + url.hostname);
};

const start = async (extraEnv = {}) => {
  const server = createServer(createAddon({ ...process.env, UPSTASH_REDIS_REST_URL: '', KV_REST_API_URL: '', ...extraEnv })).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, get: (path) => realFetch(base + path).then((res) => res.json()) };
};
const auth = createSealer(process.env.CONFIG_SECRET).seal({ u: 'sahte-kullanici', p: 'sahte-sifre', sd: 'sahte-subdl-1234', ss: 'sahte-subsource-1234' });
const seg = (options = '') => `languages=tr,en&ui=tr${options}&auth=${auth}`;
const FILE = encodeURIComponent('Ornek.Film.2024.1080p.BluRay.x264-SPARKS.mkv');
const show = (list) => console.log(list.map((s) => `   ${s.lang} | ${s.label}`).join('\n'));
const free = (s) => !s.label.includes('Hak harcar') && !s.label.includes('hak');
const a = await start();

// ---------- Sıralama ----------
const health = await a.get('/api/health');
check('/api/health', health.version === VERSION && health.rar === true, JSON.stringify(health));
const manifest = await a.get(`/${seg()}/manifest.json`);
check('manifest: anime ve kitsu', manifest.version === VERSION && manifest.types.includes('anime') && manifest.idPrefixes.includes('kitsu') && manifest.idPrefixes.includes('tt'));

let res = await a.get(`/${seg()}/subtitles/movie/tt1000001/filename=${FILE}.json`);
let list = res.subtitles;
show(list);
const tr = list.filter((s) => s.lang === 'tur');
const en = list.filter((s) => s.lang === 'eng');
const quotaTag = tr.at(-1).label.split(' | ')[0].replace(' · HI', '');
const isQuota = (s) => s.label.startsWith(quotaTag);
check('tam liste: önce Türkçe, sonra İngilizce', list.length === tr.length + en.length && list.indexOf(en[0]) === tr.length && tr.length === 10 && en.length === 2, `${tr.length} ${en.length}`);
const firstQuota = tr.findIndex(isQuota);
check('ücretsizler üstte, hak harcayan 2 altyazı en altta', firstQuota === 8 && tr.slice(8).every(isQuota) && tr.slice(0, 8).every((s) => !isQuota(s)), `ilk hak harcayan: ${firstQuota}`);
check('ücretsizlerin içinde aynı sürüm (BluRay-SPARKS) en üstte', tr.slice(0, 3).every((s) => s.label.includes('BluRay.x264-SPARKS')), tr.slice(0, 3).map((s) => s.label).join(' / '));
check('ücretsizlerin içinde makine çevirisi en sonda', tr[7].url.endsWith('/9005'), tr[7].url);
check('hak harcayanlarda da uyan üstte', tr[8].label.includes('SPARKS') && tr[9].label.includes('HDTV'));
check('birebir uyan ama hak harcayan altyazı ücretsizlerin üstüne çıkmaz', tr.findIndex((s) => s.url.includes('/sub/tr/tt1000001/2.srt')) === 8);
check('HI işareti (OpenSubtitles)', tr[9].label.includes(' · HI | Ornek.Film.2024.HDTV.x264'), tr[9].label);
const sd1 = tr.find((s) => s.label.includes('[SubDL]') && s.label.includes('HI'));
check('HI işareti (SubDL) ve videoya uyan sürüm adı gösterilir', !!sd1 && sd1.label.endsWith('· HI | Ornek.Film.2024.1080p.BluRay.x264-SPARKS'), sd1?.label);
check('İngilizce: ücretsiz (farklı kurgu) üstte, hak harcayan altta', en[0].url.includes('strem.io') && en[1].url.includes('/sub/en/'));
check('tam liste 6 saat saklanır', res.cacheMaxAge === 21600, res.cacheMaxAge);
check('etiket/id benzersiz', new Set(list.map((s) => s.id)).size === list.length);

// ---------- Eşleştirme kapalı ----------
res = await a.get(`/${seg('&match=0')}/subtitles/movie/tt1000001/filename=${FILE}.json`);
const off = res.subtitles.filter((s) => s.lang === 'tur');
show(off);
check('match=0: SubDL ilk sürüm adını gösterir', off.some((s) => s.label.endsWith('· HI | Ornek.Film.2024.WEBRip.x264')));
check('match=0: ücretsizler yine üstte', off.slice(0, 8).every((s) => !isQuota(s)) && off.slice(8).every(isQuota));
check('match=0: ada en çok benzeyen üstte', off[0].label.includes('BluRay.x264-SPARKS'), off[0].label);

// ---------- Dosya adı gelmezse ----------
res = await a.get(`/${seg()}/subtitles/movie/tt1000001.json`);
const blind = res.subtitles.filter((s) => s.lang === 'tur');
check('dosya adı yok: ücretsizler yine üstte, makine çevirisi ücretsizlerin sonunda', blind.length === 10 && blind.slice(8).every(isQuota) && blind[7].url.endsWith('/9005'));

// ---------- Limit ----------
res = await a.get(`/${seg('&max=5')}/subtitles/movie/tt1000001/filename=${FILE}.json`);
const lim = res.subtitles.filter((s) => s.lang === 'tur');
show(res.subtitles);
check('max=5: dil başına 5', lim.length === 5 && res.subtitles.filter((s) => s.lang === 'eng').length === 2);
check('max=5: her siteden en az bir altyazı', ['[SubDL]', '[SubSource]', '[OpenSubtitles]'].every((site) => lim.some((s) => s.label.startsWith(site))), lim.map((s) => s.label.split(' ')[0]).join(' '));
check('max=5: sıra bozulmaz, hak harcayan yok', lim.every((s) => !isQuota(s)) && lim.every((s, i) => i === 0 || tr.findIndex((x) => x.url === lim[i - 1].url) < tr.findIndex((x) => x.url === s.url)));
res = await a.get(`/${seg('&max=1')}/subtitles/movie/tt1000001/filename=${FILE}.json`);
check('max=1: her dilde tek altyazı', res.subtitles.length === 2 && res.subtitles[0].url === tr[0].url);
for (const bad of ['0', 'abc', '51', '-3', '2.5']) {
  res = await a.get(`/${seg('&max=' + bad)}/subtitles/movie/tt1000001/filename=${FILE}.json`);
  check(`max=${bad}: geçersiz → sınırsız`, res.subtitles.length === 12, res.subtitles.length);
}

// ---------- Kitsu ----------
calls.length = 0;
res = await a.get(`/${seg()}/subtitles/anime/${encodeURIComponent('kitsu:7442:3')}.json`);
show(res.subtitles);
check('kitsu dizi: IMDb + sezon/bölüm ile aranır', calls.some((c) => c.includes('api.opensubtitles.com') && c.includes('parent_imdb_id=2560140') && c.includes('season_number=1') && c.includes('episode_number=3')), calls.filter((c) => c.includes('opensubtitles.com')).join(' '));
check('kitsu dizi: resmi eklentiye dizi olarak sorulur', calls.some((c) => c.startsWith('opensubtitles-v3.strem.io/subtitles/series/tt2560140%3A1%3A3.json')), calls.filter((c) => c.includes('v3')).join(' '));
check('kitsu dizi: SubDL/SubSource da IMDb ile aranır', calls.some((c) => c.includes('api.subdl.com') && c.includes('imdb_id=tt2560140') && c.includes('season_number=1')) && calls.some((c) => c.includes('subsource') && c.includes('imdb=tt2560140')));
check('kitsu dizi: sonuç döner, indirme adresi IMDb numarasını taşır', res.subtitles.length > 0 && res.subtitles.some((s) => s.url.includes('/sub/tr/tt2560140%3A1%3A3/31.srt') || s.url.includes('/sub/tr/tt2560140:1:3/31.srt')), res.subtitles.map((s) => s.url).join(' ').slice(0, 300));
calls.length = 0;
res = await a.get(`/${seg()}/subtitles/series/${encodeURIComponent('kitsu:7442:27')}.json`);
check('kitsu: 27. bölüm → 2. sezon 2. bölüm', calls.some((c) => c.includes('season_number=2') && c.includes('episode_number=2')));
check('kitsu: çeviri önbellekten (Kitsu\'ya ikinci kez sorulmaz)', !calls.some((c) => c.includes('anime-kitsu')));
calls.length = 0;
res = await a.get(`/${seg()}/subtitles/movie/${encodeURIComponent('kitsu:11614')}.json`);
check('kitsu film: IMDb ile film olarak aranır', calls.some((c) => c.includes('api.opensubtitles.com') && c.includes('imdb_id=5311514') && !c.includes('parent_imdb_id')) && calls.some((c) => c.startsWith('opensubtitles-v3.strem.io/subtitles/movie/tt5311514.json')) && res.subtitles.length > 0);
calls.length = 0;
res = await a.get(`/${seg()}/subtitles/anime/${encodeURIComponent('kitsu:999:1')}.json`);
check('kitsu: IMDb karşılığı yok → boş liste, altyazı sitelerine istek yok', res.subtitles.length === 0 && calls.every((c) => c.includes('anime-kitsu')), calls.join(' '));
res = await a.get(`/${seg()}/subtitles/anime/${encodeURIComponent('kitsu:7442:99')}.json`);
check('kitsu: olmayan bölüm → boş liste', res.subtitles.length === 0);
res = await a.get(`/${seg()}/subtitles/anime/${encodeURIComponent('kitsu:5:1')}.json`);
check('kitsu servisi hata verirse: boş liste, 1 dakika saklanır', res.subtitles.length === 0 && res.cacheMaxAge === 60, JSON.stringify(res));
res = await a.get(`/${seg()}/subtitles/anime/${encodeURIComponent('kitsu:abc:1')}.json`);
check('kitsu: bozuk numara → boş liste', res.subtitles.length === 0);
a.server.close();

// ---------- Süre sınırı ----------
const b = await start({ SOURCE_DEADLINE_MS: '900' });
let t0 = Date.now();
res = await b.get(`/${seg()}/subtitles/movie/tt1000002.json`);
let took = Date.now() - t0;
show(res.subtitles);
check('yavaş SubDL beklenmez', took < 1800, `${took} ms`);
check('yavaş SubDL: diğer kaynaklar gösterilir, liste 1 dakika saklanır', res.cacheMaxAge === 60 && res.subtitles.some((s) => s.label.startsWith('[SubSource]')) && res.subtitles.some((s) => s.label.startsWith('[OpenSubtitles]')) && !res.subtitles.some((s) => s.label.startsWith('[SubDL]')), `cacheMaxAge ${res.cacheMaxAge}, ${res.subtitles.length} altyazı`);
await sleep(2200);
t0 = Date.now();
res = await b.get(`/${seg()}/subtitles/movie/tt1000002.json`);
check('sonraki açılışta geciken kaynak da gelir, liste 6 saat saklanır', res.cacheMaxAge === 21600 && res.subtitles.some((s) => s.label.startsWith('[SubDL]')), `cacheMaxAge ${res.cacheMaxAge}, ${Date.now() - t0} ms`);

t0 = Date.now();
res = await b.get(`/${seg()}/subtitles/movie/tt1000003.json`);
took = Date.now() - t0;
show(res.subtitles);
check('yavaş OpenSubtitles araması: resmi (ücretsiz) altyazılar yine gösterilir', took < 1800 && res.cacheMaxAge === 60 && res.subtitles.filter((s) => s.url.includes('strem.io')).length === 4 && res.subtitles.some((s) => s.label.startsWith('[SubDL]')), `${took} ms, cacheMaxAge ${res.cacheMaxAge}, ${res.subtitles.length} altyazı`);
check('seçilmeyen dildeki (fre) resmi altyazı listeye girmez', !res.subtitles.some((s) => s.lang === 'fre'));
b.server.close();

check('hiçbir testte giriş/indirme isteği yapılmadı', !calls.some((c) => c.includes('/login') || c.includes('/download')));
console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
