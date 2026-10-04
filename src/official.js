const OFFICIAL = 'https://opensubtitles-v3.strem.io';

/**
 * Stremio'nun resmi OpenSubtitles eklentisinin bu video için sunduğu altyazılar.
 * Bu dosyalar Stremio'nun kendi sunucusundan gelir ve kimsenin indirme hakkını harcamaz.
 * Sadece resmi eklentinin döndürdüğü adresler kullanılır; adres asla elle üretilmez.
 * Sonuç: [{ id, url, lang (3 harfli Stremio kodu), release }]
 */
export async function officialSubtitles(type, id) {
  const res = await fetch(`${OFFICIAL}/subtitles/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Resmi eklenti ${res.status}`);
  const data = await res.json();
  return (data?.subtitles || [])
    .filter((s) => s?.id && /^https:\/\/subs\d*\.strem\.io\//.test(s.url || ''))
    .map((s) => ({
      id: String(s.id),
      url: s.url,
      lang: String(s.lang || ''),
      release: s.movieReleaseName || s.subtitleFileName || '',
    }));
}
