import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
await fs.mkdir("artifacts/city2/gameplay", { recursive: true });
const report = {};
try {
  for (const [name, width, height, fail] of [
    ["desktop", 960, 640, false],
    ["mobile", 390, 844, false],
    ["fallback", 390, 844, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 500,
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        "rift-visual-settings",
        JSON.stringify({ quality: "low", comfort: true }),
      ),
    );
    if (fail)
      await context.route(/\/models\/(city|nature|platforms)\//, (r) =>
        r.abort(),
      );
    const p = await context.newPage(),
      errors = [],
      requests = [],
      responses = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (
        m.type() === "error" &&
        /shader|WebGLProgram|VALIDATE_STATUS/i.test(m.text())
      )
        errors.push(m.text());
    });
    p.on("request", (r) => {
      if (r.url().endsWith(".glb")) requests.push(r.url());
    });
    p.on("response", (r) => {
      if (r.url().endsWith(".glb")) responses.push(r.status());
    });
    const start = Date.now();
    await p.goto("http://localhost:5173");
    await enterMenu(p);
    await p.locator("#name").fill(name + " GLB city");
    await p.locator("#join").click();
    await p.waitForFunction(() => window.riftDiagnostics?.predicted);
    await p.waitForFunction(() =>
      window.riftDiagnostics.avatars.every((a) => a.heroStatus === "ready"),
    );
    await p.waitForFunction(
      (fail) => {
        const d = window.riftDiagnostics.city;
        return d.pending === 0 && (fail ? d.failed.length > 0 : d.loaded > 20);
      },
      fail,
      { timeout: 60000 },
    );
    if (name === "desktop") {
      await p.locator('[data-panel="settings"].gear').click();
      await p.locator("#quality").selectOption("medium");
      await p.waitForFunction(
        () => window.riftDiagnostics.city.quality === "medium",
      );
      assert.equal(
        await p.evaluate(
          () =>
            JSON.parse(localStorage.getItem("rift-visual-settings")).quality,
        ),
        "medium",
      );
      await p.locator("#quality").selectOption("low");
      await p.locator("#closePanel").click();
    }
    const readyMs = Date.now() - start;
    await p.keyboard.down("w");
    await p.waitForTimeout(1200);
    await p.keyboard.up("w");
    await p.waitForFunction(() => window.riftDiagnostics.predicted.steps > 0);
    await p.screenshot({ path: `artifacts/city2/gameplay/${name}.png` });
    const d = await p.evaluate(() => window.riftDiagnostics);
    assert.equal(requests.length, new Set(requests).size);
    assert.ok(requests.length <= 66);
    assert.deepEqual(errors, []);
    if (!fail) {
      assert.deepEqual(d.city.failed, []);
      assert.ok(responses.every((s) => s === 200));
    }
    const resources = await p.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes("/models/"))
        .map((r) => ({
          url: r.name,
          bytes: r.encodedBodySize,
          duration: r.duration,
        })),
    );
    report[name] = {
      readyMsIncludingIntro: readyMs,
      requests: requests.length,
      drawCalls: d.drawCalls,
      triangles: d.triangles,
      frameMs: d.frameMs,
      city: d.city,
      modelBytes: resources.reduce((a, r) => a + r.bytes, 0),
      resources,
    };
    await context.close();
  }
  await fs.writeFile(
    "artifacts/city2/gameplay/results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
