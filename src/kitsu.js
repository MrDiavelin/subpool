const KITSU = 'https://anime-kitsu.strem.fun';

/**
 * Anime kataloglarındaki Kitsu numarasını IMDb numarasına çevirmek için Stremio'nun Kitsu eklentisine sorar.
 * Altyazı siteleri IMDb numarasıyla arandığı için animelerde bu çeviri gerekir.
 * Sonuç: { movie, imdb, episodes: { "<kitsu bölümü>": [imdb numarası, sezon, bölüm] } }
 */
export async function kitsuMap(kitsuId) {
  const res = await fetch(`${KITSU}/meta/series/kitsu:${encodeURIComponent(kitsuId)}.json`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Kitsu ${res.status}`);
  const meta = (await res.json())?.meta || {};
  const imdb = /^tt\d+$/.test(meta.imdb_id || '') ? meta.imdb_id : null;
  const episodes = {};
  for (const video of meta.videos || []) {
    const episode = String(video?.id || '').split(':')[2];
    const videoImdb = /^tt\d+$/.test(video?.imdb_id || '') ? video.imdb_id : imdb;
    if (!episode || !videoImdb || !Number.isInteger(video.imdbSeason) || !Number.isInteger(video.imdbEpisode)) continue;
    episodes[episode] = [videoImdb, video.imdbSeason, video.imdbEpisode];
  }
  return { movie: meta.type === 'movie', imdb, episodes };
}

/** Adı verilen animenin Kitsu kayıtlarını arar. Sonuç: [{ id, imdb }] (yalnızca diziler). */
export async function kitsuSearch(name) {
  const res = await fetch(`${KITSU}/catalog/series/kitsu-anime-list/search=${encodeURIComponent(name)}.json`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Kitsu ${res.status}`);
  const results = [];
  for (const meta of (await res.json())?.metas || []) {
    const id = String(meta?.id || '').split(':')[1];
    if (meta?.type === 'series' && /^\d+$/.test(id || '') && /^tt\d+$/.test(meta.imdb_id || '')) results.push({ id, imdb: meta.imdb_id });
  }
  return results;
}
