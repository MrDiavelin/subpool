# SubPool by Diavelin – Stremio altyazı eklentisi

OpenSubtitles, SubDL ve SubSource'taki altyazıları Stremio'da **tek listede** toplar ve her altyazının
yanında **ücretsiz mi, yoksa senin indirme hakkından mı düşeceğini** yazar.

- Her dilde önce ücretsiz altyazıları, sonra hak harcayanları gösterir; her grubun içinde videonun dosya adına/hash'ine
  en uygun olan üstte, makine çevirileri grubun sonunda durur.
- İstenirse ilk iki dilin altyazısını tek altyazıda birleştirir (çift dilli altyazı).
- Harici oynatıcı kullananlar için ayar sayfasında altyazı arayıp dosya olarak indirme bölümü vardır.
- Anime kataloglarındaki (Kitsu) yapımlarda da çalışır; ASS/SSA biçimindeki altyazıları SRT'ye çevirir.
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
| `[Çift dilli] ✓ Ücretsiz · Türkçe + İngilizce` | İlk iki dilin altyazısı tek altyazıda birleştirilmiştir (üstte birinci dil, altında italik olarak ikinci dil); hak harcamaz. |

Etiketin sonundaki `· HI`, altyazının işitme engelliler için hazırlandığını (sesler ve müzik de yazılı) gösterir.

Ücretsiz OpenSubtitles hesabı günde 20, VIP hesap günde 1000 indirme hakkı verir. Liste görmek hak harcamaz.
Bu yüzden SubPool'un ana altyazı eklentisinin **yanında, yan eklenti olarak** kullanılması önerilir.

## Kullanım

1. Ayar sayfasını aç ve en az bir kaynak bağla: OpenSubtitles hesabı, SubDL anahtarı, SubSource anahtarı ve/veya AltyazıDB anahtarı.
   Hesap ya da anahtar istemeyen Gestdown da (yalnızca diziler) tek başına ya da diğerlerinin yanında açılabilir.
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
- **Çift dilli altyazı** (varsayılan: kapalı): Açıkken listenin başına, sıradaki ilk iki dili aynı anda gösteren en fazla
  3 altyazı eklenir: üstte birinci dil, altında italik olarak ikinci dil (adrese `dual=1` eklenir). En az iki dil
  seçilmiş olmalıdır.
  - Yalnızca eklentinin kendi sunduğu ve hak harcamayan altyazılardan üretilir: SubDL, SubSource, AltyazıDB, Gestdown ve
    Havuz. "Resmi" altyazılar Stremio'nun sunucusundan geldiği için, "1 hak harcar" altyazılar ise haberin olmadan hak
    harcanmasın diye birleştirilmez. Yalnızca OpenSubtitles hesabı bağlıysa çoğu zaman çift dilli altyazı çıkmaz.
  - Birinci dilin en uygun altyazıları, ikinci dilde sürüm adı en çok benzeyen altyazıyla eşlenir.
  - İkinci dilin altyazısı baştan sona aynı süre kadar erken ya da geç kalıyorsa (en fazla 15 saniye) bu fark ölçülür ve
    ikinci dil ona göre kaydırılır; birinci dilin zamanlarına dokunulmaz. Fark bölüm boyunca değişiyorsa düzeltilmez ve
    satırlar birbirine denk gelmeyebilir.
  - İkinci dildeki altyazı alınamazsa birinci dil tek başına gösterilir.

Bu ayarların hepsi isteğe bağlıdır; hiçbiri açılmazsa liste önceki sürümlerdeki gibi çalışır ve eski eklenti adresleri
geçerli kalır.

### Gestdown

