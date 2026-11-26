# Emlakçı sistemi — FAZ 2 kapanış

Bu belge FAZ 2.1–2.6 sonunda çalışan domain’i özetler. Yeni panel tasarımı, mesajlaşma, lead, harita veya auth yeniden yazımı bu kapsama girmez.

## Domain modeli

- `User.role`: `USER`, `AGENT`, `ADMIN`.
- `AgentApplication`: kullanıcının başvuru satırı. Durumlar `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`. Aynı kullanıcıda en fazla bir açık `DRAFT` veya `PENDING` satır vardır. Bu kural SQL partial unique index ile durur.
- `AgentApplicationDocument`: başvuru belgeleri. Zorunlu türler `TAX_CERTIFICATE` ve `AUTHORIZATION_CERTIFICATE`.
- `AgentProfile`: onayda oluşan emlakçı profili. `userId` tekildir. Bir kullanıcının 0 veya 1 profili vardır. `isActive` askı durumudur.
- `Property`: `INDIVIDUAL` ilanda `ownerUserId` dolu ve `agentProfileId` boştur. `AGENT` ilanda `ownerUserId` boş ve `agentProfileId` doludur. İstemci bu alanları güncelleyemez.
- `PropertyImage` ve `StoredFile`: ilan fotoğrafları. Canlı kapak görseli en fazla birdir; bu kural SQL partial unique index ile durur.

## Başvuru lifecycle

`USER` başvuru oluşturur ve satır `DRAFT` olur. Firma ve yetkili bilgileri ile belgeler yalnız `DRAFT` iken değişir. Submit, zorunlu belgeler varken satırı `PENDING` yapar ve `submittedAt` yazar.

Admin `PENDING` başvuruyu onaylar veya gerekçeyle reddeder. Onay tek transaction içindedir: satır yalnız hâlâ `PENDING` ise güncellenir, `User.role` `AGENT` olur, `AgentProfile` `isActive: true` ile oluşur. İkinci profil oluşmaz.

Ret sonrası aynı satır `REJECTED` kalır. Kullanıcı gerekçeyi görür, revise ile aynı satır yeniden `DRAFT` olur, düzeltir ve tekrar submit eder. Ayrı bir başvuru geçmişi yoktur.

Eşzamanlı iki submit’ten biri `PENDING` yazar, diğeri `409` döner. Eşzamanlı approve/approve ve approve/reject yarışında tek nihai karar kalır.

## Yetki

Profesyonel mutation için üçünün birden sağlanması gerekir:

- `User.role = AGENT`
- `AgentProfile` var
- `AgentProfile.isActive = true`

Askıdaki emlakçı giriş yapabilir, `GET /agents/me`, kendi ilanlarını ve kendi mevcut logosunu (`GET /agents/me/files/:fileId`) okuyabilir. İlan oluşturma, güncelleme, durum, silme, fotoğraf, kapak, sıralama, profil ve logo yazmaları `403 Agent profile is inactive` döner. Public `/files/:id` askıdaki logoyu ve ilan görselini vermez.

Başka emlakçının ilanı, silinmiş ilan ve olmayan ilan profesyonel endpoint’lerde `404 Property not found` döner. Bireysel ilan da profesyonel endpoint’ten değiştirilemez. Emlakçı ilanı `/user-properties` üzerinden değiştirilemez.

`ADMIN` admin endpoint’lerini kullanır. Admin hesabına kendiliğinden emlakçı ilan sahipliği verilmez.

## Oturum ve rol

Access token içindeki rol, token’ın üretildiği andaki roldür. `JwtAuthGuard` her istekte kullanıcıyı veritabanından okur ve yetkiyi token’daki role göre değil, güncel `User.role` ve `isActive` değerine göre verir. Onaydan sonra eski access token API’de yeni `AGENT` yetkisini taşır; bunun için yeniden login gerekmez.

Arayüzdeki menü ve route guard’lar bellekteki oturum kullanıcısına bakar. Bu nesne login, sayfa yüklemesindeki refresh ve access token yenilemesinde güncellenir. Açık sekme, access token hâlâ geçerliyken admin onayını kendiliğinden menüye yansıtmaz. Hard refresh veya yeni login arayüzü `AGENT` menüsüne geçirir. Bu bir yetki açığı değildir: API güncel rolü uygular.

