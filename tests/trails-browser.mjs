import { enterMenu } from "./menu-helper.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const out = "artifacts/trails";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [],
  contexts = [];
async function page(name, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1000, height: 700 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  contexts.push(context);
  await context.addInitScript(() =>
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    ),
  );
  const p = await context.newPage();
  p.setDefaultTimeout(30000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await p.goto("http://localhost:5173"); await enterMenu(p);
  await p.locator("#name").fill(name);
  await p.locator("#join").click();
  await p.waitForFunction(
    () =>
      window.riftDiagnostics?.localId &&
      Object.keys(window.riftDiagnostics.players).length,
    undefined,
    { timeout: 30000 },
  );
  return p;
}
try {
  const a = await page("Trail A"),
    b = await page("Trail B");
  await a.waitForFunction(
    () => Object.keys(window.riftDiagnostics.players).length === 2,
  );
  await a.bringToFront();
  await a.locator("body > canvas").click({ position: { x: 500, y: 350 } });
  await a.keyboard.down("w");
  await a.waitForFunction(
    () =>
      window.riftDiagnostics.avatars.find(
        (a) => a.id === window.riftDiagnostics.localId,
      )?.trailStats.segments > 3,
    undefined,
    { timeout: 30000 },
  );
  await a.waitForFunction(
    () =>
      window.riftDiagnostics.players[window.riftDiagnostics.localId].steps > 8,
    undefined,
    { timeout: 30000 },
  );
  await a.screenshot({ path: out + "/default-moving.png" });
  const during = await a.evaluate(() => window.riftDiagnostics);
  assert.equal(
    during.avatars.find((p) => p.id === during.localId).trail,
    "default-white",
  );
  await a.keyboard.up("w");
  await a.waitForFunction(
    () => {
      const d = window.riftDiagnostics;
      return (
        !d.players[d.localId].moving &&
        d.avatars.find((a) => a.id === d.localId)?.trailStats.segments === 0
      );
    },
    undefined,
    { timeout: 30000 },
  );
  await a.locator('[data-panel="trails"]').click();
  await a.waitForTimeout(900);
  await a.screenshot({ path: out + "/inventory.png" });
  assert.equal(await a.locator(".trail-card").count(), 77);
  await a.locator('[data-trail-id="special-hyperblast"]').click();
  assert.equal(await a.locator("#equipTrail").isDisabled(), true);
  assert.match(await a.locator("#trailBonuses").innerText(), /\+20 Steps/);
  assert.match(await a.locator("#trailBonuses").innerText(), /\+25 Gems/);
  await a.locator("#trailPreview").scrollIntoViewIfNeeded();
  await a.waitForTimeout(1000);
  await a.screenshot({ path: out + "/hyperblast-preview.png" });
  await a.locator("#closePanel").click();
  await a.keyboard.press("F3");
  assert.equal(await a.locator("#networkDiagnostics").isVisible(), true);
  await a.keyboard.press("F3");
  await b.context().close();
  console.log("Desktop trails and inventory passed");
  const mobile = await page("Touch runner", true);
  await mobile.locator('[data-panel="trails"]').click();
  await mobile.waitForTimeout(700);
  await mobile.screenshot({ path: out + "/mobile.png" });
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await mobile.locator("#closePanel").click();
  await mobile.context().close();
  console.log("Mobile layout passed");
  const samples = [];
  for (let n = 0; n < 12; n++) {
    samples.push(
      await a.evaluate(() => ({
        frameMs: window.riftDiagnostics.frameMs,
        predictionError: window.riftDiagnostics.predictionError,
        rtt: window.riftDiagnostics.rtt,
        pending: window.riftDiagnostics.pendingInputs,
      })),
    );
    await a.waitForTimeout(100);
  }
  await fs.writeFile(
    out + "/results.json",
    JSON.stringify({ during, samples, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      catalog: 77,
      frameMs: samples.map((s) => s.frameMs),
      errors,
    }),
  );
} finally {
  await browser.close();
}
