// OpenSubtitles.com'un desteklediği diller (GET /infos/languages).
// [OpenSubtitles kodu, Stremio'nun kullandığı 3 harfli kod, İngilizce ad, yerel ad için BCP 47 etiketi]
const RAW = [
  ['ab', 'abk', 'Abkhazian'], ['af', 'afr', 'Afrikaans'], ['sq', 'alb', 'Albanian'], ['am', 'amh', 'Amharic'],
  ['ar', 'ara', 'Arabic'], ['an', 'arg', 'Aragonese'], ['hy', 'arm', 'Armenian'], ['as', 'asm', 'Assamese'],
  ['at', 'ast', 'Asturian', 'ast'], ['az-az', 'aze', 'Azerbaijani', 'az'], ['eu', 'baq', 'Basque'],
  ['be', 'bel', 'Belarusian'], ['bn', 'ben', 'Bengali'], ['bs', 'bos', 'Bosnian'], ['br', 'bre', 'Breton'],
  ['bg', 'bul', 'Bulgarian'], ['my', 'bur', 'Burmese'], ['ca', 'cat', 'Catalan'],
  ['ze', 'zhe', 'Chinese bilingual', null], ['zh-ca', 'zhc', 'Chinese (Cantonese)', 'yue'],
  ['zh-cn', 'chi', 'Chinese (simplified)', 'zh-Hans'], ['zh-tw', 'zht', 'Chinese (traditional)', 'zh-Hant'],
  ['hr', 'hrv', 'Croatian'], ['cs', 'cze', 'Czech'], ['da', 'dan', 'Danish'], ['pr', 'prs', 'Dari', 'prs'],
  ['nl', 'dut', 'Dutch'], ['en', 'eng', 'English'], ['eo', 'epo', 'Esperanto'], ['et', 'est', 'Estonian'],
  ['ex', 'ext', 'Extremaduran', 'ext'], ['fi', 'fin', 'Finnish'], ['fr', 'fre', 'French'], ['gd', 'gla', 'Gaelic'],
  ['gl', 'glg', 'Galician'], ['ka', 'geo', 'Georgian'], ['de', 'ger', 'German'], ['el', 'ell', 'Greek'],
  ['he', 'heb', 'Hebrew'], ['hi', 'hin', 'Hindi'], ['hu', 'hun', 'Hungarian'], ['is', 'ice', 'Icelandic'],
  ['ig', 'ibo', 'Igbo'], ['id', 'ind', 'Indonesian'], ['ia', 'ina', 'Interlingua'], ['ga', 'gle', 'Irish'],
  ['it', 'ita', 'Italian'], ['ja', 'jpn', 'Japanese'], ['kn', 'kan', 'Kannada'], ['kk', 'kaz', 'Kazakh'],
  ['km', 'khm', 'Khmer'], ['ko', 'kor', 'Korean'], ['ku', 'kur', 'Kurdish'], ['lv', 'lav', 'Latvian'],
  ['lt', 'lit', 'Lithuanian'], ['lb', 'ltz', 'Luxembourgish'], ['mk', 'mac', 'Macedonian'], ['ms', 'may', 'Malay'],
  ['ml', 'mal', 'Malayalam'], ['ma', 'mni', 'Manipuri', 'mni'], ['mr', 'mar', 'Marathi'], ['mn', 'mon', 'Mongolian'],
  ['me', 'mne', 'Montenegrin', 'cnr'], ['nv', 'nav', 'Navajo'], ['ne', 'nep', 'Nepali'], ['se', 'sme', 'Northern Sami'],
  ['no', 'nor', 'Norwegian'], ['oc', 'oci', 'Occitan'], ['or', 'ori', 'Odia'], ['fa', 'per', 'Persian'],
  ['pl', 'pol', 'Polish'], ['pt-pt', 'por', 'Portuguese', 'pt-PT'], ['pt-br', 'pob', 'Portuguese (BR)', 'pt-BR'],
  ['pm', 'pom', 'Portuguese (MZ)', 'pt-MZ'], ['ps', 'pus', 'Pushto'], ['ro', 'rum', 'Romanian'], ['ru', 'rus', 'Russian'],
  ['sx', 'sat', 'Santali', 'sat'], ['sr', 'scc', 'Serbian'], ['sd', 'snd', 'Sindhi'], ['si', 'sin', 'Sinhalese'],
  ['sk', 'slo', 'Slovak'], ['sl', 'slv', 'Slovenian'], ['so', 'som', 'Somali'],
  ['az-zb', 'azb', 'South Azerbaijani', 'azb'], ['es', 'spa', 'Spanish'], ['sp', 'spn', 'Spanish (EU)', 'es-ES'],
  ['ea', 'spl', 'Spanish (LA)', 'es-419'], ['sw', 'swa', 'Swahili'], ['sv', 'swe', 'Swedish'], ['sy', 'syr', 'Syriac', 'syr'],
  ['tl', 'tgl', 'Tagalog'], ['ta', 'tam', 'Tamil'], ['tt', 'tat', 'Tatar'], ['te', 'tel', 'Telugu'],
  ['tm-td', 'tet', 'Tetum', 'tet'], ['th', 'tha', 'Thai'], ['tp', 'tok', 'Toki Pona', 'tok'], ['tr', 'tur', 'Turkish'],
  ['tk', 'tuk', 'Turkmen'], ['uk', 'ukr', 'Ukrainian'], ['ur', 'urd', 'Urdu'], ['uz', 'uzb', 'Uzbek'],
  ['vi', 'vie', 'Vietnamese'], ['cy', 'wel', 'Welsh'],
];

