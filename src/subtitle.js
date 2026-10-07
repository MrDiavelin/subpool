// UTF-8 olmayan eski altyazılar için dile göre varsayılan kod sayfası.
const LEGACY_ENCODINGS = {
  tr: 'windows-1254',
  ru: 'windows-1251', bg: 'windows-1251', uk: 'windows-1251', sr: 'windows-1251', mk: 'windows-1251',
  el: 'windows-1253',
  he: 'windows-1255',
  ar: 'windows-1256', fa: 'windows-1256',
  pl: 'windows-1250', cs: 'windows-1250', sk: 'windows-1250', hu: 'windows-1250',
  ro: 'windows-1250', hr: 'windows-1250', sl: 'windows-1250', bs: 'windows-1250',
};

// Türkçe metin Latin-1 sanılıp UTF-8'e çevrildiğinde ortaya çıkan bozuk harfler.
const TURKISH_MOJIBAKE = { 'ý': 'ı', 'Ý': 'İ', 'þ': 'ş', 'Þ': 'Ş', 'ð': 'ğ', 'Ð': 'Ğ' };

export function decodeSubtitle(buffer, lang) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer);

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder(LEGACY_ENCODINGS[lang] || 'windows-1252').decode(buffer);
  }
  if (lang === 'tr') text = fixTurkishMojibake(text);
  return fixScriptMojibake(text, lang);
}

// Latin harfleriyle yazılmayan dillerin harf aralıkları.
const CYRILLIC = /[\u0400-\u04ff]/g;
const ARABIC = /[\u0600-\u06ff]/g;
const SCRIPTS = {
  he: /[\u0590-\u05ff]/g, el: /[\u0370-\u03ff]/g, ar: ARABIC, fa: ARABIC,
  ru: CYRILLIC, bg: CYRILLIC, uk: CYRILLIC, sr: CYRILLIC, mk: CYRILLIC,
};

// windows-1252 (ve Latin-1) ile okunmuş her karakterin asıl bayt değeri.
const WESTERN_BYTES = new Map();
for (let byte = 0x80; byte <= 0xff; byte++) {
  WESTERN_BYTES.set(String.fromCharCode(byte), byte);
  WESTERN_BYTES.set(new TextDecoder('windows-1252').decode(Uint8Array.of(byte)), byte);
}

/**
 * Bazı kaynaklar eski kod sayfasıyla kaydedilmiş altyazıyı Batı Avrupa metni sanıp UTF-8'e çevirerek sunar; İbranice
 * metin "ùìåí" gibi aksanlı Latin harfleriyle görünür. Dilin kendi harfleri neredeyse hiç yokken aksanlı harfler yalın
 * Latin harflerinden fazlaysa karakterler asıl baytlarına döndürülüp dilin kod sayfasıyla yeniden okunur.
 */
function fixScriptMojibake(text, lang) {
  const script = SCRIPTS[lang];
  if (!script) return text;
  const count = (pattern, value) => (value.match(pattern) || []).length;
  const accented = count(/[\u00c0-\u00ff]/g, text);
  if (accented < 20 || accented <= count(/[a-z]/gi, text) || accented < count(script, text) * 10) return text;

  const decoder = new TextDecoder(LEGACY_ENCODINGS[lang]);
  const table = new Map([...WESTERN_BYTES].map(([ch, byte]) => [ch, decoder.decode(Uint8Array.of(byte))]));
  // Kod sayfasında karşılığı olmayan karakterler (♪ gibi) olduğu gibi kalır.
  const fixed = text.replace(/[^\x00-\x7f]/g, (ch) => {
    const proper = table.get(ch);
    return proper && proper !== '\ufffd' ? proper : ch;
  });
  return count(script, fixed) >= accented * 0.7 ? fixed : text;
}

function fixTurkishMojibake(text) {
  const broken = (text.match(/[ýÝþÞðÐ]/g) || []).length;
  const proper = (text.match(/[ıİşŞğĞ]/g) || []).length;
  if (broken === 0 || broken <= proper) return text;
  return text.replace(/[ýÝþÞðÐ]/g, (ch) => TURKISH_MOJIBAKE[ch]);
}

