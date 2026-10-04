import { inflateRawSync } from 'node:zlib';
import unrar from 'node-unrar-js';
import { UNRAR_WASM } from './unrar-wasm.js';
import { episodeOf } from './release.js';

const SUBTITLE_EXT = /\.(srt|vtt|ass|ssa)$/i;
const NESTED_EXT = /\.(zip|rar)$/i;
// Altyazı dosyaları küçüktür; bundan büyük dosyalar (ve "zip bombaları") hiç açılmaz.
const MAX_SUBTITLE = 8 * 1024 * 1024;
const MAX_NESTED = 32 * 1024 * 1024;

export class UnsupportedArchiveError extends Error {}

// İçinde tek satırlık bir altyazı bulunan küçük bir RAR dosyası; RAR açıcının çalıştığını denemek için.
const SAMPLE_RAR = 'UmFyIRoHAQAzkrXlCgEFBgAFAQGAgABHlJkLIgIDC6oABKoAIFCohheAAAAGb2suc3J0CgMCHw3BBjRT3QExDQowMDowMDowMSwwMDAgLS0+IDAwOjAwOjAyLDAwMA0KcmFyIG9rDQodd1ZRAwUEAA==';

export async function rarSelfTest() {
  try {
    const bytes = await pickSubtitle(new Uint8Array(Buffer.from(SAMPLE_RAR, 'base64')));
    return new TextDecoder().decode(bytes).includes('rar ok');
  } catch {
    return false;
  }
}

/**
 * İndirilen dosya bir arşivse (ZIP ya da RAR) içinden uygun altyazıyı çıkarır; değilse olduğu gibi döndürür.
 * Arşivin içindeki arşiv de (ör. ZIP içinde RAR) bir kat açılır.
 * Sezon paketlerinde dosya adındaki bölüm numarasına göre seçim yapar. Bulamazsa null döner.
 * Animelerde bölümün baştan sayılan numarası (`absolute`) ve sezonun bölüm sayısı (`seasonLength`) da verilebilir.
 */
export async function pickSubtitle(buffer, { season, episode, absolute, seasonLength } = {}) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (is7z(bytes)) throw new UnsupportedArchiveError('7z');
  if (!isZip(bytes) && !isRar(bytes)) return bytes;

  const all = await readArchive(bytes);
  const files = all.filter(isSubtitle);
  let unsupported = all.some((f) => /\.7z$/i.test(f.name));
  for (const inner of all.filter((f) => NESTED_EXT.test(f.name) && f.size <= MAX_NESTED && !isJunk(f.name))) {
    try {
      const innerBytes = await inner.read();
      if (!isZip(innerBytes) && !isRar(innerBytes)) continue;
      for (const f of await readArchive(innerBytes)) if (isSubtitle(f)) files.push({ ...f, name: `${inner.name}/${f.name}` });
    } catch (err) {
      if (!(err instanceof UnsupportedArchiveError)) throw err;
      unsupported = true;
    }
  }
  if (!files.length) {
    if (unsupported) throw new UnsupportedArchiveError('nested');
    return null;
  }

  let candidates = files;
  if (episode !== undefined && episode !== null && files.length > 1) {
    candidates = episodeFiles(files, { season, episode, absolute, seasonLength });
    if (!candidates.length) return null;
  }
  // Birden fazla uygun dosya varsa önce .srt, sonra en büyüğü seçilir (genelde tam altyazı odur).
  candidates.sort((a, b) => formatRank(a.name) - formatRank(b.name) || b.size - a.size);
  return candidates[0].read();
}

const isZip = (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5);
const isRar = (b) => b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21;
const is7z = (b) => b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf;
const isJunk = (name) => /(^|\/)__MACOSX\//.test(name);
const isSubtitle = (f) => SUBTITLE_EXT.test(f.name) && !isJunk(f.name) && f.size <= MAX_SUBTITLE;
const formatRank = (name) => (/\.srt$/i.test(name) ? 0 : /\.vtt$/i.test(name) ? 1 : 2);

/** Arşivdeki dosyalar: [{ name, size, read() }] */
function readArchive(bytes) {
  return isRar(bytes) ? readRar(bytes) : readZip(bytes);
}

/**
 * Paketteki dosyalardan istenen bölüme ait olanları seçer.
 * Adında sezon yazan dosyalar (S02E17) kesin sayılır. Sezon yazmayanlarda ("Ad - 75") sayı, paket bölümleri
 * baştan sayıyorsa `absolute` ile, sezon içinden sayıyorsa `episode` ile karşılaştırılır. Paketin baştan saydığı,
 * içinde sezonun bölüm sayısından büyük bir numara bulunmasından anlaşılır.
 */
