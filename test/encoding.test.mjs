// 3.12.1: yanlış kodlamayla sunulan (Latin-1 sanılıp UTF-8'e çevrilmiş) altyazıların düzeltilmesi.
import './setup.mjs';
const { decodeSubtitle } = await import('../src/subtitle.js');

let fails = 0;
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${ok ? '' : ` ${extra}`}`); };
const utf8 = (text) => new TextEncoder().encode(text);
const count = (re, text) => (text.match(re) || []).length;

// Bir kod sayfasının baytlarını üretir (Node'da eski kod sayfaları için kodlayıcı yoktur).
const encoder = (encoding) => {
  const map = new Map();
  for (let b = 0x80; b <= 0xff; b++) {
    const ch = new TextDecoder(encoding).decode(Uint8Array.of(b));
    if (ch !== '\ufffd' && !map.has(ch)) map.set(ch, b);
  }
  return (text) => Uint8Array.from([...text].map((ch) => (ch.charCodeAt(0) < 0x80 ? ch.charCodeAt(0) : map.get(ch) ?? 0x3f)));
};
// Eski kod sayfasındaki baytlar Batı Avrupa metni sanılıp UTF-8'e çevrilirse ortaya çıkan metin.
const broken = (text, encoding, western = 'windows-1252') => {
  const bytes = encoder(encoding)(text);
  return western === 'latin1' ? String.fromCharCode(...bytes) : new TextDecoder(western).decode(bytes);
};
const srt = (lines) => lines.map((line, i) => `${i + 1}\r\n00:00:${String(i).padStart(2, '0')},000 --> 00:00:${String(i).padStart(2, '0')},900\r\n${line}\r\n`).join('\r\n');

// 1) Düzgün dosyalara dokunulmaz.
const hebrew = srt(['שלום, מה שלומך היום?', 'אני גר ברחוב הראשי מספר 308', 'תודה רבה לך על הכול', 'Café déjà vu – נכון?']);
check('düzgün UTF-8 İbranice aynen kalır', decodeSubtitle(utf8(hebrew), 'he') === hebrew);
check('ham windows-1255 baytları eskisi gibi okunur', decodeSubtitle(encoder('windows-1255')(hebrew.replace('Café déjà vu – ', '')), 'he') === hebrew.replace('Café déjà vu – ', ''));
const french = srt(['Où étais-tu passé hier après-midi ?', 'J’étais à l’hôtel, près de la forêt.', 'Ça va être très difficile à gérer.', 'Élève modèle, il a été reçu premier.']);
for (const lang of ['he', 'ar', 'ru', 'el', 'fr']) check(`Fransızca metin "${lang}" diye gelse de aynen kalır`, decodeSubtitle(utf8(french), lang) === french);
const serbianLatin = srt(['Šta radiš ovde, čoveče?', 'Đavo će ga znati, žurim kući.', 'Ćuti i slušaj šta ti kažem.', 'Možemo li da krenemo već jednom?']);
check('Latin harfli Sırpça aynen kalır', decodeSubtitle(utf8(serbianLatin), 'sr') === serbianLatin);
const serbianBroken = broken(serbianLatin, 'windows-1250');
check('bozuk Latin harfli Sırpça Kiril harfine çevrilmez', decodeSubtitle(utf8(serbianBroken), 'sr') === serbianBroken && !/[\u0400-\u04ff]/.test(decodeSubtitle(utf8(serbianBroken), 'sr')));
const few = srt(['ùìåí']);
check('çok kısa metne dokunulmaz', decodeSubtitle(utf8(few), 'he') === few);
// Bozuk metnin arasında düzgün kalmış bir işaret (♪) varsa metin yine düzelir, işaret korunur.
const note = (lines) => srt(lines.map((line, i) => (i === 1 ? `${line} ♪` : line)));
const hebrewLines = ['שלום, מה שלומך היום?', 'אני גר ברחוב הראשי מספר 308', 'תודה רבה לך על הכול', '...לא יודע מה לומר (HBO)'];
check('bozuk İbranice metindeki ♪ işareti korunur', decodeSubtitle(utf8(note(hebrewLines.map((line) => broken(line, 'windows-1255')))), 'he') === note(hebrewLines));

// 2) Aynı bozulmanın başka dillerdeki hali.
const samples = {
  he: ['windows-1255', ['שלום, מה שלומך היום?', 'אני גר ברחוב הראשי מספר 308', 'תודה רבה לך על הכול', '...לא יודע מה לומר (HBO)']],
  ar: ['windows-1256', ['مرحبا، كيف حالك اليوم؟', 'أنا أسكن في الشارع الرئيسي رقم 308', 'شكرا جزيلا لك على كل شيء', '...لا أعرف ماذا أقول (HBO)']],
  fa: ['windows-1256', ['سلام، حال شما چطور است؟', 'من در خيابان اصلي زندگي مي‌کنم', 'از همه چيز بسيار سپاسگزارم', '...نمي‌دانم چه بگويم (HBO)']],
  ru: ['windows-1251', ['Привет, как у тебя сегодня дела?', 'Я живу на главной улице, дом 308', 'Большое спасибо тебе за всё', '...не знаю, что сказать (HBO)']],
  uk: ['windows-1251', ['Привіт, як у тебе сьогодні справи?', 'Я живу на головній вулиці, їду додому', 'Щиро дякую тобі за все', '...не знаю, що сказати (HBO)']],
  bg: ['windows-1251', ['Здравей, как си днес, приятелю?', 'Живея на главната улица номер 308', 'Много ти благодаря за всичко', '...не знам какво да кажа (HBO)']],
  sr: ['windows-1251', ['Здраво, како си данас, пријатељу?', 'Живим у главној улици, број 308', 'Хвала ти много на свему, љубави', '...не знам шта да кажем (HBO)']],
  mk: ['windows-1251', ['Здраво, како си денес, пријателе?', 'Живеам на главната улица број 308', 'Ти благодарам многу за сѐ'.replace('ѐ', 'е'), '...не знам што да кажам (HBO)']],
  el: ['windows-1253', ['Γεια σου, τι κάνεις σήμερα;', 'Μένω στον κεντρικό δρόμο, αριθμός 308', 'Σε ευχαριστώ πολύ για όλα', '...δεν ξέρω τι να πω (HBO)']],
};
for (const [lang, [encoding, lines]] of Object.entries(samples)) {
  const good = srt(lines);
  // Kod sayfasında bulunmayan karakter varsa örnek hatalıdır.
  const fits = new TextDecoder(encoding).decode(encoder(encoding)(good)) === good;
  for (const western of ['windows-1252', 'latin1']) {
    const bad = broken(good, encoding, western);
    const out = decodeSubtitle(utf8(bad), lang);
    check(`${lang}: ${encoding} → ${western} bozulması düzelir`, fits && bad !== good && out === good, fits ? JSON.stringify(out.slice(36, 80)) : 'örnek kod sayfasına sığmıyor');
  }
  check(`${lang}: düzgün metin aynen kalır`, decodeSubtitle(utf8(good), lang) === good);
}

// 3) Türkçe düzeltmesi yerinde.
check('Türkçe bozuk harf düzeltmesi çalışıyor', decodeSubtitle(utf8('Þimdi ýþýk yaðýyor'), 'tr') === 'Şimdi ışık yağıyor');
process.exit(fails ? 1 : 0);