const ASS_FIELDS = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];

/** Stiliyle sunulabilecek ASS/SSA dosyası mı: standart "[Script Info]" bölümüyle başlar ve konuşma satırı içerir. */
export function isAss(text) {
  return /^\s*\[Script Info\]/i.test(text) && /^\s*\[Events\]/im.test(text) && /^\s*Dialogue:/im.test(text);
}

/**
 * ASS/SSA biçimindeki (çoğunlukla anime) altyazıyı SRT'ye çevirir; başka biçimdeki metne dokunmaz.
 * Renk, konum gibi süslemeler atılır; italik korunur. Çizimler ve karaoke efektleri alınmaz.
 */
export function assToSrt(text) {
  if (!/^\s*\[Events\]/im.test(text) || !/^\s*Dialogue:/im.test(text)) return text;
  let fields = ASS_FIELDS;
  let inEvents = false;
  const seen = new Set();
  const cues = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^\[[^\]]+\]$/.test(line)) {
      inEvents = /^\[events\]$/i.test(line);
      continue;
    }
    if (!inEvents) continue;
    if (/^Format:/i.test(line)) {
      fields = line.slice(7).split(',').map((f) => f.trim().toLowerCase());
      continue;
    }
    if (!/^Dialogue:/i.test(line)) continue;

    const parts = line.slice(9).trimStart().split(',');
    if (parts.length < fields.length) continue;
    const value = (name) => (fields.includes(name) ? parts[fields.indexOf(name)] : '');
    const start = assTime(value('start'));
    const end = assTime(value('end'));
    const body = parts.slice(fields.length - 1).join(',');
    if (start === null || end === null || end <= start) continue;
    // Çizimler (\p1) ve karaoke şablonlarının ürettiği hece hece satırlar ekranda anlamsız yığın oluşturur.
    if (/\\p[1-9]/.test(body) || /^(fx|karaoke|template|code)/i.test(value('effect').trim())) continue;

    const positioned = /\\(pos|move)\s*\(/.test(body);
    let plain = body
      .replace(/\{([^}]*)\}/g, (_, tags) => (/\\i1/.test(tags) ? '<i>' : /\\i0?(?![a-z0-9])/.test(tags) ? '</i>' : ''))
      .replace(/\\N|\\n/g, '\n')
      .replace(/\\h/g, ' ');
    plain = plain.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
    const opens = (plain.match(/<i>/g) || []).length;
    const closes = (plain.match(/<\/i>/g) || []).length;
    if (opens > closes) plain += '</i>';
    else if (closes > opens) plain = plain.replace(/<\/?i>/g, '');
    const bare = plain.replace(/<\/?i>/g, '').trim();
    // Harf harf yerleştirilmiş tabela parçaları tek karakterlik satırlar üretir; atılır.
    if (!bare || (positioned && bare.length < 2)) continue;

    const key = `${start}|${end}|${bare}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cues.push({ start, end, text: plain, order: cues.length });
  }
  if (!cues.length) return text;
  cues.sort((a, b) => a.start - b.start || a.order - b.order);
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
}

function assTime(value) {
  const m = String(value).trim().match(/^(\d+):(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
  if (!m) return null;
  return (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 + Math.round(Number(`0.${m[4] || 0}`) * 1000);
}

function srtTime(ms) {
  const pad = (n, width = 2) => String(n).padStart(width, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

const SRT_TIMING = /^\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/;
const MUSIC = /[♪♫♬♩]/;
const REMOVED = '\u0001';
// "JOHN: Selam" ya da "- KADIN 2: Dur!" gibi, tamamı büyük harfle yazılmış konuşmacı adı. Satırın kalanında küçük harf
// yoksa (tamamı büyük harfle yazılmış altyazılar) dokunulmaz ki konuşma yanlışlıkla silinmesin.
const SPEAKER = /^((?:<[^>]+>)*\s*-?\s*)(?=[^:]*\p{Lu}[^:]*\p{Lu})[\p{Lu}\p{N} .'’#&-]{2,30}:[ \t]*(?=.*\p{Ll}|$)/u;

/**
 * İşitme engelliler için eklenen açıklamaları SRT'den çıkarır: [ses] ve (ses) açıklamaları, ♪ işaretli şarkı
 * satırları ve büyük harfle yazılmış konuşmacı adları. Tamamen boşalan satırlar atılır, kalanlar yeniden numaralanır.
 * SRT olmayan metne dokunmaz.
 */
export function stripHearingImpaired(text) {
  const body = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (/^\s*WEBVTT/.test(body)) return text;
  const cues = [];
  let current = null;
  for (const line of body.split('\n')) {
    if (SRT_TIMING.test(line)) {
      // Zaman satırından önceki sıra numarası bir önceki satırın metnine karışmasın.
      if (current && /^\s*\d+\s*$/.test(current.lines[current.lines.length - 1] ?? '')) current.lines.pop();
      current = { timing: line.trim(), lines: [] };
      cues.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (!cues.length) return text;

  const kept = [];
  for (const cue of cues) {
    const cleaned = cleanCue(cue.lines.filter((line) => line.trim()).join('\n'));
    if (cleaned) kept.push(`${cue.timing}\n${cleaned}\n`);
  }
  if (!kept.length) return text;
  return kept.map((cue, i) => `${i + 1}\n${cue}`).join('\n');
}

function cleanCue(original) {
  const bare = original.replace(/<[^>]+>/g, '').trim();
  // Baştan sona müzik işaretleri arasındaki satırlar şarkı sözüdür.
  if (MUSIC.test(bare[0] || '') && MUSIC.test(bare[bare.length - 1] || '')) return '';

  // Açıklama iki satıra bölünmüş olabilir; bu yüzden parantezler satır satır değil, bütün metinde aranır.
  // Silinen açıklamanın yerine geçici bir işaret konur; böylece hangi satıra dokunulduğu bilinir.
  const stripped = original.replace(/\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, REMOVED);
  const lines = [];
  let prefix = '';
  for (const raw of stripped.split('\n')) {
    if (MUSIC.test(raw)) continue;
    const line = raw.replaceAll(REMOVED, '').replace(SPEAKER, '$1').replace(/<(i|b|u)>\s*<\/\1>/gi, '').replace(/[ \t]{2,}/g, ' ').trim();
    const spoken = line.replace(/<[^>]+>/g, '').trim();
    if (!spoken) {
      // Geriye yalnızca biçim etiketi kaldıysa (örn. "</i>") boş satır bırakmak yerine komşu satıra eklenir.
      if (lines.length) lines[lines.length - 1] += line;
      else prefix += line;
      continue;
    }
    // Açıklaması silinince geriye yalnızca tire ya da noktalama kalan satırlar atılır; dokunulmamış satırlar kalır.
    if (line !== raw.trim() && !/[\p{L}\p{N}]/u.test(spoken)) continue;
    lines.push(prefix + line);
    prefix = '';
  }
  let result = lines.join('\n');
  // Satır silinince açık kalan biçim etiketleri bütün altyazıyı italik yapmasın.
  for (const tag of ['i', 'b', 'u', 'font']) {
    const opens = (result.match(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi')) || []).length;
    const closes = (result.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (opens !== closes) result = result.replace(new RegExp(`</?${tag}(\\s[^>]*)?>`, 'gi'), '');
  }
  return result.trim();
}

const CUE_TIMES = /^\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
// İkinci dilin satırı, kendi süresinin (ya da daha kısaysa birinci dildeki satırın süresinin) en az bu kadarında
// ekranda birlikte duruyorsa o satırın altına yazılır.
const DUAL_OVERLAP = 0.4;

/** SRT metnini satırlarına ayırır: [{ start, end, text }] (süreler milisaniye, başlangıca göre sıralı). */
function parseCues(text) {
  const body = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const ms = (h, m, s, frac) => (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(frac.padEnd(3, '0'));
  const found = [];
  let current = null;
  for (const line of body.split('\n')) {
    const m = line.match(CUE_TIMES);
    if (m) {
      // Zaman satırından önceki sıra numarası bir önceki satırın metnine karışmasın.
      if (current && /^\s*\d+\s*$/.test(current.lines[current.lines.length - 1] ?? '')) current.lines.pop();
      current = { start: ms(m[1], m[2], m[3], m[4]), end: ms(m[5], m[6], m[7], m[8]), lines: [] };
      found.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  const cues = [];
  for (const cue of found) {
    const content = cue.lines.map((line) => line.trim()).filter(Boolean).join('\n');
    if (content && cue.end > cue.start) cues.push({ start: cue.start, end: cue.end, text: content, order: cues.length });
  }
  return cues.sort((a, b) => a.start - b.start || a.order - b.order);
}

const toSrt = (cues) => cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');

// Zaman kayması en fazla bu kadar (ms) aranır ve bu genişlikte (ms) dilimlerle ölçülür.
const SHIFT_WINDOW = 15000;
const SHIFT_STEP = 100;

/**
 * Aynı videonun farklı sürümleri için hazırlanmış iki altyazı arasında çoğu zaman sabit bir zaman kayması olur
 * (biri diğerinden hep 2 saniye erken gibi). İkinci altyazının birinciye göre kaç milisaniye kaydırılması gerektiğini
 * bulur: satır başlangıçları arasındaki farklar sayılır, en çok tekrarlanan fark kaymadır.
 * Sonuç: { shift, score }. score, bulunan kaymada (kayma yoksa sıfır kaymada) birbirini tutan satır sayısıdır.
 * Belirgin bir kayma yoksa (altyazılar zaten uyumluysa ya da hiç benzemiyorsa) shift 0'dır.
 */
function timeShift(main, other) {
  const votes = new Map();
  let from = 0;
  for (const cue of other) {
    while (from < main.length && main[from].start < cue.start - SHIFT_WINDOW) from++;
    for (let i = from; i < main.length && main[i].start <= cue.start + SHIFT_WINDOW; i++) {
      const slot = Math.round((main[i].start - cue.start) / SHIFT_STEP);
      votes.set(slot, (votes.get(slot) || 0) + 1);
    }
  }
  const score = (slot) => (votes.get(slot - 1) || 0) + (votes.get(slot) || 0) + (votes.get(slot + 1) || 0);
  let best = 0;
  for (const slot of votes.keys()) if (score(slot) > score(best)) best = slot;
  // Satırların en az dörtte biri aynı farkı göstermeli ve bu, kaydırmadan elde edilen uyumun en az iki katı olmalı.
  if (!best || score(best) < Math.min(main.length, other.length) / 4 || score(best) < score(0) * 2) return { shift: 0, score: score(0) };
  // Kazanan dilimdeki farkların ortancası alınır.
  const diffs = [];
  from = 0;
  for (const cue of other) {
    while (from < main.length && main[from].start < cue.start - SHIFT_WINDOW) from++;
    for (let i = from; i < main.length && main[i].start <= cue.start + SHIFT_WINDOW; i++) {
      const diff = main[i].start - cue.start;
      if (Math.abs(diff / SHIFT_STEP - best) <= 1.5) diffs.push(diff);
    }
  }
  diffs.sort((a, b) => a - b);
  return { shift: diffs[Math.floor(diffs.length / 2)] ?? 0, score: score(best) };
}

// Aynı film 23.976, 24 ve 25 kare/saniyelik sürümlerle yayımlanır. Altyazı başka hızdaki sürüm için hazırlanmışsa
// satırlar arasındaki fark film boyunca giderek büyür; bu oranlarla ölçeklenmiş hali de denenir.
const SPEED_RATIOS = [25 / 23.976, 23.976 / 25, 24 / 23.976, 23.976 / 24, 25 / 24, 24 / 25];

/**
 * İkinci altyazının birinciye uyması için gereken hız oranını ve kaymayı bulur: { ratio, shift }.
 * Bir hız oranı, ancak satırların en az dörtte birini tutturuyor ve oransız halin en az 1,5 katı satırı
 * tutturuyorsa seçilir; yoksa oran 1 kalır (yalnızca sabit kayma düzeltilir).
 */
function alignment(main, other) {
  let best = { ratio: 1, ...timeShift(main, other) };
  const enough = Math.min(main.length, other.length) / 4;
  for (const ratio of SPEED_RATIOS) {
    const scaled = other.map((cue) => ({ ...cue, start: cue.start * ratio, end: cue.end * ratio }));
    const found = timeShift(main, scaled);
    if (found.score >= enough && found.score >= best.score * 1.5) best = { ratio, ...found };
  }
  return best;
}

/**
 * İki dildeki altyazıyı tek dosyada birleştirir: birinci dilin her satırının altına, aynı anda ekranda olan ikinci
 * dil satırı italik olarak yazılır. Birinci dilde karşılığı olmayan satırlar kendi sürelerinde tek başına gösterilir.
 * İkinci altyazı birinciye göre sabit bir süre kaymışsa ya da başka kare hızındaki bir sürüm için hazırlanmışsa
 * önce bu fark giderilir.
 * İkisinden biri SRT değilse (ya da yalnızca bir hata mesajıysa) null döner.
 */
export function mergeSubtitles(primary, secondary) {
  const main = parseCues(primary);
  let other = parseCues(secondary);
  if (main.length < 2 || other.length < 2) return null;
  const { ratio, shift } = alignment(main, other);
  if (shift || ratio !== 1) {
    const move = (ms) => Math.round(ms * ratio + shift);
    other = other.map((cue) => ({ ...cue, start: Math.max(0, move(cue.start)), end: move(cue.end) })).filter((cue) => cue.end > cue.start);
  }

  const attached = main.map(() => []);
  const alone = [];
  let from = 0;
  for (const cue of other) {
    // Tek satıra indirilir ki iki dil birlikte ekranı kaplamasın; konum ve italik etiketleri atılır.
    const line = cue.text.replace(/\{\\[^}]*\}/g, '').replace(/<\/?i>/gi, '').split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
    if (!line) continue;
    while (from < main.length && main[from].end <= cue.start) from++;
    let best = -1;
    let bestOverlap = 0;
    for (let i = from; i < main.length && main[i].start < cue.end; i++) {
      const overlap = Math.min(main[i].end, cue.end) - Math.max(main[i].start, cue.start);
      if (overlap > bestOverlap) {
        best = i;
        bestOverlap = overlap;
      }
    }
    const shorter = best < 0 ? 0 : Math.min(cue.end - cue.start, main[best].end - main[best].start);
    if (best >= 0 && bestOverlap >= shorter * DUAL_OVERLAP) attached[best].push(`<i>${line}</i>`);
    else alone.push({ start: cue.start, end: cue.end, text: `<i>${line}</i>`, order: main.length + alone.length });
  }

  const cues = main.map((cue, i) => ({ ...cue, order: i, text: [cue.text, ...attached[i]].join('\n') }));
  return toSrt([...cues, ...alone].sort((a, b) => a.start - b.start || a.order - b.order));
}

/** Altyazının başına kısa bir bilgi satırı ekler; ilk konuşma çok erken başlıyorsa (yer yoksa) metne dokunmaz. */
export function withNotice(text, line) {
  const cues = parseCues(text);
  if (cues.length < 2 || cues[0].start < 2000) return text;
  return toSrt([{ start: 0, end: Math.min(5000, cues[0].start - 200), text: line }, ...cues]);
}

export function errorSrt(lines) {
  return `1\n00:00:00,000 --> 00:00:15,000\n${lines.join('\n')}\n`;
}

const NOISE_TOKENS = new Set(['the', 'a', 'an', 'and', 'of', 'srt', 'sub', 'subs', 'mkv', 'mp4', 'avi', 'tr', 'tur', 'turkish']);

function tokenize(name) {
  return new Set(
    String(name || '')
      .toLowerCase()
      .replace(/\.[a-z0-9]{2,4}$/, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !NOISE_TOKENS.has(t)),
  );
}

/** Altyazı sürüm adı ile video dosya adı arasındaki benzerlik (0-1). */
export function releaseSimilarity(release, filename) {
  if (!release || !filename) return 0;
  const a = tokenize(release);
  const b = tokenize(filename);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const t of a) if (b.has(t)) common++;
  return common / new Set([...a, ...b]).size;
}