export const LANGUAGES = RAW.map(([code, stremio, english, tag]) => ({
  code,
  stremio,
  english,
  tag: tag === undefined ? code : tag,
}));

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));
const BY_STREMIO = new Map(LANGUAGES.map((l) => [l.stremio, l.code]));

export function isLanguage(code) {
  return BY_CODE.has(code);
}

export function stremioLang(code) {
  return BY_CODE.get(code)?.stremio || code;
}

/** Stremio'nun 3 harfli kodunu (ör. 'tur', 'pob') OpenSubtitles koduna çevirir. */
export function fromStremioLang(stremio) {
  return BY_STREMIO.get(stremio) || null;
}

// SubDL'in desteklediği dil kodları (api.subdl.com, "languages" parametresi).
const SUBDL_CODES = new Set([
  'AR', 'DA', 'NL', 'EN', 'FA', 'FI', 'FR', 'ID', 'IT', 'NO', 'RO', 'ES', 'SV', 'VI', 'SQ', 'AZ', 'BE', 'BN', 'BS',
  'BG', 'MY', 'CA', 'ZH', 'HR', 'CS', 'EO', 'ET', 'KA', 'DE', 'EL', 'HE', 'HI', 'HU', 'IS', 'JA', 'KO', 'KU',
  'LV', 'LT', 'MK', 'MS', 'ML', 'PL', 'PT', 'RU', 'SR', 'SI', 'SK', 'SL', 'TL', 'TA', 'TE', 'TH', 'TR', 'UK',
  'UR', 'HY', 'KK', 'KM', 'KN', 'MN', 'EU', 'GL', 'GA', 'JV', 'SU', 'BR_PT', 'ZH_BG',
]);
const SUBDL_SPECIAL = { 'pt-pt': 'PT', 'pt-br': 'BR_PT', 'zh-cn': 'ZH', 'zh-tw': 'ZH_BG', 'az-az': 'AZ', sp: 'ES', ea: 'ES' };

/** OpenSubtitles kodunu SubDL koduna çevirir; SubDL'de yoksa null. */
export function subdlCode(code) {
  const value = SUBDL_SPECIAL[code] || code.toUpperCase();
  return SUBDL_CODES.has(value) ? value : null;
}

