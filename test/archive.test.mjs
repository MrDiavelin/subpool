// Arşiv açma (ZIP, RAR, iç içe) ve ASS → SRT çevirisini gerçek dosyalarla dener.
import './setup.mjs';
import { readFileSync } from 'node:fs';
const { pickSubtitle, UnsupportedArchiveError } = await import('../src/archive.js');
const { assToSrt, decodeSubtitle } = await import('../src/subtitle.js');
const dir = new URL('./fixtures/', import.meta.url);
const load = (name) => new Uint8Array(readFileSync(new URL(name, dir)));
const text = (bytes, lang = 'tr') => (bytes ? decodeSubtitle(bytes, lang) : null);

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'HATA'} ${name}${detail ? ' → ' + String(detail).slice(0, 300) : ''}`); };
const unsupported = async (fn) => { try { await fn(); return false; } catch (err) { return err instanceof UnsupportedArchiveError; } };

let out = text(await pickSubtitle(load('health.rar')));
check('RAR: tek dosya', out?.includes('rar ok'), out);

out = text(await pickSubtitle(load('pack.rar'), { season: 1, episode: 2 }));
check('RAR sezon paketi: 2. bölüm seçilir, Türkçe harfler düzelir', out?.includes('Bolum 02 şı'), out);
check('RAR sezon paketi: olmayan bölüm → null', (await pickSubtitle(load('pack.rar'), { season: 1, episode: 9 })) === null);

out = text(await pickSubtitle(load('nested.zip'), { season: 1, episode: 3 }));
check('ZIP içinde RAR: 3. bölüm', out?.includes('Bolum 03'), out);
out = text(await pickSubtitle(load('zipinzip.zip'), { season: 1, episode: 1 }));
check('ZIP içinde ZIP: 1. bölüm', out?.includes('Bolum 01'), out);
out = text(await pickSubtitle(load('plain.zip'), { season: 1, episode: 2 }));
check('düz ZIP hâlâ çalışır', out?.includes('Bolum 02'), out);

out = text(await pickSubtitle(load('mixed.zip')));
check('ZIP içinde hem .srt hem .ass: .srt seçilir', out?.includes('rar ok'), out);
out = text(await pickSubtitle(load('assonly.zip')));
check('ZIP içinde yalnızca .ass: o alınır', out?.includes('[Events]'), out?.slice(0, 40));

const srt = assToSrt(text(await pickSubtitle(load('anime.rar'))));
check('ASS → SRT: zaman ve italik', srt.includes('00:00:01,500 --> 00:00:03,000\n<i>Merhaba</i>, dünya\nIkinci satır'));
check('ASS → SRT: çizim ve karaoke atılır', !srt.includes('m 0 0') && !srt.includes('lala') && !srt.includes('{'));
check('ASS → SRT: metindeki virgül korunur, sıra numaralı', srt.includes('2\n00:00:06,000 --> 00:00:07,250\nEvet, tamam'));
const plainSrt = '1\n00:00:01,000 --> 00:00:02,000\nDialogue: bu bir SRT\n';
check('SRT metnine dokunulmaz', assToSrt(plainSrt) === plainSrt);

check('şifreli RAR → desteklenmiyor', await unsupported(() => pickSubtitle(load('enc.rar'))));
check('7z → desteklenmiyor', await unsupported(() => pickSubtitle(load('fake.7z'))));
check('ZIP içinde 7z → desteklenmiyor', await unsupported(() => pickSubtitle(load('has7z.zip'))));
check('bozuk RAR → desteklenmiyor', await unsupported(() => pickSubtitle(new Uint8Array([0x52, 0x61, 0x72, 0x21, 1, 2, 3, 4, 5, 6, 7, 8]))));
const raw = new TextEncoder().encode('1\n00:00:01,000 --> 00:00:02,000\ndüz\n');
check('arşiv olmayan dosya olduğu gibi döner', (await pickSubtitle(raw)) === raw);

// Aynı anda gelen RAR istekleri birbirine karışmamalı.
const many = await Promise.all([1, 2, 3, 1, 2, 3, 2, 1].map(async (e) => [e, text(await pickSubtitle(load(e % 2 ? 'pack.rar' : 'nested.zip'), { season: 1, episode: e }))]));
check('eşzamanlı 8 RAR isteği karışmaz', many.every(([e, s]) => s?.includes(`Bolum 0${e}`)));

console.log(fails ? `\n${fails} HATA` : '\nHepsi geçti');
process.exit(fails ? 1 : 0);
