import { LANGUAGES } from './languages.js';
import { DEFAULT_UI, STRINGS, UI_LANGUAGES } from './i18n.js';

const toJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

// Ayar sayfasında kullanılmayan (sadece eklentinin içinde gösterilen) metinler sayfaya gönderilmez.
const SERVER_ONLY = new Set([
  'manifestDesc', 'needAccountLabel', 'needAccount', 'loginFailed', 'quota', 'quotaReset', 'quotaHint', 'burst',
  'archiveUnsupported', 'notInPack', 'keyRejected', 'failed', 'dualMissing', 'quotaLeft', 'fansubBy',
]);
const PAGE_STRINGS = Object.fromEntries(
  Object.entries(STRINGS).map(([ui, strings]) => [
    ui,
    Object.fromEntries(Object.entries(strings).filter(([key]) => !SERVER_ONLY.has(key))),
  ]),
);

function keyPanel(name, title, signup) {
  return `
  <div class="panel source" id="${name}Panel">
    <h3>${title} <small data-i18n="optional"></small></h3>
    <p data-i18n="${name}Intro"></p>
    <form class="stack" id="${name}Form">
      <input type="password" id="${name}Key" autocomplete="off" spellcheck="false" required>
      <div class="row">
        <button class="btn primary" type="submit" data-i18n="save"></button>
        <a href="${signup}" target="_blank" rel="noopener" data-i18n="getKey"></a>
      </div>
    </form>
    <div class="row" id="${name}Done" hidden>
      <p class="connected" id="${name}Status"></p>
      <button class="btn secondary" type="button" data-remove="${name}" data-i18n="disconnect"></button>
    </div>
    <p class="status" id="${name}Msg" role="status"></p>
  </div>`;
}

