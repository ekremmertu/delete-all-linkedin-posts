# LinkedIn Post Cleaner

Bulk-delete your own LinkedIn posts — and actually reach the end of the list.

> **Türkçe açıklama aşağıda.**

---

## Why another one?

There are a handful of LinkedIn bulk-delete tools around. Most of them stop
after a few hundred posts and report "done" while hundreds of posts are still
sitting in your profile. That is not a bug in their click logic — it is how
LinkedIn's activity feed behaves:

**After roughly 400–500 items, the feed stops loading more.** Scroll all you
want; nothing new arrives. Any script watching the page concludes there is
nothing left.

The only way past it is to **reload the page and continue** — which means the
work has to survive a reload. A snippet pasted into the DevTools console cannot
do that: reloading the page kills the snippet. That is the whole reason this is
an extension. Progress lives in `chrome.storage`, and the content script resumes
by itself on every page load.

Measured on a real account: the page reported "37 posts left" — after a reload,
**481** were still there.

### What else is different

| | Typical tool | This one |
|---|---|---|
| Reloads to refill the feed | ✗ | ✓ every N posts (default 50) |
| Survives a page reload | ✗ | ✓ state in `chrome.storage` |
| Non-English UI | ✗ matches the word "Delete" | ✓ language-independent CSS selectors first, text as fallback |
| Dry run | sometimes | ✓ **default on** — counts before it destroys anything |
| Counts before deleting | ✗ | ✓ reads LinkedIn's own render index, which survives DOM recycling |
| Stop button | sometimes | ✓ takes effect on the next post |

### Counting without touching anything

Counting the cards on the page undercounts badly. LinkedIn recycles them: it
throws old cards out of the DOM as you scroll, so no matter how far you go the
page holds only a few hundred at a time.

The hidden label on each card does not get recycled. LinkedIn stamps every card
it renders with *"Feed post number N"*, and N keeps climbing for as long as the
page stays open. On a real account the DOM held 452 cards while the labels had
already reached 965 — the labels remembered what the DOM had forgotten.

So **Count first** scrolls to the bottom, waits until the highest N stops
growing, and reports it. It is an estimate, not a guarantee: N counts what
LinkedIn has actually served this page, and if the feed stops feeding — see
above — the real total can still be higher. Nothing is clicked and nothing is
deleted, so it costs you nothing to run it first.

The language point matters more than it sounds. A tool that looks for the
literal string `"Delete"` deletes exactly zero posts on a Turkish, German or
Spanish LinkedIn. This one keys off `li.option-delete`, which is the same in
every language, and falls back to text only if that class ever changes.

---

## Install (unpacked)

Not on the Chrome Web Store. Install it yourself in about 30 seconds:

