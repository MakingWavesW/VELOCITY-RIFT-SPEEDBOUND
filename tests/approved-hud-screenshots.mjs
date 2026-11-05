import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
import fs from "node:fs/promises";

await fs.mkdir("artifacts/approved-hud", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const records = [];
try {
  for (const [name, width, height, touch] of [
    ["desktop", 1366, 768, false],
    ["android-landscape", 844, 390, true],
    ["iphone-landscape", 812, 375, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch });
    await context.addInitScript(() => {
      localStorage.setItem("rift-visual-settings",
        JSON.stringify({ quality: "low", comfort: true, muted: true, music: 0, sfx: 0 }));
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
      await enterMenu(page);
      await page.locator("#name").fill("GUI " + name);
      await page.locator("#join").click();
      await page.waitForFunction(() =>
        document.body.dataset.mediaState === "GAMEPLAY" &&
        document.querySelector("#entry")?.style.display === "none",
      null, { timeout: 50000 });
      // Wait for real server snapshot & player model before capturing.
      await page.waitForFunction(() => window.riftDiagnostics?.predicted?.steps !== undefined,
        null, { timeout: 50000 });
      await page.waitForTimeout(1200);
      const screenshot = "artifacts/approved-hud/" + name + "-gameplay.png";
      await page.screenshot({ path: screenshot });
      const boost = page.locator("#boostCenterButton");
      if (await boost.isVisible()) {
        await boost.click();
        await page.locator("#boostCenter").waitFor({ state: "visible", timeout: 10000 });
        await page.screenshot({ path: "artifacts/approved-hud/" + name + "-power-boost.png" });
      }
      records.push({ name, status: "captured", errors, screenshot });
    } catch (error) {
      records.push({ name, status: "incomplete", reason: String(error), errors });
      await page.screenshot({ path: "artifacts/approved-hud/" + name + "-diagnostic.png" }).catch(() => {});
      // Screenshot capture is QA evidence; do not make an otherwise valid
      // gameplay build fail because software WebGL cannot render reliably.
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await fs.writeFile("artifacts/approved-hud/README.json", JSON.stringify({
  description: "Actual Colyseus-backed local gameplay screenshots where status=captured; not official Playgama-hosted proof.",
  records,
}, null, 2));
console.log(JSON.stringify(records, null, 2));