export function configurePage({ baseUrl, selected, ui, auth, sources, max, match, fallback, machine, hi, clean, gestdown, anisub, dual, prefer, maxLanguages, misconfigured }) {
  const langs = LANGUAGES.map(({ code, stremio, english, tag }) => ({ code, stremio, english, tag }));
  return `<!doctype html>
<html lang="${ui || DEFAULT_UI}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SubPool by Diavelin</title>
<link rel="icon" type="image/png" href="/logo.png">
<style>
  :root { --bg:#16122a; --panel:#221c3d; --line:#3a3160; --text:#ece9f6; --muted:#a59fc0; --accent:#8a5cf6; --danger:#f87171; --ok:#4ade80; --warn:#fbbf24; }
  * { box-sizing: border-box; }
  [hidden] { display:none !important; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:640px; margin:0 auto; padding:24px 16px 64px; }
  header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
  h1 { margin:0; font-size:24px; }
  h1 small { color:var(--muted); font-weight:400; font-size:15px; }
  h2 { font-size:15px; margin:28px 0 10px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
  h3 { margin:0 0 4px; font-size:17px; }
  h3 small { color:var(--muted); font-weight:400; font-size:13px; }
  p { margin:0 0 8px; color:var(--muted); }
  a { color:var(--accent); }
  select, input[type=text], input[type=password], input[type=search], input[type=number] { padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:var(--panel); color:var(--text); font-size:15px; outline:none; }
  select:focus, input:focus { border-color:var(--accent); }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:12px; }
  .panel + .panel { margin-top:12px; }
  .note { padding:14px 16px; border-color:#5b4a9e; }
  .note b { display:block; margin-bottom:4px; color:var(--text); }
  .note p { margin:0; }
  .legend { padding:12px 16px; margin:0; display:grid; gap:10px; }
  .legend div { display:grid; gap:2px; }
  .legend dt { font-weight:600; }
  .legend dd { margin:0; color:var(--muted); }
  .trust { padding:14px 16px; margin-bottom:12px; border-color:#2f6b4a; background:#1b2a2a; }
  .trust b { display:block; margin-bottom:6px; color:var(--ok); }
  .trust ul { margin:0; padding-inline-start:20px; color:var(--muted); display:grid; gap:4px; }
  .trust .btn { margin-top:12px; }
  .free { color:var(--ok); }
  .cost { color:var(--warn); }
  .source { padding:16px; display:flex; flex-direction:column; gap:10px; }
  .stack { display:flex; flex-direction:column; gap:10px; }
  .source input { width:100%; background:#0003; }
  .row { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; }
  .status { min-height:1.5em; margin:0; }
  .status.error { color:var(--danger); }
  .status.good { color:var(--ok); }
  .foot { margin-top:28px; text-align:center; }
  .connected { color:var(--ok); font-weight:600; margin:0; }
  ol { list-style:none; margin:0; padding:4px; }
  ol li { display:flex; align-items:center; gap:8px; padding:8px 8px 8px 12px; border-radius:8px; }
  ol li + li { border-top:1px solid var(--line); }
  .rank { color:var(--muted); width:1.5em; font-variant-numeric:tabular-nums; }
  .name { flex:1; }
  .name small { color:var(--muted); margin-inline-start:6px; }
  .icon { background:none; border:1px solid var(--line); color:var(--text); width:34px; height:34px; border-radius:8px; cursor:pointer; font-size:15px; }
  .icon:hover:not(:disabled) { border-color:var(--accent); }
  .icon:disabled { opacity:.3; cursor:default; }
  .icon.remove:hover { border-color:var(--danger); color:var(--danger); }
  .empty { padding:16px; color:var(--muted); text-align:center; }
  input[type=search] { width:100%; }
  .available { margin-top:10px; max-height:320px; overflow-y:auto; padding:6px; display:flex; flex-wrap:wrap; gap:6px; }
  .chip { background:#2c2550; border:1px solid var(--line); color:var(--text); padding:7px 12px; border-radius:999px; cursor:pointer; font-size:14px; }
  .chip:hover:not(:disabled) { border-color:var(--accent); }
  .chip:disabled { opacity:.4; cursor:default; }
  .options { padding:16px; display:flex; flex-direction:column; gap:8px; }
  .options p { margin:0 0 8px; }
  .options p:last-child { margin:0; }
  .option { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; font-weight:600; cursor:pointer; }
  .option input { width:18px; height:18px; margin:0; accent-color:var(--accent); }
  .install { padding:16px; display:flex; flex-direction:column; gap:12px; }
  .btn { display:inline-block; padding:12px 18px; border-radius:10px; font-weight:600; text-decoration:none; border:none; cursor:pointer; font-size:15px; }
  .btn.primary { background:var(--accent); color:#fff; }
  .btn.secondary { background:none; border:1px solid var(--line); color:var(--text); padding:8px 14px; }
  .btn[aria-disabled=true], .btn:disabled { opacity:.4; pointer-events:none; }
  code { display:block; padding:10px; background:#0006; border-radius:8px; word-break:break-all; font-size:13px; color:var(--muted); direction:ltr; text-align:left; }
  .warn { color:var(--danger); }
  #findForm input { flex:1; min-width:0; width:auto; }
  #findShift { width:110px; }
  .titles { display:flex; flex-wrap:wrap; gap:6px; }
  .chip.on { border-color:var(--accent); background:#3a2f6e; }
  .subs li { flex-wrap:wrap; }
  .subs .name { min-width:0; overflow-wrap:anywhere; }
</style>
</head>
<body>
<main>
  <header>
    <h1>SubPool <small>by Diavelin</small></h1>
    <label class="row"><span data-i18n="uiLanguage"></span> <select id="ui"></select></label>
  </header>
  <p data-i18n="tagline"></p>
  ${misconfigured ? '<p class="warn"><b>Server misconfigured:</b> OS_API_KEY / CONFIG_SECRET missing.</p>' : ''}

  <div class="panel note">
    <b data-i18n="sideTitle"></b>
    <p data-i18n="sideAddon"></p>
  </div>

  <h2 data-i18n="howTitle"></h2>
  <dl class="panel legend">
    <div><dt class="free" data-i18n="tagOfficial"></dt><dd data-i18n="howOfficial"></dd></div>
    <div><dt class="free" data-i18n="tagPool"></dt><dd data-i18n="howPool"></dd></div>
    <div><dt class="cost" data-i18n="tagQuota"></dt><dd data-i18n="howQuota"></dd></div>
    <div><dt class="free"><span data-i18n="tagSubdl"></span> / <span data-i18n="tagSubsource"></span></dt><dd data-i18n="howOther"></dd></div>
    <div><dt class="free" data-i18n="tagGestdown"></dt><dd data-i18n="howGestdown"></dd></div>
    <div><dt class="free" data-i18n="tagAnisub"></dt><dd data-i18n="howAnisub"></dd></div>
    <div><dt class="free" data-i18n="tagDual"></dt><dd data-i18n="howDual"></dd></div>
    <div><dt>HI</dt><dd data-i18n="howHi"></dd></div>
    <div><dd><span data-i18n="vipNote"></span> <a href="https://www.opensubtitles.com/en/vip" target="_blank" rel="noopener" data-i18n="vipLink"></a></dd></div>
  </dl>

  <h2 data-i18n="sourcesTitle"></h2>
  <p data-i18n="sourcesIntro"></p>

  <div class="panel trust">
    <b>🔒 <span data-i18n="trustTitle"></span></b>
    <ul>
      <li data-i18n="trustStore"></li>
      <li data-i18n="trustRemember"></li>
      <li data-i18n="trustUse"></li>
      <li data-i18n="trustShare"></li>
      <li data-i18n="trustRevoke"></li>
      <li data-i18n="trustSeparate"></li>
      <li data-i18n="trustLink"></li>
    </ul>
    <button class="btn secondary" id="forget" type="button" data-i18n="forget" hidden></button>
  </div>

  <div class="panel source" id="osPanel">
    <h3 data-i18n="accountTitle"></h3>
    <p data-i18n="accountIntro"></p>
    <form class="stack" id="osForm">
      <input type="text" id="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      <input type="password" id="password" autocomplete="current-password" required>
      <div class="row">
        <button class="btn primary" type="submit" data-i18n="verify"></button>
        <span><span data-i18n="signupHint"></span> <a href="https://www.opensubtitles.com/" target="_blank" rel="noopener" data-i18n="signupLink"></a></span>
      </div>
    </form>
    <div id="osDone" hidden>
      <div class="row">
        <p class="connected" id="osStatus"></p>
        <button class="btn secondary" type="button" data-remove="os" data-i18n="disconnect"></button>
      </div>
      <p id="allowance"></p>
    </div>
    <p class="status" id="osMsg" role="status"></p>
  </div>
  ${keyPanel('subdl', 'SubDL', 'https://subdl.com/panel/api')}
  ${keyPanel('subsource', 'SubSource', 'https://subsource.net/dashboard/profile')}
  ${keyPanel('altyazidb', 'AltyazıDB', 'https://altyazidb.com/')}
  <div class="panel source" id="gestdownPanel">
    <h3>Gestdown <small data-i18n="optional"></small></h3>
    <p data-i18n="gestdownIntro"></p>
    <label class="option"><input type="checkbox" id="gestdown"> <span data-i18n="gestdownLabel"></span></label>
  </div>
  <div class="panel source" id="anisubPanel">
    <h3>AniSub <small data-i18n="optional"></small></h3>
    <p data-i18n="anisubIntro"></p>
    <label class="option"><input type="checkbox" id="anisub"> <span data-i18n="anisubLabel"></span></label>
  </div>

  <div class="panel source">
    <div class="row"><button class="btn secondary" id="test" type="button" data-i18n="testButton"></button></div>
    <p data-i18n="testHint"></p>
    <div id="testResult" role="status"></div>
  </div>

  <h2 data-i18n="languagesTitle"></h2>
  <p data-i18n="languagesIntro"></p>
  <div class="panel"><ol id="selected"></ol></div>

  <h2 data-i18n="addTitle"></h2>
  <input type="search" id="search" autocomplete="off">
  <div class="panel available" id="available"></div>

  <h2 data-i18n="optionsTitle"></h2>
  <div class="panel options">
    <label class="option"><input type="checkbox" id="match"> <span data-i18n="matchLabel"></span></label>
    <p data-i18n="matchHint"></p>
    <label class="option"><span data-i18n="limitLabel"></span> <select id="limit"></select></label>
    <p data-i18n="limitHint"></p>
    <label class="option"><input type="checkbox" id="fallback"> <span data-i18n="fallbackLabel"></span></label>
    <p data-i18n="fallbackHint"></p>
    <label class="option"><input type="checkbox" id="machine"> <span data-i18n="machineLabel"></span></label>
    <p data-i18n="machineHint"></p>
    <label class="option"><span data-i18n="hiLabel"></span> <select id="hi"></select></label>
    <p data-i18n="hiHint"></p>
    <label class="option"><input type="checkbox" id="clean"> <span data-i18n="cleanLabel"></span></label>
    <p data-i18n="cleanHint"></p>
    <label class="option"><span data-i18n="priLabel"></span> <select id="pri"></select></label>
    <p data-i18n="priHint"></p>
    <label class="option"><input type="checkbox" id="dual"> <span data-i18n="dualLabel"></span></label>
    <p data-i18n="dualHint"></p>
  </div>

  <h2 data-i18n="installTitle"></h2>
  <div class="panel install">
    <p id="needSetup" data-i18n="needSetup"></p>
    <div class="row">
      <a class="btn primary" id="install" data-i18n="install"></a>
      <a class="btn primary" id="installNuvio" data-i18n="installNuvio"></a>
      <button class="btn secondary" id="copy" type="button" data-i18n="copy"></button>
    </div>
    <p id="nuvioNote" data-i18n="nuvioNote" hidden></p>
    <p data-i18n="pasteHint"></p>
    <code id="url"></code>
    <p data-i18n="reinstallHint"></p>
  </div>

  <h2 data-i18n="findTitle"></h2>
  <div class="panel source" id="findPanel">
    <p id="findIntro"></p>
    <p id="findSetup" data-i18n="needSetup"></p>
    <form class="row" id="findForm">
      <input type="search" id="findQuery" autocomplete="off" required>
      <button class="btn primary" type="submit" id="findButton" data-i18n="findButton"></button>
    </form>
    <p class="status" id="findMsg" role="status"></p>
    <div class="titles" id="findTitles"></div>
    <div class="row" id="findEpisode" hidden>
      <label class="row"><span data-i18n="seasonLabel"></span> <select id="findSeason"></select></label>
      <label class="row"><span data-i18n="episodeLabel"></span> <select id="findEp"></select></label>
      <button class="btn secondary" id="findList" type="button" data-i18n="findList"></button>
    </div>
    <div id="findShiftBox" hidden>
      <label class="row"><span data-i18n="shiftLabel"></span> <input type="number" id="findShift" value="0" step="0.1" min="-600" max="600" inputmode="decimal"></label>
      <p data-i18n="shiftHint"></p>
    </div>
    <ol class="subs" id="findSubs" hidden></ol>
  </div>

  <p class="foot"><span data-i18n="codeText"></span> <a href="https://github.com/MrDiavelin/subpool" target="_blank" rel="noopener">github.com/MrDiavelin/subpool</a></p>
  <p class="foot"><span data-i18n="contactText"></span> <a href="https://x.com/Diavelin" target="_blank" rel="noopener">X (@Diavelin)</a> · <a href="https://discord.com/users/163213047597498368" target="_blank" rel="noopener">Discord (diavelin)</a></p>
</main>
<script>
const STRINGS = ${toJson(PAGE_STRINGS)};
const UI_LANGUAGES = ${toJson(UI_LANGUAGES)};
const LANGS = ${toJson(langs)};
const BASE_URL = ${toJson(baseUrl)};
const MAX = ${maxLanguages};
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
// Gestdown anahtar istemeyen bir kaynaktır; şifreli parçada değil, adreste bir ayar olarak durur.
let gestdown = ${toJson(!!gestdown)};
// AniSub da anahtar istemez; adreste "as=1" olarak durur.
let anisub = ${toJson(!!anisub)};
let dual = ${toJson(!!dual)};
// Listede öne alınacak kaynak ("pri"); boşsa hiçbiri.
let prefer = ${toJson(prefer || '')};
const PREFER_NAMES = { os: 'OpenSubtitles', sd: 'SubDL', ss: 'SubSource', adb: 'AltyazıDB', gd: 'Gestdown', as: 'AniSub' };
const LIMITS = [5, 10, 15, 20];
const HI_MODES = { show: 'hiShow', last: 'hiLast', hide: 'hiHide' };
const SOURCE_NAMES = { os: 'OpenSubtitles', subdl: 'SubDL', subsource: 'SubSource', altyazidb: 'AltyazıDB', gestdown: 'Gestdown', anisub: 'AniSub' };
let allowance = null;
// Kaynak denemesinin durumu: null, 'running', bir hata metninin anahtarı ya da sonuç listesi.
let tested = null;
// Altyazı arama: harici oynatıcı kullananlar altyazıyı buradan indirir. Kurulum adresindeki ayarların aynısı kullanılır.
const CINEMETA = 'https://v3-cinemeta.strem.io';
let addonBase = null;
let found = null;
let picked = null;
let subs = null;
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

const tr = (key, vars = {}) => (STRINGS[ui][key] ?? STRINGS.en[key]).replace(/\\{(\\w+)\\}/g, (_, k) => vars[k] ?? '');

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
const norm = (s) => s.toLocaleLowerCase(ui).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/ı/g, 'i');

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

function renderStatic() {
  document.documentElement.lang = ui;
  document.documentElement.dir = ui === 'ar' ? 'rtl' : 'ltr';
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tr(el.dataset.i18n);
  $('username').placeholder = tr('username');
  $('password').placeholder = tr('password');
  $('subdlKey').placeholder = tr('apiKey');
  $('subsourceKey').placeholder = tr('apiKey');
  $('altyazidbKey').placeholder = tr('apiKey');
  $('search').placeholder = tr('searchPlaceholder');
  $('findQuery').placeholder = tr('findPlaceholder');
  $('findIntro').textContent = tr('findIntro', { quota: tr('tagQuota'), official: tr('tagOfficial') }) + ' ' + tr('findAnisub', { anisub: tr('tagAnisub') });
  const limits = [...new Set([...LIMITS, max || LIMITS[0]])].sort((a, b) => a - b);
  $('limit').replaceChildren(new Option(tr('limitNone'), ''), ...limits.map((n) => new Option(String(n), String(n))));
  $('limit').value = max ? String(max) : '';
  $('match').checked = match;
  $('fallback').checked = fallback;
  $('machine').checked = hideMachine;
  $('hi').replaceChildren(...Object.entries(HI_MODES).map(([mode, key]) => new Option(tr(key), mode)));
  $('hi').value = hi;
  $('clean').checked = clean;
  $('pri').replaceChildren(new Option(tr('priNone'), ''), ...Object.entries(PREFER_NAMES).map(([code, name]) => new Option(name, code)));
  $('pri').value = prefer;
  $('gestdown').checked = gestdown;
  $('anisub').checked = anisub;
  $('dual').checked = dual;
  for (const name of ['os', 'subdl', 'subsource', 'altyazidb']) setMsg(name, messages[name]);
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
    if (r.status === 'ok' && r.reachable) {
      line(tr('testReachable', { source }), 'good');
    } else if (r.status === 'ok') {
      // Gestdown yalnızca dizi barındırdığı için orada film yerine örnek bir dizi bölümü aranır.
      const text = r.count > 0 ? tr(r.series ? 'testOkSeries' : 'testOk', { source, n: r.count }) : tr(r.series ? 'testEmptySeries' : 'testEmpty', { source });
      line(text + (r.remaining != null ? ' ' + tr('testRemaining', { n: r.remaining }) : ''), 'good');
    } else {
      line(r.status === 'login' ? tr('testBadLogin') : tr(r.status === 'key' ? 'testBadKey' : 'testFailed', { source }), 'error');
    }
  }
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

  const list = $('selected');
  list.replaceChildren();
  if (!selected.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = tr('empty');
    list.append(li);
  }
  selected.forEach((code, i) => {
    const lang = byCode.get(code);
    const li = document.createElement('li');
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = i + 1 + '.';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = langName(lang);
    if (lang.english !== langName(lang)) {
      const small = document.createElement('small');
      small.textContent = lang.english;
      name.append(small);
    }
    li.append(
      rank, name,
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
  const matches = LANGS
    .filter((l) => !selected.includes(l.code) &&
      (!q || norm(langName(l)).includes(q) || norm(l.english).includes(q) || l.code.includes(q)))
    .sort((a, b) => langName(a).localeCompare(langName(b), ui));
  for (const l of matches) {
    available.append(button(langName(l), full ? tr('maxReached', { n: MAX }) : l.english,
      'chip', () => { selected.push(l.code); $('search').value = ''; render(); }, full));
  }
  if (!matches.length) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = tr('noMatch');
    available.append(p);
  }

  const ready = (!!auth || gestdown || anisub) && selected.length > 0;
  // Varsayılan liste ayarları adrese yazılmaz; eski adresler de aynen çalışır.
  const options = (max ? '&max=' + max : '') + (match ? '' : '&match=0') + (fallback ? '&fb=1' : '') +
    (hideMachine ? '&mt=0' : '') + (hi !== 'show' ? '&hi=' + hi : '') + (clean ? '&clean=1' : '') +
    (gestdown ? '&gd=1' : '') + (anisub ? '&as=1' : '') + (dual ? '&dual=1' : '') + (prefer ? '&pri=' + prefer : '');
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
  $('test').disabled = !(auth || gestdown || anisub) || tested === 'running';
  renderTest();
  const base = ready ? manifestUrl.slice(0, -'/manifest.json'.length) : null;
  // Ayarlar değişince eski ayarlarla getirilmiş altyazı listesi gösterilmez.
  if (base !== addonBase) subs = null;
  addonBase = base;
  renderFind();
  storageSet('saved', JSON.stringify({ auth, sources, selected, max, match, fallback, machine: !hideMachine, hi, clean, gestdown, anisub, dual, prefer }));
}

function renderFind() {
  $('findSetup').hidden = !!addonBase;
  $('findForm').hidden = !addonBase;
  $('findButton').disabled = findBusy;
  $('findMsg').textContent = findNote ? (findNote.key ? tr(findNote.key) : findNote.text) : '';
  $('findMsg').className = 'status' + (findNote?.error ? ' error' : '');
  const titles = $('findTitles');
  titles.replaceChildren();
  for (const meta of (addonBase && found) || []) {
    const text = meta.name + (meta.year ? ' (' + meta.year + ')' : '') + ' · ' + tr(meta.type === 'series' ? 'findSeries' : 'findMovie');
    titles.append(button(text, meta.id, 'chip' + (picked?.id === meta.id ? ' on' : ''), () => pick(meta), findBusy));
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
  for (const item of (addonBase && subs) || []) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'name';
    const lang = LANGS.find((l) => l.stremio === item.lang && selected.includes(l.code)) || LANGS.find((l) => l.stremio === item.lang);
    name.textContent = (lang ? langName(lang) + ' · ' : '') + item.label;
    const save = button(item.saved ? tr('findSaved') : tr('findDownload'), item.label, 'btn secondary', () => download(item), item.busy);
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
      findNote = subs.length ? null : { key: 'findSubsNone' };
    }
  } catch {
    findNote = { key: 'serverError', error: true };
  }
  findBusy = false;
  render();
}

function fileName(meta, item) {
  const pad = (n) => String(n).padStart(2, '0');
  const episode = meta.type === 'series' ? ' S' + pad($('findSeason').value) + 'E' + pad($('findEp').value) : '';
  const title = meta.name.replace(/[\\\\/:*?"<>|]+/g, ' ').replace(/\\s+/g, ' ').trim() || meta.id;
  return title + episode + (item.url.includes('/dual/') ? '.dual' : '') + '.' + item.lang + '.srt';
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
    const res = await fetch(item.url);
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
  const asked = auth + '|' + gestdown + '|' + anisub;
  tested = 'running';
  render();
  let outcome = 'serverError';
  try {
    const res = await fetch(BASE_URL + '/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth, languages: selected, gestdown, anisub }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.results)) outcome = data.results;
    else if (res.status === 429) outcome = 'tooMany';
  } catch {}
  // Deneme sürerken kaynaklar değiştiyse eski sonuç gösterilmez.
  tested = auth + '|' + gestdown + '|' + anisub === asked ? outcome : null;
  render();
});

const uiSelect = $('ui');
for (const [code, label] of Object.entries(UI_LANGUAGES)) uiSelect.append(new Option(label, code, false, code === ui));
uiSelect.addEventListener('change', () => {
  ui = uiSelect.value;
  storageSet('ui', ui);
  renderStatic();
  render();
});

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
$('limit').addEventListener('change', () => {
  max = Number($('limit').value) || null;
  render();
});
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
$('hi').addEventListener('change', () => {
  hi = HI_MODES[$('hi').value] ? $('hi').value : 'show';
  render();
});
$('clean').addEventListener('change', () => {
  clean = $('clean').checked;
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
$('pri').addEventListener('change', () => {
  prefer = PREFER_NAMES[$('pri').value] ? $('pri').value : '';
  render();
});
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