export function episodeFiles(files, { season, episode, absolute, seasonLength } = {}) {
  const ep = Number(episode);
  const se = season === undefined || season === null ? null : Number(season);
  const abs = Number(absolute) > 0 ? Number(absolute) : null;
  const length = Number(seasonLength) > 0 ? Number(seasonLength) : null;
  const parsed = files.map((file) => ({ file, ...episodeOf(file.name) })).filter((p) => p.episode !== null);

  const exact = parsed.filter((p) => p.season !== null && se !== null && (
    (p.season === se && p.episode === ep) ||
    // "1. sezon 75. bölüm" ya da "2. sezon 25. bölüm" diye yazılmış baştan sayılan numara.
    (abs !== null && p.episode === abs && (p.season === 1 || (p.season === se && length !== null && abs > length)))
  ));
  if (exact.length) return exact.map((p) => p.file);

  const loose = parsed.filter((p) => p.season === null || se === null);
  const byEpisode = loose.filter((p) => p.episode === ep);
  if (abs === null) return byEpisode.map((p) => p.file);
  const byAbsolute = loose.filter((p) => p.episode === abs);
  if (length !== null) {
    const countsFromStart = loose.some((p) => p.episode > length);
    return (countsFromStart ? byAbsolute : byEpisode).map((p) => p.file);
  }
  return (byEpisode.length ? byEpisode : byAbsolute).map((p) => p.file);
}

/** Bağımlılık olmadan ZIP okur (sadece "stored" ve "deflate" sıkıştırma). */
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new UnsupportedArchiveError('bad zip');

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const files = [];
  for (let i = 0; i < count && offset + 46 <= bytes.length; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const rawName = bytes.subarray(offset + 46, offset + 46 + nameLength);
    // 11. bit UTF-8 adı belirtir; değilse eski DOS kod sayfası (ad sadece eşleştirme için kullanılıyor).
    const name = new TextDecoder(flags & 0x800 ? 'utf-8' : 'latin1').decode(rawName);
    offset += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;

    files.push({
      name,
      size,
      read() {
        if (flags & 0x1) throw new UnsupportedArchiveError('encrypted');
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const start = localOffset + 30 + localNameLength + localExtraLength;
        const data = bytes.subarray(start, start + compressedSize);
        if (method === 0) return data;
        if (method === 8) return new Uint8Array(inflateRawSync(data, { maxOutputLength: MAX_NESTED }));
        throw new UnsupportedArchiveError(`zip method ${method}`);
      },
    });
  }
  return files;
}

// RAR kütüphanesi aynı anda tek arşivle çalışır; istekler sıraya alınır.
let rarQueue = Promise.resolve();

/** RAR okur (node-unrar-js). İçindeki altyazılar ve iç arşivler hemen çıkarılır, gerisine dokunulmaz. */
function readRar(bytes) {
  const job = rarQueue.then(async () => {
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    let extractor;
    try {
      extractor = await unrar.createExtractorFromData({ data, wasmBinary: UNRAR_WASM });
    } catch (err) {
      throw new UnsupportedArchiveError(`rar: ${err.message}`);
    }
    try {
      const wanted = (h) => !h.flags.directory && !h.flags.encrypted &&
        ((SUBTITLE_EXT.test(h.name) && h.unpSize <= MAX_SUBTITLE) || (NESTED_EXT.test(h.name) && h.unpSize <= MAX_NESTED));
      const headers = [...extractor.getFileList().fileHeaders];
      if (headers.length && headers.every((h) => h.flags.encrypted)) throw new UnsupportedArchiveError('encrypted');
      const names = headers.filter(wanted).map((h) => h.name);
      const files = [];
      if (names.length) {
        for (const { fileHeader, extraction } of extractor.extract({ files: names }).files) {
          if (!extraction) continue;
          const name = fileHeader.name.replace(/\\/g, '/');
          files.push({ name, size: extraction.length, read: () => extraction });
        }
      }
      // Açılmayan dosyalar da (ör. .7z) adlarıyla listede dursun ki "desteklenmiyor" denebilsin.
      for (const h of headers) {
        const name = h.name.replace(/\\/g, '/');
        if (!h.flags.directory && !files.some((f) => f.name === name)) {
          files.push({ name, size: h.unpSize, read() { throw new UnsupportedArchiveError('rar entry'); } });
        }
      }
      return files;
    } catch (err) {
      if (err instanceof UnsupportedArchiveError) throw err;
      throw new UnsupportedArchiveError(`rar: ${err.message}`);
    }
  });
  rarQueue = job.catch(() => {});
  return job;
}
