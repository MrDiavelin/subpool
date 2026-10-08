// Bir altyazının videoyla senkron olması, aynı sürüm (aynı kaynak, aynı kurgu) için hazırlanmış olmasına bağlıdır.
// Buradaki kodlar sürüm adını parçalarına ayırır ve videonun dosya adıyla karşılaştırır.

const SOURCES = [
  ['bluray', /\.(blu\.?ray|bd\.?rip|br\.?rip|bd\.?remux|bdmv|remux|uhd\.bd)\./],
  ['web', /\.(web\.?dl|web\.?rip|webhd|web)\./],
  ['tv', /\.(hdtv|pdtv|dsr|tv\.?rip|sat\.?rip)\./],
  ['dvd', /\.(dvd\.?rip|dvd\.?scr|dvdr?|dvd[59])\./],
  ['hdrip', /\.(hd\.?rip)\./],
  ['cam', /\.(cam|hd\.?cam|cam\.?rip|ts|hd\.?ts|telesync|tc|telecine)\./],
];
const SERVICES = /\.(amzn|nf|dsnp|hmax|atvp|hulu|pcok|pmtp|crav|stan|itunes)\./;
const EDITIONS = [
  ['extended', /\.(extended|uzatilmis)\./],
  ['unrated', /\.(unrated|uncut|uncensored)\./],
  ['directors', /\.(directors?(\.s)?\.cut|dc)\./],
  ['theatrical', /\.theatrical\./],
  ['final', /\.final\.cut\./],
  ['special', /\.special\.edition\./],
  ['redux', /\.redux\./],
];
// Teknik bir parçanın başladığı yer: grup adı ancak bundan sonra aranır ("Spider-Man" gibi adlar grup sanılmasın).
const TECH = /\.(2160p|1080[pi]|720p|576p|480p|4k|uhd|blu\.?ray|bd\.?rip|br\.?rip|remux|web|web\.?dl|web\.?rip|hdtv|dvd\.?rip|hd\.?rip|x26[45]|h\.?26[45]|hevc|avc|xvid|divx|av1)\./;
const NOT_GROUP = new Set([
  'dl', 'rip', 'ray', 'hd', 'ma', 'x264', 'x265', 'h264', 'h265', 'hevc', 'avc', 'xvid', 'aac', 'ac3', 'dts', 'web', 'bluray',
  '1080p', '720p', '2160p', '480p', 'subs', 'sub', 'tr', 'en', 'eng', 'tur', 'turkish', 'english', 'hi', 'sdh', 'forced',
]);
const EXTENSION = /\.(mkv|mp4|avi|mov|wmv|m4v|ts|webm|srt|ass|ssa|vtt|sub|zip|rar)$/i;

/** Sürüm adını senkronu belirleyen parçalarına ayırır. */
export function parseRelease(name) {
  const raw = String(name || '').trim().replace(EXTENSION, '');
  const text = `.${raw.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '.')}.`;
  const info = { group: '', source: '', service: '', resolution: '', edition: '', season: null, episode: null };
  if (text.length < 3) return info;

  const resolution = text.match(/\.(2160|1080|720|576|480)[pi]\./);
  if (resolution) info.resolution = resolution[1];
  else if (/\.(4k|uhd)\./.test(text)) info.resolution = '2160';

  info.service = text.match(SERVICES)?.[1] || '';
  info.source = SOURCES.find(([, pattern]) => pattern.test(text))?.[0] || (info.service ? 'web' : '');
  info.edition = EDITIONS.filter(([, pattern]) => pattern.test(text)).map(([key]) => key).join('+');

  let m = text.match(/\.s(\d{1,2})\.?e(\d{1,4})\./) || text.match(/\.(\d{1,2})x(\d{2,3})\./);
  if (m) {
    info.season = Number(m[1]);
    info.episode = Number(m[2]);
  }

  // Grup: "…x264-GRUP", "…-GRUP[rartv]", "[YTS.MX]" ya da animelerdeki baştaki "[Grup]".
  const tech = text.search(TECH);
  m = raw.match(/-([A-Za-z0-9]+)(?:\[[^\]]*\])?$/);
  if (m && tech >= 0 && !NOT_GROUP.has(m[1].toLowerCase()) && !/^\d+$/.test(m[1])) info.group = m[1].toLowerCase();
  else if (/\.(yts|yify)\./.test(text)) info.group = 'yts';
  else if ((m = raw.match(/^\[([^\]]{2,30})\]/))) info.group = m[1].toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (info.group === 'yify') info.group = 'yts';
  return info;
}

/**
 * Altyazının sürümü videonun sürümüne ne kadar uyuyor? Yüksek puan daha uyumlu demektir.
 * En çok sürüm grubu ve kaynak (BluRay/WEB…) belirleyicidir; farklı kaynak ya da farklı kurgu puan düşürür.
 */
export function releaseMatch(video, sub) {
  let score = 0;
  if (video.group && video.group === sub.group) score += 150;
  if (video.source && sub.source) score += video.source === sub.source ? 100 : -100;
  if (video.service && video.service === sub.service) score += 30;
  if (video.edition !== sub.edition) score -= video.edition && sub.edition ? 60 : 30;
  else if (video.edition) score += 60;
  if (video.resolution && video.resolution === sub.resolution) score += 10;
  if (video.episode !== null && sub.episode !== null) {
    if (video.episode !== sub.episode || (video.season !== null && sub.season !== null && video.season !== sub.season)) score -= 300;
  }
  return score;
}

