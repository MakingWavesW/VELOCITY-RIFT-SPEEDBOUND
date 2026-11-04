// Run after other browser tests finish. The before server is an isolated edea063 checkout on 5180.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
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
const report = {};
try {
  for (const [phase, port] of [
    ["before", 5180],
    ["after", 5173],
  ].filter(
    ([phase]) => !process.env.CITY_PHASE || phase === process.env.CITY_PHASE,
  ))
    for (const [device, width, height, quality] of [
      ["desktop", 960, 640, "high"],
      ["mobile", 390, 844, "low"],
    ]) {
      const context = await browser.newContext({ viewport: { width, height } }),
        p = await context.newPage();
      let glbRequests = 0;
      const errors = [];
      p.on("request", (r) => {
        if (r.url().endsWith(".glb")) glbRequests++;
      });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("**/performance-fixture.html", (r) =>
        r.fulfill({
          contentType: "text/html",
          body: '<body style="margin:0"></body>',
        }),
      );
      await p.goto(`http://localhost:${port}/performance-fixture.html`);
      const start = Date.now();
      await p.evaluate(
        async ({ width, height, quality }) => {
          const T = await import("/node_modules/three/build/three.module.js"),
            { createWorld } = await import("/src/world/environment.ts");
          const scene = new T.Scene(),
            camera = new T.PerspectiveCamera(52, width / height, 0.1, 1800),
            renderer = new T.WebGLRenderer({ antialias: true });
          renderer.setSize(width, height);
          renderer.setPixelRatio(1);
          renderer.outputColorSpace = T.SRGBColorSpace;
          renderer.toneMapping = T.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.05;
          document.body.append(renderer.domElement);
          camera.position.set(42, 35, 57);
          camera.lookAt(0, 1, 0);
          const world = createWorld(scene);
          world.setQuality?.(quality, false);
          window.fixture = { world, renderer, scene, camera };
          window.running = true;
          function frame() {
            if (!window.running) return;
            world.update(performance.now() / 1000, 0.016, 0, 0, 180000);
            renderer.render(scene, camera);
            requestAnimationFrame(frame);
          }
          frame();
        },
        { width, height, quality },
      );
      if (phase === "after")
        await p.waitForFunction(
          () =>
            window.fixture.world.diagnostics.loaded > 20 &&
            window.fixture.world.diagnostics.pending === 0,
          undefined,
          { timeout: 60000 },
        );
      const readyMs = Date.now() - start;
      await p.waitForTimeout(1200);
      const sample = await p.evaluate(async () => {
        const times = [];
        let previous = performance.now();
        for (let i = 0; i < 60; i++) {
          await new Promise(requestAnimationFrame);
          const t = performance.now();
          times.push(t - previous);
          previous = t;
        }
        const { renderer, world } = window.fixture;
        times.sort((a, b) => a - b);
        return {
          medianFrameMs: times[30],
          p95FrameMs: times[57],
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          heapBytes: performance.memory?.usedJSHeapSize,
          city: world.diagnostics,
          modelBytes: performance
            .getEntriesByType("resource")
            .filter((r) => r.name.includes("/models/"))
            .reduce((a, r) => a + r.encodedBodySize, 0),
        };
      });
      assert.deepEqual(errors, []);
      report[`${phase}-${device}`] = { ...sample, readyMs, glbRequests };
      console.log(phase, device, report[`${phase}-${device}`]);
      await p.evaluate(() => {
        window.running = false;
        window.fixture.world.dispose?.();
        window.fixture.renderer.dispose();
      });
      await context.close();
    }
  await fs.mkdir("artifacts/city2", { recursive: true });
  await fs.writeFile(
    "artifacts/city2/performance.json",
    JSON.stringify(report, null, 2),
  );
} finally {
  await browser.close();
}
