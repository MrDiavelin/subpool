import { LANGUAGES } from './languages.js';
import { DEFAULT_UI, STRINGS, UI_LANGUAGES } from './i18n.js';
import { LOGO_SVG } from './logo.js';

const toJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

// Ayar sayfasında kullanılmayan (sadece eklentinin içinde gösterilen) metinler sayfaya gönderilmez.
const SERVER_ONLY = new Set([
  'manifestDesc', 'needAccountLabel', 'needAccount', 'loginFailed', 'quota', 'quotaReset', 'quotaHint', 'burst',
  'archiveUnsupported', 'notInPack', 'keyRejected', 'failed', 'dualMissing', 'fansubBy', 'matchFile', 'matchRelease', 'forced',
]);
const PAGE_STRINGS = Object.fromEntries(
  Object.entries(STRINGS).map(([ui, strings]) => [
    ui,
    Object.fromEntries(Object.entries(strings).filter(([key]) => !SERVER_ONLY.has(key))),
  ]),
);

// Yazı tipleri sunucunun kendisinden gelir (src/fonts.js); sayfa başka bir sunucuya istek atmaz.
const RANGES = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF',
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
};
const face = (family, file, range, axes) =>
  `@font-face { font-family:"${family}"; font-style:normal; ${axes}; font-display:swap; src:url(/fonts/${file}.woff2) format("woff2"); unicode-range:${RANGES[range]}; }`;
const FONT_CSS = [
  face('Archivo', 'archivo-latin-ext', 'latin-ext', 'font-weight:400 800; font-stretch:62% 125%'),
  face('Archivo', 'archivo-latin', 'latin', 'font-weight:400 800; font-stretch:62% 125%'),
  face('JetBrains Mono', 'mono-cyrillic', 'cyrillic', 'font-weight:400 500'),
  face('JetBrains Mono', 'mono-latin-ext', 'latin-ext', 'font-weight:400 500'),
  face('JetBrains Mono', 'mono-latin', 'latin', 'font-weight:400 500'),
].join('\n  ');

// Perdedeki toz zerreleri: yerleri ve hızları sabit bir düzenden gelir.
const DUST = Array.from({ length: 14 }, (_, i) => {
  const size = i % 3 ? 2 : 3;
  return `<span style="left:${38 + ((i * 37) % 24)}%;top:${35 + ((i * 53) % 55)}%;width:${size}px;height:${size}px;animation-duration:${5 + (i % 5)}s;animation-delay:${(i * 0.6).toFixed(1)}s"></span>`;
}).join('');

// Önizlemedeki örnek kare için kısa replikler (ilk seçili dilde gösterilir; ikinci satır "çift dilli" içindir).
const DIALOG = {
  tr: ['Burada ne arıyorsun?', 'Kim var orada?', 'Sadece biraz konuşmak istedim.', 'Yarın sabah gidiyorum.'],
  en: ['What are you doing here?', "Who's there?", 'I just wanted to talk.', "I'm leaving tomorrow morning."],
  es: ['¿Qué haces aquí?', '¿Quién anda ahí?', 'Solo quería hablar.', 'Me voy mañana por la mañana.'],
  pt: ['O que estás a fazer aqui?', 'Quem está aí?', 'Só queria conversar.', 'Vou-me embora amanhã de manhã.'],
  'pt-br': ['O que você está fazendo aqui?', 'Quem está aí?', 'Eu só queria conversar.', 'Vou embora amanhã de manhã.'],
  fr: ['Que fais-tu ici ?', 'Qui est là ?', 'Je voulais juste parler.', 'Je pars demain matin.'],
  de: ['Was machst du hier?', 'Wer ist da?', 'Ich wollte nur reden.', 'Ich fahre morgen früh.'],
  it: ['Cosa ci fai qui?', "Chi c'è?", 'Volevo solo parlare.', 'Parto domani mattina.'],
  ar: ['ماذا تفعل هنا؟', 'من هناك؟', 'أردت فقط أن نتحدث.', 'سأغادر صباح الغد.'],
  ru: ['Что ты здесь делаешь?', 'Кто там?', 'Я просто хотел поговорить.', 'Я уезжаю завтра утром.'],
  zh: ['你在这里做什么？', '谁在那儿？', '我只是想聊聊。', '我明天早上就走。'],
  ja: ['ここで何してるの？', '誰かいるのか？', '少し話したかっただけ。', '明日の朝に発つよ。'],
  ko: ['여기서 뭐 해?', '거기 누구야?', '그냥 얘기하고 싶었어.', '내일 아침에 떠나.'],
  nl: ['Wat doe jij hier?', 'Wie is daar?', 'Ik wilde alleen praten.', 'Ik vertrek morgenochtend.'],
  pl: ['Co tu robisz?', 'Kto tam?', 'Chciałem tylko porozmawiać.', 'Wyjeżdżam jutro rano.'],
};

// Önizleme listesindeki örnek sürüm adları. Gestdown yalnızca dizi barındırdığı için o açıkken örnek bir dizi bölümü gösterilir.
const SAMPLE = {
  movie: {
    title: 'The Shawshank Redemption (1994)',
    official: 'Shawshank.Redemption.1994.1080p.BluRay.x264',
    pool: 'The.Shawshank.Redemption.1994.REMASTERED.720p.BluRay',
    subdl: 'Shawshank.Redemption.1994.1080p.BluRay.x264-AMIABLE',
    subdlHi: 'Shawshank.Redemption.1994.BDRip.XviD',
    subsource: 'The.Shawshank.Redemption.1994.2160p.UHD.BluRay',
    altyazidb: 'Esaretin.Bedeli.1994.1080p.BluRay',
    quota: 'Shawshank.Redemption.1994.1080p.WEB-DL.DD5.1',
    machine: 'Shawshank.Redemption.1994.720p (MT)',
  },
  series: {
    title: 'Breaking Bad S01E01',
    official: 'Breaking.Bad.S01E01.1080p.BluRay.x264',
    pool: 'Breaking.Bad.S01E01.Pilot.720p.BluRay',
    subdl: 'Breaking.Bad.S01E01.1080p.BluRay.x265',
    subdlHi: 'Breaking.Bad.S01E01.BDRip.XviD',
    subsource: 'Breaking.Bad.S01E01.2160p.WEB-DL',
    altyazidb: 'Breaking.Bad.S01E01.1080p.BluRay',
    gestdown: 'Breaking.Bad.S01E01.720p.HDTV.x264',
    quota: 'Breaking.Bad.S01E01.1080p.WEB-DL.DD5.1',
    machine: 'Breaking.Bad.S01E01.720p (MT)',
  },
};

// Arama kutusu boşken önerilen diller (sırayla ilk 10 seçilmemiş dil gösterilir).
const POPULAR = [
  'tr', 'en', 'de', 'ar', 'es', 'fr', 'it', 'pt-br', 'pt-pt', 'ru', 'ja', 'ko', 'zh-cn', 'nl', 'pl', 'sv', 'no', 'da',
  'fi', 'el', 'he', 'fa', 'hi', 'id', 'ro', 'hu', 'cs', 'bg', 'uk', 'hr', 'sr', 'bs', 'az-az', 'vi', 'th', 'ms',
];

function keyPanel(name, title, signup) {
  return `
        <div class="src" id="${name}Panel">
          <button class="src-h" type="button" id="${name}Head" aria-expanded="false" aria-controls="${name}Body">
            <span class="src-t"><b>${title}</b><span class="sub" data-i18n="${name}Intro" data-part="sum"></span></span>
            <span class="badge" id="${name}Badge"></span><span class="chev" id="${name}Chev" aria-hidden="true">+</span>
          </button>
          <div class="src-b" id="${name}Body" hidden>
            <p class="more" data-i18n="${name}Intro" data-part="more"></p>
            <form class="stack" id="${name}Form">
              <input class="mono" type="password" id="${name}Key" autocomplete="off" spellcheck="false" required>
              <div class="row">
                <button class="btn acc" type="submit" data-i18n="save"></button>
                <a href="${signup}" target="_blank" rel="noopener" data-i18n="getKey"></a>
              </div>
            </form>
            <div class="row" id="${name}Done" hidden>
              <span class="connected" id="${name}Status"></span>
              <button class="btn out" type="button" data-remove="${name}" data-i18n="disconnect"></button>
            </div>
            <p class="status" id="${name}Msg" role="status"></p>
          </div>
        </div>`;
}

function freePanel(name, title) {
  return `
        <div class="fsrc" id="${name}Panel">
          <div class="row">
            <div class="opt-t"><b>${title}</b><span class="sub"><span data-i18n="${name}Intro" data-part="sum"></span> <button class="link" type="button" data-det="${name}Rest"></button></span></div>
            <label class="switch"><input type="checkbox" id="${name}" role="switch"><span class="track"></span><span class="vh" data-i18n="${name}Label"></span></label>
          </div>
          <p class="more" id="${name}Rest" data-i18n="${name}Intro" data-part="rest" hidden></p>
        </div>`;
}

const toggle = (id) => `<label class="switch"><input type="checkbox" id="${id}" role="switch" aria-labelledby="${id}T"><span class="track"></span></label>`;
// Seçenekli ayarlarda değer gizli <select>'te durur; görünen düğmeler onu değiştirir.
const choice = (id) => `<select id="${id}" hidden></select><div class="seg" id="${id}Seg" role="group" aria-labelledby="${id}T"></div>`;

function option(id, control, extra = '') {
  return `
          <div class="opt">
            <div class="row">
              <div class="opt-t"><b id="${id}T" data-i18n="${id}Label"></b><span class="sub"><span data-i18n="${id}Hint" data-part="sum"></span> <button class="link" type="button" data-det="${id}Rest"></button></span></div>
              ${control}
            </div>
            <p class="more" id="${id}Rest" data-i18n="${id}Hint" data-part="rest" hidden></p>${extra}
          </div>`;
}

function stepHead(index, time, title, intro = '', extra = '') {
  return `
        <div class="head">
          <span class="eyebrow"><span data-i18n="scene"></span> 0${index + 1} / 04 · <span dir="ltr">${time}</span>${extra}</span>
          <h2 data-i18n="${title}"></h2>${intro ? `
          <p data-i18n="${intro}"></p>` : ''}
        </div>`;
}

const CLEAN_SAMPLE = `
            <div class="sample">
              <div><span class="m" data-i18n="before"></span><span data-i18n="sfx"></span><span>JOHN: <span data-i18n="who"></span></span></div>
              <div><span class="f" data-i18n="after"></span><span data-i18n="who"></span></div>
            </div>`;

