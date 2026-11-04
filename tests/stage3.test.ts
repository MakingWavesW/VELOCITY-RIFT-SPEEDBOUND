import { test } from "node:test";
import assert from "node:assert/strict";
import { PARKOUR_COURSES, inParkourRange } from "../shared/parkour.js";
import { WORLD_HALF, hoops } from "../shared/world.js";
import { PETS } from "../shared/pets.js";

test("Stage 3 courses have safe names, unique IDs and valid checkpoints", () => {
  assert.equal(PARKOUR_COURSES.length, 3);
  assert.equal(new Set(PARKOUR_COURSES.map((c) => c.id)).size, 3);
  for (const c of PARKOUR_COURSES) {
    assert.ok(c.name && c.description);
    assert.ok(c.checkpoints.length >= 2);
    assert.ok(c.gems > 0 && c.gems <= 25);
    assert.ok(c.minimumMs > 0 && c.maximumMs > c.minimumMs);
    assert.ok(c.cooldownMs >= 300000);
    assert.ok(Math.abs(c.start.x) < WORLD_HALF && Math.abs(c.start.z) < WORLD_HALF);
    for (const cp of c.checkpoints) {
      if (cp.type === "hoop") assert.ok(hoops.some((h) => h.id === cp.id));
      else {
        assert.ok(Math.abs(cp.x) < WORLD_HALF && Math.abs(cp.z) < WORLD_HALF);
        assert.ok(cp.radius >= 4 && cp.radius <= 15);
      }
    }
  }
});

test("parkour start/checkpoint validation requires real position and height", () => {
  const c = PARKOUR_COURSES[0];
  assert.ok(inParkourRange(c.start, c.start));
  assert.equal(inParkourRange(c.start, { x: c.start.x + 100, y: c.start.y, z: c.start.z }), false);
  assert.equal(inParkourRange(c.start, { x: c.start.x, y: c.start.y + 10, z: c.start.z }), false);
});

test("all existing Pet IDs and economy tiers remain unchanged", () => {
  assert.equal(PETS.length, 12);
  assert.equal(new Set(PETS.map((p) => p.id)).size, 12);
  assert.equal(PETS.filter((p) => p.rarity === "Legendary").length, 2);
  for (const pet of PETS) {
    assert.ok(pet.steps >= 1 && pet.gems >= 1);
  }
});