## İlan ve görsel

Aktif emlakçı kendi ilanında oluşturma, liste, detay, düzenleme, fotoğraf, kapak, sıralama, `ACTIVE`/`INACTIVE` ve soft delete kullanır. Soft delete yalnız `properties.deletedAt` yazar. İlan status’u `ACTIVE` kalabilir; `deletedAt` görünürlüğü belirler. Silinen ilan public listede, emlakçı listesinde ve detayda yoktur. Status ve fotoğraf mutation’ları da `404` döner.

`GET /properties/me` her kayıtta `coverImageUrl` döner. Değer, silinmemiş kapak görselinin sahip dosya path'idir (`/api/v1/properties/me/files/<uuid>`); kapak yoksa ilk canlı görsel, görsel yoksa `null` kullanılır. Galeri bu listede dönmez. Public kartlar mevcut public `coverImageUrl` alanını kullanmaya devam eder.

Tek görsel silindiğinde `PropertyImage` ve `StoredFile` soft delete olur ve fiziksel dosya atılır. İlan soft delete’inde görsel satırları ve fiziksel dosyalar yerinde kalır. Restore özelliği yoktur. Fiziksel dosyayı ilan silinirken otomatik silmek, ileride geri alma veya yanlış silme durumunda veri kaybı yaratır. Bu fazda cleanup job eklenmedi. Politika: ilan soft delete dosyaya dokunmaz; orphan dosya bilinen teknik borçtur ve ancak açık bir cleanup kararıyla silinir.

## Arsa

`rooms` ve `livingRooms` şemada zorunlu tam sayıdır. Create DTO da bu alanları ister. Convention: `LAND` ilanında API `rooms = 0`, `livingRooms = 0` yazar; kat, toplam kat ve ısıtma boş, asansör `false` olur. Bireysel ve emlakçı formları arsa seçilince bu alanları gizler ve aynı payload’ı gönderir. Public kart ve detay arsada oda, kat, ısıtma ve asansörü göstermez.

## Emlakçı paneli

Route’lar: `/panel`, `/panel/ilanlar`, `/panel/ilanlar/yeni`, `/panel/ilanlar/:id/duzenle`, `/panel/emlakci-profili`, `/favoriler`. Masaüstü kenar çubuğu 1024 px ile açılır. Altında hamburger drawer kullanılır.

Askıdaki emlakçı bu ekranları okuyabilir. Yeni ilan menüsü devre dışıdır. İlan oluşturma, durum, silme, fotoğraf ve profil yazma kapalıdır. Mevcut ilan düzenleme adresi salt okunur açılır. Dashboard sayaçları `GET /properties/me` toplamlarını kullanır: filtresiz toplam, `ACTIVE`, `INACTIVE`, `SOLD + RENTED`. Bu toplamlar liste sayfa boyutundan bağımsızdır. Hiçbir sayaç ilk kez yüklenemezse kartlar yerine hata metni görünür; başarısız değer 0 yazılmaz. Daha önce yüklenmiş sayaçlar refetch hatasında durur ve güncellenemediği belirtilir. Yalnız bazı sayaçlar ilk kez yüklenemezse başarılı olanlar kalır, yüklenemeyen hücre `—` olur.

Paneldeki ilan görseli ve sahip logosu authenticated blob ile yüklenir. Public dosya kuralları gevşetilmez.

İlan ve profil formlarında kaydedilmemiş alan değişikliği uygulama içi linklerde onay ister. Tarayıcı geri hareketinde adres form sayfasında tutulur ve aynı diyalog açılır; temiz formda geri hareket uyarı vermez. Başarılı kayıt yönlendirmesi ve anında kaydolan fotoğraf/logo işlemi tek başına uyarı açmaz. Tarayıcı yenileme ve sekme kapatma native `beforeunload` kullanır; özel metin tarayıcıya bağlıdır. Logo silme endpoint’i yoktur.

