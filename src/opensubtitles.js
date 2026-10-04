const DEFAULT_BASE = 'https://api.opensubtitles.com/api/v1';
export const USER_AGENT = 'SubPool v3.0.0';
const MAX_PAGES = 10;

export class OpenSubtitlesError extends Error {
  constructor(status, data) {
    const detail = data?.message || data?.errors?.join(', ') || '';
    super(`OpenSubtitles ${status}${detail ? `: ${detail}` : ''}`);
    this.status = status;
    this.data = data;
  }
}

/**
 * OpenSubtitles API istemcisi. Arama sadece API anahtarıyla yapılır; indirme ise
 * her kullanıcının kendi oturumuyla (login() ile alınan token) yapılır.
 */
export class OpenSubtitlesClient {
  constructor({ apiKey }) {
    this.apiKey = apiKey;
  }

  async request(path, { method = 'GET', query, body, token, baseUrl = DEFAULT_BASE } = {}) {
    const url = new URL(baseUrl + path);
    // API, parametrelerin alfabetik sırada ve küçük harfle gönderilmesini istiyor (aksi halde yönlendirme yapıyor).
    if (query) {
      for (const key of Object.keys(query).sort()) {
        const value = query[key];
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value).toLowerCase());
        }
      }
    }

    const headers = {
      'Api-Key': this.apiKey,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    };
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 300) };
    }
    if (!res.ok) throw new OpenSubtitlesError(res.status, data);
    return data;
  }

  /** Kullanıcı adı/şifre ile giriş yapar ve indirme için oturum bilgisi döndürür. */
  async login(username, password) {
    let data;
    for (let attempt = 0; ; attempt++) {
      try {
        data = await this.request('/login', { method: 'POST', body: { username, password } });
        break;
      } catch (err) {
        // Giriş saniyede 1 istekle sınırlı; aynı anda gelen girişlerde kısa bekleyip tekrar dene.
        if (err.status !== 429 || attempt >= 2) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1100 * (attempt + 1)));
      }
    }
    return {
      token: data.token,
      baseUrl: data.base_url ? `https://${data.base_url}/api/v1` : DEFAULT_BASE,
      allowedDownloads: data.user?.allowed_downloads,
    };
  }

  /**
   * Bir film ya da bölüm için tüm sayfalardaki altyazıları döndürür.
   */
  async searchAll({ imdbId, season, episode, languages, moviehash }) {
    const imdbNumber = String(parseInt(imdbId.replace(/^tt/, ''), 10));
    const query = { languages: languages.join(','), moviehash };
    if (season !== undefined && episode !== undefined) {
      query.parent_imdb_id = imdbNumber;
      query.season_number = season;
      query.episode_number = episode;
    } else {
      query.imdb_id = imdbNumber;
    }

    const first = await this.request('/subtitles', { query });
    const results = [...(first.data || [])];
    const totalPages = Math.min(first.total_pages || 1, MAX_PAGES);
    if (totalPages > 1) {
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          this.request('/subtitles', { query: { ...query, page: i + 2 } }).catch((err) => {
            console.error(`[os] Sayfa ${i + 2} alınamadı: ${err.message}`);
            return { data: [] };
          }),
        ),
      );
      for (const page of pages) results.push(...(page.data || []));
    }
    return results;
  }

  download(fileId, session) {
    return this.request('/download', {
      method: 'POST',
      body: { file_id: Number(fileId), sub_format: 'srt' },
      token: session.token,
      baseUrl: session.baseUrl,
    });
  }
}
