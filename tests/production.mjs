import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
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
try {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await ctx.addInitScript(() =>
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    ),
  );
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://localhost:4173");
  await p.locator("#name").fill("Coast Runner");
  await p.locator("#join").click();
  await p.locator("#entry").waitFor({ state: "hidden" });
  await p.waitForFunction(() =>
    document.querySelector("#connection").textContent.includes("CONNECTED"),
  );
  await p.keyboard.down("w");
  await p.waitForTimeout(2000);
  await p.keyboard.up("w");
  assert.ok(Number(await p.locator("#steps").textContent()) > 0);
  await p.screenshot({ path: "artifacts/production-desktop.png" });
  await ctx.close();
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
  await m.goto("http://localhost:4173");
  await m.locator("#name").fill("Mobile Runner");
  await m.locator("#join").click();
  await m.locator("#entry").waitFor({ state: "hidden" });
  await m.waitForTimeout(1000);
  const stick = await m.locator("#stick").boundingBox(),
    xp = await m.locator(".levelbar").boundingBox(),
    jump = await m.locator("#jump").boundingBox();
  assert.ok(stick.y + stick.height < xp.y, "joystick must not overlap XP");
  assert.ok(jump.y + jump.height < xp.y, "jump must not overlap XP");
  await m.locator('[data-panel="settings"]').tap();
  await m.locator("#comfort").check();
  await m.locator("#closePanel").tap();
  await m.screenshot({ path: "artifacts/production-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS production static build: connects, moves and earns steps; touch settings work; joystick and jump do not overlap XP; no JavaScript errors.",
  );
} finally {
  await browser.close();
}