## Bilinen sınırlar

- İlan soft delete sonrası fiziksel fotoğraf dosyaları durur. Logo silme endpoint’i yoktur.
- Açık sekme, rol değişimini access token yenilenene veya sayfa yenilenene kadar menüde göstermez.
- Emlakçı mutation’ları audit kaydı yazmaz.
- Onaylı `AGENT` bireysel ilan endpoint’lerini kullanamaz; bireysel ilan `USER` rolüne bağlıdır.
- Ayrı analytics endpoint’i yoktur. Dashboard her sayaç için `limit=1` liste sorgusu kullanır; `total` sayfanın kendisi değildir.
- Admin detayı mevcut logoyu `GET /api/v1/admin/agents/:id/files/:fileId` üzerinden authenticated blob ile alır. Public `/files/:id` askıda ve pasif hesapta 404 kalır.

## Manuel tarayıcı doğrulaması

Otomasyon native `beforeunload` dialogunu ve güvenilen Tab/Enter/Space olayını üretemez. Sentetik olay bu iki senaryonun yerine geçmez.

Yenileme ve sekme kapatma: emlakçı profilinde şirket adını değiştirip kaydetmeden sayfayı yenileyin ve sekmeyi kapatmayı deneyin. Tarayıcının kendi ayrılma uyarısı açılmalı. Temiz formda açılmamalı.

Drawer Tab: 390 px genişlikte hamburger’a gerçek klavyeyle odaklanın. Enter veya Space menüyü açar, odak kapat düğmesine geçer. Tab menüdeki her bağlantıyı sırayla dolaşır, Shift+Tab ters gider, odak drawer dışına çıkmaz, son elemandan ilk elemana döner. Escape kapatır ve odak hamburger’a döner. Kapalıyken drawer bağlantıları Tab sırasında yoktur.

## FAZ 2.7.6 son doğrulama

Kontrollü oturumda, önbelleksiz ilk yüklemede sayaç istekleri 500 döndüğünde kartlar yerine “Bilgiler yüklenirken bir sorun oluştu.” ve “Yeniden dene” göründü. Ekranda 0 veya sayaç değeri yoktu. Tekrar denemeden sonra gerçek toplamlar geldi.

Başarılı yüklemeden sonra aynı istekler yeniden 500 döndüğünde son değerler durdu ve “Sayaçlar güncellenemedi. Son başarılı değerler gösteriliyor.” yazıldı. İstekler normale dönünce uyarı kapandı, değerler korundu.

Yalnız `ACTIVE` sayacı başarısız olduğunda o hücre `—` oldu. Toplam, pasif ve sonuçlanan değerleri durdu. “Bazı sayaçlar yüklenemedi.” yazıldı. Başarısız sayaç 0 yazılmadı.

105 geçici ilan (`Faz276 Sayac`) ve mevcut `Faz24 Aktif Duzenleme` ile dashboard 106 / 41 / 30 / 35 gösterdi. Sonuçlanan, 20 satıldı ve 15 kiralandı toplamıdır. Bu sayılar `limit=1` sorgularının `total` alanıdır; ilk sayfanın kayıt sayısı değildir. Aynı toplam, `limit=20` listesinde de 106 idi. Geçici ilanlar soft delete edildi. Canlı `Faz276 Sayac` kaydı kalmadı. `Faz24 Aktif Duzenleme` duruyor. Temizlik sonrası dashboard 1 / 1 / 0 / 0.

Native `beforeunload` ve gerçek klavye Tab bu koşumda yapılmadı. Yukarıdaki manuel adımlar duruyor. Bu iki madde otomasyon sınırıdır; ürün hatası olarak kapanmadı ve PASS sayılmadı.

## FAZ 2 kapanış kararı

Sonraki kapanış kaydı bu doğrulamadan sonra `FAZ 2.7.6 = COMPLETE`, `FAZ 2.7 = COMPLETE`, `FAZ 2 = COMPLETE` ve `FAZ 3 = READY` dedi. Dashboard hata durumları yukarıda ölçüldü. Native `beforeunload` ve gerçek klavye Tab o kararda da PASS değildir.
