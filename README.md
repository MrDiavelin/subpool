# SubPool by Diavelin – Stremio altyazı eklentisi

OpenSubtitles, SubDL, SubSource, AltyazıDB, Gestdown ve AniSub'daki altyazıları Stremio'da **tek listede** toplar ve
her altyazının yanında **ücretsiz mi, yoksa senin indirme hakkından mı düşeceğini** yazar.

- Her dilde önce ücretsiz altyazıları, sonra hak harcayanları gösterir; her grubun içinde videonun dosya adına/hash'ine
  en uygun olan üstte, makine çevirileri ve yalnızca yabancı konuşmaları içeren altyazılar grubun sonunda durur.
- Videonun dosyasıyla eşleşen ya da sürüm adı uyan altyazıları etikette belirtir.
- İstenirse ilk iki dilin altyazısını tek altyazıda birleştirir (çift dilli altyazı); iki altyazı arasındaki sabit
  zaman farkını ve kare hızı farkını düzeltir.
- İstenirse seçilen bir kaynağın ücretsiz altyazılarını her dilde öne alır.
- Harici oynatıcı kullananlar için ayar sayfasında altyazı arayıp dosya olarak (istenirse zamanı kaydırarak) indirme
  bölümü vardır.
- Anime kataloglarındaki yapımlarda da çalışır (Kitsu, MyAnimeList, AniList ve AniDB numaraları); ASS/SSA biçimindeki
  altyazıları SRT'ye çevirir, istenirse stiliyle olduğu gibi gönderir (deneysel).
- Türkçe karakter sorunlarını düzeltir (windows-1254 kodlama, `ý/þ/ð` → `ı/ş/ğ`).
- 105 altyazı dili; ayar sayfası 11 dilde (TR, EN, ES, PT, FR, DE, AR, RU, ZH, JA, KO).
- **Her kullanıcı kendi hesabı / anahtarıyla** çalışır; sunucu sahibinin hakkı hiçbir zaman kullanılmaz.
- Eklenti sadece kullanıcının bağladığı kaynaklarla çalışır. Hiç kaynak bağlanmamışsa uyarı gösterir.

Canlı adres: **https://subpool-diavelin.vercel.app**

> **Kaynağı görülebilir, açık kaynak değil.** Kod, eklentinin ne yaptığını herkes inceleyebilsin diye yayımlanır.
> Kopyalamak, değiştirmek, dağıtmak ya da kendi sunucunda yayımlamak izne bağlıdır; dışarıdan katkı (pull request)
> kabul edilmez. Ayrıntı: [LICENSE](LICENSE).
>
> **Source-available, not open source.** The code is published for inspection only. Copying, modifying,
> redistributing or hosting it requires written permission, and pull requests are not accepted. See [LICENSE](LICENSE).

## Etiketler

| Etiket | Anlamı |
|---|---|
| `[OpenSubtitles] ✓ Ücretsiz · Resmi` | Stremio'nun resmi OpenSubtitles sunucusunda zaten var; kimsenin hakkı harcanmaz. |
| `[OpenSubtitles] ✓ Ücretsiz · Havuz` | Bu eklentiyi kullanan biri daha önce indirdi; 30 gün ortak havuzda, herkese ücretsiz. |
| `[OpenSubtitles] 1 hak harcar` | Sadece OpenSubtitles.com'da var; açınca kullanıcının günlük hakkından 1 düşer, sonra 30 gün havuza girer. |
| `[SubDL] ✓ Ücretsiz` / `[SubSource] ✓ Ücretsiz` | Kullanıcının kendi ücretsiz anahtarıyla gelir. |
| `[AltyazıDB] ✓ Ücretsiz` | Kullanıcının kendi AltyazıDB API anahtarıyla gelir (yalnızca Türkçe ve İngilizce); OpenSubtitles hakkı harcamaz. |
| `[Gestdown] ✓ Ücretsiz` | Gestdown servisinden gelir (Addic7ed altyazıları); anahtar gerektirmez, OpenSubtitles hakkı harcamaz. Yalnızca dizilerde. |
| `[AniSub] ✓ Ücretsiz` | AniSub'ın kendi Stremio eklentisinden gelen Türkçe anime altyazısıdır; anahtar gerektirmez, OpenSubtitles hakkı harcamaz. Oynatıcı dosyayı doğrudan AniSub'dan açar. Etikette çeviren fansub'ın adı yazar: `[AniSub] ✓ Ücretsiz \| Çeviri: HolySubs`. |
| `[Çift dilli] ✓ Ücretsiz · Türkçe + İngilizce` | İlk iki dilin altyazısı tek altyazıda birleştirilmiştir (üstte birinci dil, altında italik olarak ikinci dil); hak harcamaz. |

