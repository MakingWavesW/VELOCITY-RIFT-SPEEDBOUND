import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
fs.mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [];
const results = {};
try {
  const a = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    b = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  for (const c of [a, b])
    await c.addInitScript(() =>
      localStorage.setItem(
        "rift-visual-settings",
        JSON.stringify({ quality: "low" }),
      ),
    );
  const p = await a.newPage(),
    q = await b.newPage();
  for (const page of [p, q])
    page.on("pageerror", (e) => errors.push(e.message));
  console.log("loading entry");
  await p.goto("http://localhost:5173");
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: "artifacts/welcome.png" });
  console.log("joining players");
  for (const [page, name] of [
    [p, "Astra"],
    [q, "Nova"],
  ]) {
    if (page === q) await page.goto("http://localhost:5173");
    await page.locator("#name").fill(name);
    await page.locator("#join").click();
    await page.locator("#entry").waitFor({ state: "hidden" });
  }
  await p.waitForFunction(
    () => Object.keys(window.riftDiagnostics.players).length === 2,
  );
  console.log("moving player");
  await p.bringToFront();
  await p
    .locator("canvas")
    .first()
    .click({ position: { x: 720, y: 500 } });
  await p.keyboard.down("w");
  await p.waitForTimeout(3000);
  await p.keyboard.up("w");
  results.movement = await p.evaluate(() => window.riftDiagnostics);
  const id = results.movement.localId;
  assert.ok(results.movement.players[id].steps > 0, "movement must earn steps");
  await q.waitForFunction((id) => {
    const d = window.riftDiagnostics;
    return d.avatars.some((a) => a.id === id && a.z < -2);
  }, id);
  console.log("remote movement verified");
  results.remoteMovement = true;
  await p.screenshot({ path: "artifacts/day-multiplayer.png" });
  await p.keyboard.press("Space");
  await p.waitForFunction(() => {
    const d = window.riftDiagnostics;
    return d.players[d.localId].y > 0;
  });
  await q.waitForFunction(
    (id) =>
      window.riftDiagnostics.avatars.some((a) => a.id === id && a.y > 0.2),
    id,
  );
  console.log("remote jump verified");
  results.remoteJump = true;
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "artifacts/day-multiplayer.png" });
  console.log("settings");
  await p.locator('[data-panel="settings"]').click();
  await p.locator("#night").check();
  await p.locator("#closePanel").click();
  await p.waitForTimeout(7000);
  await p.screenshot({ path: "artifacts/night-multiplayer.png" });
  await p.locator('[data-panel="map"]').click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: "artifacts/island-map.png" });
  await p.locator("#closePanel").click();
  console.log("settings");
  await p.locator('[data-panel="settings"]').click();
  await p.locator("#night").uncheck();
  await p.locator("#quality").selectOption("low");
  await p.locator("#closePanel").click();
  results.lowQuality = await p.evaluate(() => window.riftDiagnostics);
  await b.close();
  await p.waitForFunction(
    () => Object.keys(window.riftDiagnostics.players).length === 1,
  );
  results.softwareRendererProfile = await p.evaluate(async () => {
    const times = [];
    let last = performance.now();
    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      times.push(now - last);
      last = now;
    }
    return {
      frames: times.length,
      averageFrameMs: times.reduce((a, b) => a + b, 0) / times.length,
      drawCalls: window.riftDiagnostics.drawCalls,
      triangles: window.riftDiagnostics.triangles,
    };
  });
  await p.locator('[data-panel="settings"]').click();
  await p.locator("#quality").selectOption("high");
  await p.locator("#closePanel").click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "artifacts/day-high.png" });
  await p.locator('[data-panel="settings"]').click();
  await p.locator("#quality").selectOption("low");
  await p.locator("#closePanel").click();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  await mobile.addInitScript(() =>
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    ),
  );
  const m = await mobile.newPage();
  m.on("pageerror", (e) => errors.push(e.message));
  await m.goto("http://localhost:5173");
  await m.locator("#name").fill("Touch Runner");
  await m.locator("#join").click();
  await m.locator("#entry").waitFor({ state: "hidden" });
  await m.locator("#stick").waitFor({ state: "visible" });
  const s = await m.locator("#stick").boundingBox();
  await m.dispatchEvent("#stick", "pointerdown", {
    pointerId: 1,
    clientX: s.x + s.width / 2,
    clientY: s.y + 10,
  });
  await m.waitForTimeout(2000);
  await m.dispatchEvent("#stick", "pointerup", { pointerId: 1 });
  await m.waitForFunction(() => {
    const d = window.riftDiagnostics;
    return d.players[d.localId].steps > 0;
  });
  await m.locator("#jump").tap();
  await m.waitForTimeout(200);
  await m.screenshot({ path: "artifacts/mobile.png" });
  results.mobileMovement = true;
  assert.deepEqual(errors, []);
  results.errors = errors;
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(
    "artifacts/visual-results.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
