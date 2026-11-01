/* LinkedIn Post Cleaner — content script.
 *
 * The one thing other tools get wrong: LinkedIn's activity feed stops feeding
 * after a few hundred posts, so a script thinks it is finished while hundreds
 * of posts are still there. The only fix is to reload the page and keep going —
 * which means the work has to survive a reload. That is why this is an
 * extension and not a console snippet: state lives in chrome.storage, and this
 * script picks up where it left off every time the page loads.
 */

(() => {
  "use strict";

  const ANAHTAR = "lpc";
  const TR = (navigator.language || "").toLowerCase().startsWith("tr");

  const S = TR
    ? {
        bitti: "Bitti",
        durduruldu: "Durduruldu",
        calisiyor: "Çalışıyor",
      }
    : {
        bitti: "Finished",
        durduruldu: "Stopped",
        calisiyor: "Running",
      };

  const varsayilan = () => ({
    calisiyor: false,
    prova: true,
    silinen: 0,
    sayilan: 0,
    atlanan: 0,
    yenilemeAraligi: 50,
    beklemeMin: 2500,
    beklemeMax: 5000,
    sonYenileme: 0,
    bosYenileme: 0,
    islenmis: [],
    durumYazi: "",
    bittiMi: false,
  });

  const uyu = (ms) => new Promise((r) => setTimeout(r, ms));
  const rastgele = (a, b) => a + Math.random() * (b - a);
  const acik = (el) => !!el && el.offsetParent !== null;
  const yazi = (el) => ((el && el.innerText) || "").replace(/\s+/g, " ").trim();

  async function oku() {
    const o = await chrome.storage.local.get(ANAHTAR);
    return Object.assign(varsayilan(), o[ANAHTAR] || {});
  }
  async function kaydet(d) {
    await chrome.storage.local.set({ [ANAHTAR]: d });
  }

  /* --- Sayfadaki gönderiler --------------------------------------------- */

  // Dil bağımsız: her gönderinin "..." düğmesi bu sınıfı taşır. aria-label
  // metnine güvenmiyoruz, çünkü o kullanıcının arayüz diline göre değişir.
  const MENU_SECICI = [
    "button.feed-shared-control-menu__trigger",
    'button[class*="control-menu"]',
    'button[aria-label*="control menu" i]',
    'button[aria-label*="kontrol men" i]',
  ].join(",");

  function menuDugmeleri() {
    return [...document.querySelectorAll(MENU_SECICI)].filter(acik);
  }

  function anahtarla(btn) {
    const kart = btn.closest("[data-urn], [data-id], [data-activity-urn]");
    if (!kart) return null;
    return (
      kart.getAttribute("data-urn") ||
      kart.getAttribute("data-id") ||
      kart.getAttribute("data-activity-urn")
    );
  }

  // Menüdeki "Gönderiyi sil" satırı. Birincil yol dil bağımsız CSS sınıfı;
  // sınıf değişirse metne düşeriz (TR + EN).
  function silSatiri() {
    const sinif = [...document.querySelectorAll("li.option-delete")].filter(acik)[0];
    if (sinif) return sinif;
    const kalip = /^(gönderiyi sil|delete post|post löschen|supprimer le post|eliminar publicación)$/i;
    return [...document.querySelectorAll('li, div[role="button"]')]
      .filter(acik)
      .find((e) => kalip.test(yazi(e)));
  }

  // Onay penceresindeki asıl düğme. Yine önce dil bağımsız sınıf.
  function onayDugmesi() {
    const kutular = [
      ...document.querySelectorAll('[role="alertdialog"], [role="dialog"], .artdeco-modal'),
    ].filter(acik);
    for (const k of kutular) {
      const dugmeler = [...k.querySelectorAll("button")].filter(acik);
      const metin = dugmeler.find((b) => /^(sil|delete|löschen|supprimer|eliminar)$/i.test(yazi(b)));
      if (metin) return metin;
      const birincil = dugmeler.find(
        (b) => b.className.includes("artdeco-button--primary") && yazi(b).length <= 20
      );
      if (birincil) return birincil;
    }
    return null;
  }

  // Kartları saymak eksik sayar: LinkedIn eskileri DOM'dan atıyor, sayfada hep
  // birkaç yüz kart kalıyor. Ama her karta vurduğu görünmez damga — "Akış gönderi
  // numarası N" / "Feed post number N" — atılmıyor ve sayfa açık kaldıkça büyüyor.
  // Gerçek bir hesapta DOM'da 452 kart varken damgalar 965'e ulaşmıştı.
  // Not: anlamlı olması için sona kadar kaydırmak şart; tek bakış yanıltır.
  function enBuyukSira() {
    const kalip = /(?:gönderi numarası|post number|publicación número|beitrag nummer)\s*(\d+)/gi;
    const metin = (document.body.innerText || "") + " " + etiketMetinleri();
    let e,
      enb = 0;
    while ((e = kalip.exec(metin))) enb = Math.max(enb, Number(e[1]));
    return Math.max(enb, menuDugmeleri().length);
  }

  function etiketMetinleri() {
    return [...document.querySelectorAll("[aria-label]")]
      .map((e) => e.getAttribute("aria-label"))
      .join(" ");
  }

  function kacisTusu() {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }

  async function bekleyerekBul(fn, denemeSayisi = 28, aralik = 250) {
    for (let i = 0; i < denemeSayisi; i++) {
      await uyu(aralik);
      const x = fn();
      if (x) return x;
    }
    return null;
  }

  /* --- Tek gönderi ------------------------------------------------------- */

  async function birAdim(d, islenmisKume) {
    let hedef = menuDugmeleri().find((b) => {
      const k = anahtarla(b);
      return k && !islenmisKume.has(k);
    });

    if (!hedef) {
      window.scrollTo(0, document.body.scrollHeight);
      await uyu(2500);
      hedef = menuDugmeleri().find((b) => {
        const k = anahtarla(b);
        return k && !islenmisKume.has(k);
      });
      if (!hedef) return { sonuc: "yok" };
    }

    const key = anahtarla(hedef);
    hedef.scrollIntoView({ block: "center" });
    await uyu(450);
    hedef.click();

    const satir = await bekleyerekBul(silSatiri);
    if (!satir) {
      kacisTusu();
      await uyu(400);
      return { sonuc: "atlandi", key, sebep: "menu" };
    }

    const tiklanacak = satir.querySelector('div[role="button"], button') || satir;
    tiklanacak.click();

    const onay = await bekleyerekBul(onayDugmesi, 36);
    if (!onay) {
      kacisTusu();
      await uyu(400);
      return { sonuc: "atlandi", key, sebep: "onay" };
    }

    onay.click();
    await uyu(1500);
    return { sonuc: "silindi", key };
  }

  /* --- Ana döngü --------------------------------------------------------- */

  let donguAcik = false;

  // Prova: hiçbir şeye dokunmadan kaç gönderi olduğunu söyler. Menüleri tek tek
  // açmaz — sadece sona kadar kaydırır ve en büyük sıra numarasını okur.
  async function provaSay() {
    let onceki = -1,
      sabit = 0;
    while (sabit < 3) {
      const d = await oku();
      if (!d.calisiyor) return;

      window.scrollTo(0, document.body.scrollHeight);
      await uyu(1800);

      d.calisiyor = (await oku()).calisiyor;
      if (!d.calisiyor) return;

      const s = enBuyukSira();
      if (s === onceki) sabit++;
      else {
        sabit = 0;
        onceki = s;
      }
      d.sayilan = Math.max(d.sayilan || 0, s);
      d.durumYazi = S.calisiyor;
      await kaydet(d);
    }
    const d = await oku();
    d.calisiyor = false;
    d.bittiMi = true;
    d.durumYazi = S.bitti;
    await kaydet(d);
    window.scrollTo(0, 0);
  }

  async function calis() {
    if (donguAcik) return;
    donguAcik = true;
    try {
      let d = await oku();

      if (d.prova) {
        await provaSay();
        return;
      }

      const islenmis = new Set(d.islenmis);

      while (true) {
        d = await oku();
        if (!d.calisiyor) break;

        const r = await birAdim(d, islenmis);

        // Bir adım birkaç saniye sürer. Bu sırada basılan Durdur'u ezmemek için
        // durumu kaydetmeden önce taze oku.
        d.calisiyor = (await oku()).calisiyor;

        if (r.sonuc === "silindi") {
          d.silinen++;
          d.bosYenileme = 0;
          if (r.key) islenmis.add(r.key);
          d.islenmis = [...islenmis];
          d.durumYazi = S.calisiyor;
          await kaydet(d);

          const adet = d.silinen;
          if (adet > 0 && adet % d.yenilemeAraligi === 0 && d.sonYenileme !== adet) {
            d.sonYenileme = adet;
            await kaydet(d);
            location.reload();
            return;
          }
          await uyu(rastgele(d.beklemeMin, d.beklemeMax));
          continue;
        }

        if (r.sonuc === "atlandi") {
          d.atlanan++;
          if (r.key) islenmis.add(r.key);
          d.islenmis = [...islenmis];
          await kaydet(d);
          await uyu(1200);
          continue;
        }

        // "yok" — sayfada işlenmemiş gönderi kalmadı. LinkedIn beslemeyi
        // bırakmış olabilir; yenileyip tekrar bakıyoruz. Üç tur üst üste boş
        // gelirse gerçekten bitmiştir.
        d.bosYenileme++;
        await kaydet(d);
        if (d.bosYenileme >= 3) {
          d.calisiyor = false;
          d.bittiMi = true;
          d.durumYazi = S.bitti;
          await kaydet(d);
          break;
        }
        location.reload();
        return;
      }
    } catch (e) {
      const d = await oku();
      d.durumYazi = "Hata: " + (e && e.message ? e.message : e);
      await kaydet(d);
    } finally {
      donguAcik = false;
    }
  }

  /* --- Popup ile konuşma ------------------------------------------------- */

  chrome.runtime.onMessage.addListener((mesaj, _g, cevapla) => {
    if (mesaj && mesaj.tip === "basla") {
      calis();
      cevapla({ ok: true });
    } else if (mesaj && mesaj.tip === "durum") {
      cevapla({ ok: true, sayfadaGonderi: menuDugmeleri().length });
    }
    return true;
  });

  /* --- Yeniden yüklemeden sonra kendiliğinden devam ----------------------- */

  (async () => {
    const d = await oku();
    if (d.calisiyor) {
      // Akışın çizilmesini bekle
      await uyu(6000);
      calis();
    }
  })();
})();
