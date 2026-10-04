const CINEMETA = 'https://v3-cinemeta.strem.io';

/**
 * Stremio'nun kendi katalog eklentisinden (Cinemeta) dizinin adını, türünü ve sezonlarının kaç bölüm olduğunu alır.
 * Animelerde bölümün baştan sayılan numarasını hesaplamak için kullanılır.
 * Sonuç: { name, animation, seasons: { "<sezon>": bölüm sayısı } }
 */
export async function seriesInfo(imdbId) {
  const res = await fetch(`${CINEMETA}/meta/series/${encodeURIComponent(imdbId)}.json`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Cinemeta ${res.status}`);
  const meta = (await res.json())?.meta || {};
  const seasons = {};
  for (const video of meta.videos || []) {
    if (!Number.isInteger(video?.season) || video.season < 1 || !Number.isInteger(video.episode)) continue;
    seasons[video.season] = Math.max(seasons[video.season] || 0, video.episode);
  }
  const genres = Array.isArray(meta.genres) ? meta.genres : Array.isArray(meta.genre) ? meta.genre : [];
  return { name: typeof meta.name === 'string' ? meta.name : '', animation: genres.includes('Animation'), seasons };
}
