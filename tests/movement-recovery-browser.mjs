import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const baseline = process.argv.includes("--baseline");
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
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    );
    const send = WebSocket.prototype.send;
    let count = 0;
    WebSocket.prototype.send = function (data) {
      if (window.dropMovement && Date.now() < window.dropMovement) return;
      return send.call(this, data);
    };
  });
  const p = await context.newPage();
  await p.goto("http://localhost:5173");
  await enterMenu(p);
  await p.locator("#name").fill("Recovery");
  await p.locator("#join").click();
  await p.waitForFunction(() => window.riftDiagnostics?.predicted);
  await p.waitForTimeout(1000);
  await p.evaluate(() => (window.dropMovement = Date.now() + 1500));
  await p.keyboard.down("d");
  await p.waitForTimeout(5000);
  await p.keyboard.up("d");
  const result = await p.evaluate(() => ({
    pending: window.riftDiagnostics.pendingInputs,
    x: window.riftDiagnostics.players[window.riftDiagnostics.localId].x,
  }));
  await fs.mkdir("artifacts/v5", { recursive: true });
  await fs.writeFile(
    `artifacts/v5/recovery-${baseline ? "before" : "after"}.json`,
    JSON.stringify(result),
  );
  console.log(result);
  if (baseline) assert.equal(result.pending, 12);
  else
    assert.ok(result.x > 15, "server movement recovers after dropped commands");
} finally {
  await browser.close();
}