Etiketin sonundaki `· HI`, altyazının işitme engelliler için hazırlandığını (sesler ve müzik de yazılı) gösterir.

Etikette şu notlar da yazabilir:

| Not | Anlamı |
|---|---|
| `· Tam dosya eşleşmesi` | OpenSubtitles, altyazının oynattığın video dosyasının kendisiyle (dosyanın hash'iyle) eşleştiğini bildirdi. Oynatıcı dosyanın hash'ini gönderirse görünür. |
| `· Sürüm adı uyuyor` | "Akıllı sürüm eşleştirme" açıkken ve oynatıcı dosya adını gönderdiğinde: altyazının sürüm adı, videonun dosya adıyla aynı sürüm grubunu, aynı kaynağı (BluRay, WEB…) ve aynı kurguyu (Extended, Director's Cut…) gösteriyor; sezon/bölüm numarası da çelişmiyor. Bir puana değil bu kurala bağlıdır; grubu ya da kaynağı okunamayan adlarda yazmaz. |
| `· Yabancı konuşmalar` | OpenSubtitles bu altyazıyı "yalnızca yabancı dildeki konuşmalar" olarak işaretlemiş; filmin tamamını çevirmez. Bu altyazılar kendi grubunun (ücretsiz ya da hak harcayan) sonunda durur ve çift dilli altyazıda kullanılmaz. |

Bir satırda en fazla bir uyum notu olur: dosya eşleşmesi varsa yalnızca o yazar. Notlar kaynağın verdiği bilgiye ve
dosya adına dayanır; altyazının senkron olacağının garantisi değildir.

"1 hak harcar" etiketinde OpenSubtitles hesabının o gün kalan indirme hakkı da yazabilir:
`[OpenSubtitles] 1 hak harcar · bugün 17 kaldı`. Bu sayı yalnızca sunucu onu zaten biliyorsa gösterilir: son
indirmeden, **Kaynaklarımı dene** butonundan ya da hesabın hâlâ açık olan oturumundan. Sırf bu sayı için hesaba giriş
yapılmaz; bilinmiyorsa etiket sayısız görünür. Sunucu ve oynatıcı sayıyı birkaç dakika sakladığı için gerçek değerin
biraz gerisinde kalabilir.

Ücretsiz OpenSubtitles hesabı günde 20, VIP hesap günde 1000 indirme hakkı verir. Liste görmek hak harcamaz.

## Kullanım

1. Ayar sayfasını aç ve en az bir kaynak bağla: OpenSubtitles hesabı, SubDL anahtarı, SubSource anahtarı ve/veya AltyazıDB anahtarı.
   Hesap ya da anahtar istemeyen Gestdown (yalnızca diziler) ve AniSub (yalnızca Türkçe anime altyazısı) da tek başına
   ya da diğerlerinin yanında açılabilir. AltyazıDB yalnızca Türkçe ve İngilizce altyazı verdiği için kartı, bağlı
   değilse yalnızca sayfa dili Türkçe ya da İngilizceyken görünür.
   OpenSubtitles için **opensubtitles.com** hesabının kullanıcı adı (e-posta değil) ve şifresi gerekir. opensubtitles.org
   hesabı ayrıdır ve burada geçmez; yalnızca .org'da hesabı olanlar onu https://www.opensubtitles.com/en/users/import
   adresinden .com'a aktarabilir.
2. Altyazı dillerini seç ve önem sırasına diz.
3. İstersen **Liste ayarları**nı değiştir (aşağıya bak).
4. **Stremio'ya yükle**'ye bas (ya da adresi kopyalayıp Stremio'da Eklentiler sayfasındaki arama kutusuna yapıştır).

### Liste ayarları

- **Akıllı sürüm eşleştirme** (varsayılan: açık): Videonun dosya adı ile altyazının sürüm adı parçalarına ayrılır
  (sürüm grubu, BluRay/WEB/HDTV kaynağı, uzatılmış kurgu, çözünürlük) ve aynı sürüm için hazırlanmış altyazılar üste taşınır.
  Ücretsiz altyazılar yine hep hak harcayanların üstünde durur. Kapatılırsa yalnızca ad benzerliğine bakılır
  (adrese `match=0` eklenir). Oynatıcı dosya adı göndermiyorsa etkisi olmaz.
- **Her dilde en fazla altyazı** (varsayılan: sınırsız): Liste uzun geliyorsa 5, 10, 15 ya da 20 ile sınırlanabilir
  (adrese `max=10` gibi eklenir). Sınır konduğunda da altyazısı bulunan her siteden en az biri listede kalır.
- **Sonraki dilleri yalnızca yedek olarak kullan** (varsayılan: kapalı): Açıkken listede yalnızca sıradaki ilk dilin
  altyazıları gösterilir; o dilde hiç altyazı yoksa bir sonraki dile geçilir (adrese `fb=1` eklenir).
- **Makine çevirilerini gizle** (varsayılan: kapalı): Makine ya da yapay zekâ çevirisi olarak işaretlenmiş altyazılar
  listeye alınmaz (adrese `mt=0` eklenir). Bu işareti yalnızca OpenSubtitles ve AltyazıDB verir.
- **İşitme engelli (HI) altyazılar** (varsayılan: göster): "Sona taşı" (`hi=last`) HI altyazıları her dilde diğerlerinin
  altına alır, "Gizle" (`hi=hide`) listeden çıkarır. Ücretsiz altyazılar yine hep hak harcayanların üstünde durur.
  Kaynağın HI olarak işaretlemediği altyazılar ayırt edilemez.
- **Ses açıklamalarını temizle** (varsayılan: kapalı): Altyazı açılırken `[kapı çarpar]` ve `(iç çeker)` gibi açıklamalar,
  ♪ işaretli şarkı satırları ve `JOHN:` gibi büyük harfle yazılmış konuşmacı adları çıkarılır (adrese `clean=1` eklenir).
  Parantez içindeki çevirmen notları da silinir. "Resmi" etiketli altyazılar Stremio'nun sunucusundan geldiği için
  onlara dokunulamaz.
- **ASS/SSA stilini koru (Deneysel)** (varsayılan: kapalı): Açıkken ASS/SSA biçimindeki altyazılar SRT'ye çevrilmeden,
  kendi yazı tipi, renk ve konum bilgisiyle gönderilir (adrese `ass=1` eklenir). Stilin görünmesi oynatıcıya ve
  oynatıcının kendi ASS ayarına bağlıdır; altyazı görünmez ya da bozuk görünürse ayarı kapatmak yeterlidir.
  - Bu dosyalarda ses açıklamaları temizlenmez; SRT dosyalarında temizlik aynen sürer.
  - Çift dilli altyazılar ve "Altyazı ara ve indir" bölümü yine SRT kullanır.
  - OpenSubtitles altyazıları her zaman SRT olarak gelir. Bir arşivde hem `.srt` hem `.ass` dosyası varsa `.srt` seçilir.
    AniSub altyazıları doğrudan AniSub'dan açıldığı için bu ayardan etkilenmez.
  - 3 MB'tan büyük ASS/SSA dosyaları SRT'ye çevrilerek verilir.
  - Oynatıcıyı denemek için: adreste `ass=1` yerine `ass=test` yazılırsa listenin başına "ASS test (.srt)" ve
    "ASS test (.ass)" adlı iki deneme altyazısı eklenir. İkisi de aynı dosyadır: üstte kırmızı, ortada sarı ve eğik, sol
    altta mavi ve büyük, altta beyaz (bir sözcüğü yeşil) dört satır. Stil uygulanmıyorsa hepsi aynı renkte çıkar.
- **Çift dilli altyazı** (varsayılan: kapalı): Açıkken listenin başına, sıradaki ilk iki dili aynı anda gösteren en fazla
  3 altyazı eklenir: üstte birinci dil, altında italik olarak ikinci dil (adrese `dual=1` eklenir). En az iki dil
  seçilmiş olmalıdır.
  - Yalnızca eklentinin kendi sunduğu ve hak harcamayan altyazılardan üretilir: SubDL, SubSource, AltyazıDB, Gestdown ve
    Havuz. "Resmi" altyazılar Stremio'nun sunucusundan geldiği için, "1 hak harcar" altyazılar ise haberin olmadan hak
    harcanmasın diye birleştirilmez. AniSub altyazıları da doğrudan AniSub'dan açıldığı için birleştirilmez. Yalnızca OpenSubtitles hesabı bağlıysa çoğu zaman çift dilli altyazı çıkmaz.
  - Birinci dilin en uygun altyazıları, ikinci dilde sürüm adı en çok benzeyen altyazıyla eşlenir.
  - İkinci dilin altyazısı baştan sona aynı süre kadar erken ya da geç kalıyorsa (en fazla 15 saniye) bu fark ölçülür ve
    ikinci dil ona göre kaydırılır; birinci dilin zamanlarına dokunulmaz.
  - İkinci dilin altyazısı başka kare hızındaki bir sürüm için hazırlanmışsa (23,976, 24 ve 25 kare/saniye arasında) fark
    film boyunca giderek büyür; bu da ölçülüp düzeltilir. Bunların dışındaki, bölüm boyunca değişen farklar (örneğin
    reklam arası kesilmiş bir sürüm) düzeltilmez ve satırlar birbirine denk gelmeyebilir.
  - İkinci dildeki altyazı alınamazsa birinci dil tek başına gösterilir.
- **Öne alınacak kaynak** (varsayılan: yok): Seçilen kaynağın (OpenSubtitles, SubDL, SubSource, AltyazıDB, Gestdown
  ya da AniSub) altyazıları her dilde diğer ücretsiz altyazıların üstüne alınır (adrese `pri=adb` gibi eklenir). O kaynağın
  kendi altyazıları yine videoya uygunluğa göre sıralanır. "1 hak harcar" altyazılar her zaman en altta, çift dilli
  altyazılar her zaman en üstte kalır; "Sona taşı" seçiliyse HI altyazılar öne alınan kaynaktan olsalar da HI
  olmayanların altında durur.

Bu ayarların hepsi isteğe bağlıdır; hiçbiri açılmazsa liste önceki sürümlerdeki gibi çalışır ve eski eklenti adresleri
geçerli kalır.

### Gestdown

[Gestdown](https://api.gestdown.info), Addic7ed'deki dizi altyazılarını sunan, hesap ve anahtar istemeyen bir servistir.
Ayar sayfasındaki **Gestdown** kartının düğmesiyle açılır (adrese `gd=1` eklenir); varsayılan olarak kapalıdır.

- Yalnızca dizilerde çalışır; filmlerde altyazı getirmez.
- Başka hiçbir kaynak bağlamadan, tek başına da kullanılabilir.
- Eklentideki 105 dilin 88'inde arama yapabilir; tanımadığı dillerde aranmaz.
- Gestdown diziyi o sırada yeniliyorsa o an altyazı vermez; liste onsuz gösterilir ve oynatıcıya listeyi yalnızca
  1 dakika saklaması söylenir.

### AniSub

[AniSub](https://anisub.co), Türkçe anime altyazılarının paylaşıldığı bir sitedir ve hesap ya da anahtar istemeyen kendi
Stremio eklentisini sunar. SubPool bu eklentiye, Stremio'nun resmi OpenSubtitles eklentisine bağlandığı gibi bağlanır.
Ayar sayfasındaki **AniSub** kartının düğmesiyle açılır (adrese `as=1` eklenir); varsayılan olarak kapalıdır. Yalnızca Türkçe altyazı verdiği için bu kart ayar sayfasında yalnızca sayfa dili Türkçeyken görünür; sayfa başka bir dildeyken AniSub adrese yazılmaz.

- Yalnızca Türkçe seçiliyse kullanılır.
- AniSub'ın sitesindeki açıklamaya göre eklentisi yalnızca AniSub'ın bir IMDb numarasıyla eşleştirdiği animelerde
  altyazı bulur.
- Başka hiçbir kaynak bağlamadan, tek başına da kullanılabilir.
- AniSub çeviren fansub'ın adını bildirirse etikette "Çeviri: …" olarak gösterilir.
- AniSub'ın eklentisinin verdiği altyazı adresleri olduğu gibi listeye konur; oynatıcı dosyayı doğrudan AniSub'dan açar.
  Dosya SubPool'un sunucusundan geçmediği için bu altyazılarda ses açıklaması temizliği yapılmaz, çift dilli altyazıda
  kullanılmaz ve **Altyazı ara ve indir** bölümünde gösterilmez.

### Kaynaklarımı dene

Ayar sayfasındaki **Kaynaklarımı dene** butonu, bağladığın her kaynakta örnek bir filmi (The Shawshank Redemption)
seçtiğin dillerde arar ve kaynağın çalışıp çalışmadığını, kaç altyazı bulunduğunu yazar. Yalnızca arama yapılır;
altyazı indirilmez, indirme hakkı harcanmaz. OpenSubtitles hesabı bağlıysa deneme sırasında hesaba giriş yapılır ve
OpenSubtitles bildirirse o gün kalan indirme hakkı da gösterilir. Gestdown açıksa, yalnızca dizi barındırdığı için orada
film yerine örnek bir dizi bölümü (Breaking Bad, 1. sezon 1. bölüm) aranır. AniSub açıksa arama yapılmaz; yalnızca
AniSub'ın eklentisine ulaşılıp ulaşılamadığına bakılır. Her satırın sonunda o kaynağın yanıt süresi milisaniye olarak
yazar (ör. `(420 ms)`); sonucu önbellekte duran bir arama çok kısa sürede döner.

Şifre ve anahtarlar, sana özel eklenti adresinin içinde sunucu anahtarıyla şifrelenmiş olarak durur; sunucuda saklanmaz. Ayar sayfası, bilgileri yeniden girmemen için bu şifreli adresi kullandığın tarayıcıda da hatırlar; "Bilgilerimi bu tarayıcıdan sil" butonuyla silinir.
Yine de bu adresi kimseyle paylaşma: adresi alan, senin indirme hakkını kullanabilir.

### Altyazı ara ve indir

Harici bir oynatıcı kullananlar altyazıyı ayar sayfasındaki **Altyazı ara ve indir** sekmesinden dosya olarak indirip
oynatıcıya kendileri ekleyebilir.

- Film ya da dizi adı (ya da IMDb numarası veya adresi) yazılır; dizilerde sezon ve bölüm seçilir.
- Liste, kurulum adresindekiyle aynı ayarlarla gelir: bağlı kaynaklar, seçili diller, liste ayarları ve açıksa çift
  dilli altyazılar.
- "Resmi" altyazılar Stremio'nun sunucusundan geldiği için burada listelenmez.
- "1 hak harcar" etiketli bir altyazıyı indirmek, OpenSubtitles hesabından 1 indirme hakkı harcar.
- Dosya `Ad S01E02.tur.srt` biçiminde kaydedilir (çift dilli altyazılarda `Ad S01E02.dual.tur.srt`).
- Altyazı alınamazsa (örneğin indirme hakkı bittiyse) dosya kaydedilmez; nedeni sayfada yazar.
- **İndirirken kaydır (saniye):** Altyazı konuşmadan önce görünüyorsa artı (ör. `1.5`), sonra görünüyorsa eksi
  (ör. `-1.5`) bir değer yazılır; indirilen dosyadaki bütün zamanlar o kadar kaydırılır (en fazla 600 saniye).
  Kaydırma tarayıcıda, yalnızca indirilen dosyaya yapılır; Stremio ve Nuvio'daki liste ve sunucudaki dosya değişmez.
  Geri kaydırınca başı 0'ın altına düşen satır 0. saniyeden başlar, tamamen 0'ın altına düşen satır dosyadan çıkarılır.

### Nuvio

Eklenti Nuvio'da da çalışır: adresi kopyalayıp Nuvio'nun Eklentiler bölümüne yapıştır.

- Nuvio TV, her altyazının altında etiketi ve sürüm adını gösterir.
- Nuvio mobil ve masaüstü yalnızca dili ve eklenti adını gösterir; etiket görünmez. Bu yüzden oynatıcı dosya adı
  göndermediğinde de ücretsiz altyazılar her dilde hak harcayanların üstünde durur.
- Aynı hesapla 5 saniye içinde en fazla 1 hak harcanır. Nuvio video indirirken listedeki bütün altyazıları
  kendiliğinden çektiği için bu sınır günlük hakkın bir anda bitmesini önler.

## Nasıl çalışır?

- **Resmi eşleştirme:** OpenSubtitles.com aramasındaki `legacy_subtitle_id`, resmi Stremio eklentisinin
  (`opensubtitles-v3.strem.io`) altyazı kimliğiyle aynıdır. Eşleşen altyazılar için resmi eklentinin döndürdüğü adres
  aynen kullanılır (adres asla elle üretilmez). Resmi eklentide olup aramada çıkmayanlar da listeye eklenir.
- **Havuz:** OpenSubtitles'tan indirilen her altyazı 30 gün önbellekte tutulur ve o başlık için havuza yazılır.
- **SubDL / SubSource:** Arşivler (ZIP, RAR ve bir arşivin içindeki arşiv) sunucuda açılır; sezon paketlerinde doğru
  bölümün dosyası seçilir. 7z ve şifreli arşivler desteklenmez. RAR için `node-unrar-js` kullanılır.
- **ASS/SSA:** Bu biçimdeki altyazılar SRT'ye çevrilir; italik korunur, renk/konum süslemeleri, çizimler ve karaoke
  efektleri atılır. "ASS/SSA stilini koru" açıksa, `[Script Info]` bölümüyle başlayan ve konuşma satırı içeren dosyalar
  çevrilmeden, `text/x-ssa` içerik türüyle verilir; dosya adresi yine `.srt` ile biter. Önbellekte dosyanın özgün hâli
  durur, SRT'ye çevirme dosya istenirken yapılır; bu yüzden ayarı açıp kapatmak dosyayı yeniden indirtmez.
- **Anime numaraları:** `kitsu:7442:3`, `mal:16498:3`, `anilist:16498:3` ve `anidb:9541:3` gibi numaralar Stremio'nun
  Kitsu eklentisine (`anime-kitsu.strem.fun`) sorularak IMDb numarasına ve sezon/bölüme çevrilir; çeviri 24 saat
  saklanır. Karşılığı olmayan yapımlar için liste boş döner.
- **Anime bölüm numaraları:** Anime altyazıları çoğu zaman baştan sayılan numarayla yüklenir ("Hunter x Hunter - 75"),
  oynatıcı ise sezon/bölüm sorar (2. sezon 17. bölüm). Animelerde 2. ve sonraki sezonlar için bölüm iki numarayla da
  aranır; paketlerde "Ad - 05" gibi yazılmış dosyalar da tanınır. Sezon uzunlukları Cinemeta'dan (`v3-cinemeta.strem.io`) alınır.
- **Süre sınırı:** Bir kaynak 10 saniyede yanıt vermezse liste onu beklemeden gösterilir ve oynatıcıya bu listeyi yalnızca
  1 dakika saklaması söylenir; geciken kaynağın sonucu bir sonraki açılışta gelir.
- **Durum:** `/api/health` sunucunun sürümünü ve RAR açıcının çalışıp çalışmadığını gösterir.
- **Ses açıklaması temizliği:** Altyazı dosyası kullanıcıya gönderilirken yapılır ([src/subtitle.js](src/subtitle.js));
  önbellekte ve havuzda altyazının özgün hâli durur, yani ayarı açmayanlar dosyayı olduğu gibi alır.
- **Kaynak denemesi:** `/api/test` yalnızca arama yapar; aynı adresten 10 dakikada en fazla 20 deneme kabul edilir.
- **AltyazıDB:** Sitenin resmi API'si (`altyazidb.com/api-docs.php`) kullanılır. Arşivleri site kendisi açıp düz altyazı
  olarak verir; sezon paketlerinden istenen bölüm de site tarafında ayıklanır.
- **Gestdown:** Servisin API'si (`api.gestdown.info`) kullanılır ([src/gestdown.js](src/gestdown.js)). Gestdown dizileri
  TheTVDB numarasıyla tanır; bu numara Cinemeta'dan (`v3-cinemeta.strem.io`) alınır. Altyazılar düz SRT olarak gelir.
- **AniSub:** AniSub'ın kendi Stremio eklentisinin altyazı adresi (`anisub.co/subtitles/...`) kullanılır
  ([src/anisub.js](src/anisub.js)). Yalnızca `https://anisub.co/` ile başlayan altyazı adresleri listeye alınır; adresler
  elle üretilmez ve altyazı dosyalarına sunucu hiç dokunmaz. Sonuçlar 6 saat önbellekte tutulur. İsteklerde eklentinin
  adı, bu deponun adresi ve iletişim adresi yazar.
- **Çift dilli altyazı:** Birleşik altyazının adresi iki altyazının yolunu taşır; dosya açılırken ikisi de alınır ve
  zamanları örtüşen satırlar birleştirilir ([src/subtitle.js](src/subtitle.js)). Birleştirmeden önce iki altyazı
  arasındaki sabit zaman farkı aranır; satırların en az dörtte biri aynı farkı gösteriyorsa ikinci dil o kadar
  kaydırılır. Kare hızı farkı için ikinci dil 23,976 / 24 / 25 oranlarıyla ölçeklenmiş hâlleriyle de denenir; bir oran,
  satırların en az dörtte birini tutturuyor ve ölçeklenmemiş hâlin en az 1,5 katı satırı denk getiriyorsa kullanılır.
  OpenSubtitles dosyaları bu sırada yalnızca önbellekten okunur; çift dilli altyazı hiçbir durumda indirme hakkı harcamaz.
- **Kalan hak:** Listede gösterilen kalan indirme hakkı, son indirmede ya da kaynak denemesinde OpenSubtitles'ın verdiği
  sayıdır. Bilinmiyorsa ve hesabın oturumu hâlâ açıksa OpenSubtitles'ın hesap bilgisi adresine (`/infos/user`, hak
  harcamaz) sorulur; oturum yoksa sorulmaz ve giriş yapılmaz. Sayı 3 saniyede gelmezse liste onsuz gösterilir. Sayı yazan
  liste için oynatıcıya listeyi en fazla 5 dakika saklaması söylenir.

## Bilgilerin nereye gidiyor?

Kodu incelerken bakılacak yerler:

- **Şifre ve anahtarlar sunucuda saklanmaz.** Ayar sayfasında girilen bilgiler AES-256-GCM ile şifrelenip sana özel
  eklenti adresinin içine yazılır ([src/crypto.js](src/crypto.js)). Sunucu bu bilgiyi yalnızca istek geldiği anda açar.
- **Bilgiler yalnızca ait oldukları siteye gönderilir:** OpenSubtitles hesabı OpenSubtitles'a
  ([src/opensubtitles.js](src/opensubtitles.js)), SubDL anahtarı SubDL'e ([src/subdl.js](src/subdl.js)), SubSource anahtarı
  SubSource'a ([src/subsource.js](src/subsource.js)), AltyazıDB anahtarı AltyazıDB'ye ([src/altyazidb.js](src/altyazidb.js)).
- **Gestdown'a hesap bilgisi gitmez.** Gestdown açıksa sunucu, izlenen dizinin TheTVDB numarasını, sezon/bölüm numarasını ve
  seçilen dilleri `api.gestdown.info` adresine sorar ([src/gestdown.js](src/gestdown.js)); kullanıcı adı, şifre ya da anahtar
  gönderilmez. İstek kullanıcının cihazından değil, eklentinin sunucusundan çıkar.
- **AniSub'a hesap bilgisi gitmez.** AniSub açıksa sunucu, izlenen yapımın IMDb numarasını (dizide sezon/bölüm numarasıyla
  birlikte) AniSub'ın eklentisine sorar ([src/anisub.js](src/anisub.js)); kullanıcı adı, şifre ya da anahtar gönderilmez.
  Bir AniSub altyazısı seçildiğinde ise dosyayı oynatıcı doğrudan `anisub.co` adresinden indirir; bu istek kullanıcının
  cihazından çıkar.
- **Ayar sayfası açılırken başka bir sunucuya istek atılmaz.** Yazı tipleri ve logo eklentinin kendi sunucusundan gelir
  ([src/fonts.js](src/fonts.js), [src/logo.js](src/logo.js)). Sayfadaki "Kahve ısmarla" bağlantısı yalnızca tıklanınca
  `buymeacoffee.com` adresini açar.
- **Altyazı arama sekmesi:** Film ve dizi araması ile dizinin sezon listesi tarayıcıdan doğrudan Stremio'nun katalog
  servisine (`v3-cinemeta.strem.io`) sorulur ([src/configure.js](src/configure.js)); bu isteklerde yalnızca aranan ad ya
  da yapım numarası gider. Altyazı listesi ve dosyalar, kurulum adresindeki ayarlarla eklentinin kendi sunucusundan alınır.
- **Sunucu sahibinin indirme hakkı kullanılmaz.** Sunucudaki `OS_API_KEY` yalnızca uygulamayı OpenSubtitles'a tanıtır;
  indirmeler her zaman kullanıcının kendi hesabıyla yapılır ve hak o hesaptan düşer. Hesap bağlanmamışsa indirme yapılmaz.
- **Önbellekte duranlar** ([src/store.js](src/store.js)): arama sonuçları, indirilen altyazı dosyaları, havuz listesi ve
  OpenSubtitles'ın verdiği oturum anahtarı (her istekte yeniden giriş yapmamak için; şifrelenmiş olarak ve süreli tutulur).
  Kalan indirme hakkı sayısı da kullanıcı adının özeti (SHA-256) ile en fazla 5 dakika sunucunun belleğinde tutulur.
  Kullanıcı adı ve şifre önbelleğe yazılmaz.
- **Sunucu günlüğü:** Hangi yapım için liste istendiği (yapım numarası, diller, bulunan altyazı sayısı ve oynatıcı
  gönderdiyse videonun dosya adı) sunucunun çalışma günlüğüne yazılır. Kullanıcı adı, şifre ve anahtar yazılmaz;
  kişiye bağlı bir izleme geçmişi tutulmaz.

Bu depo, yayındaki sunucuda çalışan kodun kaynağıdır; ancak dışarıdan bakan biri sunucuda birebir bu kodun çalıştığını
kanıtlayamaz. Tam emin olmak isteyen, kodu kendi bilgisayarında çalıştırıp deneyebilir.

## Yerelde çalıştırmak (inceleme için)

1. https://www.opensubtitles.com/consumers adresinden bir **API Key** al.
2. `.env.example` dosyasını `.env` olarak kopyala, `OS_API_KEY` ve `CONFIG_SECRET` değerlerini doldur.
3. `npm install`, ardından `npm start` → http://127.0.0.1:7000/

Kodu başkalarının kullanımına açık bir sunucuda yayımlamak izne bağlıdır ([LICENSE](LICENSE)).

## Sunucu ayarları

| Değişken | Açıklama |
|---|---|
| `OS_API_KEY` | OpenSubtitles API anahtarı (zorunlu). Uygulamayı OpenSubtitles'a tanıtır; indirme hakkı bu anahtardan değil, kullanıcının kendi hesabından düşer. |
| `CONFIG_SECRET` | Hesap bilgilerini ve anahtarları şifreleyen anahtar (zorunlu). **Değiştirilirse herkesin eklenti adresi geçersiz olur.** |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Kalıcı ortak önbellek (isteğe bağlı). Vercel'in Upstash entegrasyonunun verdiği `KV_REST_API_URL` / `KV_REST_API_TOKEN` de çalışır. Yoksa önbellek sadece bellekte tutulur ve havuz kısa ömürlü olur. |
| `SOURCE_DEADLINE_MS` | Bir kaynağın yanıtı için beklenen en uzun süre (isteğe bağlı, varsayılan 10000) |
| `PORT` | Yerel port (varsayılan 7000) |
| `PUBLIC_URL` | Eklentinin dış adresi; genelde boş bırakılır |

SubDL ve SubSource anahtarları sunucuya değil, her kullanıcının kendi eklenti adresine girilir.

## Yenilikler

- **3.14.1:** Oynatıcının ASS stilini gösterip göstermediğini denemek için `ass=test` ile açılan iki deneme altyazısı.
- **3.14.2:** Oynatıcının altyazı listesinde hangi bilgiyi gösterdiğini denemek için adrese `test=fields` eklenince açılan dört deneme altyazısı.
- **3.14.0:** "ASS/SSA stilini koru (Deneysel)" ayarı: ASS/SSA altyazılar SRT'ye çevrilmeden, stiliyle gönderilir.
- **3.13.0:** Kitsu'nun yanında MyAnimeList, AniList ve AniDB numaralarıyla gelen animeler de tanınır.
- **3.12.1:** Kaynağın yanlış kodlamayla sunduğu İbranice, Arapça, Farsça, Yunanca ve Kiril alfabeli altyazılardaki
  bozuk harfler düzeltilir.
- **3.12.0:** Etikette "Tam dosya eşleşmesi" ve "Sürüm adı uyuyor" notları; yalnızca yabancı konuşmaları içeren
  altyazılar işaretlenir ve grubunun sonuna alınır; **Kaynaklarımı dene** her kaynağın yanıt süresini de yazar.
- **3.11.0:** Ayar sayfasının yeni tasarımı, yeni logo.
- **3.10.0:** Etikette kalan indirme hakkı, öne alınacak kaynak, çift dilli altyazıda kare hızı düzeltmesi, indirirken
  kaydırma, AniSub kaynağı.
- **3.9.0:** Gestdown kaynağı, çift dilli altyazı, altyazı ara ve indir.
- **3.8.0:** Liste filtreleri, yedek dil, ses açıklaması temizliği, kaynak denemesi.

## Hata bildirimi ve katkı

- Hata ya da öneri için bu deponun **Issues** bölümünü kullanabilirsin.
- Güvenlik açığı bulduysan lütfen herkese açık yazmak yerine depo sahibine özel olarak bildir.
- İletişim: [X (@Diavelin)](https://x.com/Diavelin) · [Discord (diavelin)](https://discord.com/users/163213047597498368)
- Dışarıdan kod katkısı (pull request) kabul edilmez; izinsiz gönderilenler incelenmeden kapatılır.

## Lisans

Tüm hakları saklıdır © 2026 Diavelin. Bu proje açık kaynak değildir; koşullar için [LICENSE](LICENSE) dosyasına bak.
