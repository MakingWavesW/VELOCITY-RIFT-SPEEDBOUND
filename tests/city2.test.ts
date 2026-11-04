import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cityPlacements } from "../src/world/cityLayout.js";
import { blocked, groundAt, solids, ramps, hoops } from "../shared/world.js";
import { CRYSTALS } from "../shared/pets.js";
import { orbRoutes, validOrbPoint } from "../shared/orbRoutes.js";
const originalBlocked = (x: number, z: number, y = 0) =>
  solids.some(
    (s) =>
      s.kind !== "scenery" &&
      Math.abs(x - s.x) < s.w / 2 + 0.55 &&
      Math.abs(z - s.z) < s.d / 2 + 0.55 &&
      s.h > y + 0.65,
  );
const manifest: Record<string, string[]> = JSON.parse(
  fs.readFileSync("assets/runtime-models.json", "utf8"),
);
test("runtime manifest is exact and every selected GLB and external texture exists", () => {
  const used = new Set(cityPlacements.map((p) => p.model));
  assert.deepEqual(
    new Set(
      Object.entries(manifest)
        .filter(([k]) => k !== "hero")
        .flatMap(([, v]) => v),
    ),
    used,
  );
  assert.ok([...used].length < 75);
  for (const name of Object.values(manifest).flat()) {
    const b = fs.readFileSync(path.join("assets/library/models", name));
    assert.equal(b.readUInt32LE(0), 0x46546c67);
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
    for (const asset of [...(json.images || []), ...(json.buffers || [])])
      if (asset.uri && !asset.uri.startsWith("data:"))
        assert.ok(
          fs.existsSync(
            path.join("assets/library/models", path.dirname(name), asset.uri),
          ),
        );
  }
});
test("all original avenues, ramp approaches, crystals and rooftop loops remain accessible", () => {
  for (const x of [-330, 0, 190, 330])
    for (let z = -425; z <= 425; z += 2)
      assert.equal(blocked(x, z, 0), originalBlocked(x, z), `avenue ${x},${z}`);
  for (const z of [-330, 0, 170, 330])
    for (let x = -425; x <= 425; x += 2)
      assert.equal(blocked(x, z, 0), originalBlocked(x, z), `avenue ${x},${z}`);
  for (const r of ramps)
    for (let dz = -12; dz <= 12; dz++)
      assert.equal(blocked(r.x, r.z + dz, 0), false);
  for (const c of CRYSTALS)
    for (const [dx, dz] of [
      [0, 0],
      [-3, 0],
      [3, 0],
      [0, -3],
      [0, 3],
    ])
      assert.equal(blocked(c.x + dx, c.z + dz, 0), false, c.id);
  for (const [x, z] of [
    [140, 105],
    [152, 105],
    [165, 122],
    [149, 135],
    [139, 122],
  ]) {
    assert.equal(groundAt(x, z, 26), 26);
    assert.equal(blocked(x, z, 26), false);
  }
  for (const h of hoops) assert.equal(blocked(h.x, h.z, h.y), false, h.name);
});
test("scenery does not occupy original collectible paths and facades use exact shared footprints", () => {
  for (const route of orbRoutes)
    for (const p of route.points) {
      if (
        [
          [-210, 120],
          [-260, 230],
        ].some(([x, z]) => ((p.x - x) / 16) ** 2 + ((p.z - z) / 12) ** 2 < 1)
      )
        continue;
      if (p.z > 358 && p.z < 373 && Math.abs(p.x) < 83) continue;
      if (
        solids.some(
          (s) =>
            s.kind !== "scenery" &&
            Math.abs(p.x - s.x) < s.w / 2 + 0.55 &&
            Math.abs(p.z - s.z) < s.d / 2 + 0.55 &&
            s.h > p.y + 0.65,
        )
      )
        continue;
      assert.equal(blocked(p.x, p.z, p.y), false, `${route.id}: ${p.x},${p.z}`);
    }
  for (const p of cityPlacements.filter((p) => p.solidIndex !== undefined)) {
    const s = solids[p.solidIndex!];
    assert.equal(p.w, s.w);
    assert.equal(p.d, s.d);
    assert.equal(p.x, s.x);
    assert.equal(p.z, s.z);
    assert.ok(Math.abs(p.h - s.h) < 0.2);
  }
  for (const route of orbRoutes)
    assert.ok(
      route.points.filter(validOrbPoint).length >= route.count,
      route.id,
    );
});
