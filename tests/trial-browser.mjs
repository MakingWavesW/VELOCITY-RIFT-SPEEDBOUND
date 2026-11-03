import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const ctx = await browser.newContext({
    viewport: { width: 960, height: 640 },
  });
  await ctx.addInitScript(() =>
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    ),
  );
  const p = await ctx.newPage();
  await p.goto("http://localhost:5173");
  await enterMenu(p);
  await p.locator("#name").fill("Trial runner");
  await p.locator("#join").click();
  await p.waitForFunction(() => window.riftDiagnostics?.predicted);
  await p.locator("#questsButton").click();
  await p.locator("#startTrial").click();
  await p.locator("#rewardHub").waitFor({ state: "hidden" });
  await p.waitForTimeout(3200);
  await p.keyboard.down("w");
  await p.waitForFunction(
    () =>
      window.riftDiagnostics.players[window.riftDiagnostics.localId].z < -102,
    undefined,
    { timeout: 30000 },
  );
  await p.keyboard.up("w");
  await p.keyboard.down("s");
  await p.waitForFunction(
    () => window.riftDiagnostics.players[window.riftDiagnostics.localId].z > -3,
    undefined,
    { timeout: 30000 },
  );
  await p.keyboard.up("s");
  await p.waitForTimeout(1200);
  await p.locator("#questsButton").click();
  const text = await p.locator("#hubBody").innerText();
  assert.match(text, /Best: \d+\.\d+s/);
  await p.screenshot({
    path: "artifacts/v5/trial.png",
    animations: "disabled",
  });
  console.log(text.match(/Best: [^\n]+/)?.[0]);
} finally {
  await browser.close();
}
