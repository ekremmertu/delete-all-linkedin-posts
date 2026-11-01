// Records docs/demo.gif: the real extension working through the simulated feed.
// Every name on screen is fictional, and the page says it is simulated.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_DIR, launch, makeFeed } from "./helpers.mjs";

const frames = mkdtempSync(join(tmpdir(), "lpc-frames-"));
mkdirSync(join(frames, "feed"));
mkdirSync(join(frames, "popup"));

const feed = makeFeed({ total: 8, feedLimit: 4 });
const run = await launch(feed, { prova: false, yenilemeAraligi: 4 }, { popupViewport: { width: 340, height: 620 } });

let frame = 0;
const shoot = async () => {
  const name = String(frame++).padStart(4, "0") + ".png";
  await run.tab.screenshot({ path: join(frames, "feed", name) });
  await run.popup.screenshot({ path: join(frames, "popup", name) });
};

await shoot();
await shoot();
await run.popup.locator("#anaDugme").click();
const end = Date.now() + 180_000;
let holdAfterDone = 16;
while (Date.now() < end && holdAfterDone > 0) {
  await shoot();
  if ((await run.state()).bittiMi) holdAfterDone -= 1;
}
await run.close();

execFileSync("ffmpeg", [
  "-y", "-loglevel", "error", "-framerate", "16",
  "-i", join(frames, "feed", "%04d.png"),
  "-framerate", "16",
  "-i", join(frames, "popup", "%04d.png"),
  "-filter_complex",
  "[0:v][1:v]hstack=inputs=2,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
  join(EXTENSION_DIR, "docs", "demo.gif"),
]);
rmSync(frames, { recursive: true, force: true });
console.log(`${frame} frames, ${feed.deleted.length} posts deleted, ${feed.loads} page loads`);
