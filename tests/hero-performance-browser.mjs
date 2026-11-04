// A same-scene comparison, not a substitute for physical desktop/mobile GPU profiling.
import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
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
const results = {};
try {
  for (const blocked of [true, false]) {
    const context = await browser.newContext({
      viewport: { width: 640, height: 480 },
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        "rift-visual-settings",
        JSON.stringify({ quality: "low" }),
      ),
    );
    if (blocked) await context.route("**/*.glb", (r) => r.abort());
    const p = await context.newPage();
    await p.goto("http://localhost:5173");
    await enterMenu(p);
    await p.locator("#name").fill("Render comparison");
    await p.locator("#join").click();
    await p.waitForFunction(
      (status) =>
        window.riftDiagnostics?.avatars.some((a) => a.heroStatus === status),
      blocked ? "fallback" : "ready",
    );
    await p.waitForTimeout(2000);
    results[blocked ? "procedural" : "hero"] = await p.evaluate(async () => {
      const frames = [];
      for (let i = 0; i < 60; i++) {
        await new Promise(requestAnimationFrame);
        frames.push(window.riftDiagnostics.frameMs);
      }
      frames.sort((a, b) => a - b);
      const d = window.riftDiagnostics;
      return {
        medianFrameMs: frames[30],
        p95FrameMs: frames[57],
        drawCalls: d.drawCalls,
        triangles: d.triangles,
      };
    });
    await context.close();
  }
  await fs.mkdir("artifacts/hero", { recursive: true });
  await fs.writeFile(
    "artifacts/hero/performance.json",
    JSON.stringify(results, null, 2),
  );
  console.log(results);
} finally {
  await browser.close();
}
