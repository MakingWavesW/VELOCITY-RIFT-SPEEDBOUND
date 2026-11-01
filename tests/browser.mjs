import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
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
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  for (const c of contexts)
    await c.addInitScript(() =>
      localStorage.setItem(
        "rift-visual-settings",
        JSON.stringify({ quality: "low" }),
      ),
    );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  for (let i = 0; i < 2; i++) {
    const p = pages[i];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://localhost:5173");
    await p.locator("#name").fill(`Browser ${i + 1}`);
    await p.locator("#join").click();
    await p.locator("#entry").waitFor({ state: "hidden" });
  }
  await pages[0].waitForFunction(() =>
    document.querySelector("#connection").textContent.includes("2/20"),
  );
  await pages[0].bringToFront();
  await pages[0]
    .locator("canvas")
    .first()
    .click({ position: { x: 400, y: 350 } });
  await pages[0].keyboard.down("w");
  await pages[0].waitForTimeout(1400);
  await pages[0].keyboard.up("w");
  assert.ok(
    Number(
      (await pages[0].locator("#steps").textContent()).replaceAll(",", ""),
    ) > 0,
  );
  await pages[0].keyboard.press("Space");
  await pages[0].waitForTimeout(200);
  await pages[0].screenshot({ path: "/tmp/velocity-rift-browser.png" });
  await contexts[1].close();
  await pages[0].waitForFunction(() =>
    document.querySelector("#connection").textContent.includes("1/20"),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: two independent Chromium contexts connect; movement earns steps; jump input; leave reflected; no JavaScript errors. Screenshot /tmp/velocity-rift-browser.png",
  );
} finally {
  await browser.close();
}
