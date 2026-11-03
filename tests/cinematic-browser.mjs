import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
await fs.mkdir("artifacts/cinematic", { recursive: true });
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    ),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5173");
  await page
    .locator("#beginIntro")
    .waitFor({ state: "visible", timeout: 30000 });
  await page.locator("#beginIntro").click();
  await page.waitForFunction(
    () => document.querySelector("#studioIntro video")?.currentTime > 1,
  );
  const intro = await page.evaluate(() => ({
    media: window.riftDiagnostics.media,
    muted: document.querySelector("video").muted,
    children: document.querySelector("#studioIntro").children.length,
    video: document.querySelector("video").currentTime,
  }));
  assert.equal(intro.media.state, "STUDIO_INTRO");
  assert.equal(intro.media.musicChannels, 0);
  assert.equal(intro.children, 1);
  assert.equal(intro.muted, false);
  await page
    .locator("#studioIntro")
    .waitFor({ state: "detached", timeout: 30000 });
  assert.equal(
    await page.evaluate(() => window.riftDiagnostics.media.musicChannels),
    0,
  );
  assert.match(
    await page
      .locator("#entry")
      .evaluate((e) => getComputedStyle(e).backgroundImage),
    /sunset.png/,
  );
  await page.screenshot({ path: "artifacts/cinematic/menu.png" });
  await page.locator(".menu-settings").click();
  await page.locator("#music").fill("0.2");
  await page.locator("#muted").check();
  await page.locator("#closePanel").click();
  await page.locator("#name").fill("Cinema Runner");
  await page.locator("#join").click();
  await page.waitForFunction(
    () => window.riftDiagnostics?.localId && window.riftDiagnostics.predicted,
  );
  await page.waitForFunction(() => localStorage.getItem("rift-runner-token"));
  assert.equal(
    await page.evaluate(() => window.riftDiagnostics.media.musicChannels),
    0,
  );
  await page.locator('[data-panel="settings"].gear').click();
  await page.locator("#muted").uncheck();
  await page.locator("#closePanel").click();
  assert.equal(
    await page.evaluate(() => window.riftDiagnostics.media.musicChannels),
    1,
  );
  await page.keyboard.down("w");
  await page.waitForTimeout(3000);
  await page.keyboard.up("w");
  await page.locator('[data-panel="rebirth"]').click();
  assert.equal(await page.locator("#confirmRebirth").isDisabled(), true);
  await page.locator("#cancelRebirth").click();
  await page.locator('[data-panel="trails"]').click();
  assert.equal(await page.locator(".trail-card").count(), 77);
  await page.locator("#trailNext").click();
  await page.locator("#closePanel").click();
  // Presentation fixture verifies snapshot deduplication and reconnect baseline without granting progress.
  const levels = await page.evaluate(async () => {
    const { LevelCelebration } = await import("/src/ui/celebration.ts");
    const c = new LevelCelebration();
    c.snapshot(5, false);
    const initial = !!document.querySelector("#levelCelebration");
    c.snapshot(6, false);
    c.snapshot(6, false);
    c.snapshot(8, false);
    const count = document.querySelectorAll("#levelCelebration").length;
    const text = document.querySelector(
      "#levelCelebration strong",
    )?.textContent;
    c.reset();
    c.snapshot(8, false);
    return {
      initial,
      count,
      text,
      reconnect: !!document.querySelector("#levelCelebration"),
    };
  });
  assert.deepEqual(levels, {
    initial: false,
    count: 1,
    text: "LEVEL 8",
    reconnect: false,
  });
  await page.screenshot({ path: "artifacts/cinematic/gameplay.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/cinematic/mobile.png" });
  await page.locator('[data-panel="settings"].gear').click();
  assert.equal(await page.locator("#music").inputValue(), "0.2");
  await page.locator("#closePanel").click();
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "artifacts/cinematic/results.json",
    JSON.stringify(
      { intro, levels, errors, desktop: true, mobile: true },
      null,
      2,
    ),
  );
  console.log(
    "Cinematic startup, audio exclusivity, artwork, settings, 77 trails, rebirth eligibility, level deduplication, and responsive UI passed",
  );
} finally {
  await browser.close();
}
