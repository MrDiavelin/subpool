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
  return text;
}

function fixTurkishMojibake(text) {
  const broken = (text.match(/[ýÝþÞðÐ]/g) || []).length;
  const proper = (text.match(/[ıİşŞğĞ]/g) || []).length;
  if (broken === 0 || broken <= proper) return text;
  return text.replace(/[ýÝþÞðÐ]/g, (ch) => TURKISH_MOJIBAKE[ch]);
}

const ASS_FIELDS = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];

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
