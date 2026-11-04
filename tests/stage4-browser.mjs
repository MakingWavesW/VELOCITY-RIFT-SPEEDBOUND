import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  desktop.on("pageerror", (e) => errors.push(e.message));
  await desktop.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await desktop.locator("#rewardDock").waitFor();
  assert.deepEqual(
    await desktop.locator("#rewardDock > button").evaluateAll((buttons) =>
      buttons.map((b) => b.id)),
    ["questsButton", "dailyButton", "playtimeButton"],
  );
  assert.equal(await desktop.locator(".settings-launcher").count(), 1);
  assert.ok(await desktop.locator(".menu .compact-game-icon").count() >= 5);
  assert.equal(await desktop.locator("#dailyButton .ready-badge").getAttribute("hidden"), "");
  assert.equal(await desktop.locator("#playtimeButton .ready-badge").getAttribute("hidden"), "");
  // Shortcut docks are not displayed over the cinematic intro or main menu.
  assert.equal(
    await desktop.locator(".settings-launcher").evaluate((b) => getComputedStyle(b).visibility),
    "hidden",
  );

  // Simulate the menu -> gameplay presentation transition without granting a
  // profile or bypassing any authoritative rewards.
  await desktop.evaluate(() => { document.body.dataset.mediaState = "GAMEPLAY"; });
  assert.equal(
    await desktop.locator(".settings-launcher").evaluate((b) => getComputedStyle(b).pointerEvents),
    "auto",
  );
  await desktop.locator(".settings-launcher").evaluate((button) => button.click());
  assert.equal(await desktop.locator("#panel").evaluate((panel) => panel.open), true);
  assert.ok(!(await desktop.locator("#landscapeOrientation").isVisible()));

  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true,
  });
  const portrait = await touch.newPage();
  await portrait.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await portrait.locator("#landscapeOrientation").waitFor();
  assert.ok(await portrait.locator("#landscapeOrientation").isVisible());
  await portrait.setViewportSize({ width: 844, height: 390 });
  assert.ok(!(await portrait.locator("#landscapeOrientation").isVisible()));
  await touch.close();
  assert.deepEqual(errors, [], "No uncaught Stage 4 GUI errors");
  console.log("Stage 4 GUI + landscape browser smoke checks passed");
} finally {
  await browser.close();
}
