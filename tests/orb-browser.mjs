import { enterMenu } from "./menu-helper.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
fs.mkdirSync("artifacts/orbs", { recursive: true });
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
const errors = [],
  result = {};
try {
  const a = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    }),
    b = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  for (const c of [a, b])
    await c.addInitScript(() => {
      localStorage.setItem(
        "rift-visual-settings",
        JSON.stringify({ quality: "low" }),
      );
      window.pickupEvidence = [];
      addEventListener("rift:orb-pickup", (e) => {
        const el = document.querySelector("#pickupFeed").lastElementChild;
        window.pickupEvidence.push({
          event: e.detail,
          text: el.textContent,
          tier: el.dataset.tier,
          color: getComputedStyle(el).borderColor,
        });
      });
    });
  const p = await a.newPage(),
    q = await b.newPage();
  for (const page of [p, q])
    page.on("pageerror", (e) => errors.push(e.message));
  for (const [page, name] of [
    [p, "Orb Runner"],
    [q, "Route Explorer"],
  ]) {
    await page.goto("http://localhost:5173"); await enterMenu(page);
    await page.locator("#name").fill(name);
    await page.locator("#join").click();
    await page.locator("#entry").waitFor({ state: "hidden" });
    await page.waitForFunction(() => window.riftDiagnostics?.orbs.length >= 50);
  }
  const first = await p.evaluate(() => window.riftDiagnostics),
    second = await q.evaluate(() => window.riftDiagnostics);
  assert.deepEqual(first.orbs, second.orbs);
  result.population = first.orbs.length;
  result.initialSharedLayout = true;
  result.tiers = Object.fromEntries(
    ["blue", "purple", "red", "gem"].map((t) => [
      t,
      first.orbs.filter((o) => o.tier === t).length,
    ]),
  );
  await p.bringToFront();
  await p
    .locator("canvas")
    .first()
    .click({ position: { x: 650, y: 430 } });
  await p.screenshot({ path: "artifacts/orbs/day.png" });
  const target = first.orbs
    .filter((o) => o.route === "starter" && o.tier === "blue")
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  console.log("Walking to live orb", target.id);
  let held = new Set();
  for (let i = 0; i < 45; i++) {
    const d = await p.evaluate(() => ({
      d: window.riftDiagnostics,
      e: window.pickupEvidence,
    }));
    if (d.e.some((e) => e.event.orb.id === target.id)) break;
    const me = d.d.players[d.d.localId],
      dx = target.x - me.x,
      dz = target.z - me.z;
    const next = new Set();
    if (Math.abs(dx) > 0.6) next.add(dx > 0 ? "d" : "a");
    if (Math.abs(dz) > 0.6) next.add(dz > 0 ? "s" : "w");
    for (const k of held) if (!next.has(k)) await p.keyboard.up(k);
    for (const k of next) if (!held.has(k)) await p.keyboard.down(k);
    held = next;
    await p.waitForTimeout(300);
  }
  for (const k of held) await p.keyboard.up(k);
  const evidence = await p.evaluate(() => window.pickupEvidence);
  const pickup = evidence.find((e) => e.event.orb.id === target.id);
  assert.ok(pickup, "real pickup reached with keyboard");
  assert.equal(pickup.tier, "blue");
  assert.ok(
    pickup.text.includes(
      `+${pickup.event.steps} Steps  +${pickup.event.xp} XP`,
    ),
  );
  assert.equal(pickup.event.steps, 2);
  assert.equal(pickup.color, "rgb(16, 220, 255)");
  result.pickup = evidence;
  await p.screenshot({ path: "artifacts/orbs/pickup.png" });
  await q.waitForFunction(
    (id) => !window.riftDiagnostics.orbs.some((o) => o.id === id),
    target.id,
  );
  result.sharedDisappearance = true;
  // Verify eventual relocation on both browsers without fabricating a renderer state.
  await p.waitForFunction(
    (id) =>
      window.riftDiagnostics.orbs.some((o) => o.id === id && o.generation > 1),
    target.id,
    { timeout: 15000 },
  );
  await q.waitForFunction(
    (id) =>
      window.riftDiagnostics.orbs.some((o) => o.id === id && o.generation > 1),
    target.id,
    { timeout: 15000 },
  );
  const next = await p.evaluate(
    (id) => window.riftDiagnostics.orbs.find((o) => o.id === id),
    target.id,
  );
  assert.ok(Math.hypot(next.x - target.x, next.z - target.z) >= 3);
  result.respawn = next;
  await b.close();
  await p.locator('[data-panel="settings"]').click();
  await p.locator("#night").check();
  await p.locator("#closePanel").click();
  await p.waitForTimeout(7000);
  await p.screenshot({ path: "artifacts/orbs/night.png" });
  const profile = await p.evaluate(async () => {
    const times = [];
    let last = performance.now();
    for (let i = 0; i < 20; i++) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      times.push(now - last);
      last = now;
    }
    return {
      meanFrameMs: times.reduce((a, b) => a + b, 0) / times.length,
      drawCalls: window.riftDiagnostics.drawCalls,
      triangles: window.riftDiagnostics.triangles,
    };
  });
  result.softwareRenderer = profile;
  await a.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobile.addInitScript(() =>
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    ),
  );
  const m = await mobile.newPage();
  m.on("pageerror", (e) => errors.push(e.message));
  await m.goto("http://localhost:5173"); await enterMenu(m);
  await m.locator("#name").fill("Touch Runner");
  await m.locator("#join").click();
  await m.locator("#entry").waitFor({ state: "hidden" });
  await m.waitForFunction(() => window.riftDiagnostics?.orbs.length >= 50);
  const s = await m.locator("#stick").boundingBox();
  await m.dispatchEvent("#stick", "pointerdown", {
    pointerId: 1,
    clientX: s.x + s.width / 2,
    clientY: s.y + 5,
  });
  await m.waitForTimeout(2000);
  await m.dispatchEvent("#stick", "pointerup", { pointerId: 1 });
  await m.waitForFunction(() => {
    const d = window.riftDiagnostics;
    return d.players[d.localId].steps > 0;
  });
  const legend = await m.locator("#orbLegend").boundingBox(),
    loc = await m.locator("#location").boundingBox();
  assert.ok(legend.y >= loc.y + loc.height);
  const xp = await m.locator(".levelbar").boundingBox();
  assert.ok(s.y + s.height < xp.y);
  await m.screenshot({ path: "artifacts/orbs/mobile.png" });
  result.mobile = true;
  assert.deepEqual(errors, []);
  result.errors = errors;
  fs.writeFileSync(
    "artifacts/orbs/results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
