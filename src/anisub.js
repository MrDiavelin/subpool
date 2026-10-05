const ANISUB = 'https://anisub.co';

/** "Kaynaklarımı dene" için: AniSub'ın eklentisine ulaşılabiliyor mu (yalnızca manifest okunur). */
export async function anisubReachable(userAgent) {
  const res = await fetch(`${ANISUB}/manifest.json`, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw Object.assign(new Error(`AniSub ${res.status}`), { status: res.status });
  const manifest = await res.json();
  if (typeof manifest?.id !== 'string' || !manifest.resources?.some((r) => (r?.name || r) === 'subtitles')) {
    throw new Error('AniSub manifest beklenen biçimde değil');
  }
  return true;
}

/**
 * AniSub'ın kendi Stremio eklentisinin (anisub.co/manifest.json) bu video için sunduğu Türkçe anime altyazıları.
 * Eklenti hesap ya da anahtar istemez. Sadece eklentinin döndürdüğü anisub.co adresleri kullanılır; adres elle
 * üretilmez ve dosyaya sunucu dokunmaz: oynatıcı altyazıyı doğrudan AniSub'dan alır.
 * AniSub dili "Turkish" gibi adıyla, çeviren fansub'ın adını da "releaseInfo" alanında verir.
 * Sonuç: [{ id, url, lang, fansub }]
 */
export async function anisubSubtitles(type, id, userAgent) {
  const res = await fetch(`${ANISUB}/subtitles/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw Object.assign(new Error(`AniSub ${res.status}`), { status: res.status });
  const data = await res.json();
  return (data?.subtitles || [])
    .filter((s) => s?.id != null && /^https:\/\/anisub\.co\//.test(s.url || ''))
    .map((s) => ({
      id: String(s.id),
      url: s.url,
      lang: String(s.lang || ''),
      fansub: [s.releaseInfo, s.label, s.title].find((v) => typeof v === 'string' && v.trim())?.trim() || '',
    }));
}
