import assert from "node:assert/strict";
import { test } from "node:test";
import { FEED_URL, PROFILE_URL, launch, makeFeed } from "./helpers.mjs";

const start = (run) => run.popup.locator("#anaDugme").click();

test("Count first reads the real total and deletes nothing", async () => {
  const feed = makeFeed({ total: 30 });
  const run = await launch(feed);
  try {
    await start(run);
    const done = await run.until((s) => s.bittiMi);
    assert.equal(done.sayilan, 30);
    assert.equal(feed.deleted.length, 0);
    assert.equal(feed.remaining.length, 30);
    assert.deepEqual(run.leaked, []);
  } finally {
    await run.close();
  }
});

test("keeps going when the feed stops refilling, across reloads, to the very end", async () => {
  // Only 3 posts are served per page load, like the real feed running dry.
  const feed = makeFeed({ total: 7, feedLimit: 3 });
  const run = await launch(feed, { prova: false, yenilemeAraligi: 3 });
  try {
    await start(run);
    const done = await run.until((s) => s.bittiMi);
    assert.equal(done.silinen, 7);
    assert.equal(feed.remaining.length, 0);
    assert.ok(feed.loads >= 3, `expected reloads, saw ${feed.loads} page loads`);
    assert.deepEqual(run.leaked, []);
  } finally {
    await run.close();
  }
});

test("waits for a slow page instead of declaring the list finished", async () => {
  const feed = makeFeed({ total: 2, renderDelayMs: 12_000 });
  const run = await launch(feed, { prova: false });
  try {
    await start(run);
    await run.until((s) => s.silinen === 2 || s.bittiMi);
    assert.equal(feed.remaining.length, 0);
  } finally {
    await run.close();
  }
});

test("finds the delete row by text when LinkedIn's CSS class is missing (German UI)", async () => {
  const feed = makeFeed({ total: 2, lang: "de" });
  const run = await launch(feed, { prova: false });
  try {
    await start(run);
    await run.until((s) => s.silinen === 2);
    assert.equal(feed.remaining.length, 0);
  } finally {
    await run.close();
  }
});

test("skips a post it cannot delete and leaves it alone", async () => {
  const feed = makeFeed({ total: 2, protectedIds: [1000] });
  const run = await launch(feed, { prova: false });
  try {
    await start(run);
    const state = await run.until((s) => s.silinen === 1 && s.atlanan === 1);
    assert.deepEqual(feed.deleted, [1001]);
    assert.equal(feed.remaining[0].id, 1000);
    assert.equal(state.atlanan, 1);
  } finally {
    await run.close();
  }
});

test("Stop halts the run before the list is finished", async () => {
  const feed = makeFeed({ total: 8 });
  const run = await launch(feed, { prova: false });
  try {
    await start(run);
    await run.until((s) => s.silinen >= 1);
    const atStop = feed.deleted.length;
    await start(run);
    // The post already in progress may finish. Nothing after it may be touched.
    await new Promise((r) => setTimeout(r, 5000));
    const settled = feed.deleted.length;
    assert.ok(settled <= atStop + 1, `stopped at ${atStop}, but ${settled} were deleted`);
    await new Promise((r) => setTimeout(r, 5000));
    assert.equal(feed.deleted.length, settled);
    assert.ok(feed.remaining.length > 0);
    assert.equal((await run.state()).calisiyor, false);
  } finally {
    await run.close();
  }
});

test("Stop also ends a Count first run", async () => {
  const feed = makeFeed({ total: 30 });
  const run = await launch(feed);
  try {
    await start(run);
    await run.until((s) => s.calisiyor && s.sayilan > 0);
    await start(run);
    await new Promise((r) => setTimeout(r, 4000));
    const state = await run.state();
    assert.equal(state.calisiyor, false);
    assert.equal(state.bittiMi, false);
    assert.equal(feed.deleted.length, 0);
  } finally {
    await run.close();
  }
});

test("on any other profile page it offers to open the activity page instead", async () => {
  const feed = makeFeed({ total: 1 });
  const run = await launch(feed, { startUrl: PROFILE_URL });
  try {
    assert.match(await run.popup.locator("#anaDugme").innerText(), /Open my posts page/);
    await start(run).catch(() => {});
    await run.tab.waitForURL(FEED_URL);
    assert.equal(feed.deleted.length, 0);
  } finally {
    await run.close();
  }
});
