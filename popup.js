"use strict";

const ANAHTAR = "lpc";
const TR = (navigator.language || "").toLowerCase().startsWith("tr");

const M = TR
  ? {
      modProva: "Önce say (güvenli)",
      modSil: "Sil",
      basla: "Başlat",
      dur: "Durdur",
      bulunan: "gönderi var (tahmini toplam)",
      silinen: "gönderi silindi",
      uyari:
        "Bu geri alınamaz. LinkedIn'in çöp kutusu yoktur; silinen gönderi geri gelmez.",
      yanlisSayfa: "Gönderilerim sayfasını aç",
      ipucuYanlis: "Önce kendi gönderiler sayfanda olman gerekiyor.",
      ipucuHazir: "\"Önce say\" hiçbir şey silmez, sadece kaç gönderin olduğunu söyler.",
      ipucuCalisiyor: "Çalışıyor… Sayfa arada kendini yeniler, bu normal.",
      ipucuBitti: "Bitti. Başka gönderi kalmadı.",
      ayarlar: "Ayarlar",
      yenileme: "Kaç gönderide bir yenilensin",
      bekleme: "Gönderi arası bekleme (sn)",
      sifirla: "Sayaçları sıfırla",
    }
  : {
      modProva: "Count first (safe)",
      modSil: "Delete",
      basla: "Start",
      dur: "Stop",
      bulunan: "posts found (estimated total)",
      silinen: "posts deleted",
      uyari: "This cannot be undone. LinkedIn has no trash bin — deleted posts are gone.",
      yanlisSayfa: "Open my posts page",
      ipucuYanlis: "You need to be on your own activity page first.",
      ipucuHazir: "\"Count first\" deletes nothing — it just tells you how many posts you have.",
      ipucuCalisiyor: "Running… The page reloads itself now and then. That is normal.",
      ipucuBitti: "Done. No posts left.",
      ayarlar: "Settings",
      yenileme: "Reload after this many posts",
      bekleme: "Wait between posts (s)",
      sifirla: "Reset counters",
    };

const $ = (id) => document.getElementById(id);
const AKTIVITE = /linkedin\.com\/in\/[^/]+\/recent-activity/;

let sekme = null;

async function oku() {
  const o = await chrome.storage.local.get(ANAHTAR);
  return Object.assign(
    {
      calisiyor: false,
      prova: true,
      silinen: 0,
      sayilan: 0,
      atlanan: 0,
      yenilemeAraligi: 50,
      beklemeMin: 2500,
      beklemeMax: 5000,
      bittiMi: false,
    },
    o[ANAHTAR] || {}
  );
}
const kaydet = (d) => chrome.storage.local.set({ [ANAHTAR]: d });

function metinleriKur() {
  $("modProva").textContent = M.modProva;
  $("modSil").textContent = M.modSil;
  $("ayarBaslik").textContent = M.ayarlar;
  $("etiketYenileme").textContent = M.yenileme;
  $("etiketBekleme").textContent = M.bekleme;
  $("sifirla").textContent = M.sifirla;
  $("uyari").textContent = M.uyari;
}

async function ciz() {
  const d = await oku();
  const dogruSayfa = sekme && AKTIVITE.test(sekme.url || "");

  $("sayi").textContent = d.prova ? d.sayilan : d.silinen;
  $("etiket").textContent = d.prova ? M.bulunan : M.silinen;

  $("modProva").dataset.secili = d.prova ? "1" : "0";
  $("modSil").dataset.secili = d.prova ? "0" : "1";
  $("uyari").style.display = d.prova ? "none" : "block";

  $("yenileme").value = d.yenilemeAraligi;
  $("bekleme").value = Math.round(d.beklemeMin / 1000);

  const b = $("anaDugme");
  if (!dogruSayfa) {
    b.textContent = M.yanlisSayfa;
    b.dataset.dur = "0";
    b.disabled = false;
    $("ipucu").textContent = M.ipucuYanlis;
  } else if (d.calisiyor) {
    b.textContent = M.dur;
    b.dataset.dur = "1";
    b.disabled = false;
    $("ipucu").textContent = M.ipucuCalisiyor;
  } else {
    b.textContent = M.basla;
    b.dataset.dur = "0";
    b.disabled = false;
    $("ipucu").textContent = d.bittiMi ? M.ipucuBitti : M.ipucuHazir;
  }
}

async function anaDugmeTiklandi() {
  const d = await oku();
  const dogruSayfa = sekme && AKTIVITE.test(sekme.url || "");

  if (!dogruSayfa) {
    const kullanici = (sekme.url || "").match(/linkedin\.com\/in\/([^/?#]+)/);
    const hedef = kullanici
      ? `https://www.linkedin.com/in/${kullanici[1]}/recent-activity/all/`
      : "https://www.linkedin.com/in/me/recent-activity/all/";
    await chrome.tabs.update(sekme.id, { url: hedef });
    window.close();
    return;
  }

  if (d.calisiyor) {
    d.calisiyor = false;
    await kaydet(d);
    await ciz();
    return;
  }

  d.calisiyor = true;
  d.bittiMi = false;
  d.bosYenileme = 0;
  d.sonYenileme = 0;
  await kaydet(d);
  try {
    await chrome.tabs.sendMessage(sekme.id, { tip: "basla" });
  } catch (e) {
    await chrome.tabs.reload(sekme.id);
  }
  await ciz();
}

async function modDegistir(prova) {
  const d = await oku();
  if (d.calisiyor) return;
  d.prova = prova;
  await kaydet(d);
  await ciz();
}

(async () => {
  metinleriKur();
  [sekme] = await chrome.tabs.query({ active: true, currentWindow: true });
  await ciz();

  $("anaDugme").addEventListener("click", anaDugmeTiklandi);
  $("modProva").addEventListener("click", () => modDegistir(true));
  $("modSil").addEventListener("click", () => modDegistir(false));

  $("yenileme").addEventListener("change", async (e) => {
    const d = await oku();
    d.yenilemeAraligi = Math.max(10, Math.min(200, Number(e.target.value) || 50));
    await kaydet(d);
  });
  $("bekleme").addEventListener("change", async (e) => {
    const d = await oku();
    const sn = Math.max(1, Math.min(30, Number(e.target.value) || 3));
    d.beklemeMin = sn * 1000;
    d.beklemeMax = sn * 1000 + 2500;
    await kaydet(d);
  });
  $("sifirla").addEventListener("click", async () => {
    const d = await oku();
    Object.assign(d, {
      silinen: 0,
      sayilan: 0,
      atlanan: 0,
      islenmis: [],
      bosYenileme: 0,
      sonYenileme: 0,
      bittiMi: false,
    });
    await kaydet(d);
    await ciz();
  });

  chrome.storage.onChanged.addListener(ciz);
  setInterval(ciz, 1000);
})();
