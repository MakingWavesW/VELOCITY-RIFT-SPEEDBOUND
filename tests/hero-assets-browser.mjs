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
await fs.mkdir("artifacts/hero", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 650 },
  });
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      /binding|bone|texture/i.test(m.text()) &&
      ["warning", "error"].includes(m.type())
    )
      errors.push(m.text());
  });
  page.on("request", (r) => {
    if (r.url().endsWith(".glb")) requests.push(r.url());
  });
  await page.route("**/hero-fixture.html", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="margin:0;background:#122538;color:white;font:22px sans-serif"><div style="position:absolute;top:30px;width:100%;display:flex;justify-content:space-around"><span>Idle</span><span>Walk</span><span>Heroic sprint</span><span>Airborne</span></div></body>',
    }),
  );
  await page.goto("http://localhost:5173/hero-fixture.html");
  const result = await page.evaluate(async () => {
    const T = await import("/node_modules/.vite/deps/three.js");
    const { createHero, CLIPS } = await import("/src/assets/hero.ts");
    const heroes = await Promise.all(
      Array.from({ length: 4 }, () => createHero()),
    );
    const meshes = heroes.map((h) => {
      const a = [];
      h.model.traverse((o) => {
        if (o.isSkinnedMesh) a.push(o);
      });
      return a;
    });
    const onePalette = new Set(meshes[0].map((m) => m.skeleton)).size === 1;
    const independent =
      meshes[0][0].skeleton !== meshes[1][0].skeleton &&
      meshes[0][0].skeleton.bones[0] !== meshes[1][0].skeleton.bones[0];
    const shared = meshes[0].every(
      (m, i) =>
        m.geometry === meshes[1][i].geometry &&
        m.material === meshes[1][i].material,
    );
    const scene = new T.Scene();
    scene.background = new T.Color("#122538");
    scene.add(new T.HemisphereLight(0xffffff, 0x667788, 2.5));
    const light = new T.DirectionalLight(0xffffff, 3);
    light.position.set(2, 8, 8);
    scene.add(light);
    const plane = new T.Mesh(
      new T.PlaneGeometry(100, 100),
      new T.MeshStandardMaterial({ color: 0x354655 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.025;
    scene.add(plane);
    const camera = new T.PerspectiveCamera(35, 1200 / 650, 0.1, 100);
    camera.position.set(0, 5, 18);
    camera.lookAt(0, 1.6, 0);
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setSize(1200, 650);
    renderer.setPixelRatio(1);
    document.body.append(renderer.domElement);
    const states = ["idle", "walk", "sprint", "airborne"];
    heroes.forEach((h, i) => {
      h.container.position.x = (i - 1.5) * 3.6;
      scene.add(h.container);
      for (let n = 0; n < 24; n++)
        h.update(states[i], [0, 1.14, 9, 0][i], 1 / 60);
    });
    renderer.render(scene, camera);
    const before = heroes[0].model.getObjectByName("footl").quaternion.clone();
    const test = await createHero();
    test.update("sprint", 9, 0.1);
    test.dispose();
    const survived = before.equals(
      heroes[0].model.getObjectByName("footl").quaternion,
    );
    // All states, including one-shot transitions, must bind and actually move bones.
    const probe = await createHero(),
      sampled = {};
    for (const state of Object.keys(CLIPS)) {
      probe.reset();
      for (let i = 0; i < 20; i++) probe.update(state, 9, 1 / 60);
      sampled[state] = {
        clip: probe.clip,
        foot: probe.model.getObjectByName("footl").quaternion.toArray(),
      };
    }
    probe.dispose();
    const low = await createHero();
    low.update("sprint", 9, 0.02, 0.1);
    const held = low.mixer.time === 0;
    low.update("sprint", 9, 0.09, 0.1);
    const advanced = low.mixer.time > 0;
    low.dispose();
    // Capture stand-alone render costs, excluding the unchanged world and UI.
    window.fixture = { heroes, renderer, scene, camera };
    return {
      onePalette,
      independent,
      shared,
      survived,
      held,
      advanced,
      sampled,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      texture: meshes[0][0].material.map?.image?.width,
    };
  });
  assert.equal(requests.length, 3);
  assert.equal(new Set(requests).size, 3);
  for (const key of [
    "onePalette",
    "independent",
    "shared",
    "survived",
    "held",
    "advanced",
  ])
    assert.equal(result[key], true, key);
  assert.ok(result.texture > 0);
  assert.notDeepEqual(result.sampled.idle.foot, result.sampled.sprint.foot);
  await page.screenshot({ path: "artifacts/hero/animation-comparison.png" });
  await page.evaluate(() => {
    const { heroes, renderer, scene, camera } = window.fixture;
    heroes[2].wave();
    for (let i = 0; i < 40; i++) heroes[2].update("idle", 0, 1 / 60);
    renderer.render(scene, camera);
  });
  await page.screenshot({ path: "artifacts/hero/greeting.png" });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "artifacts/hero/assets-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
