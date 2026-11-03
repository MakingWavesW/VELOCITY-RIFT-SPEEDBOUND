import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Profiles } from "../server/profiles.ts";
const db = new Profiles(process.env.RIFT_PROFILE_DB || ".data/profiles.sqlite");
const fixture = db.acquire();
db.save(fixture.id, { ...fixture.data, gems: 30 });
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
await fs.mkdir("artifacts/city", { recursive: true });
const errors = [];
try {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
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
  await p.locator("#name").fill("Crystal test");
  await p.locator("#join").click();
  await p.waitForFunction(() => window.riftDiagnostics?.predicted);
  const population = await p.evaluate(() => window.riftDiagnostics.orbs.length);
  assert.ok(population >= 50 && population <= 100);
  await p.keyboard.down("d");
  await p.waitForTimeout(1800);
  await p.keyboard.up("d");
  await p.keyboard.down("s");
  await p.waitForTimeout(1500);
  await p.keyboard.up("s");
  await p.locator("#crystalInteract").waitFor({ state: "visible" });
  await p.locator("#crystalInteract").click();
  assert.equal(await p.locator(".crystal-chances article").count(), 6);
  const chances = await p
    .locator(".crystal-chances article small:first-of-type")
    .allTextContents();
  assert.ok(chances.some((c) => c.includes("1%")));
  await p.screenshot({
    animations: "disabled",
    path: "artifacts/city/crystal.png",
  });
  await p.locator("#openCrystal").click();
  await p.waitForFunction(() =>
    document
      .querySelector(".crystal-result")
      ?.textContent.includes("NEW COMPANION"),
  );
  await p.locator("#closeCompanions").click();
  await p.waitForFunction(() => window.riftDiagnostics.predicted.equippedPetId);
  await p.locator("#petsButton").click();
  assert.equal(await p.locator(".pet-grid button").count(), 12);
  assert.match(await p.locator(".pet-lineup").innerText(), /Following you:/);
  await p.screenshot({
    animations: "disabled",
    path: "artifacts/city/pets.png",
  });
  await p.locator("#closeCompanions").click();
  await p.locator('[data-panel="settings"].gear').click();
  await p.locator("#dayCycle").uncheck();
  await p.locator("#night").check();
  await p.locator("#closePanel").click();
  await p.waitForTimeout(2500);
  await p.screenshot({
    animations: "disabled",
    path: "artifacts/city/night.png",
  });
  await p.locator('[data-panel="settings"].gear').click();
  await p.locator("#dayCycle").check();
  await p.locator("#closePanel").click();
  // Wait a genuine minute of gameplay. The offer is deferred while a dialog is open.
  await p.waitForTimeout(61000);
  await p.locator("#timedRewardOffer").waitFor({ state: "visible" });
  assert.equal(await p.locator(".watch-offer").isDisabled(), true);
  await p.locator(".dismiss-offer").click();
  assert.equal(await p.locator("#timedRewardOffer").count(), 0);
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
  await enterMenu(m);
  await m.locator("#name").fill("Touch City");
  await m.locator("#join").click();
  await m.waitForFunction(() => window.riftDiagnostics?.predicted);
  await m.locator("#stick").waitFor({ state: "visible" });
  const rect = await m.locator("#stick").boundingBox();
  await m.dispatchEvent("#stick", "pointerdown", {
    pointerId: 1,
    clientX: rect.x + rect.width / 2,
    clientY: rect.y + 8,
  });
  await m.waitForTimeout(2000);
  await m.dispatchEvent("#stick", "pointerup", { pointerId: 1 });
  await m.waitForFunction(() => window.riftDiagnostics.predicted.steps > 0);
  await m.locator("#petsButton").click();
  await m.screenshot({
    animations: "disabled",
    path: "artifacts/city/mobile-pets.png",
  });
  await m.locator("#closeCompanions").click();
  await m.screenshot({
    animations: "disabled",
    path: "artifacts/city/mobile-world.png",
  });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "artifacts/city/results.json",
    JSON.stringify(
      {
        population,
        crystalPurchase: true,
        petEquipped: true,
        oneMinuteOffer: true,
        offerDisabled: true,
        mobileMovement: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Main City browser checks passed: crystal purchase, pet collection, night controls, real-minute gated offer and mobile movement.",
  );
} finally {
  await browser.close();
}
