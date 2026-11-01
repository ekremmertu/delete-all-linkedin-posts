// Runs the real extension in real Chromium against a simulated activity feed.
// Every linkedin.com request is answered locally; nothing reaches the network,
// and all names on the page are fictional.

import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

export const EXTENSION_DIR = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
export const FEED_URL = "https://www.linkedin.com/in/demo/recent-activity/all/";
export const PROFILE_URL = "https://www.linkedin.com/in/demo/";

const AUTHORS = ["Alex Example", "Sam Sample", "Robin Placeholder"];
const TOPICS = [
  "Thoughts on shipping small things often.",
  "Three lessons from last quarter.",
  "We are hiring. Or we were, back then.",
  "A long post about a short meeting.",
  "Grateful and humbled to announce a thing.",
];

const LABELS = {
  en: { row: "Delete post", confirm: "Delete", cancel: "Cancel" },
  de: { row: "Post löschen", confirm: "Löschen", cancel: "Abbrechen" },
};

// Unpacked extension ids are derived from the folder path.
function extensionId(path) {
  const hex = createHash("sha256").update(path).digest("hex").slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}

function card(post, lang) {
  const label = LABELS[lang];
  const row = post.deletable
    ? lang === "en"
      ? `<li class="option-delete"><div role="button">${label.row}</div></li>`
      : `<li><div role="button">${label.row}</div></li>`
    : `<li><div role="button">Copy link</div></li>`;
  return `<article class="post" data-urn="urn:li:activity:${post.id}">
    <span class="stamp">Feed post number ${post.number}</span>
    <header><b>${post.author}</b><button class="feed-shared-control-menu__trigger" aria-label="Open control menu">…</button></header>
    <p>${post.text}</p>
    <ul class="menu" hidden>${row}</ul>
  </article>`;
}

function page(feed) {
  const visible = feed.remaining.slice(0, feed.feedLimit);
  const label = LABELS[feed.lang];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Simulated feed</title><style>
    body{margin:0;background:#f4f2ee;font:15px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#1d2226}
    .bar{background:#1d2226;color:#fff;padding:10px 18px;font-size:13px;display:flex;justify-content:space-between}
    main{max-width:620px;margin:16px auto;padding:0 12px}
    .post{position:relative;background:#fff;border:1px solid #e0dfdc;border-radius:10px;padding:14px 16px;margin-bottom:10px}
    .post header{display:flex;justify-content:space-between;align-items:center}
    .post p{margin:6px 0 0}.stamp{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    button{font:inherit;cursor:pointer}.feed-shared-control-menu__trigger{border:0;background:none;font-size:18px}
    .menu{position:absolute;right:12px;top:42px;z-index:2;margin:0;padding:6px;list-style:none;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 14px #0002}
    .menu div{padding:6px 12px}.overlay{position:absolute;inset:0;min-height:100%;background:#0006;z-index:3}
    .artdeco-modal{position:relative;width:340px;margin:120px auto;background:#fff;border-radius:10px;padding:18px}
    .artdeco-modal button{padding:6px 14px;border-radius:16px;border:1px solid #888;background:#fff;margin:10px 6px 0 0}
    .artdeco-button--primary{background:#0a66c2!important;color:#fff;border-color:#0a66c2!important}
  </style></head><body>
    <div class="bar"><span>Simulated feed · fictional names · not LinkedIn</span><span id="left">${feed.remaining.length} posts left</span></div>
    <main>${visible.map((p) => card(p, feed.lang)).join("") || "<p>No posts.</p>"}</main>
  <script>
    let left = ${feed.remaining.length};
    document.addEventListener("click", async (event) => {
      const trigger = event.target.closest(".feed-shared-control-menu__trigger");
      if (trigger) { trigger.closest(".post").querySelector(".menu").hidden = false; return; }
      const row = event.target.closest(".menu [role=button]");
      if (!row) return;
      const post = row.closest(".post");
      post.querySelector(".menu").hidden = true;
      if (row.textContent === "Copy link") return;
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.style.height = document.documentElement.scrollHeight + "px";
      overlay.innerHTML = '<div class="artdeco-modal" role="alertdialog"><b>Delete this post?</b><br><button>${label.cancel}</button><button class="artdeco-button--primary">${label.confirm}</button></div>';
      overlay.querySelector(".artdeco-button--primary").addEventListener("click", async () => {
        await fetch("/__delete/" + post.dataset.urn, { method: "POST" });
        post.remove(); overlay.remove();
        document.getElementById("left").textContent = (--left) + " posts left";
      });
      document.body.append(overlay);
    });
  </script></body></html>`;
}

export function makeFeed({ total, feedLimit = total, lang = "en", protectedIds = [] }) {
  return {
    feedLimit,
    lang,
    deleted: [],
    loads: 0,
    remaining: Array.from({ length: total }, (_, i) => ({
      id: 1000 + i,
      number: i + 1,
      author: AUTHORS[i % AUTHORS.length],
      text: TOPICS[i % TOPICS.length],
      deletable: !protectedIds.includes(1000 + i),
    })),
  };
}

// Opens the feed and the extension popup, with no real network access.
export async function launch(feed, settings = {}, { popupViewport } = {}) {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "lpc-")), {
    channel: "chromium",
    headless: true,
    locale: "en-US",
    viewport: { width: 760, height: 620 },
    args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
  });

  const leaked = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "chrome-extension:") return route.continue();
    if (url.hostname !== "www.linkedin.com") {
      leaked.push(url.href);
      return route.abort();
    }
    if (url.pathname.startsWith("/__delete/")) {
      const id = Number(url.pathname.split(":").pop());
      feed.deleted.push(id);
      feed.remaining = feed.remaining.filter((p) => p.id !== id);
      return route.fulfill({ status: 200, body: "ok" });
    }
    if (url.pathname === new URL(FEED_URL).pathname) {
      feed.loads += 1;
      return route.fulfill({ status: 200, contentType: "text/html", body: page(feed) });
    }
    if (url.pathname === new URL(PROFILE_URL).pathname) {
      return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Profile</title><h1>Alex Example</h1>" });
    }
    return route.fulfill({ status: 204, body: "" });
  });

  const tab = context.pages()[0] || (await context.newPage());
  await tab.goto(settings.startUrl || FEED_URL);

  const popup = await context.newPage();
  if (popupViewport) await popup.setViewportSize(popupViewport);
  // Opened as a tab, the popup would see itself as the active tab. This one
  // shim points it at the LinkedIn tab; the rest of popup.js runs untouched.
  await popup.addInitScript(() => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (filter) =>
      filter && filter.active ? query({ url: "https://www.linkedin.com/*" }) : query(filter);
  });
  const popupUrl = `chrome-extension://${extensionId(EXTENSION_DIR)}/popup.html`;
  await popup.goto(popupUrl);
  const { startUrl, ...stored } = settings;
  await popup.evaluate((value) => chrome.storage.local.set({ lpc: value }), {
    prova: true,
    beklemeMin: 0,
    beklemeMax: 50,
    yenilemeAraligi: 50,
    ...stored,
  });
  await popup.reload();
  await tab.bringToFront();

  const state = async () => (await popup.evaluate(() => chrome.storage.local.get("lpc"))).lpc;
  const until = async (test, ms = 150_000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const current = await state();
      if (test(current)) return current;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error("Timed out. Last state: " + JSON.stringify(await state()));
  };

  return { context, tab, popup, state, until, leaked, close: () => context.close() };
}