1. Download this repository (**Code → Download ZIP**) and unzip it.
2. Open `chrome://extensions` (Brave: `brave://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the unzipped folder.

Works in Chrome, Brave, Edge and any other Chromium browser.

## Use

1. Go to your own activity page:
   `linkedin.com/in/<you>/recent-activity/all/`
2. Click the extension icon.
3. Leave it on **Count first** and press **Start**. Nothing is deleted — it just
   tells you how many posts are actually there.
4. If the number looks right, switch to **Delete** and press **Start** again.

The tab reloads itself every 50 posts. That is intentional; do not close it.
You can press **Stop** at any time — it finishes the post it is on and halts.

Speed is roughly **8–11 seconds per post** with the default delay. A thousand
posts takes a couple of hours. The delay is deliberate: hammering the site is
both rude and a good way to get rate-limited.

## Warnings

- **Deletion is permanent.** LinkedIn has no trash bin and no undo. There is no
  way to get a post back.
- **Export first if you might want the text later.** LinkedIn: Settings → Data
  privacy → Get a copy of your data.
- This automates clicks in your own browser, on your own account, using the
  normal UI. It does not touch anyone else's content and does not use LinkedIn's
  internal APIs. Even so, LinkedIn's User Agreement does not permit automated
  tools — you are using this at your own risk on your own account.

## How it works

- `content.js` — finds each post's "…" button, opens the menu, clicks the delete
  row, confirms in the modal, then repeats. Every N posts it saves state and
  reloads. On load, it checks whether a run is in progress and picks up where it
  left off. When the page comes up empty it reloads and looks again; only after
  three empty rounds does it declare the job finished.
- `popup.js` — settings and progress. State is a single object in
  `chrome.storage.local`, so the popup and the page always agree.

No servers, no analytics, no network requests of its own. Nothing leaves the
browser.

## Maintenance

LinkedIn changes its markup from time to time and that will eventually break
this. If it does, the selectors to look at are `MENU_SECICI`, `silSatiri()` and
`onayDugmesi()` in `content.js` — all three try a stable CSS class first and
fall back to text. Issues and PRs welcome.

MIT licensed.

---

# Türkçe

LinkedIn'deki **kendi** gönderilerini topluca siler — ve listenin gerçekten
sonuna kadar gider.

## Neden bir tane daha?

Benzeri araçlar var ama çoğu birkaç yüz gönderiden sonra "bitti" deyip duruyor;
oysa profilde hâlâ yüzlerce gönderi duruyor. Sebep şu:

**LinkedIn, yaklaşık 400–500 gönderiden sonra listeyi beslemeyi bırakıyor.**
Ne kadar aşağı kaydırırsan kaydır yenisi gelmiyor. Sayfayı izleyen script de
haklı olarak "bitti" sanıyor.

Tek çözüm **sayfayı yenileyip devam etmek**. Ama sayfa yenilenince o sayfada
çalışan script ölür — konsola yapıştırılan bir kod bunu yapamaz. İşte bu yüzden
bu bir eklenti: ilerleme `chrome.storage`'da tutuluyor, sayfa her açıldığında
kaldığı yerden devam ediyor.

Gerçek bir hesapta ölçüldü: sayfa "37 gönderi kaldı" diyordu — yeniledikten
sonra **481** gönderi daha çıktı.

### Diğer farklar

| | Alışılmış araç | Bu |
|---|---|---|
| Listeyi tazelemek için yenileme | ✗ | ✓ her 50 gönderide |
| Yenilemeden sonra devam | ✗ | ✓ durum `chrome.storage`'da |
| Türkçe arayüz | ✗ sadece "Delete" arar | ✓ önce dil bağımsız CSS sınıfı |
| Prova modu | bazen | ✓ **varsayılan açık** — silmeden önce sayar |
| Silmeden önce sayma | ✗ | ✓ LinkedIn'in kendi çizim numarasını okur, kart geri dönüşümünden etkilenmez |
| Durdur düğmesi | bazen | ✓ sıradaki gönderide durur |

### Hiçbir şeye dokunmadan saymak

Sayfadaki kartları saymak **eksik sayar**. LinkedIn kartları geri dönüştürüyor:
sen aşağı kaydırdıkça eskileri hafızadan atıyor, ne kadar giderse gitsin sayfada
hep birkaç yüz kart kalıyor.

Kartın üzerindeki görünmez etiket ise atılmıyor. LinkedIn çizdiği her karta
*"Akış gönderi numarası N"* damgasını vuruyor ve N, sayfa açık kaldığı sürece
büyümeye devam ediyor. Gerçek bir hesapta DOM'da 452 kart varken etiketler çoktan
965'e ulaşmıştı — etiketler, DOM'un unuttuğunu hatırlıyordu.

**Önce say** modu sona kadar kaydırıyor, en büyük N büyümeyi bırakana kadar
bekliyor ve onu söylüyor. Bu bir **tahmin**, garanti değil: N yalnızca LinkedIn'in
bu sayfaya gerçekten verdiklerini sayar; akış beslemeyi bırakırsa —yukarıya bak—
gerçek toplam daha yüksek olabilir. Hiçbir yere tıklamadığı için önce bunu
çalıştırmanın maliyeti sıfır.

Dil meselesi göründüğünden önemli: `"Delete"` kelimesini arayan bir araç, Türkçe
arayüzde **tek bir gönderi bile** silemez. Bu araç her dilde aynı olan
`li.option-delete` sınıfını kullanıyor, metne ancak o sınıf değişirse düşüyor.

## Kurulum

Chrome Mağazası'nda değil. Kendin kuruyorsun, yarım dakika:

1. Bu depoyu indir (**Code → Download ZIP**) ve zip'ten çıkar.
2. `chrome://extensions` adresini aç (Brave'de `brave://extensions`).
3. Sağ üstten **Geliştirici modu**'nu aç.
4. **Paketlenmemiş öğe yükle** de ve çıkardığın klasörü seç.

## Kullanım

1. Kendi gönderiler sayfana git:
   `linkedin.com/in/<sen>/recent-activity/all/`
2. Eklenti simgesine tıkla.
3. **Önce say** modunda bırak, **Başlat**'a bas. Hiçbir şey silinmez, sadece
   gerçekten kaç gönderin olduğunu söyler.
4. Sayı doğruysa **Sil** moduna geç ve tekrar **Başlat**'a bas.

Sekme her 50 gönderide kendini yeniler; bu normaldir, kapatma. İstediğin an
**Durdur**'a basabilirsin.

Hız: gönderi başına **8–11 saniye**. Bin gönderi birkaç saat sürer. Bu yavaşlık
bilerek: siteye yüklenmek hem kabalık hem de hız sınırına takılmanın kestirme
yolu.

## Uyarılar

- **Silinen geri gelmez.** LinkedIn'de çöp kutusu yok, geri alma yok.
- **Metinler lazım olabilirse önce yedek al:** Ayarlar → Veri gizliliği →
  Verilerinin bir kopyasını al.
- Bu araç kendi tarayıcında, kendi hesabında, normal arayüzü kullanarak tıklama
  yapar. Başkasının içeriğine dokunmaz, LinkedIn'in iç API'lerini kullanmaz.
  Yine de LinkedIn kullanıcı sözleşmesi otomasyon araçlarına izin vermiyor;
  kendi hesabında kendi sorumluluğunda kullanırsın.

MIT lisanslı.