// SubSource dil adları çoğunlukla İngilizce adın küçük harflisi; farklı olanlar:
const SUBSOURCE_SPECIAL = {
  fa: 'farsi_persian', 'pt-br': 'brazilian_portuguese', 'pt-pt': 'portuguese', 'zh-cn': 'chinese_bg_code',
  'zh-tw': 'chinese_bg_code', 'zh-ca': 'chinese (cantonese)', ze: 'chinese bilingual', eo: 'espranto',
  se: 'northen sami', si: 'sinhala', 'az-az': 'azerbaijani', sp: 'spanish', ea: 'spanish', gl: 'gaelician',
  sx: 'santli', 'az-zb': null, pm: null, 'tm-td': 'tetum', tp: null,
};

/** OpenSubtitles kodunu SubSource dil adına çevirir; SubSource'ta yoksa null. */
export function subsourceName(code) {
  if (Object.hasOwn(SUBSOURCE_SPECIAL, code)) return SUBSOURCE_SPECIAL[code];
  return BY_CODE.get(code)?.english.toLowerCase() || null;
}

// Gestdown çoğu dili aynı kodla tanır; kodu farklı olanlar ve hiç tanımadıkları (null):
const GESTDOWN_SPECIAL = {
  'pt-pt': 'pt', 'zh-cn': 'zh-hans', 'zh-tw': 'zh-hant', 'az-az': 'az', sp: 'es-es', ea: 'es-419',
  ab: null, an: null, at: null, ze: null, 'zh-ca': null, pr: null, ex: null, ma: null, me: null, nv: null, pm: null,
  sx: null, 'az-zb': null, sy: null, tl: null, 'tm-td': null, tp: null,
};

/** OpenSubtitles kodunu Gestdown'ın dil koduna çevirir; Gestdown'da yoksa null. */
export function gestdownCode(code) {
  if (Object.hasOwn(GESTDOWN_SPECIAL, code)) return GESTDOWN_SPECIAL[code];
  return BY_CODE.has(code) ? code : null;
}

// Subs.ro yalnızca bu dilleri ayırır (aramadaki `language` değerleri); gerisi sitede "alt" (diğer) diye geçer.
const SUBSRO_CODES = {
  ro: 'ro', en: 'en', it: 'ita', fr: 'fra', de: 'ger', hu: 'ung', el: 'gre', 'pt-pt': 'por', 'pt-br': 'por', es: 'spa', sp: 'spa', ea: 'spa',
};

/** OpenSubtitles kodunu Subs.ro'nun dil koduna çevirir; Subs.ro'da ayrı bir dil değilse null. */
export function subsroCode(code) {
  return SUBSRO_CODES[code] || null;
}

// TheSubtitleDB dilleri iki harfli kodla tanır; çoğu aynıdır. Kodu farklı olanlar ve orada ayrı bir dil olmayanlar (null):
const TSDB_SPECIAL = {
  'pt-br': 'pb', 'pt-pt': 'pt', 'zh-cn': 'zh', 'zh-tw': 'zt', 'az-az': 'az', sp: 'es', ea: 'es',
  'zh-ca': null, 'az-zb': null, 'tm-td': null,
};

/** OpenSubtitles kodunu TheSubtitleDB'nin dil koduna çevirir; orada yoksa null. */
export function tsdbCode(code) {
  if (Object.hasOwn(TSDB_SPECIAL, code)) return TSDB_SPECIAL[code];
  return BY_CODE.has(code) ? code : null;
}

/** Dilin adını verilen arayüz dilinde döndürür (ör. 'de' + 'tr' -> 'Almanca'). */
export function languageName(code, uiLang) {
  const lang = BY_CODE.get(code);
  if (!lang) return code;
  if (lang.tag) {
    try {
      const name = new Intl.DisplayNames([uiLang], { type: 'language' }).of(lang.tag);
      if (name && name.toLowerCase() !== lang.tag.toLowerCase()) {
        return name.charAt(0).toLocaleUpperCase(uiLang) + name.slice(1);
      }
    } catch {
      // Bilinmeyen etiket: İngilizce ada düş.
    }
  }
  return lang.english;
}
