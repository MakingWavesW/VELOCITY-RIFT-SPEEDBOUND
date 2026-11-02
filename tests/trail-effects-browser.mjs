import { chromium } from "@playwright/test";
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
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 600, height: 450 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/trail-harness.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"></body></html>',
    }),
  );
  await page.goto("http://localhost:5173/trail-harness.html");
  await page.evaluate(async () => {
    const T = await import("/node_modules/.vite/deps/three.js"),
      { createTrail } = await import("/src/world/trails.ts");
    const scene = new T.Scene(),
      renderer = new T.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    renderer.setSize(600, 450);
    renderer.setClearColor(0x14283c);
    document.body.append(renderer.domElement);
    const camera = new T.PerspectiveCamera(45, 600 / 450, 0.1, 100);
    camera.position.set(6, 7, 10);
    camera.lookAt(0, 0, 0);
    const trail = createTrail(scene);
    window.harness = { T, scene, renderer, camera, trail };
  });
  for (const id of [
    "default-white",
    "basic-red-and-blue",
    "basic-blue-snow",
    "advanced-red-sparks",
    "advanced-green-storm",
    "rare-blue-soul",
    "rare-blue-lightning",
    "epic-green-gem",
    "epic-rb-speed",
    "unique-rainbow-speed",
    "special-dragonfire",
    "special-hyperblast",
  ]) {
    const stats = await page.evaluate((id) => {
      const { T, trail, renderer, scene, camera } = window.harness;
      trail.clear();
      trail.setTrail(id);
      for (let n = 0; n < 180; n++) {
        const t = n / 60;
        trail.update(
          new T.Vector3(Math.sin(t * 2) * 3, 0, Math.cos(t * 2) * 3),
          t,
          1 / 60,
          { quality: "high", comfort: false },
        );
      }
      renderer.render(scene, camera);
      return trail.stats;
    }, id);
    assert.ok(stats.segments > 4);
    await page.screenshot({ path: `artifacts/trails/effect-${id}.png` });
  }
  const stopped = await page.evaluate(() => {
    const { T, trail } = window.harness;
    for (let n = 180; n < 300; n++)
      trail.update(
        new T.Vector3(
          Math.sin((179 / 60) * 2) * 3,
          0,
          Math.cos((179 / 60) * 2) * 3,
        ),
        n / 60,
        1 / 60,
        { quality: "low", comfort: false },
      );
    return trail.stats;
  });
  assert.equal(stopped.segments, 0);
  assert.equal(stopped.particles, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 12 trail families render, stop and expire without shader errors",
  );
} finally {
  await browser.close();
}