export function configurePage({ baseUrl, selected, ui, auth, sources, max, match, fallback, machine, hi, clean, ass, gestdown, anisub, dual, prefer, maxLanguages, misconfigured }) {
  const langs = LANGUAGES.map(({ code, stremio, english, tag }) => ({ code, stremio, english, tag }));
  return `<!doctype html>
<html lang="${ui || DEFAULT_UI}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#110e0b">
<title>SubPool by Diavelin</title>
<link rel="icon" type="image/png" href="/logo.png">
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<link rel="preload" href="/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
<style>
  ${FONT_CSS}
  :root { --bg:#110e0b; --surface:#1b1613; --surface2:#251f1b; --line:#352f2a; --text:#f1eee9; --muted:#b1a9a2; --accent:#fbc044; --on-accent:#1c140c; --free:#6ed889; --cost:#f99262; --free-bg:rgba(110,216,137,.12); --cost-bg:rgba(249,146,98,.12); --dim:#8f8881; --mono:"JetBrains Mono",ui-monospace,Consolas,monospace; }
  @supports (color:oklch(0 0 0)) {
    :root { --bg:oklch(0.165 0.008 60); --surface:oklch(0.205 0.01 60); --surface2:oklch(0.245 0.012 60); --line:oklch(0.31 0.012 60); --text:oklch(0.95 0.008 80); --muted:oklch(0.74 0.014 70); --accent:oklch(0.84 0.15 82); --on-accent:oklch(0.2 0.02 70); --free:oklch(0.8 0.15 150); --cost:oklch(0.76 0.14 45); --free-bg:oklch(0.8 0.15 150 / 0.12); --cost-bg:oklch(0.76 0.14 45 / 0.12); --dim:oklch(0.62 0.01 70); }
  }
  @keyframes spFlicker { 0%,100% { opacity:.9; } 8% { opacity:.7; } 10% { opacity:.95; } 47% { opacity:.82; } 50% { opacity:1; } 72% { opacity:.78; } 74% { opacity:.95; } }
  @keyframes spGrain { 0% { transform:translate(0,0); } 20% { transform:translate(-6%,3%); } 40% { transform:translate(4%,-5%); } 60% { transform:translate(-3%,6%); } 80% { transform:translate(6%,2%); } 100% { transform:translate(0,0); } }
  @keyframes spCurtainL { from { transform:translateX(0); } to { transform:translateX(-94%); } }
  @keyframes spCurtainR { from { transform:translateX(0); } to { transform:translateX(94%); } }
  @keyframes spPerf { to { background-position:21px 0; } }
  @keyframes spIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
  @keyframes spCapIn { from { opacity:0; transform:translateY(6px); filter:blur(5px); } to { opacity:1; transform:none; filter:none; } }
  @keyframes spDust { 0% { transform:translate(0,0); opacity:0; } 25% { opacity:.9; } 100% { transform:translate(26px,-140px); opacity:0; } }
  @keyframes spSweep { 0%,60% { transform:translateX(-150%); } 100% { transform:translateX(450%); } }
  @keyframes spProg { from { width:0; } to { width:100%; } }
  @keyframes spTitle { from { opacity:0; letter-spacing:.12em; filter:blur(8px); } to { opacity:1; letter-spacing:0; filter:none; } }
  @keyframes spReel { to { transform:rotate(360deg); } }
  @keyframes spReelR { to { transform:rotate(-360deg); } }
  @keyframes spCap { 0% { transform:scaleX(0); } 14%,80% { transform:scaleX(1); } 94%,100% { transform:scaleX(0); } }
  @keyframes spGlow { 0%,100% { opacity:.35; } 50% { opacity:.75; } }

  * { box-sizing:border-box; }
  [hidden] { display:none !important; }
  html { -webkit-text-size-adjust:100%; }
  body { margin:0; min-height:100vh; background:var(--bg); background:radial-gradient(1100px 520px at 50% -8%,oklch(0.84 0.15 82 / 0.09),transparent 70%) no-repeat,var(--bg); color:var(--text); font:15px/1.5 Archivo,system-ui,-apple-system,"Segoe UI",sans-serif; }
  p, h1, h2, ol, ul, dl, dd { margin:0; }
  ol, ul { padding:0; list-style:none; }
  a { color:var(--accent); }
  a:hover { color:var(--text); }
  button, input, select { font:inherit; color:inherit; }
  button { cursor:pointer; }
  button:disabled { cursor:default; }
  input::placeholder { color:var(--muted); opacity:.8; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  input[type=text], input[type=password], input[type=search] { width:100%; padding:11px 12px; border-radius:10px; border:1px solid var(--line); background:var(--surface); color:var(--text); outline:none; }
  input:focus { border-color:var(--accent); }
  .mono { font-family:var(--mono); }
  .vh { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
  .row { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; }
  .stack { display:flex; flex-direction:column; gap:10px; }
  .card { background:var(--surface); border:1px solid var(--line); border-radius:14px; }
  .free { color:var(--free); }
  .cost { color:var(--cost); }
  .warn { max-width:1200px; margin:16px auto 0; padding:0 24px; color:var(--cost); }
  .btn { display:inline-block; border-radius:10px; font-weight:600; font-size:14px; text-decoration:none; }
  .btn.out { background:none; border:1px solid var(--line); color:var(--text); padding:8px 14px; }
  .btn.out:hover:not(:disabled) { border-color:var(--accent); }
  .btn.acc { background:var(--accent); color:var(--on-accent); border:none; padding:10px 16px; font-weight:700; }
  .btn:disabled, [aria-disabled=true] { opacity:.4; pointer-events:none; }
  .link { background:none; border:none; padding:0; color:var(--accent); font-weight:600; font-size:13px; }
  .link:hover { color:var(--text); }
  .status { font-size:14px; color:var(--muted); }
  .status:empty { display:none; }
  .status.error { color:var(--cost); }
  .status.good { color:var(--free); }
  .glabel { font-size:12px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
  .group { display:flex; flex-direction:column; gap:8px; }
  .hint { color:var(--muted); font-size:13px; }
  .chev { flex:none; width:14px; text-align:center; color:var(--muted); }
  .eyebrow { font-family:var(--mono); font-size:12px; color:var(--accent); overflow-wrap:anywhere; }

  .top { border-bottom:1px solid var(--line); }
  .top-in { max-width:1200px; margin:0 auto; padding:14px 24px; display:flex; flex-wrap:wrap; align-items:center; gap:12px 24px; }
  .brand { display:flex; align-items:center; gap:10px; margin-inline-end:auto; }
  .logo { flex:none; width:46px; height:46px; }
  .logo svg { display:block; width:100%; height:100%; }
  .sp-glow { animation:spGlow 3.2s ease-in-out infinite; }
  .sp-reel, .sp-reel-r, .sp-cap { transform-box:fill-box; transform-origin:center; }
  .sp-reel { animation:spReel 7s linear infinite; }
  .sp-reel-r { animation:spReelR 4.5s linear infinite; }
  .sp-cap { animation:spCap 3.6s cubic-bezier(.3,.7,.2,1) infinite; }
  .sp-cap2 { animation-delay:.25s; }
  .brand-t { display:flex; flex-direction:column; gap:3px; line-height:1; }
  .brand-t b { font-size:24px; font-stretch:66%; font-weight:800; letter-spacing:.03em; text-transform:uppercase; }
  .brand-t b span { color:var(--accent); }
  .brand-t small { color:var(--muted); font-family:var(--mono); font-size:10.5px; letter-spacing:.12em; }
  #ui { order:2; padding:7px 10px; border-radius:8px; border:1px solid var(--line); background:var(--surface); color:var(--text); font-size:14px; }
  .tabs { order:3; flex:1 1 300px; max-width:420px; display:flex; gap:4px; background:var(--surface); border:1px solid var(--line); border-radius:999px; padding:4px; }
  .tabs button { flex:1; min-width:0; border:none; padding:9px 12px; border-radius:999px; background:transparent; color:var(--text); font-weight:600; font-size:14px; text-align:center; }
  .tabs button.on { background:var(--accent); color:var(--on-accent); }

  .hero { max-width:1200px; margin:0 auto; padding:28px 24px; display:flex; flex-direction:column; gap:22px; }
  .frame { position:relative; border-radius:18px; overflow:hidden; background:#090706; box-shadow:0 50px 110px -40px rgba(251,192,68,.45); padding:0 8px; isolation:isolate; }
  .perf { height:8px; margin:5px 0; background-image:repeating-linear-gradient(90deg,transparent 0 9px,#2f2a26 9px 21px); animation:spPerf .9s linear infinite; }
  .screen { position:relative; width:100%; height:clamp(280px,44vw,520px); border-radius:6px; overflow:hidden; background:radial-gradient(ellipse at 50% 30%,transparent 20%,#050403 95%),repeating-linear-gradient(135deg,#13100e 0 14px,#1a1613 14px 28px); display:flex; flex-direction:column; justify-content:space-between; padding:clamp(14px,3vw,26px); }
  .beam, .sweep, .dust, .grain, .crowd, .curtains { position:absolute; pointer-events:none; }
  .beam { top:-20%; left:50%; width:160%; height:140%; transform:translateX(-50%); z-index:1; mix-blend-mode:screen; background:conic-gradient(at 50% 0%,transparent 0 152deg,oklch(0.95 0.07 85 / 0.14) 168deg,oklch(0.97 0.06 85 / 0.24) 180deg,oklch(0.95 0.07 85 / 0.14) 192deg,transparent 208deg); animation:spFlicker 2.6s steps(1) infinite; }
  .sweep { top:0; bottom:0; left:0; width:22%; z-index:1; background:linear-gradient(100deg,transparent,rgba(255,255,255,.07),transparent); animation:spSweep 8s ease-in-out infinite; }
  .dust { inset:0; z-index:1; }
  .dust span { position:absolute; border-radius:9px; background:#fbeccd; opacity:0; animation:spDust 5s linear infinite; }
  .grain { inset:-20%; z-index:4; opacity:.22; mix-blend-mode:overlay; background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.55'/></svg>"); animation:spGrain .6s steps(4) infinite; }
  .scr-top { position:relative; z-index:2; display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px 12px; padding-inline:1.5%; font-family:var(--mono); font-size:12px; color:#c9c2bb; }
  .scr-top i { font-style:normal; color:var(--accent); }
  .tc { font-variant-numeric:tabular-nums; }
  .scr-title { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; margin-bottom:clamp(30px,5vw,52px); }
  .scr-title h1 { background:rgba(0,0,0,.72); color:#fff; padding:4px 16px; border-radius:4px; font-size:clamp(26px,5.4vw,62px); line-height:1.05; font-stretch:70%; font-weight:800; text-transform:uppercase; text-wrap:balance; animation:spTitle 1.2s cubic-bezier(.2,.7,.2,1) 1.4s backwards; }
  .scr-cap { color:#fdc85e; font-style:italic; font-size:clamp(15px,2.2vw,24px); font-weight:500; min-height:1.6em; }
  .pill { display:inline-flex; align-items:center; gap:10px; background:rgba(0,0,0,.72); padding:2px 12px; border-radius:4px; animation:spCapIn .55s ease both; }
  .pill .code { font-family:var(--mono); font-style:normal; font-size:11px; padding:1px 6px; border:1px solid currentColor; border-radius:3px; opacity:.85; }
  .crowd { left:0; right:0; bottom:0; height:58px; z-index:3; background:radial-gradient(circle at 50% 70%,#030201 0 13px,transparent 14px) 0 100%/46px 32px repeat-x,radial-gradient(circle at 50% 70%,#0a0807 0 9px,transparent 10px) 17px calc(100% - 18px)/34px 26px repeat-x,linear-gradient(transparent,#030201 80%) 0 100%/100% 26px no-repeat; }
  .curtains { inset:0; z-index:6; }
  .curtains div { position:absolute; top:0; bottom:0; width:51%; box-shadow:inset 0 -40px 60px rgba(0,0,0,.5); }
  .curtains .cl { left:0; transform:translateX(-94%); background:linear-gradient(90deg,transparent 70%,rgba(0,0,0,.55)),repeating-linear-gradient(90deg,oklch(0.3 0.12 25) 0 16px,oklch(0.44 0.17 25) 16px 28px,oklch(0.34 0.14 25) 28px 42px); animation:spCurtainL 1.9s cubic-bezier(.7,0,.2,1) .35s backwards; }
  .curtains .cr { right:0; transform:translateX(94%); background:linear-gradient(270deg,transparent 70%,rgba(0,0,0,.55)),repeating-linear-gradient(90deg,oklch(0.3 0.12 25) 0 16px,oklch(0.44 0.17 25) 16px 28px,oklch(0.34 0.14 25) 28px 42px); animation:spCurtainR 1.9s cubic-bezier(.7,0,.2,1) .35s backwards; }
  .curtains .valance { left:0; right:0; bottom:auto; width:auto; height:16px; background:linear-gradient(oklch(0.38 0.15 25),oklch(0.28 0.12 25)); box-shadow:0 6px 14px rgba(0,0,0,.5); border-radius:0 0 50% 50% / 0 0 100% 100%; }
  .lead { display:flex; flex-wrap:wrap; align-items:flex-start; gap:14px 40px; }
  .tagline { flex:1 1 420px; color:var(--muted); font-size:17px; text-wrap:pretty; }

  .main { max-width:1200px; margin:0 auto; padding:0 24px 64px; display:flex; flex-wrap:wrap; gap:28px; align-items:flex-start; }
  .left { flex:1 1 560px; min-width:0; display:flex; flex-direction:column; gap:20px; }
  .side { flex:0 1 380px; min-width:0; width:100%; position:sticky; top:16px; display:flex; flex-direction:column; gap:16px; }
  .stepper { background:#0c0a08; border-radius:12px; padding:0 6px; }
  .stepper ol { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr)); gap:6px; }
  .stepper li { display:flex; }
  .stepper button { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; align-items:flex-start; border:2px solid #2a2622; border-radius:6px; padding:12px; text-align:start; background:#100d0b; color:#aaa39c; }
  .stepper .num { font-family:var(--mono); font-size:11px; color:var(--dim); }
  .stepper .done .num { color:var(--free); }
  .stepper .lbl { font-weight:700; font-size:15px; line-height:1.15; font-stretch:85%; text-transform:uppercase; letter-spacing:.02em; overflow-wrap:anywhere; hyphens:auto; }
  .stepper button.on { border-color:var(--accent); background:#1e1a16; color:#fff; }
  .stepper button.on .num { color:var(--accent); }
  .step { background:repeating-linear-gradient(135deg,var(--text) 0 12px,var(--surface) 12px 24px) top/100% 7px no-repeat,var(--surface); padding:31px 24px 24px; display:flex; flex-direction:column; gap:18px; animation:spIn .5s cubic-bezier(.2,.7,.2,1) both; }
  .head { display:flex; flex-direction:column; gap:6px; }
  .head h2 { font-size:30px; line-height:1; font-stretch:72%; font-weight:800; text-transform:uppercase; }
  .head p { color:var(--muted); text-wrap:pretty; }

  .trust { display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px; padding:10px 14px; border-radius:10px; background:var(--free-bg); font-size:14px; }
  .trust i { flex:none; width:8px; height:8px; border-radius:2px; background:var(--free); }
  .trust span { flex:1; min-width:200px; }
  .trust .link { color:var(--free); font-size:14px; }
  .trustmore { display:flex; flex-direction:column; align-items:flex-start; gap:12px; margin-top:-8px; padding:4px 14px 0; }
  .trustmore ul { list-style:disc; padding-inline-start:18px; color:var(--muted); display:grid; gap:6px; font-size:14px; }
  .src { border:1px solid var(--line); border-radius:12px; background:var(--bg); }
  .src.open { border-color:var(--accent); }
  .src.on { border-color:var(--free); }
  .src-h { width:100%; display:flex; align-items:center; gap:12px; padding:14px 16px; background:none; border:none; color:var(--text); text-align:start; border-radius:12px; }
  .src-t, .opt-t { flex:1 1 240px; min-width:0; display:flex; flex-direction:column; gap:2px; }
  .src-t { flex:1; }
  .src-t b, .fsrc b { font-size:16px; }
  .opt-t b { font-weight:600; }
  .sub { color:var(--muted); font-size:13px; }
  .more { color:var(--muted); font-size:14px; }
  .more:empty { display:none; }
  .badge { flex:none; font-size:12px; font-weight:600; padding:3px 10px; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
  .badge.on { background:var(--free-bg); border-color:transparent; color:var(--free); }
  .src-b { padding:0 16px 16px; display:flex; flex-direction:column; gap:10px; }
  .src-b .row { font-size:14px; color:var(--muted); }
  .two { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr)); gap:10px; }
  .connected { flex:1; min-width:0; color:var(--free); font-weight:600; overflow-wrap:anywhere; }
  #allowance:not(:empty)::before { content:"· "; }
  .fsrc { border:1px solid var(--line); border-radius:12px; background:var(--bg); padding:14px 16px; display:flex; flex-direction:column; gap:8px; }
  .fsrc.on { border-color:var(--free); }
  .switch { position:relative; flex:none; display:inline-flex; cursor:pointer; }
  .switch input { position:absolute; inset:0; width:100%; height:100%; margin:0; opacity:0; cursor:pointer; }
  .track { display:block; width:44px; height:26px; border-radius:999px; padding:3px; background:var(--line); transition:background .15s; }
  .track::after { content:""; display:block; width:20px; height:20px; border-radius:50%; background:var(--surface); transition:transform .15s; }
  .switch input:checked + .track { background:var(--accent); }
  .switch input:checked + .track::after { transform:translateX(18px); }
  [dir=rtl] .switch input:checked + .track::after { transform:translateX(-18px); }
  .switch input:focus-visible + .track { outline:2px solid var(--accent); outline-offset:2px; }
  .testbox { display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--line); padding-top:16px; }
  .testbox .btn { padding:9px 14px; }
  .testbox .hint { flex:1; min-width:220px; }

  .langs { display:flex; flex-direction:column; gap:6px; }
  .langs li { display:flex; align-items:center; gap:10px; padding:8px 8px 8px 14px; padding-inline:14px 8px; border-radius:10px; background:var(--bg); border:1px solid var(--line); }
  .langs li.empty { display:block; padding:16px; border-style:dashed; background:none; color:var(--muted); text-align:center; }
  .rank { flex:none; width:22px; font-family:var(--mono); font-size:13px; color:var(--accent); }
  .langs .name { flex:1; min-width:0; display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 8px; }
  .langs .name b { font-weight:600; }
  .langs .name small { color:var(--muted); font-size:13px; }
  .icon { flex:none; width:34px; height:34px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--text); }
  .icon:hover:not(:disabled) { border-color:var(--accent); }
  .icon:disabled { opacity:.3; }
  .icon.remove:hover { border-color:var(--cost); color:var(--cost); }
  #search { background:var(--bg); }
  .chips { display:flex; flex-wrap:wrap; gap:6px; max-height:320px; overflow-y:auto; }
  .chip { background:var(--surface2); border:1px solid var(--line); color:var(--text); padding:6px 12px; border-radius:999px; font-size:14px; }
  .chip:hover:not(:disabled) { border-color:var(--accent); }
  .chip:disabled { opacity:.4; }
  .chips .empty { color:var(--muted); font-size:14px; }

  .box { border:1px solid var(--line); border-radius:12px; background:var(--bg); }
  .opt { padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
  .opt + .opt { border-top:1px solid var(--line); }
  .seg { display:flex; flex-wrap:wrap; gap:2px; background:var(--surface2); border-radius:9px; padding:3px; }
  .seg button { border:none; padding:5px 10px; border-radius:7px; background:transparent; color:var(--text); font-weight:600; font-size:13px; }
  .seg button.on { background:var(--accent); color:var(--on-accent); }
  .sample { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr)); gap:8px; font-family:var(--mono); font-size:12px; }
  .sample div { display:flex; flex-direction:column; gap:2px; padding:10px 12px; border-radius:8px; background:var(--surface2); }
  .sample .m { color:var(--muted); }
  .sample .f { color:var(--free); }

  .checks { display:flex; flex-direction:column; gap:6px; }
  .checks li { display:flex; align-items:center; gap:10px; }
  .checks i { flex:none; width:20px; height:20px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-style:normal; font-size:12px; font-weight:700; background:var(--free-bg); color:var(--free); }
  .checks .no i { background:var(--cost-bg); color:var(--cost); }
  .installs { display:flex; flex-wrap:wrap; gap:10px; }
  .cta { flex:1 1 180px; text-align:center; text-decoration:none; background:var(--accent); color:var(--on-accent); padding:14px 18px; border-radius:12px; font-weight:700; font-size:16px; transition:box-shadow .2s,transform .2s; }
  .cta.alt { background:var(--text); color:var(--bg); }
  .cta:hover, .glow:hover:not(:disabled) { color:var(--on-accent); box-shadow:0 0 0 4px rgba(251,192,68,.25),0 12px 34px -6px rgba(251,192,68,.75); transform:translateY(-1px); }
  .cta.alt:hover { color:var(--bg); }
  .note { color:var(--muted); font-size:14px; }
  .paste { display:flex; flex-direction:column; gap:8px; }
  .urlrow { display:flex; gap:8px; align-items:stretch; }
  code { flex:1; min-width:0; padding:11px 12px; background:var(--bg); border:1px solid var(--line); border-radius:10px; font-family:var(--mono); font-size:12.5px; color:var(--muted); overflow-wrap:anywhere; direction:ltr; text-align:left; }
  #copy { flex:none; padding:0 14px; }
  .wnav { display:flex; align-items:center; gap:10px; }
  .wnav span { flex:1; }
  .wnav button { padding:12px 18px; border-radius:12px; font-weight:600; font-size:15px; background:none; border:1px solid var(--line); color:var(--text); }
  .wnav .glow { padding:12px 20px; background:var(--accent); color:var(--on-accent); border:none; font-weight:700; transition:box-shadow .2s,transform .2s; }

  .pad { padding:18px; display:flex; flex-direction:column; gap:12px; }
  .between { display:flex; justify-content:space-between; align-items:baseline; gap:12px; }
  .between b { font-size:14px; }
  .between span { font-family:var(--mono); font-size:13px; color:var(--muted); }
  .bar { height:6px; border-radius:999px; background:var(--surface2); overflow:hidden; }
  .bar i { display:block; height:100%; width:0; background:var(--accent); transition:width .3s; }
  .sbadges { display:flex; flex-wrap:wrap; gap:6px; }
  .sbadge { font-size:12px; padding:3px 9px; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
  .sbadge.on { background:var(--free-bg); border-color:transparent; color:var(--free); }
  .pv { overflow:hidden; display:flex; flex-direction:column; }
  .pv-h { padding:16px 18px 12px; display:flex; flex-direction:column; gap:4px; border-bottom:1px solid var(--line); }
  .pv-h .live { font-family:var(--mono); font-size:11px; letter-spacing:.06em; color:var(--accent); }
  .pv-h b { font-size:16px; }
  .player { position:relative; aspect-ratio:16/9; background:radial-gradient(ellipse at 50% 40%,transparent 30%,#060504 100%),repeating-linear-gradient(135deg,#13100e 0 10px,#1a1613 10px 20px); display:flex; flex-direction:column; justify-content:flex-end; align-items:center; padding:12px 12px 26px; gap:2px; text-align:center; }
  .player .ph, .player .tc { position:absolute; top:10px; font-family:var(--mono); font-size:10.5px; color:#969088; }
  .player .ph { inset-inline-start:12px; }
  .player .tc { right:12px; }
  [dir=rtl] .player .tc { right:auto; left:12px; }
  #playerCaps { min-height:22px; }
  .capcol { display:flex; flex-direction:column; gap:2px; animation:spCapIn .3s ease both; }
  .cap { color:#fff; font-size:16px; font-weight:600; text-shadow:0 1px 3px #000; }
  .cap.sfx { font-size:14px; font-weight:400; }
  .cap.second { color:#fdc85e; font-size:14px; font-weight:400; font-style:italic; }
  .prog { position:absolute; left:12px; right:12px; bottom:10px; height:3px; border-radius:2px; background:rgba(255,255,255,.2); overflow:hidden; }
  .prog i { display:block; height:100%; background:var(--accent); animation:spProg 40s linear infinite; }
  .pv-list { max-height:min(420px,36vh); overflow-y:auto; }
  .pv-list p { padding:24px 18px; color:var(--muted); font-size:14px; text-align:center; }
  .pv-list p b { display:block; }
  .pv-g { position:sticky; top:0; background:var(--surface2); padding:6px 18px; font-size:12px; font-weight:600; letter-spacing:.04em; color:var(--muted); text-transform:uppercase; }
  .pv-r { padding:9px 18px; display:flex; flex-direction:column; gap:2px; border-top:1px solid var(--line); }
  .pv-r .tag { display:flex; flex-wrap:wrap; align-items:center; gap:4px 8px; font-size:13px; font-weight:600; }
  .best { font-size:10.5px; font-weight:700; padding:1px 6px; border-radius:4px; background:var(--accent); color:var(--on-accent); }
  .rel { font-family:var(--mono); font-size:11.5px; color:var(--muted); overflow-wrap:anywhere; }
  .legend-b { display:flex; justify-content:space-between; align-items:center; gap:12px; background:none; border:none; border-top:1px solid var(--line); padding:12px 18px; color:var(--text); font-weight:600; font-size:14px; text-align:start; }
  .legend { padding:0 18px 16px; display:flex; flex-direction:column; gap:10px; font-size:13px; }
  .legend dt { font-weight:600; }
  .legend dd { color:var(--muted); }
  .support { padding:18px; display:flex; align-items:center; gap:14px; }
  .support div { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
  .support div span { color:var(--muted); font-size:13px; }
  .coffee { flex:none; display:flex; align-items:center; gap:8px; text-decoration:none; background:#ffdd00; color:#1a1714; padding:10px 14px; border-radius:10px; font-weight:700; font-size:14px; transition:transform .2s,box-shadow .2s; }
  .coffee:hover { color:#1a1714; transform:translateY(-1px); box-shadow:0 10px 26px -8px #ffdd00; }

  .find { max-width:900px; margin:0 auto; padding:40px 24px 64px; display:flex; flex-direction:column; gap:20px; }
  .find-h { display:flex; flex-direction:column; gap:10px; }
  .find-h .eyebrow { letter-spacing:.08em; }
  .find-h h1 { font-size:clamp(32px,6vw,52px); line-height:.95; font-stretch:70%; font-weight:800; text-transform:uppercase; }
  #findIntro { display:flex; flex-direction:column; gap:10px; }
  #findIntro .sum { color:var(--muted); font-size:16px; }
  #findIntro .link { font-size:15px; }
  #findRest { color:var(--muted); font-size:14px; }
  .setupcard { padding:24px; display:flex; flex-wrap:wrap; align-items:center; gap:12px 20px; }
  .setupcard span { flex:1; min-width:220px; }
  .setupcard .btn { padding:11px 18px; }
  .findcard { padding:20px; display:flex; flex-direction:column; gap:16px; }
  #findForm { display:flex; gap:8px; }
  #findQuery { flex:1; min-width:0; padding:13px 14px; background:var(--bg); font-size:16px; }
  #findButton { flex:none; padding:0 22px; font-size:15px; }
  .posters { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:12px; }
  .posters:empty { display:none; }
  .poster { display:flex; flex-direction:column; gap:8px; padding:0; background:none; border:none; color:var(--text); text-align:start; }
  .pf { position:relative; width:100%; aspect-ratio:2/3; border-radius:8px; outline:2px solid transparent; outline-offset:2px; background:repeating-linear-gradient(135deg,#13100e 0 10px,#1c1815 10px 20px); display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .poster.on .pf { outline-color:var(--accent); }
  .poster:hover:not(:disabled) .pf { outline-color:var(--line); }
  .poster.on:hover .pf { outline-color:var(--accent); }
  .pn { padding:28px 10px 10px; color:var(--dim); font-size:16px; line-height:1.05; font-stretch:70%; font-weight:800; text-transform:uppercase; text-align:center; overflow-wrap:anywhere; }
  .pt { position:absolute; top:8px; inset-inline-start:8px; font-size:10.5px; font-weight:700; padding:1px 6px; border-radius:4px; background:var(--accent); color:var(--on-accent); }
  .pi { display:flex; flex-direction:column; gap:1px; }
  .pi b { font-size:14px; line-height:1.2; }
  .pi small { color:var(--muted); font-size:12px; }
  .eprow { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; padding-top:16px; border-top:1px solid var(--line); }
  .eprow label { display:flex; align-items:center; gap:8px; }
  .eprow select { padding:8px 10px; border-radius:8px; border:1px solid var(--line); background:var(--bg); color:var(--text); }
  .subscard { overflow:hidden; }
  .subs-h { padding:16px 20px; display:flex; flex-wrap:wrap; align-items:center; gap:10px 16px; }
  .subs-h > b { flex:1; min-width:200px; }
  #findShiftBox { display:contents; }
  #findShiftBox label { color:var(--muted); font-size:14px; }
  .shift { display:flex; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .shift button { width:34px; border:none; background:var(--surface2); color:var(--text); font-size:16px; }
  #findShift { width:64px; border:none; border-radius:0; text-align:center; background:var(--bg); color:var(--text); font-family:var(--mono); font-size:14px; padding:7px 0; outline:none; -moz-appearance:textfield; appearance:textfield; }
  #findShift::-webkit-inner-spin-button, #findShift::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
  #findShiftBox > span { flex-basis:100%; color:var(--muted); font-size:13px; }
  .subs li { padding:12px 20px; display:flex; flex-wrap:wrap; align-items:center; gap:8px 16px; border-top:1px solid var(--line); }
  .subs .name { flex:1 1 300px; min-width:0; display:flex; flex-direction:column; gap:2px; }
  .subs .top { font-size:14px; border:none; }
  .subs .top b { font-weight:600; }
  .subs .lang { color:var(--muted); }
  .subs .btn { flex:none; }
  .subs .saved { border-color:var(--free); background:var(--free-bg); color:var(--free); }

  footer { border-top:1px solid var(--line); }
  .foot { max-width:1200px; margin:0 auto; padding:20px 24px; display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px 24px; color:var(--muted); font-size:13px; }

  @media (max-width:1015px) {
    .side { flex-basis:100%; position:static; }
  }
  @media (max-width:640px) {
    .top-in, .hero, .find, .foot { padding-inline:16px; }
    .main { padding-inline:16px; }
    .tabs { flex-basis:100%; max-width:none; }
    .step { padding-inline:16px; }
    .support { flex-wrap:wrap; }
  }
  @media (prefers-reduced-motion:reduce) {
    *, *::before, *::after { animation:none !important; transition:none !important; }
  }
</style>
</head>
<body>
<header class="top">
  <div class="top-in">
    <div class="brand">
      <span class="logo">${LOGO_SVG}</span>
      <span class="brand-t"><b>Sub<span>Pool</span></b><small>BY DIAVELIN</small></span>
    </div>
    <select id="ui"></select>
    <nav class="tabs">
      <button type="button" id="tabSetup" data-i18n="setupTab"></button>
      <button type="button" id="tabFind" data-i18n="findTitle"></button>
    </nav>
  </div>
</header>
${misconfigured ? '<p class="warn"><b>Server misconfigured:</b> OS_API_KEY / CONFIG_SECRET missing.</p>' : ''}

<div id="setupView">
  <section class="hero">
    <div class="frame">
      <div class="perf"></div>
      <div class="screen">
        <div class="beam"></div>
        <div class="sweep"></div>
        <div class="dust">${DUST}</div>
        <div class="grain"></div>
        <div class="scr-top">
          <span><i>▶</i> <span data-i18n="nowPlaying"></span> · <span data-i18n="scene"></span> 00</span>
          <span class="tc" id="heroTime" dir="ltr">00:00:01,000</span>
        </div>
        <div class="scr-title">
          <h1 data-i18n="hero"></h1>
          <div class="scr-cap" id="heroCap"></div>
        </div>
        <div class="crowd"></div>
        <div class="curtains" dir="ltr"><div class="cl"></div><div class="cr"></div><div class="valance"></div></div>
      </div>
      <div class="perf"></div>
    </div>
    <div class="lead">
      <p class="tagline" data-i18n="tagline"></p>
    </div>
  </section>

  <main class="main">
    <div class="left">
      <div class="stepper" id="stepper">
        <div class="perf"></div>
        <ol>
          <li><button type="button" id="stepBtn0"><span class="num" id="stepNum0"></span><span class="lbl" data-i18n="sourcesTitle"></span></button></li>
          <li><button type="button" id="stepBtn1"><span class="num" id="stepNum1"></span><span class="lbl" data-i18n="languagesTitle"></span></button></li>
          <li><button type="button" id="stepBtn2"><span class="num" id="stepNum2"></span><span class="lbl" data-i18n="optionsTitle"></span></button></li>
          <li><button type="button" id="stepBtn3"><span class="num" id="stepNum3"></span><span class="lbl" data-i18n="installTitle"></span></button></li>
        </ol>
        <div class="perf"></div>
      </div>

      <section class="card step" id="step0">${stepHead(0, '00:00:01,000', 'sourcesTitle', 'sourcesIntro')}
        <div class="trust">
          <i></i><span data-i18n="trustStore"></span>
          <button class="link" type="button" id="trustBtn" aria-expanded="false" aria-controls="trustMore"></button>
        </div>
        <div class="trustmore" id="trustMore" hidden>
          <ul>
            <li data-i18n="trustRemember"></li>
            <li data-i18n="trustUse"></li>
            <li data-i18n="trustShare"></li>
            <li data-i18n="trustRevoke"></li>
            <li data-i18n="trustSeparate"></li>
            <li data-i18n="trustLink"></li>
          </ul>
          <button class="btn out" id="forget" type="button" data-i18n="forget" hidden></button>
        </div>

        <div class="group">
          <div class="glabel" data-i18n="gKey"></div>
          <div class="src" id="osPanel">
            <button class="src-h" type="button" id="osHead" aria-expanded="false" aria-controls="osBody">
              <span class="src-t"><b>OpenSubtitles</b><span class="sub" data-i18n="accountIntro" data-part="sum"></span></span>
              <span class="badge" id="osBadge"></span><span class="chev" id="osChev" aria-hidden="true">+</span>
            </button>
            <div class="src-b" id="osBody" hidden>
              <p class="more" data-i18n="accountIntro" data-part="more"></p>
              <form class="stack" id="osForm">
                <div class="two">
                  <input type="text" id="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
                  <input type="password" id="password" autocomplete="current-password" required>
                </div>
                <div class="row">
                  <button class="btn acc" type="submit" data-i18n="verify"></button>
                  <span><span data-i18n="signupHint"></span> <a href="https://www.opensubtitles.com/" target="_blank" rel="noopener" data-i18n="signupLink"></a></span>
                </div>
              </form>
              <div class="row" id="osDone" hidden>
                <span class="connected"><span id="osStatus"></span> <span id="allowance"></span></span>
                <button class="btn out" type="button" data-remove="os" data-i18n="disconnect"></button>
              </div>
              <p class="status" id="osMsg" role="status"></p>
            </div>
          </div>${keyPanel('subdl', 'SubDL', 'https://subdl.com/panel/api')}${keyPanel('subsource', 'SubSource', 'https://subsource.net/dashboard/profile')}${keyPanel('altyazidb', 'AltyazıDB', 'https://altyazidb.com/')}
        </div>

        <div class="group">
          <div class="glabel" data-i18n="gFree"></div>${freePanel('gestdown', 'Gestdown')}${freePanel('anisub', 'AniSub')}
        </div>

        <div class="testbox">
          <div class="row">
            <button class="btn out" id="test" type="button" data-i18n="testButton"></button>
            <span class="hint" data-i18n="testHint"></span>
          </div>
          <div id="testResult" role="status"></div>
        </div>
      </section>

      <section class="card step" id="step1" hidden>${stepHead(1, '00:01:12,400', 'languagesTitle', 'languagesIntro')}
        <ol class="langs" id="selected"></ol>
        <div class="group">
          <div class="glabel" data-i18n="addTitle"></div>
          <input type="search" id="search" autocomplete="off">
          <div class="chips" id="available"></div>
        </div>
      </section>

      <section class="card step" id="step2" hidden>${stepHead(2, '00:02:30,800', 'optionsTitle', 'optIntro', ' · <span id="optUp"></span>')}
        <div class="group">
          <div class="glabel" data-i18n="gSort"></div>
          <div class="box">${option('match', toggle('match'))}${option('pri', choice('pri'))}${option('limit', choice('limit'))}${option('fallback', toggle('fallback'))}
          </div>
        </div>
        <div class="group">
          <div class="glabel" data-i18n="gFilter"></div>
          <div class="box">${option('machine', toggle('machine'))}${option('hi', choice('hi'))}
          </div>
        </div>
        <div class="group">
          <div class="glabel" data-i18n="gText"></div>
          <div class="box">${option('clean', toggle('clean'), CLEAN_SAMPLE)}${option('dual', toggle('dual'))}${option('ass', toggle('ass'))}
          </div>
        </div>
      </section>

      <section class="card step" id="step3" hidden>${stepHead(3, '00:03:45,000', 'installTitle')}
        <ul class="checks" id="checks"></ul>
        <p class="note" id="needSetup" data-i18n="needSetup"></p>
        <div class="installs">
          <a class="cta" id="install" data-i18n="install"></a>
          <a class="cta alt" id="installNuvio" data-i18n="installNuvio"></a>
        </div>
        <p class="note" id="nuvioNote" data-i18n="nuvioNote" hidden></p>
        <div class="paste">
          <p class="note" data-i18n="pasteHint"></p>
          <div class="urlrow">
            <code id="url"></code>
            <button class="btn out" id="copy" type="button" data-i18n="copy"></button>
          </div>
          <p class="hint" data-i18n="reinstallHint"></p>
        </div>
      </section>

      <div class="wnav">
        <button type="button" id="back" hidden></button>
        <span></span>
        <button class="glow" type="button" id="next"></button>
      </div>
    </div>

    <aside class="side">
      <div class="card pad">
        <div class="between"><b data-i18n="srcTitle"></b><span id="srcCount" dir="ltr"></span></div>
        <div class="bar"><i id="srcBar"></i></div>
        <div class="sbadges" id="srcBadges"></div>
        <p class="hint" id="srcHint"></p>
      </div>

      <div class="card pv">
        <div class="pv-h">
          <span class="live" data-i18n="live"></span>
          <b data-i18n="playerList"></b>
          <span class="hint" id="pvTitle"></span>
        </div>
        <div class="player">
          <span class="ph" data-i18n="playerPh"></span>
          <span class="tc" id="playerTime" dir="ltr">01:12:08,416</span>
          <div id="playerCaps"></div>
          <div class="prog"><i></i></div>
        </div>
        <div class="pv-list" id="pvList"></div>
        <button class="legend-b" type="button" id="legendBtn" aria-expanded="false" aria-controls="legend"><span data-i18n="howTitle"></span><span class="chev" id="legendChev" aria-hidden="true">+</span></button>
        <dl class="legend" id="legend" hidden>
          <div><dt class="free" data-i18n="tagOfficial"></dt><dd data-i18n="howOfficial"></dd></div>
          <div><dt class="free" data-i18n="tagPool"></dt><dd data-i18n="howPool"></dd></div>
          <div><dt class="cost" data-i18n="tagQuota"></dt><dd data-i18n="howQuota"></dd></div>
          <div><dt class="free"><span data-i18n="tagSubdl"></span> / <span data-i18n="tagSubsource"></span></dt><dd data-i18n="howOther"></dd></div>
          <div><dt class="free" data-i18n="tagGestdown"></dt><dd data-i18n="howGestdown"></dd></div>
          <div id="anisubLegend"><dt class="free" data-i18n="tagAnisub"></dt><dd data-i18n="howAnisub"></dd></div>
          <div><dt class="free" data-i18n="tagDual"></dt><dd data-i18n="howDual"></dd></div>
          <div><dt>HI</dt><dd data-i18n="howHi"></dd></div>
          <div><dd><span data-i18n="vipNote"></span> <a href="https://www.opensubtitles.com/en/vip" target="_blank" rel="noopener" data-i18n="vipLink"></a></dd></div>
        </dl>
      </div>

      <div class="card support">
        <div><b data-i18n="supportTitle"></b><span data-i18n="supportText"></span></div>
        <a class="coffee" href="https://buymeacoffee.com/diavelin" target="_blank" rel="noopener"><span aria-hidden="true">☕</span> <span data-i18n="supportBtn"></span></a>
      </div>
    </aside>
  </main>
</div>

<section class="find" id="findPanel" hidden>
  <div class="find-h">
    <span class="eyebrow" data-i18n="findEyebrow"></span>
    <h1 data-i18n="findTitle"></h1>
    <div id="findIntro">
      <p class="sum"><span id="findSum"></span> <button class="link" type="button" data-det="findRest"></button></p>
      <p id="findRest" hidden></p>
    </div>
  </div>
  <div class="card setupcard" id="findSetup">
    <span data-i18n="needSetup"></span>
    <button class="btn acc" type="button" id="goSetup" data-i18n="goSetup"></button>
  </div>
  <div class="card findcard" id="findCard">
    <form id="findForm">
      <input type="search" id="findQuery" autocomplete="off" required>
      <button class="btn acc" type="submit" id="findButton" data-i18n="findButton"></button>
    </form>
    <p class="status" id="findMsg" role="status"></p>
    <div class="posters" id="findTitles"></div>
    <div class="eprow" id="findEpisode" hidden>
      <label><span data-i18n="seasonLabel"></span> <select id="findSeason"></select></label>
      <label><span data-i18n="episodeLabel"></span> <select id="findEp"></select></label>
      <button class="btn out" id="findList" type="button" data-i18n="findList"></button>
    </div>
  </div>
  <div class="card subscard" id="findSubsCard" hidden>
    <div class="subs-h">
      <b id="findSubsTitle"></b>
      <div id="findShiftBox" hidden>
        <label for="findShift" data-i18n="shiftLabel"></label>
        <div class="shift" dir="ltr">
          <button type="button" id="shiftDown" aria-label="-0.5">−</button>
          <input type="number" id="findShift" value="0" step="0.1" min="-600" max="600" inputmode="decimal">
          <button type="button" id="shiftUp" aria-label="+0.5">+</button>
        </div>
        <span data-i18n="shiftHint"></span>
      </div>
    </div>
    <ol class="subs" id="findSubs" hidden></ol>
  </div>
</section>

<footer>
  <div class="foot">
    <span><span data-i18n="codeText"></span> <a href="https://github.com/MrDiavelin/subpool" target="_blank" rel="noopener">github.com/MrDiavelin/subpool</a></span>
    <span><span data-i18n="contactText"></span> <a href="https://x.com/Diavelin" target="_blank" rel="noopener">X (@Diavelin)</a> · <a href="https://discord.com/users/163213047597498368" target="_blank" rel="noopener">Discord (diavelin)</a></span>
  </div>
</footer>
<script>
const STRINGS = ${toJson(PAGE_STRINGS)};
const UI_LANGUAGES = ${toJson(UI_LANGUAGES)};
const LANGS = ${toJson(langs)};
const BASE_URL = ${toJson(baseUrl)};
const MAX = ${maxLanguages};
const DIALOG = ${toJson(DIALOG)};
const SAMPLE = ${toJson(SAMPLE)};
const POPULAR = ${toJson(POPULAR)};
let selected = ${toJson(selected)};
let auth = ${toJson(auth)};
let sources = ${toJson(sources)};
// Liste ayarları: dil başına en fazla altyazı (null: sınırsız) ve akıllı sürüm eşleştirme.
let max = ${toJson(max)};
let match = ${toJson(match)};
// Yedek dil, makine çevirilerini gizleme, işitme engelli (HI) altyazıların yeri ve ses açıklaması temizliği.
let fallback = ${toJson(!!fallback)};
let hideMachine = ${toJson(machine === false)};
let hi = ${toJson(hi || 'show')};
let clean = ${toJson(!!clean)};
// ASS/SSA altyazılar SRT'ye çevrilmeden, stiliyle verilir (deneysel).
let ass = ${toJson(!!ass)};
// Gestdown anahtar istemeyen bir kaynaktır; şifreli parçada değil, adreste bir ayar olarak durur.
let gestdown = ${toJson(!!gestdown)};
// AniSub da anahtar istemez; adreste "as=1" olarak durur. Yalnızca Türkçe altyazı verdiği için ayarı yalnızca site
// Türkçeyken görünür; başka dilde gizlenir ve adrese yazılmaz (Türkçeye dönülünce seçim geri gelir).
let anisub = ${toJson(!!anisub)};
const anisubShown = () => ui === 'tr';
const anisubOn = () => anisub && anisubShown();
let dual = ${toJson(!!dual)};
// Listede öne alınacak kaynak ("pri"); boşsa hiçbiri.
let prefer = ${toJson(prefer || '')};
const PREFER_NAMES = { os: 'OpenSubtitles', sd: 'SubDL', ss: 'SubSource', adb: 'AltyazıDB', gd: 'Gestdown', as: 'AniSub' };
const LIMITS = [5, 10, 15, 20];
const HI_MODES = { show: 'hiShow', last: 'hiLast', hide: 'hiHide' };
const SOURCE_NAMES = { os: 'OpenSubtitles', subdl: 'SubDL', subsource: 'SubSource', altyazidb: 'AltyazıDB', gestdown: 'Gestdown', anisub: 'AniSub' };
const KEY_SOURCES = ['os', 'subdl', 'subsource', 'altyazidb'];
const STEPS = ['sourcesTitle', 'languagesTitle', 'optionsTitle', 'installTitle'];
let allowance = null;
// Kaynak denemesinin durumu: null, 'running', bir hata metninin anahtarı ya da sonuç listesi.
let tested = null;
// Altyazı arama: harici oynatıcı kullananlar altyazıyı buradan indirir. Kurulum adresindeki ayarların aynısı kullanılır.
const CINEMETA = 'https://v3-cinemeta.strem.io';
let addonBase = null;
let found = null;
let picked = null;
let subs = null;
let subsName = '';
let findNote = null;
let findBusy = false;

const $ = (id) => document.getElementById(id);
const byCode = new Map(LANGS.map((l) => [l.code, l]));

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch {} }

function detectUi() {
  const fromConfig = ${toJson(ui)};
  if (fromConfig) return fromConfig;
  const saved = storageGet('ui');
  if (saved && STRINGS[saved]) return saved;
  for (const lang of navigator.languages || [navigator.language || '']) {
    const code = String(lang).slice(0, 2).toLowerCase();
    if (STRINGS[code]) return code;
  }
  return ${toJson(DEFAULT_UI)};
}
let ui = detectUi();

// Ayarlar bu tarayıcıda hatırlanır. Adres ayar taşımıyorsa (site doğrudan açıldıysa) hatırlanan ayar yüklenir.
const NO_SOURCES = { os: null, subdl: null, subsource: null, altyazidb: null };
let restored = false;
if (!auth && !selected.length) {
  try {
    const saved = JSON.parse(storageGet('saved') || 'null');
    if (Array.isArray(saved?.selected)) selected = saved.selected.filter((code) => byCode.has(code)).slice(0, MAX);
    if (LIMITS.includes(saved?.max)) max = saved.max;
    if (saved?.match === false) match = false;
    if (saved?.fallback === true) fallback = true;
    if (saved?.machine === false) hideMachine = true;
    if (HI_MODES[saved?.hi]) hi = saved.hi;
    if (saved?.clean === true) clean = true;
    if (saved?.ass === true) ass = true;
    if (saved?.gestdown === true) gestdown = true;
    if (saved?.anisub === true) anisub = true;
    if (saved?.dual === true) dual = true;
    if (PREFER_NAMES[saved?.prefer]) prefer = saved.prefer;
    if (typeof saved?.auth === 'string' && saved.auth && saved.sources) {
      auth = saved.auth;
      sources = { ...NO_SOURCES, ...saved.sources };
      restored = true;
    }
  } catch {}
}

// İlk kez gelen kullanıcıya tarayıcı dilindeki altyazıyı önceden seç.
if (!selected.length) {
  for (const lang of navigator.languages || [navigator.language || '']) {
    const full = String(lang).toLowerCase();
    const base = full.slice(0, 2);
    const code = [full, base === 'pt' ? 'pt-br' : base].find((c) => byCode.has(c));
    if (code) { selected = [code]; break; }
  }
}

// Sayfanın görünümü: açık sekme (kurulum ya da altyazı arama), kurulum adımı ve açık duran bölümler.
let tab = location.hash === '#find' ? 'find' : 'setup';
let step = 0;
let openSrc = auth ? null : 'os';
let trustOpen = false;
let legendOpen = false;
// Hareket azaltma istenmişse perdedeki zaman ve örnek altyazılar akmaz.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
let heroIdx = 0;
let capIdx = calm ? 1 : 0;
let capShown = '';
let previewShown = '';

const tr = (key, vars = {}) => (STRINGS[ui][key] ?? STRINGS.en[key]).replace(/\\{(\\w+)\\}/g, (_, k) => vars[k] ?? '');

/** Metni ilk cümlesi ve gerisi olarak ayırır: ilk cümle hep görünür, gerisi "Detay" ile açılır. */
function split(text) {
  const s = String(text || '');
  const end = /[.!?؟](?=\\s|$)|[。！？]/g;
  for (let m; (m = end.exec(s));) {
    const head = s.slice(0, m.index + 1);
    // Parantez içindeki kısaltmalarda (ör. "и т. д.") cümle bitmiş sayılmaz.
    if (head.split('(').length === head.split(')').length && head.split('（').length === head.split('）').length) return [head, s.slice(m.index + 1).trim()];
  }
  return [s, ''];
}

const nameCache = {};
function langName(l) {
  const cache = nameCache[ui] || (nameCache[ui] = {});
  if (cache[l.code]) return cache[l.code];
  let name = l.english;
  if (l.tag) {
    try {
      const n = new Intl.DisplayNames([ui], { type: 'language' }).of(l.tag);
      if (n && n.toLowerCase() !== l.tag.toLowerCase()) name = n.charAt(0).toLocaleUpperCase(ui) + n.slice(1);
    } catch {}
  }
  return (cache[l.code] = name);
}
// Dilin kendi dilindeki adı (ör. "Deutsch"); bilinmiyorsa boş.
const nativeCache = {};
function nativeName(l) {
  if (nativeCache[l.code] != null) return nativeCache[l.code];
  let name = '';
  if (l.tag) {
    try {
      const n = new Intl.DisplayNames([l.tag], { type: 'language' }).of(l.tag);
      if (n && n.toLowerCase() !== l.tag.toLowerCase()) name = n.charAt(0).toLocaleUpperCase(l.tag) + n.slice(1);
    } catch {}
  }
  return (nativeCache[l.code] = name);
}
const norm = (s) => s.toLocaleLowerCase(ui).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/ı/g, 'i');

function make(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function button(label, title, cls, onClick, disabled) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.title = title;
  b.disabled = !!disabled;
  b.addEventListener('click', onClick);
  return b;
}

function move(i, delta) {
  const j = i + delta;
  [selected[i], selected[j]] = [selected[j], selected[i]];
  render();
}

const messages = {};
function setMsg(name, key) {
  messages[name] = key || '';
  $(name + 'Msg').textContent = key ? tr(key) : '';
  $(name + 'Msg').className = 'status' + (key && key !== 'verifying' ? ' error' : '');
}

const hasSource = () => !!auth || gestdown || anisubOn();
// AltyazıDB yalnızca Türkçe ve İngilizce altyazı verir; bu diller seçili değilse bölümü gösterilmez.
const adbShown = () => !!sources.altyazidb || ui === 'tr' || ui === 'en';
const sourceList = () => [
  ['OpenSubtitles', !!sources.os], ['SubDL', !!sources.subdl], ['SubSource', !!sources.subsource],
  ...(adbShown() ? [['AltyazıDB', !!sources.altyazidb]] : []),
  ['Gestdown', gestdown],
  ...(anisubShown() ? [['AniSub', anisub]] : []),
];

function renderStatic() {
  document.documentElement.lang = ui;
  document.documentElement.dir = ui === 'ar' ? 'rtl' : 'ltr';
  for (const node of document.querySelectorAll('[data-i18n]')) {
    const text = tr(node.dataset.i18n);
    const part = node.dataset.part;
    const [sum, rest] = part ? split(text) : [];
    node.textContent = !part ? text : part === 'sum' ? sum : part === 'rest' ? rest : rest || text;
  }
  $('ui').title = tr('uiLanguage');
  $('ui').setAttribute('aria-label', tr('uiLanguage'));
  $('username').placeholder = tr('username');
  $('password').placeholder = tr('password');
  $('subdlKey').placeholder = tr('apiKey');
  $('subsourceKey').placeholder = tr('apiKey');
  $('altyazidbKey').placeholder = tr('apiKey');
  $('search').placeholder = tr('searchPlaceholder');
  $('findQuery').placeholder = tr('findPlaceholder');
  $('optUp').textContent = tr('optional').toLocaleUpperCase(ui);
  const intro = split(tr('findIntro', { quota: tr('tagQuota'), official: tr('tagOfficial') }) +
    (anisubShown() ? ' ' + tr('findAnisub', { anisub: tr('tagAnisub') }) : ''));
  $('findSum').textContent = intro[0];
  $('findRest').textContent = intro[1];
  const limits = [...new Set([...LIMITS, max || LIMITS[0]])].sort((a, b) => a - b);
  $('limit').replaceChildren(new Option(tr('limitNone'), ''), ...limits.map((n) => new Option(String(n), String(n))));
  $('limit').value = max ? String(max) : '';
  $('match').checked = match;
  $('fallback').checked = fallback;
  $('machine').checked = hideMachine;
  $('hi').replaceChildren(...Object.entries(HI_MODES).map(([mode, key]) => new Option(tr(key), mode)));
  $('hi').value = hi;
  $('clean').checked = clean;
  $('ass').checked = ass;
  const priCodes = Object.keys(PREFER_NAMES).filter((code) => code !== 'as' || anisubShown());
  $('pri').replaceChildren(new Option(tr('priNone'), ''), ...priCodes.map((code) => new Option(PREFER_NAMES[code], code)));
  $('pri').value = priCodes.includes(prefer) ? prefer : '';
  $('gestdown').checked = gestdown;
  $('anisub').checked = anisub;
  $('anisubPanel').hidden = !anisubShown();
  $('anisubLegend').hidden = !anisubShown();
  $('dual').checked = dual;
  for (const name of KEY_SOURCES) setMsg(name, messages[name]);
  renderHero();
}

/** Perdenin altındaki satır: başlık, sayfanın diğer dillerinde sırayla gösterilir. */
function renderHero() {
  const others = Object.keys(UI_LANGUAGES).filter((code) => code !== ui);
  const code = others[heroIdx % others.length];
  const pill = make('span', 'pill');
  const text = make('span', '', STRINGS[code].hero);
  text.lang = code;
  text.dir = code === 'ar' ? 'rtl' : 'ltr';
  pill.append(make('span', 'code', code.toUpperCase()), text);
  $('heroCap').replaceChildren(pill);
}

const timecode = (ms) => {
  const pad = (n, size) => String(Math.floor(n)).padStart(size, '0');
  return pad(ms / 3600000, 2) + ':' + pad((ms / 60000) % 60, 2) + ':' + pad((ms / 1000) % 60, 2) + ',' + pad(ms % 1000, 3);
};

/** Sekme, adım ve açılır bölümlerin durumunu sayfaya yansıtır. */
function renderView() {
  const find = tab === 'find';
  $('setupView').hidden = find;
  $('findPanel').hidden = !find;
  $('tabSetup').className = find ? '' : 'on';
  $('tabSetup').setAttribute('aria-pressed', String(!find));
  $('tabFind').className = find ? 'on' : '';
  $('tabFind').setAttribute('aria-pressed', String(find));

  const done = [hasSource(), selected.length > 0, true, false];
  STEPS.forEach((key, i) => {
    $('step' + i).hidden = i !== step;
    $('stepBtn' + i).className = (i === step ? 'on' : '') + (done[i] ? ' done' : '');
    $('stepBtn' + i).setAttribute('aria-current', i === step ? 'step' : 'false');
    $('stepNum' + i).textContent = tr('scene') + ' 0' + (i + 1) + (done[i] && i !== step ? ' ✓' : '');
  });
  const rtl = ui === 'ar';
  $('back').hidden = step === 0;
  $('back').textContent = (rtl ? '→ ' : '← ') + tr('back');
  $('next').hidden = step === STEPS.length - 1;
  $('next').textContent = tr('next') + ': ' + tr(STEPS[Math.min(step + 1, STEPS.length - 1)]) + (rtl ? ' ←' : ' →');

  for (const name of KEY_SOURCES) {
    const open = openSrc === name;
    $(name + 'Panel').className = 'src' + (open ? ' open' : '') + (sources[name] ? ' on' : '');
    $(name + 'Body').hidden = !open;
    $(name + 'Head').setAttribute('aria-expanded', String(open));
    $(name + 'Chev').textContent = open ? '−' : '+';
    $(name + 'Badge').className = 'badge' + (sources[name] ? ' on' : '');
    $(name + 'Badge').textContent = tr(sources[name] ? 'on' : 'off');
  }
  $('trustMore').hidden = !trustOpen;
  $('trustBtn').textContent = tr(trustOpen ? 'hide' : 'trustTitle');
  $('trustBtn').setAttribute('aria-expanded', String(trustOpen));
  $('legend').hidden = !legendOpen;
  $('legendChev').textContent = legendOpen ? '−' : '+';
  $('legendBtn').setAttribute('aria-expanded', String(legendOpen));
  // "Detay" düğmeleri: açıklamanın ilk cümlesinden sonrası yoksa düğme de gösterilmez.
  for (const b of document.querySelectorAll('[data-det]')) {
    const target = $(b.dataset.det);
    if (!target.textContent) target.hidden = true;
    b.hidden = !target.textContent;
    b.textContent = tr(target.hidden ? 'details' : 'hide');
    b.setAttribute('aria-expanded', String(!target.hidden));
  }
}

function renderTest() {
  const box = $('testResult');
  box.replaceChildren();
  const line = (text, cls) => {
    const p = document.createElement('p');
    p.className = 'status' + (cls ? ' ' + cls : '');
    p.textContent = text;
    box.append(p);
  };
  if (tested === 'running') return line(tr('testRunning'));
  if (typeof tested === 'string') return line(tr(tested), 'error');
  for (const r of tested || []) {
    const source = SOURCE_NAMES[r.source] || r.source;
    // Yanıt süresi satırın sonuna yazılır: listeyi hangi kaynağın beklettiği buradan anlaşılır.
    const took = typeof r.ms === 'number' ? ' (' + r.ms + ' ms)' : '';
    if (r.status === 'ok' && r.reachable) {
      line(tr('testReachable', { source }) + took, 'good');
    } else if (r.status === 'ok') {
      // Gestdown yalnızca dizi barındırdığı için orada film yerine örnek bir dizi bölümü aranır.
      const text = r.count > 0 ? tr(r.series ? 'testOkSeries' : 'testOk', { source, n: r.count }) : tr(r.series ? 'testEmptySeries' : 'testEmpty', { source });
      line(text + (r.remaining != null ? ' ' + tr('testRemaining', { n: r.remaining }) : '') + took, 'good');
    } else {
      line(r.status === 'login' ? tr('testBadLogin') : r.status === 'key' ? tr('testBadKey', { source }) : tr('testFailed', { source }) + took, 'error');
    }
  }
}

/** Seçenekli bir ayarın düğmelerini çizer; seçim gizli <select>'e yazılır ve ayarın kendi işleyicisi çağrılır. */
function segment(id, options, onChange) {
  const select = $(id);
  $(id + 'Seg').replaceChildren(...options.map(([value, label]) => {
    const b = button(label, '', select.value === value ? 'on' : '', () => { select.value = value; onChange(); });
    b.setAttribute('aria-pressed', String(select.value === value));
    return b;
  }));
}

/**
 * Önizleme: seçili kaynaklar, diller ve liste ayarlarıyla oynatıcıdaki listenin nasıl görüneceğinin örneği.
 * Sürüm adları örnektir; sıra ve etiketler eklentinin gerçek listesindeki kuralları izler.
 */
function preview(pri) {
  const sample = gestdown ? SAMPLE.series : SAMPLE.movie;
  const quotaTag = tr('tagQuota') + (allowance != null ? ' · ' + tr('quotaLeft', { n: allowance }) : '');
  const freeRows = (l) => {
    const rows = [];
    const add = (src, key, rel, more = {}) => rows.push({ src, tag: tr(key) + (more.hi ? ' · HI' : ''), rel, hi: !!more.hi, own: !more.official });
    if (sources.os) {
      add('os', 'tagOfficial', sample.official, { official: true });
      add('os', 'tagPool', sample.pool);
    }
    if (sources.subdl) {
      add('sd', 'tagSubdl', sample.subdl);
      add('sd', 'tagSubdl', sample.subdlHi, { hi: true });
    }
    if (sources.subsource) add('ss', 'tagSubsource', sample.subsource);
    if (sources.altyazidb && (l.code === 'tr' || l.code === 'en')) add('adb', 'tagAltyazidb', sample.altyazidb);
    if (gestdown) add('gd', 'tagGestdown', sample.gestdown);
    let out = hi === 'hide' ? rows.filter((r) => !r.hi) : rows;
    if (pri) out = [...out.filter((r) => r.src === pri), ...out.filter((r) => r.src !== pri)];
    if (hi === 'last') out = [...out.filter((r) => !r.hi), ...out.filter((r) => r.hi)];
    return out;
  };
  const groups = [];
  const shown = (fallback ? selected.slice(0, 1) : selected).map((code) => byCode.get(code));
  for (const l of shown) {
    const cost = sources.os ? [{ tag: quotaTag, rel: sample.quota, cost: true }, ...(hideMachine ? [] : [{ tag: quotaTag, rel: sample.machine, cost: true }])] : [];
    let rows = [...freeRows(l), ...cost].map((r) => ({ tag: r.tag, rel: r.rel, cost: !!r.cost }));
    if (max) rows = rows.slice(0, max);
    if (match && rows.length) rows[0].best = true;
    if (rows.length) groups.push({ name: langName(l), rows });
  }
  // Çift dilli altyazılar ilk dilin başına eklenir; "Resmi" ve hak harcayan altyazılar bunlara katılmaz.
  const pair = selected.slice(0, 2).map((code) => byCode.get(code));
  if (dual && pair.length === 2 && groups.length && groups[0].name === langName(pair[0]) && freeRows(pair[1]).some((r) => r.own)) {
    const tag = tr('tagDual') + ' · ' + langName(pair[0]) + ' + ' + langName(pair[1]);
    groups[0].rows.unshift(...freeRows(pair[0]).filter((r) => r.own).slice(0, 2).map((r) => ({ tag, rel: r.rel, cost: false })));
  }
  const all = groups.flatMap((g) => g.rows);
  return { title: sample.title, groups, total: all.length, free: all.filter((r) => !r.cost).length };
}

function renderPreview(pri) {
  const data = preview(pri);
  $('pvTitle').textContent = data.title + ' · ' + (data.total ? tr('count', { n: data.total, f: data.free }) : tr('listEmpty'));
  // Aynı liste yeniden çizilmez; yoksa her tuşta listenin kaydırma konumu başa dönerdi.
  const key = ui + JSON.stringify(data) + (data.total ? '' : selected.length + '|' + anisubOn());
  if (key === previewShown) return;
  previewShown = key;
  const list = $('pvList');
  list.replaceChildren();
  if (!data.total) {
    const p = make('p');
    if (!selected.length) p.textContent = tr('pvNoLang');
    // AniSub yalnızca anime altyazısı verdiği için örnek filmde satırı yoktur; yerine ne getirdiği yazılır.
    else if (anisubOn()) p.append(make('b', 'free', tr('tagAnisub')), make('span', '', tr('howAnisub')));
    else p.textContent = tr('pvNoSrc');
    list.append(p);
  }
  for (const group of data.groups) {
    list.append(make('div', 'pv-g', group.name));
    for (const r of group.rows) {
      const row = make('div', 'pv-r');
      const tag = make('span', 'tag ' + (r.cost ? 'cost' : 'free'));
      tag.append(make('span', '', r.tag));
      if (r.best) tag.append(make('span', 'best', tr('best')));
      const rel = make('span', 'rel', r.rel);
      rel.dir = 'ltr';
      row.append(tag, rel);
      list.append(row);
    }
  }
}

/** Örnek karedeki altyazı: ilk seçili dilde kısa replikler; "çift dilli" açıksa altında ikinci dil. */
function renderCaps() {
  const lines = (l) => DIALOG[l.code] || DIALOG[l.code.slice(0, 2)] || DIALOG.en;
  const first = byCode.get(selected[0]);
  const second = dual ? byCode.get(selected[1]) : null;
  const key = [ui, first?.code, second?.code, clean, capIdx].join('|');
  if (key === capShown) return;
  capShown = key;
  const box = $('playerCaps');
  if (!first) return box.replaceChildren(make('span', 'cap', '…'));
  if (capIdx === 4) return box.replaceChildren();
  const col = make('div', 'capcol');
  // İkinci replikte ses açıklaması ve konuşmacı adı vardır; "temizle" ayarı bunları kaldırır.
  const noisy = capIdx === 1 && !clean;
  if (noisy) col.append(make('span', 'cap sfx', (STRINGS[first.code.slice(0, 2)] || STRINGS[ui]).sfx));
  col.append(make('span', 'cap', (noisy ? 'JOHN: ' : '') + lines(first)[capIdx]));
  if (second) col.append(make('span', 'cap second', lines(second)[capIdx]));
  for (const line of col.children) line.dir = 'auto';
  box.replaceChildren(col);
}

function render() {
  $('osForm').hidden = !!sources.os;
  $('osDone').hidden = !sources.os;
  if (sources.os) {
    $('osStatus').textContent = tr('connected', { user: sources.os });
    $('allowance').textContent = allowance != null ? tr('allowance', { n: allowance }) : '';
  }
  for (const name of ['subdl', 'subsource', 'altyazidb']) {
    $(name + 'Form').hidden = !!sources[name];
    $(name + 'Done').hidden = !sources[name];
    if (sources[name]) $(name + 'Status').textContent = tr('keyConnected', { key: sources[name] });
  }
  $('altyazidbPanel').hidden = !adbShown();
  $('gestdownPanel').className = 'fsrc' + (gestdown ? ' on' : '');
  $('anisubPanel').className = 'fsrc' + (anisub ? ' on' : '');

  const list = $('selected');
  list.replaceChildren();
  if (!selected.length) list.append(make('li', 'empty', tr('empty')));
  selected.forEach((code, i) => {
    const lang = byCode.get(code);
    const li = document.createElement('li');
    const name = make('span', 'name');
    name.append(make('b', '', langName(lang)));
    // Yanında dilin kendi dilindeki adı; sayfa zaten o dildeyse İngilizce adı.
    const other = [nativeName(lang), lang.english].find((n) => n && n !== langName(lang));
    if (other) name.append(make('small', '', other));
    li.append(
      make('span', 'rank', String(i + 1).padStart(2, '0')), name,
      button('↑', tr('moveUp'), 'icon', () => move(i, -1), i === 0),
      button('↓', tr('moveDown'), 'icon', () => move(i, 1), i === selected.length - 1),
      button('✕', tr('remove'), 'icon remove', () => { selected.splice(i, 1); render(); }),
    );
    list.append(li);
  });

  const q = norm($('search').value.trim());
  const available = $('available');
  available.replaceChildren();
  const full = selected.length >= MAX;
  // Arama boşken en çok kullanılan dillerden ilk 10'u önerilir; diğer diller aranarak bulunur.
  const matches = q
    ? LANGS
      .filter((l) => !selected.includes(l.code) &&
        (norm(langName(l)).includes(q) || norm(l.english).includes(q) || norm(nativeName(l)).includes(q) || l.code.includes(q)))
      .sort((a, b) => langName(a).localeCompare(langName(b), ui))
    : POPULAR.map((code) => byCode.get(code)).filter((l) => l && !selected.includes(l.code)).slice(0, 10);
  for (const l of matches) {
    available.append(button('+ ' + langName(l), full ? tr('maxReached', { n: MAX }) : l.english,
      'chip', () => { selected.push(l.code); $('search').value = ''; render(); }, full));
  }
  if (!matches.length) available.append(make('div', 'empty', tr('noMatch')));

  const ready = hasSource() && selected.length > 0;
  // AniSub gizliyken onu öne alma ayarı da adrese yazılmaz.
  const pri = prefer === 'as' && !anisubShown() ? '' : prefer;
  // Varsayılan liste ayarları adrese yazılmaz; eski adresler de aynen çalışır.
  const options = (max ? '&max=' + max : '') + (match ? '' : '&match=0') + (fallback ? '&fb=1' : '') +
    (hideMachine ? '&mt=0' : '') + (hi !== 'show' ? '&hi=' + hi : '') + (clean ? '&clean=1' : '') + (ass ? '&ass=1' : '') +
    (gestdown ? '&gd=1' : '') + (anisubOn() ? '&as=1' : '') + (dual ? '&dual=1' : '') + (pri ? '&pri=' + pri : '');
  const manifestUrl = BASE_URL + '/languages=' + selected.join(',') + '&ui=' + ui + options + (auth ? '&auth=' + auth : '') + '/manifest.json';
  const install = $('install');
  install.href = ready ? manifestUrl.replace(/^https?:\\/\\//, 'stremio://') : '#';
  install.setAttribute('aria-disabled', String(!ready));
  const installNuvio = $('installNuvio');
  installNuvio.href = ready ? manifestUrl.replace(/^https?:\\/\\//, 'nuvio://') : '#';
  installNuvio.setAttribute('aria-disabled', String(!ready));
  $('copy').disabled = !ready;
  $('needSetup').hidden = ready;
  $('url').textContent = ready ? manifestUrl : '—';
  $('forget').hidden = !auth;
  $('test').disabled = !hasSource() || tested === 'running';
  renderTest();

  // Seçenekli ayarlar. Öne alınacak kaynakta yalnızca bağlı kaynaklar (ve o an seçili olan) gösterilir.
  const limits = [...new Set([...LIMITS, max || LIMITS[0]])].sort((a, b) => a - b);
  segment('limit', [['', tr('limitNone')], ...limits.map((n) => [String(n), String(n)])], onLimit);
  segment('hi', Object.entries(HI_MODES).map(([mode, key]) => [mode, tr(key)]), onHi);
  const usable = { os: sources.os, sd: sources.subdl, ss: sources.subsource, adb: sources.altyazidb, gd: gestdown, as: anisubOn() };
  segment('pri', [['', tr('priNone')], ...Object.keys(PREFER_NAMES).filter((code) => usable[code] || code === pri).map((code) => [code, PREFER_NAMES[code]])], onPri);

  // Yükleme adımındaki özet ve yandaki kaynak sayacı.
  const all = sourceList();
  const count = all.filter(([, on]) => on).length;
  const changed = [!match, fallback, hideMachine, clean, ass, dual, !!max, hi !== 'show', !!pri].filter(Boolean).length;
  const names = selected.map((code) => langName(byCode.get(code))).join(', ');
  $('checks').replaceChildren(...[
    [count > 0, tr('chkSrc', { n: count })],
    [selected.length > 0, selected.length ? tr('chkLang', { n: selected.length, list: names }) : split(tr('empty'))[0]],
    [true, changed ? tr('chkOpt', { n: changed }) : tr('chkDef')],
  ].map(([ok, text]) => {
    const li = make('li', ok ? '' : 'no');
    li.append(make('i', '', ok ? '✓' : '!'), make('span', '', text));
    return li;
  }));
  $('srcCount').textContent = count + ' / ' + all.length;
  $('srcBar').setAttribute('style', 'width:' + Math.round((count / all.length) * 100) + '%');
  $('srcBadges').replaceChildren(...all.map(([name, on]) => make('span', 'sbadge' + (on ? ' on' : ''), name)));
  $('srcHint').textContent = tr(count === 0 ? 'srcHint0' : count < 3 ? 'srcHint1' : 'srcHint2');
  renderPreview(pri);
  renderCaps();

  const base = ready ? manifestUrl.slice(0, -'/manifest.json'.length) : null;
  // Ayarlar değişince eski ayarlarla getirilmiş altyazı listesi gösterilmez.
  if (base !== addonBase) subs = null;
  addonBase = base;
  renderFind();
  renderView();
  storageSet('saved', JSON.stringify({ auth, sources, selected, max, match, fallback, machine: !hideMachine, hi, clean, ass, gestdown, anisub, dual, prefer }));
}

function renderFind() {
  $('findSetup').hidden = !!addonBase;
  $('findCard').hidden = !addonBase;
  $('findForm').hidden = !addonBase;
  $('findButton').disabled = findBusy;
  $('findMsg').textContent = findNote ? (findNote.key ? tr(findNote.key) : findNote.text) : '';
  $('findMsg').className = 'status' + (findNote?.error ? ' error' : '');
  const titles = $('findTitles');
  titles.replaceChildren();
  for (const meta of (addonBase && found) || []) {
    // Afiş yüklenmez (tarayıcı başka bir resim sunucusuna bağlanmasın diye); kartta yapımın adı yazar.
    const type = tr(meta.type === 'series' ? 'findSeries' : 'findMovie');
    const card = button('', meta.name + (meta.year ? ' (' + meta.year + ')' : '') + ' · ' + type, 'poster' + (picked?.id === meta.id ? ' on' : ''), () => pick(meta), findBusy);
    card.setAttribute('aria-pressed', String(picked?.id === meta.id));
    const frame = make('span', 'pf');
    const big = make('span', 'pn', meta.name);
    big.setAttribute('aria-hidden', 'true');
    frame.append(big, make('span', 'pt', type));
    const info = make('span', 'pi');
    info.append(make('b', '', meta.name), make('small', '', String(meta.year || '')));
    card.append(frame, info);
    titles.append(card);
  }
  const series = !!addonBase && picked?.type === 'series' && !!picked.seasons;
  $('findEpisode').hidden = !series;
  if (series) {
    const season = Number($('findSeason').value) || picked.season;
    $('findSeason').replaceChildren(...Object.keys(picked.seasons).map((s) => new Option(String(s), String(s))));
    $('findSeason').value = String(season);
    const count = picked.seasons[season] || 1;
    const episode = Math.min(Number($('findEp').value) || 1, count);
    $('findEp').replaceChildren(...Array.from({ length: count }, (_, i) => new Option(String(i + 1), String(i + 1))));
    $('findEp').value = String(episode);
    $('findList').disabled = findBusy;
  }
  const list = $('findSubs');
  list.replaceChildren();
  list.hidden = !addonBase || !subs;
  $('findShiftBox').hidden = list.hidden || !subs.length;
  $('findSubsCard').hidden = list.hidden || !subs.length;
  $('findSubsTitle').textContent = list.hidden ? '' : subsName + ' · ' + tr('subsN', { n: subs.length });
  for (const item of (addonBase && subs) || []) {
    const li = document.createElement('li');
    const lang = LANGS.find((l) => l.stremio === item.lang && selected.includes(l.code)) || LANGS.find((l) => l.stremio === item.lang);
    // Eklentinin etiketi "kaynak | sürüm adı" biçimindedir; iki satıra bölünür.
    const cut = item.label.indexOf(' | ');
    const tag = cut < 0 ? item.label : item.label.slice(0, cut);
    const top = make('div', 'top');
    top.append(make('span', 'lang', lang ? langName(lang) + ' · ' : ''), make('b', tag.startsWith(tr('tagQuota')) ? 'cost' : 'free', tag));
    const rel = make('div', 'rel', cut < 0 ? '' : item.label.slice(cut + 3));
    rel.dir = 'auto';
    const name = make('div', 'name');
    name.append(top, rel);
    const save = button(item.saved ? tr('findSaved') : tr('findDownload'), item.label, 'btn out' + (item.saved ? ' saved' : ''), () => download(item), item.busy);
    li.append(name, save);
    list.append(li);
  }
}

const normTitle = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, ' ').trim();

/** Film ve dizileri Stremio'nun katalog servisinde (Cinemeta) arar. IMDb numarası (tt…) da yazılabilir. */
async function findTitles(query) {
  const get = (path) => fetch(CINEMETA + path).then((res) => (res.ok ? res.json() : null)).catch(() => null);
  const toTitle = (meta, type) => meta && typeof meta.name === 'string' && /^tt\\d+$/.test(meta.id || '')
    ? { id: meta.id, type, name: meta.name, year: meta.releaseInfo || meta.year || '' } : null;
  const imdb = query.match(/tt\\d{5,}/);
  if (imdb) {
    const metas = await Promise.all(['series', 'movie'].map((type) => get('/meta/' + type + '/' + imdb[0] + '.json').then((data) => toTitle(data?.meta, type))));
    return metas.filter(Boolean).slice(0, 1);
  }
  const lists = await Promise.all(['movie', 'series'].map((type) => get('/catalog/' + type + '/top/search=' + encodeURIComponent(query) + '.json')
    .then((data) => (data ? (Array.isArray(data.metas) ? data.metas : []).map((meta) => toTitle(meta, type)).filter(Boolean).slice(0, 8) : null))));
  // İki arama da yanıt vermediyse hata gösterilir; yalnızca biri yanıt verdiyse onun sonuçları kullanılır.
  if (lists.every((list) => !list)) return null;
  // Filmler ve diziler sırayla karıştırılır; adı aranan metinle aynı ya da onunla başlayanlar öne alınır.
  const mixed = [];
  for (let i = 0; i < 8; i++) for (const list of lists) if (list?.[i]) mixed.push(list[i]);
  const q = normTitle(query);
  const rank = (meta) => (normTitle(meta.name) === q ? 0 : normTitle(meta.name).startsWith(q) ? 1 : 2);
  return mixed.map((meta, i) => [meta, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([meta]) => meta);
}

async function pick(meta) {
  picked = { ...meta };
  subs = null;
  findNote = null;
  if (meta.type === 'movie') return listSubs();
  findBusy = true;
  findNote = { key: 'findRunning' };
  render();
  // Dizinin sezonları ve her sezonun bölüm sayısı Cinemeta'dan alınır (özel bölümler, yani 0. sezon, hariç).
  try {
    const res = await fetch(CINEMETA + '/meta/series/' + meta.id + '.json');
    const videos = res.ok ? (await res.json())?.meta?.videos || [] : [];
    const seasons = {};
    for (const v of videos) if (Number.isInteger(v?.season) && v.season > 0 && Number.isInteger(v.episode) && v.episode > 0) seasons[v.season] = Math.max(seasons[v.season] || 0, v.episode);
    if (picked?.id === meta.id) {
      picked.seasons = Object.keys(seasons).length ? seasons : { 1: 1 };
      picked.season = Number(Object.keys(picked.seasons)[0]);
      $('findSeason').value = '';
      $('findEp').value = '';
      findNote = null;
    }
  } catch {
    findNote = { key: 'serverError', error: true };
  }
  findBusy = false;
  render();
}

const episodeTag = (meta) => {
  const pad = (n) => String(n).padStart(2, '0');
  return meta.type === 'series' ? ' S' + pad($('findSeason').value) + 'E' + pad($('findEp').value) : '';
};

/** Seçilen film ya da bölüm için eklentinin altyazı listesini, kurulum adresindeki ayarlarla getirir. */
async function listSubs() {
  if (!addonBase || !picked) return;
  const base = addonBase;
  const meta = picked;
  const id = meta.type === 'series' ? meta.id + ':' + $('findSeason').value + ':' + $('findEp').value : meta.id;
  findBusy = true;
  subs = null;
  findNote = { key: 'findRunning' };
  render();
  try {
    const res = await fetch(base + '/subtitles/' + meta.type + '/' + id + '.json');
    const data = await res.json();
    // Yalnızca eklentinin kendi sunduğu dosyalar listelenir; "Resmi" altyazılar Stremio'nun sunucusundadır.
    const own = (data.subtitles || []).filter((s) => typeof s.url === 'string' && s.url.startsWith(BASE_URL + '/') && !s.url.includes('/message/'));
    if (addonBase === base && picked === meta) {
      subs = own.map((s) => ({ ...s, file: fileName(meta, s) }));
      subsName = meta.name + episodeTag(meta);
      findNote = subs.length ? null : { key: 'findSubsNone' };
    }
  } catch {
    findNote = { key: 'serverError', error: true };
  }
  findBusy = false;
  render();
}

function fileName(meta, item) {
  const title = meta.name.replace(/[\\\\/:*?"<>|]+/g, ' ').replace(/\\s+/g, ' ').trim() || meta.id;
  return title + episodeTag(meta) + (item.url.includes('/dual/') ? '.dual' : '') + '.' + item.lang + '.srt';
}

/**
 * SRT'nin zaman satırlarındaki bütün zamanları verilen milisaniye kadar kaydırır. Sıfırın altına düşen zaman 0 olur;
 * tamamen başa sıkışan (bitişi de 0 olan) satırlar dosyadan çıkarılır.
 */
function shiftSrt(text, ms) {
  const pad = (n, size) => String(n).padStart(size, '0');
  const time = (h, m, s, f) => Math.max(0, ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(f.padEnd(3, '0')) + ms);
  const format = (t) => pad(Math.floor(t / 3600000), 2) + ':' + pad(Math.floor(t / 60000) % 60, 2) + ':' + pad(Math.floor(t / 1000) % 60, 2) + ',' + pad(t % 1000, 3);
  const stamp = /([0-9]{1,2}):([0-9]{2}):([0-9]{2})[,.]([0-9]{1,3})/g;
  const blocks = text.replace(/\\r\\n?/g, '\\n').split(/\\n{2,}/);
  const kept = [];
  for (const block of blocks) {
    let gone = false;
    const moved = block.replace(/^.*-->.*$/m, (line) => {
      const shifted = line.replace(stamp, (_, h, m, s, f) => format(time(h, m, s, f)));
      const ends = [...shifted.matchAll(stamp)];
      if (ends.length === 2 && ends[1][0] === '00:00:00,000') gone = true;
      return shifted;
    });
    if (!gone) kept.push(moved);
  }
  return kept.join('\\n\\n');
}

/** Altyazıyı indirir. Sunucu altyazı yerine bir uyarı döndürdüyse (ör. indirme hakkı bittiyse) dosya kaydedilmez, uyarı gösterilir. */
async function download(item) {
  item.busy = true;
  findNote = null;
  render();
  try {
    // Kaydırma SRT üzerinde yapılır ve dosya .srt olarak kaydedilir; bu yüzden dosya her zaman SRT olarak istenir.
    const res = await fetch(item.url.replace('&ass=1', ''));
    const text = await res.text();
    const warning = text.match(/^1\\r?\\n00:00:00,000 --> 00:00:15,000\\r?\\n([\\s\\S]*?)\\s*$/);
    if (!res.ok || (warning && !/\\n\\s*\\n/.test(warning[1]))) {
      findNote = { text: warning ? warning[1].split(/\\r?\\n/).join(' ') : tr('serverError'), error: true };
    } else {
      const seconds = Math.max(-600, Math.min(600, Number($('findShift').value) || 0));
      const body = seconds ? shiftSrt(text, Math.round(seconds * 1000)) : text;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([body], { type: 'application/x-subrip' }));
      link.download = item.file;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
      item.saved = true;
    }
  } catch {
    findNote = { key: 'serverError', error: true };
  }
  item.busy = false;
  render();
}

/** Kaynak ekler ya da kaldırır; sunucu yeni şifreli "auth" parçasını döndürür. */
async function connect(name, payload, form) {
  setMsg(name, 'verifying');
  const buttons = form ? form.querySelectorAll('button') : [];
  for (const b of buttons) b.disabled = true;
  try {
    const res = await fetch(BASE_URL + '/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.sources) {
      auth = data.auth;
      sources = data.sources;
      if (name === 'os') allowance = payload.remove ? null : data.allowedDownloads;
      if (form) form.reset();
      tested = null;
      setMsg(name, '');
    } else {
      const bad = name === 'os' ? 'badLogin' : 'badKey';
      setMsg(name, res.status === 401 ? bad : res.status === 429 ? 'tooMany' : data.error === 'os_refused' ? 'osRefused' : 'serverError');
    }
  } catch {
    setMsg(name, 'serverError');
  }
  for (const b of buttons) b.disabled = false;
  render();
}

$('osForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const username = $('username').value.trim();
  // OpenSubtitles e-posta ile girişi kabul etmez; boşuna deneme yapılmaz.
  if (username.includes('@')) return setMsg('os', 'badLogin');
  connect('os', { os: { username, password: $('password').value } }, event.target);
});
for (const name of ['subdl', 'subsource', 'altyazidb']) {
  $(name + 'Form').addEventListener('submit', (event) => {
    event.preventDefault();
    connect(name, { [name]: $(name + 'Key').value.trim() }, event.target);
  });
}
for (const b of document.querySelectorAll('[data-remove]')) {
  b.addEventListener('click', () => connect(b.dataset.remove, { remove: b.dataset.remove }));
}

$('forget').addEventListener('click', () => {
  auth = null;
  sources = { ...NO_SOURCES };
  allowance = null;
  tested = null;
  render();
});

// Bağlı kaynaklarda örnek bir film aranır; yalnızca arama yapılır, indirme hakkı harcanmaz.
$('test').addEventListener('click', async () => {
  const asked = auth + '|' + gestdown + '|' + anisubOn();
  tested = 'running';
  render();
  let outcome = 'serverError';
  try {
    const res = await fetch(BASE_URL + '/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth, languages: selected, gestdown, anisub: anisubOn() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.results)) outcome = data.results;
    else if (res.status === 429) outcome = 'tooMany';
  } catch {}
  // Deneme sürerken kaynaklar değiştiyse eski sonuç gösterilmez.
  tested = auth + '|' + gestdown + '|' + anisubOn() === asked ? outcome : null;
  render();
});

const uiSelect = $('ui');
for (const [code, label] of Object.entries(UI_LANGUAGES)) uiSelect.append(new Option(label, code, false, code === ui));
uiSelect.addEventListener('change', () => {
  ui = uiSelect.value;
  storageSet('ui', ui);
  // Dil değişince AniSub görünür ya da gizlenir; açıksa deneme sonucu eski kaynaklara göre kalmasın.
  if (anisub) tested = null;
  renderStatic();
  render();
});

// Sekmeler, adımlar ve açılır bölümler.
function setTab(next) {
  tab = next;
  try { history.replaceState(null, '', next === 'find' ? '#find' : location.pathname + location.search); } catch {}
  renderView();
}
function setStep(next) {
  step = Math.max(0, Math.min(STEPS.length - 1, next));
  renderView();
}
$('tabSetup').addEventListener('click', () => setTab('setup'));
$('tabFind').addEventListener('click', () => setTab('find'));
addEventListener('hashchange', () => {
  tab = location.hash === '#find' ? 'find' : 'setup';
  renderView();
});
// Arama sekmesindeki "kuruluma git": eksik olan ilk adım açılır.
$('goSetup').addEventListener('click', () => {
  step = !hasSource() ? 0 : !selected.length ? 1 : step;
  setTab('setup');
});
STEPS.forEach((key, i) => $('stepBtn' + i).addEventListener('click', () => setStep(i)));
for (const [id, delta] of [['back', -1], ['next', 1]]) {
  $(id).addEventListener('click', () => {
    setStep(step + delta);
    $('stepper').scrollIntoView?.({ block: 'nearest' });
  });
}
for (const name of KEY_SOURCES) {
  $(name + 'Head').addEventListener('click', () => {
    openSrc = openSrc === name ? null : name;
    renderView();
  });
}
$('trustBtn').addEventListener('click', () => { trustOpen = !trustOpen; renderView(); });
$('legendBtn').addEventListener('click', () => { legendOpen = !legendOpen; renderView(); });
for (const b of document.querySelectorAll('[data-det]')) {
  b.addEventListener('click', () => {
    $(b.dataset.det).hidden = !$(b.dataset.det).hidden;
    renderView();
  });
}

$('search').addEventListener('input', render);
$('findForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = $('findQuery').value.trim();
  if (!query || findBusy) return;
  findBusy = true;
  found = null;
  picked = null;
  subs = null;
  findNote = { key: 'findRunning' };
  render();
  const results = await findTitles(query).catch(() => null);
  found = results || [];
  findNote = !results ? { key: 'serverError', error: true } : results.length ? null : { key: 'findNone' };
  findBusy = false;
  render();
});
$('findSeason').addEventListener('change', () => {
  $('findEp').value = '1';
  subs = null;
  render();
});
$('findEp').addEventListener('change', () => {
  subs = null;
  render();
});
$('findList').addEventListener('click', listSubs);
// Kaydırma düğmeleri yarım saniyelik adımlarla ilerler.
for (const [id, delta] of [['shiftDown', -0.5], ['shiftUp', 0.5]]) {
  $(id).addEventListener('click', () => {
    const now = Number($('findShift').value) || 0;
    $('findShift').value = String(Math.max(-600, Math.min(600, Math.round((now + delta) * 10) / 10)));
  });
}
function onLimit() {
  max = Number($('limit').value) || null;
  render();
}
function onHi() {
  hi = HI_MODES[$('hi').value] ? $('hi').value : 'show';
  render();
}
function onPri() {
  prefer = PREFER_NAMES[$('pri').value] ? $('pri').value : '';
  render();
}
$('limit').addEventListener('change', onLimit);
$('match').addEventListener('change', () => {
  match = $('match').checked;
  render();
});
$('fallback').addEventListener('change', () => {
  fallback = $('fallback').checked;
  render();
});
$('machine').addEventListener('change', () => {
  hideMachine = $('machine').checked;
  render();
});
$('hi').addEventListener('change', onHi);
$('clean').addEventListener('change', () => {
  clean = $('clean').checked;
  render();
});
$('ass').addEventListener('change', () => {
  ass = $('ass').checked;
  render();
});
$('gestdown').addEventListener('change', () => {
  gestdown = $('gestdown').checked;
  tested = null;
  render();
});
$('anisub').addEventListener('change', () => {
  anisub = $('anisub').checked;
  tested = null;
  render();
});
$('dual').addEventListener('change', () => {
  dual = $('dual').checked;
  render();
});
$('pri').addEventListener('change', onPri);
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('url').textContent);
    $('copy').textContent = tr('copied');
  } catch {
    $('copy').textContent = tr('copyFailed');
  }
  setTimeout(() => { $('copy').textContent = tr('copy'); }, 2000);
});
// Nuvio'nun Windows ve Linux sürümleri nuvio:// bağlantısını açmaz; adres panoya da kopyalanır.
$('installNuvio').addEventListener('click', () => {
  navigator.clipboard?.writeText($('url').textContent).catch(() => {});
  $('nuvioNote').hidden = false;
});

renderStatic();
render();

// Perdedeki zaman, başlığın diğer dilleri ve örnek altyazılar kendiliğinden akar.
if (!calm) {
  const started = performance.now();
  setInterval(() => {
    if (document.hidden || tab !== 'setup') return;
    const passed = performance.now() - started;
    $('heroTime').textContent = timecode(1000 + passed);
    $('playerTime').textContent = timecode(4328416 + passed);
  }, 53);
  setInterval(() => { heroIdx++; renderHero(); }, 2800);
  setInterval(() => { capIdx = (capIdx + 1) % 5; renderCaps(); }, 2600);
}

// Hatırlanan ayar sunucuya sorulur; artık geçerli değilse (ör. bozulmuşsa) temizlenir.
if (restored) {
  const remembered = auth;
  fetch(BASE_URL + '/api/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth }),
  }).then((res) => (res.ok ? res.json() : null)).then((data) => {
    if (!data?.sources || auth !== remembered) return;
    sources = { ...NO_SOURCES, ...data.sources };
    if (!Object.values(sources).some(Boolean)) auth = null;
    render();
  }).catch(() => {});
}
</script>
</body>
</html>`;
}
