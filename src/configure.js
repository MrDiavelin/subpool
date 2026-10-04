import { LANGUAGES } from './languages.js';
import { DEFAULT_UI, STRINGS, UI_LANGUAGES } from './i18n.js';

const toJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

// Ayar sayfasında kullanılmayan (sadece eklentinin içinde gösterilen) metinler sayfaya gönderilmez.
const SERVER_ONLY = new Set([
  'manifestDesc', 'needAccountLabel', 'needAccount', 'loginFailed', 'quota', 'quotaReset', 'quotaHint', 'burst',
  'archiveUnsupported', 'notInPack', 'keyRejected', 'failed',
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

export function configurePage({ baseUrl, selected, ui, auth, sources, max, match, maxLanguages, misconfigured }) {
  const langs = LANGUAGES.map(({ code, english, tag }) => ({ code, english, tag }));
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
  select, input[type=text], input[type=password], input[type=search] { padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:var(--panel); color:var(--text); font-size:15px; outline:none; }
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
const LIMITS = [5, 10, 15, 20];
let allowance = null;

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
  const limits = [...new Set([...LIMITS, max || LIMITS[0]])].sort((a, b) => a - b);
  $('limit').replaceChildren(new Option(tr('limitNone'), ''), ...limits.map((n) => new Option(String(n), String(n))));
  $('limit').value = max ? String(max) : '';
  $('match').checked = match;
  for (const name of ['os', 'subdl', 'subsource', 'altyazidb']) setMsg(name, messages[name]);
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

  const ready = !!auth && selected.length > 0;
  // Varsayılan liste ayarları adrese yazılmaz; eski adresler de aynen çalışır.
  const options = (max ? '&max=' + max : '') + (match ? '' : '&match=0');
  const manifestUrl = BASE_URL + '/languages=' + selected.join(',') + '&ui=' + ui + options + '&auth=' + auth + '/manifest.json';
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
  storageSet('saved', JSON.stringify({ auth, sources, selected, max, match }));
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
      setMsg(name, '');
    } else {
      const bad = name === 'os' ? 'badLogin' : 'badKey';
      setMsg(name, res.status === 401 ? bad : res.status === 429 ? 'tooMany' : 'serverError');
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
$('limit').addEventListener('change', () => {
  max = Number($('limit').value) || null;
  render();
});
$('match').addEventListener('change', () => {
  match = $('match').checked;
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
