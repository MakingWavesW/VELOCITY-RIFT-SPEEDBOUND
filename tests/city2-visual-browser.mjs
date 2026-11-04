import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const phase = process.env.CITY_STAGE || "after";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const out = `artifacts/city2/${phase}`;
await fs.mkdir(out, { recursive: true });
const errors = [],
  requests = [];
try {
  const p = await browser.newPage({ viewport: { width: 960, height: 640 } });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|VALIDATE_STATUS/i.test(m.text()))errors.push(m.text());});
  p.on("requestfailed", (r) => errors.push(r.url()));
  p.on("response", (r) => {
    if (r.url().endsWith(".glb"))
      requests.push({ url: r.url(), status: r.status() });
  });
  await p.route("**/world-fixture.html", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="margin:0"></body>',
    }),
  );
  await p.goto("http://localhost:5173/world-fixture.html");
  await p.evaluate(async () => {
    const T = await import("/node_modules/.vite/deps/three.js");
    const { createWorld } = await import("/src/world/environment.ts");
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(52, 960 / 640, 0.1, 1800),
      renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setSize(960, 640);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    document.body.append(renderer.domElement);
    const world = createWorld(scene);
    world.setQuality?.("high", false);
    window.fixture = { T, scene, camera, renderer, world };
  });
  const views = [
    ["plaza", 0, 0, 65, 62, 82],
    ["downtown", -180, -160, 100, 105, 120],
    ["speedway", 190, -185, 65, 68, 105],
    ["gardens", -210, 170, 85, 68, 105],
    ["skyline", 135, 120, 75, 75, 105],
    ["coast", 0, 390, 95, 56, 90],
  ];
  const results = {};
  for (const [name, x, z, dx, dy, dz] of views) {
    await p.evaluate(
      ({ x, z, dx, dy, dz }) => {
        const { world, camera } = window.fixture;
        camera.position.set(x + dx, dy, z + dz);
        camera.lookAt(x, 0, z);
        world.update(10, 0.016, x, z, 180000);
      },
      { x, z, dx, dy, dz },
    );
    await p.waitForTimeout(1500);
    await p.waitForFunction(
      () => !window.fixture.world.diagnostics?.pending,
      undefined,
      { timeout: 45000 },
    );
    results[name] = await p.evaluate(
      async ({ x, z }) => {
        const { world, camera, renderer, scene } = window.fixture;
        const times = [];
        for (let i = 0; i < 24; i++) {
          await new Promise(requestAnimationFrame);
          const start = performance.now();
          world.update(10, 0.016, x, z, 180000);
          renderer.render(scene, camera);
          times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b);
        return {
          submitMedianMs: times[12],
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          heapBytes: performance.memory?.usedJSHeapSize,
          streaming: world.diagnostics,
        };
      },
      { x, z },
    );
    await p.screenshot({ path: `${out}/${name}.png` });
  }
  await p.evaluate(() => {
    const { world, camera, renderer, scene } = window.fixture;
    camera.position.set(65, 62, 82);
    camera.lookAt(0, 0, 0);
    world.setCycle(false);
    world.setNight(true);
    for (let i = 0; i < 100; i++) world.update(100, 0.1, 0, 0, 540000);
    renderer.render(scene, camera);
  });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${out}/night.png` });
  if (phase !== "before")
    for (const result of Object.values(results)) {
      assert.deepEqual(result.streaming.failed, []);
      assert.ok(result.streaming.loaded > 20);
    }
  assert.deepEqual(errors, []);
  assert.ok(requests.every((r) => r.status === 200));
  await fs.writeFile(
    `${out}/results.json`,
    JSON.stringify({ results, requests, errors }, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