[Gestdown](https://api.gestdown.info), Addic7ed'deki dizi altyazılarını sunan, hesap ve anahtar istemeyen bir servistir.
Ayar sayfasındaki **Gestdown'ı kullan** kutusuyla açılır (adrese `gd=1` eklenir); varsayılan olarak kapalıdır.

- Yalnızca dizilerde çalışır; filmlerde altyazı getirmez.
- Başka hiçbir kaynak bağlamadan, tek başına da kullanılabilir.
- Eklentideki 105 dilin 88'inde arama yapabilir; tanımadığı dillerde aranmaz.
- Gestdown diziyi o sırada yeniliyorsa o an altyazı vermez; liste onsuz gösterilir ve oynatıcıya listeyi yalnızca
  1 dakika saklaması söylenir.

### Kaynaklarımı dene

Ayar sayfasındaki **Kaynaklarımı dene** butonu, bağladığın her kaynakta örnek bir filmi (The Shawshank Redemption)
seçtiğin dillerde arar ve kaynağın çalışıp çalışmadığını, kaç altyazı bulunduğunu yazar. Yalnızca arama yapılır;
altyazı indirilmez, indirme hakkı harcanmaz. OpenSubtitles hesabı bağlıysa deneme sırasında hesaba giriş yapılır ve
OpenSubtitles bildirirse o gün kalan indirme hakkı da gösterilir. Gestdown açıksa, yalnızca dizi barındırdığı için orada
film yerine örnek bir dizi bölümü (Breaking Bad, 1. sezon 1. bölüm) aranır.

Şifre ve anahtarlar, sana özel eklenti adresinin içinde sunucu anahtarıyla şifrelenmiş olarak durur; sunucuda saklanmaz. Ayar sayfası, bilgileri yeniden girmemen için bu şifreli adresi kullandığın tarayıcıda da hatırlar; "Bilgilerimi bu tarayıcıdan sil" butonuyla silinir.
Yine de bu adresi kimseyle paylaşma: adresi alan, senin indirme hakkını kullanabilir.

### Altyazı ara ve indir

Harici bir oynatıcı kullananlar altyazıyı ayar sayfasındaki **Altyazı ara ve indir** bölümünden dosya olarak indirip
oynatıcıya kendileri ekleyebilir.

- Film ya da dizi adı (ya da IMDb numarası veya adresi) yazılır; dizilerde sezon ve bölüm seçilir.
- Liste, kurulum adresindekiyle aynı ayarlarla gelir: bağlı kaynaklar, seçili diller, liste ayarları ve açıksa çift
  dilli altyazılar.
- "Resmi" altyazılar Stremio'nun sunucusundan geldiği için burada listelenmez.
- "1 hak harcar" etiketli bir altyazıyı indirmek, OpenSubtitles hesabından 1 indirme hakkı harcar.
- Dosya `Ad S01E02.tur.srt` biçiminde kaydedilir (çift dilli altyazılarda `Ad S01E02.dual.tur.srt`).
- Altyazı alınamazsa (örneğin indirme hakkı bittiyse) dosya kaydedilmez; nedeni sayfada yazar.

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
  efektleri atılır.
- **Anime (Kitsu):** `kitsu:7442:3` gibi numaralar Stremio'nun Kitsu eklentisine (`anime-kitsu.strem.fun`) sorularak
  IMDb numarasına ve sezon/bölüme çevrilir; karşılığı olmayan yapımlar için liste boş döner.
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
- **Çift dilli altyazı:** Birleşik altyazının adresi iki altyazının yolunu taşır; dosya açılırken ikisi de alınır ve
  zamanları örtüşen satırlar birleştirilir ([src/subtitle.js](src/subtitle.js)). Birleştirmeden önce iki altyazı
  arasındaki sabit zaman farkı aranır; satırların en az dörtte biri aynı farkı gösteriyorsa ikinci dil o kadar
  kaydırılır. OpenSubtitles dosyaları bu sırada yalnızca önbellekten okunur; çift dilli altyazı hiçbir durumda indirme
  hakkı harcamaz.

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
- **Altyazı arama bölümü:** Film ve dizi araması ile dizinin sezon listesi tarayıcıdan doğrudan Stremio'nun katalog
  servisine (`v3-cinemeta.strem.io`) sorulur ([src/configure.js](src/configure.js)); bu isteklerde yalnızca aranan ad ya
  da yapım numarası gider. Altyazı listesi ve dosyalar, kurulum adresindeki ayarlarla eklentinin kendi sunucusundan alınır.
- **Sunucu sahibinin indirme hakkı kullanılmaz.** Sunucudaki `OS_API_KEY` yalnızca uygulamayı OpenSubtitles'a tanıtır;
  indirmeler her zaman kullanıcının kendi hesabıyla yapılır ve hak o hesaptan düşer. Hesap bağlanmamışsa indirme yapılmaz.
- **Önbellekte duranlar** ([src/store.js](src/store.js)): arama sonuçları, indirilen altyazı dosyaları, havuz listesi ve
  OpenSubtitles'ın verdiği oturum anahtarı (her istekte yeniden giriş yapmamak için; şifrelenmiş olarak ve süreli tutulur).
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

## Hata bildirimi ve katkı

- Hata ya da öneri için bu deponun **Issues** bölümünü kullanabilirsin.
- Güvenlik açığı bulduysan lütfen herkese açık yazmak yerine depo sahibine özel olarak bildir.
- Dışarıdan kod katkısı (pull request) kabul edilmez; izinsiz gönderilenler incelenmeden kapatılır.

## Lisans

Tüm hakları saklıdır © 2026 Diavelin. Bu proje açık kaynak değildir; koşullar için [LICENSE](LICENSE) dosyasına bak.
