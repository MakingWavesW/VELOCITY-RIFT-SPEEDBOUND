import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Profiles } from "../server/profiles.ts";
import { freshEngagement } from "../shared/engagement.ts";
const db = new Profiles(".data/profiles.sqlite"),
  fixture = db.acquire(),
  state = freshEngagement(Date.now());
state.activeMs = 120000;
db.save(fixture.id, { ...fixture.data, engagement: state });
db.release(fixture.id);
db.close();
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
await fs.mkdir("artifacts/v5", { recursive: true });
const errors = [];
try {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
  });
  await ctx.addInitScript((token) => {
    localStorage.setItem("rift-runner-token", token);
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    );
  }, fixture.token);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://localhost:5173");
  await enterMenu(p);
  await p.locator("#name").fill("Reward tester");
  await p.locator("#join").click();
  await p.waitForFunction(() => window.riftDiagnostics?.predicted);
  await p.locator("#playtimeButton .ready-badge").waitFor({ state: "visible" });
  await p.locator("#playtimeButton").click();
  await p.locator('[data-kind="playtime"][data-id="0"]').click();
  await p.locator("#playtimeButton .ready-badge").waitFor({ state: "hidden" });
  await p.waitForFunction(() => window.riftDiagnostics.predicted.gems === 5);
  await p.screenshot({
    path: "artifacts/v5/playtime.png",
    animations: "disabled",
  });
  await p.locator("#rewardHub .panel-head button").click();
  await p.locator("#rewardHub").waitFor({ state: "hidden" });
  await p.locator("#dailyButton").click();
  await p.locator('[data-kind="daily"]:enabled').click();
  await p.locator("#dailyButton .ready-badge").waitFor({ state: "hidden" });
  await p.waitForFunction(() => window.riftDiagnostics.predicted.gems === 8);
  assert.equal(await p.locator('[data-kind="daily"]:enabled').count(), 0);
  await p.screenshot({
    path: "artifacts/v5/daily.png",
    animations: "disabled",
  });
  await p.keyboard.press("Escape");
  await p.locator("#rewardHub").waitFor({ state: "hidden" });
  await p.locator("#boostCenterButton").click();
  assert.equal(await p.locator("[data-boost]").count(), 3);
  assert.equal(await p.locator("[data-boost]:disabled").count(), 3);
  await p.screenshot({
    path: "artifacts/v5/boosts.png",
    animations: "disabled",
  });
  await p.locator(".no-thanks").click();
  await p.locator("#boostCenter").waitFor({ state: "hidden" });
  for (const size of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
  ]) {
    await p.setViewportSize(size);
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.locator("#dailyButton").tap();
    await p.screenshot({
      path: `artifacts/v5/mobile-${size.width}.png`,
      animations: "disabled",
    });
    const r = await p.locator("#rewardHub").boundingBox();
    assert.ok(r.x >= 0 && r.x + r.width <= size.width);
    await p.keyboard.press("Escape");
    await p.locator("#rewardHub").waitFor({ state: "hidden" });
    const rail = await p.locator(".menu").boundingBox(),
      stick = await p.locator("#stick").boundingBox();
    assert.ok(
      rail.y + rail.height <= stick.y,
      "navigation must clear touch movement",
    );
    await p.screenshot({
      path: `artifacts/v5/touch-world-${size.width}.png`,
      animations: "disabled",
    });
  }
  await p.reload();
  await enterMenu(p);
  await p.locator("#join").click();
  await p.waitForFunction(() => window.riftDiagnostics?.predicted?.gems === 8);
  await p.waitForTimeout(1500);
  assert.equal(await p.locator("#dailyButton .ready-badge").isVisible(), false);
  assert.equal(
    await p.locator("#playtimeButton .ready-badge").isVisible(),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "V5 UI: atomic claims, badges, calendar, disabled three-offer preview, Escape/focus, mobile/reduced motion and reconnect passed",
  );
} finally {
  await browser.close();
}
