import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
await fs.mkdir("artifacts/hero", { recursive: true });
try {
  const ctx = await browser.newContext({
    viewport: { width: 1000, height: 750 },
  });
  await ctx.addInitScript(() =>
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    ),
  );
  const p = await ctx.newPage(),
    errors = [],
    requests = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (r.url().endsWith(".glb")) requests.push(r.url());
  });
  p.on("console", (m) => {
    if (
      m.type() === "warning" &&
      /bone|binding|Hero unavailable/i.test(m.text())
    )
      errors.push(m.text());
  });
  await p.goto("http://localhost:5173");
  await enterMenu(p);
  await p.locator("#name").fill("GLB Ranger");
  await p.locator("#join").click();
  await p.waitForFunction(() =>
    window.riftDiagnostics?.avatars.some((a) => a.heroStatus === "ready"),
  );
  await p.waitForTimeout(1000);
  await p.screenshot({ path: "artifacts/hero/idle.png" });
  await p.keyboard.down("s");
  await p.waitForTimeout(1400);
  await p.screenshot({ path: "artifacts/hero/run.png" });
  await p.keyboard.press("Space");
  await p.waitForTimeout(250);
  await p.screenshot({ path: "artifacts/hero/jump.png" });
  await p.keyboard.up("s");
  await p.waitForTimeout(1600);
  assert.equal(new Set(requests).size, 3);
  assert.equal(requests.length, 3);
  assert.deepEqual(errors, []);
  console.log(await p.evaluate(() => window.riftDiagnostics.avatars));
  const blocked = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  await blocked.route("**/*.glb", (r) => r.abort());
  const f = await blocked.newPage();
  await f.goto("http://localhost:5173");
  await enterMenu(f);
  await f.locator("#name").fill("Fallback");
  await f.locator("#join").click();
  await f.waitForFunction(() =>
    window.riftDiagnostics?.avatars.some((a) => a.heroStatus === "fallback"),
  );
  await f.screenshot({ path: "artifacts/hero/fallback.png" });
  console.log(
    "Hero loads, cache uses three requests, run/jump render, and mobile fallback works",
  );
} finally {
  await browser.close();
}
