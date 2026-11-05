import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batch } from "../src/world/models.js";
import { addSunburstReference } from "../src/world/sunburstReference.js";
import { hoops, solids, ramps, WORLD_HALF } from "../shared/world.js";

test("reference scenery is non-authoritative and Solar frame targets the real hoop", () => {
  const solidsBefore = solids.map((s) => ({ ...s }));
  const hoopsBefore = hoops.map((h) => ({ ...h }));
  const rampsBefore = ramps.map((r) => ({ ...r }));
  const scene = new T.Scene();
  const batch = new Batch();
  const visuals = addSunburstReference(scene, batch);
  const realSolar = hoops.find((h) => h.name === "SOLAR")!;
  const frame = scene.getObjectByName("Sunburst Golden Solar Hoop Frame (non-interactive)");
  assert.ok(frame, "Reference Solar frame is present");
  assert.equal(frame!.position.x, realSolar.x);
  assert.equal(frame!.position.y, realSolar.y);
  assert.equal(frame!.position.z, realSolar.z);
  assert.ok(scene.getObjectByName("Reference Low-Poly Skyline Hills"));
  assert.ok(scene.getObjectByName("Sunburst Cyan Plaza Ring"));
  assert.ok(scene.getObjectByName("Sunburst Warm Plaza Ring"));
  assert.ok(WORLD_HALF >= 400, "World bounds unchanged");
  batch.finish(scene);
  visuals.update(0, true, 0);
  visuals.update(2.5, false, 0.6);
  assert.deepEqual(solids, solidsBefore);
  assert.deepEqual(hoops, hoopsBefore);
  assert.deepEqual(ramps, rampsBefore);
  visuals.dispose();
  assert.equal(scene.getObjectByName("Sunburst Golden Solar Hoop Frame (non-interactive)"), undefined);
});

test("golden gate is framed outside the Solar Hoop functional opening", () => {
  const realSolar = hoops.find((h) => h.name === "SOLAR")!;
  const scene = new T.Scene();
  const visuals = addSunburstReference(scene, new Batch());
  const gate = visuals.portal.getObjectByName("Golden Solar Arch") as T.Mesh;
  assert.ok(gate);
  const radius = (gate.geometry as T.TorusGeometry).parameters.radius;
  assert.ok(radius > realSolar.r + 1, "Ornamental frame sits outside reward ring");
  visuals.dispose();
});
