import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

// Real local Colyseus + WebGL screenshot evidence. The screenshot is NOT
// generated concept art and does NOT prove official Playgama hosting.
await fs.mkdir("artifacts/sunburst-reference", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.addInitScript(() => {
    localStorage.setItem("rift-visual-settings",
      JSON.stringify({ quality: "medium", comfort: true, muted: true }));
  });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await enterMenu(page);
  await page.locator("#name").fill("Sunburst Visual QA");
  await page.locator("#join").click();
  await page.waitForFunction(() => window.riftDiagnostics?.predicted, null, { timeout: 50000 });
  await page.waitForFunction(
    () => window.riftDiagnostics?.city?.loaded >= 12,
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(900);
  const world = await page.evaluate(() => window.riftDiagnostics);
  assert.ok(world.predicted, "An authoritative multiplayer session must exist");
  assert.ok(world.city.loaded >= 12, "Reference city GLBs should render");
  assert.deepEqual(errors, [], "No browser runtime exceptions");
  await page.screenshot({ path: "artifacts/sunburst-reference/sunburst-plaza-live.png" });
  console.log(JSON.stringify({
    screenshot: "artifacts/sunburst-reference/sunburst-plaza-live.png",
    verified: "Real Colyseus joined session with streamed GLBs",
    cityModelsLoaded: world.city.loaded, drawCalls: world.drawCalls,
    triangles: world.triangles, frameMs: world.frameMs,
    browserErrors: errors,
  }, null, 2));
} finally {
  await browser.close();
}
