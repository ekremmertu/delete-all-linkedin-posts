import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { EXTENSION_DIR } from "./helpers.mjs";

const read = (file) => readFileSync(join(EXTENSION_DIR, file), "utf8");
const trackedFiles = () =>
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: EXTENSION_DIR,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);

test("no real LinkedIn account appears anywhere in the repo", () => {
  const placeholders = new Set(["<you>", "<me>", "<sen>", "me", "demo", "*", "${kullanici[1]}"]);
  const found = [];
  for (const file of trackedFiles().filter((f) => !/\.(png|gif|ico|lock)$/.test(f) && f !== "package-lock.json")) {
    for (const match of read(file).matchAll(/linkedin\.com\/in\/([^\s/`)'"]+)/gi)) {
      if (!placeholders.has(match[1])) found.push(`${file}: ${match[1]}`);
    }
  }
  assert.deepEqual(found, []);
});

test("the extension code makes no network requests of its own", () => {
  for (const file of ["content.js", "popup.js"]) {
    assert.doesNotMatch(read(file), /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\b|sendBeacon/, file);
  }
});

test("the manifest asks only for what it needs", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual([...manifest.permissions].sort(), ["storage", "tabs"]);
  assert.deepEqual(manifest.host_permissions, ["https://www.linkedin.com/*"]);
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://www.linkedin.com/in/*"]);
  for (const icon of Object.values(manifest.icons)) assert.ok(existsSync(join(EXTENSION_DIR, icon)), icon);
});