/**
 * Altyazının sürüm adı videonun dosya adıyla aynı sürümü mü gösteriyor? Etikete yazılan "sürüm adı uyuyor" notu
 * puana değil bu açık kurala bağlıdır: aynı grup, aynı kaynak, aynı kurgu; sezon ve bölüm numarası çelişmiyor.
 * Grubu ya da kaynağı okunamayan adlar için hiçbir şey söylenmez.
 */
export function sameRelease(video, sub) {
  if (!video.group || video.group !== sub.group) return false;
  if (!video.source || video.source !== sub.source) return false;
  if (video.edition !== sub.edition) return false;
  if (video.episode !== null && sub.episode !== null && video.episode !== sub.episode) return false;
  if (video.season !== null && sub.season !== null && video.season !== sub.season) return false;
  return true;
}

/**
 * Bir dosya ya da sürüm adındaki sezon ve bölüm numarasını bulur: S01E02, 1x02, E02, Bölüm 2.
 * Bunlar yoksa animelerdeki yalın yazımı dener: "[Grup] Ad - 05 [1080p]", "Ad S2 - 05", "Ad_075_(BD)".
 * Sonuç: { season, episode } — bulunamayan null olur.
 */
export function episodeOf(name) {
  const base = String(name).split('/').pop().toLowerCase().replace(EXTENSION, '');
  let m = base.match(/s(\d{1,2})[ ._-]*e(\d{1,4})/);
  if (m) return { season: Number(m[1]), episode: Number(m[2]) };
  m = base.match(/(?:^|[^\d])(\d{1,2})x(\d{1,3})(?:[^\d]|$)/);
  if (m) return { season: Number(m[1]), episode: Number(m[2]) };
  m = base.match(/(?:^|[^a-z])(?:ep?|episode|bolum|bölüm)[ ._-]*(\d{1,4})(?:[^\d]|$)/);
  if (m) return { season: null, episode: Number(m[1]) };

  // Yalın yazım: önce bölüm numarası sanılabilecek her şey (çözünürlük, kodek, yıl, ses kanalı…) ayıklanır.
  let season = null;
  const text = base
    .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, ' ')
    .replace(/\d{3,4}[pi](?![a-z0-9])|\d{3,4}x\d{3,4}|[xh][ .]?26[45]|\d{1,2}[ .-]?bits?|(?<!\d)(?:19|20)\d{2}(?!\d)/g, ' ')
    .replace(/(?<!\d)\d\.\d(?!\d)/g, ' ')
    .replace(/(?:part|cour|vol|volume|cd|disc|movie)[ ._-]*\d+/g, ' ')
    .replace(/(?<![a-z0-9])s(\d{1,2})(?![a-z0-9])|season[ ._-]*(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)[ ._-]*season/g, (_, a, b, c) => {
      season = Number(a || b || c);
      return ' ';
    });
  // "01-12" ya da "1~148" tek bölüm değil, bölüm aralığıdır (paket).
  if (/(?<![a-z0-9])\d{1,4}[-–~]\d{1,4}(?![a-z0-9])/.test(text)) return { season, episode: null };
  // "Ad - 05" yazımındaki tireden sonraki sayı; yoksa addaki son yalın sayı ("Mob Psycho 100 05" → 5).
  m = text.match(/(?:^|[ _.])[-–—][ _.]+(\d{1,4})(?:v\d+)?(?![a-z0-9])/);
  if (m) return { season, episode: Number(m[1]) };
  const numbers = [...text.matchAll(/(?<![a-z0-9])(\d{1,4})(?:v\d+)?(?![a-z0-9])/g)];
  if (numbers.length) return { season, episode: Number(numbers.at(-1)[1]) };
  // Köşeli parantez içinde tek başına duran sayı: "[Grup][Ad][05][1080p]".
  m = base.match(/\[(\d{1,3})(?:v\d+)?\]/);
  return { season, episode: m ? Number(m[1]) : null };
}

// Başlığın bittiği yer: yıl, sezon/bölüm numarası ya da ilk teknik parça.
const TITLE_END = /\.((19|20)\d{2}|s\d{1,2}(\.?e\d{1,4})?|\d{1,2}x\d{2,3})\./;

/**
 * Sürüm adı, altyazının yalnızca yabancı dildeki konuşmaları içerdiğini ("forced") söylüyor mu?
 * Sözcük ancak başlık bittikten sonra geçiyorsa sayılır; "Forced.Vengeance.1982.720p" gibi adlarda başlığın parçasıdır.
 * Başlığın nerede bittiği anlaşılamayan adlar için hiçbir şey söylenmez.
 */
export function forcedRelease(name) {
  const text = `.${String(name || '').trim().replace(EXTENSION, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '.')}.`;
  const at = text.lastIndexOf('.forced.');
  if (at < 0) return false;
  const starts = [text.search(TITLE_END), text.search(TECH)].filter((index) => index >= 0);
  return starts.length > 0 && at > Math.min(...starts);
}
