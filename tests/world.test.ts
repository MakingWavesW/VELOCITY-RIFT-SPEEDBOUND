import { test } from "node:test";
import assert from "node:assert/strict";
import { move, orbs, DT, type Player } from "../shared/game.js";
import {
  WORLD_HALF,
  solids,
  blocked,
  groundAt,
  ramps,
  hoops,
  crossesHoop,
} from "../shared/world.js";
const player = (x = 0, z = 0): Player => ({
  id: "test",
  name: "Runner",
  x,
  y: 0,
  z,
  vy: 0,
  angle: 0,
  seq: -1,
  steps: 0,
  xp: 0,
  gems: 0,
  level: 1,
  moving: false,
});
test("880-unit bounds and stationary boundary movement grant no distance", () => {
  assert.equal(WORLD_HALF * 2, 880);
  const p = player(437, 0);
  assert.equal(move(p, { seq: 0, x: 1, z: 0, jump: false }), 0);
  assert.equal(p.x, 437);
});
test("buildings block movement, and wall sliding remains possible", () => {
  const b = solids[0],
    p = player(b.x - b.w / 2 - 0.6, b.z);
  move(p, { seq: 0, x: 1, z: 1, jump: false });
  assert.ok(p.x < b.x - b.w / 2 - 0.5);
  assert.ok(p.z > b.z);
});
test("all collectible locations are accessible and IDs are stable", () => {
  assert.equal(orbs[0].x, 0);
  assert.equal(orbs[0].z, 12);
  for (const [i, o] of orbs.entries()) {
    assert.equal(o.id, i);
    assert.equal(blocked(o.x, o.z, 0), false, `orb ${i} inside building`);
    assert.ok(Math.abs(o.x) < 437 && Math.abs(o.z) < 437);
  }
});
test("launch pads use the same grounded trigger as the rendered layout", () => {
  const r = ramps[0],
    p = player(r.x, r.z + 1);
  move(p, { seq: 0, x: 0, z: -1, jump: false });
  assert.ok(p.vy > 18);
  assert.ok(p.y > 0);
});
test("skyline staircase is climbable and roof has a landing surface", () => {
  const p = player(90, 67);
  for (let i = 0; i < 150; i++) move(p, { seq: i, x: 0, z: 1, jump: false });
  assert.ok(p.z > 110);
  assert.equal(p.y, 12);
  assert.equal(groundAt(90, 120, 12), 12);
});
test("jump falls back to ground and does not jump again while airborne", () => {
  const p = player();
  move(p, { seq: 0, x: 0, z: 0, jump: true });
  const vy = p.vy;
  move(p, { seq: 1, x: 0, z: 0, jump: true });
  assert.ok(p.vy < vy);
  for (let i = 0; i < 100; i++)
    move(p, { seq: i + 2, x: 0, z: 0, jump: false });
  assert.equal(p.y, 0);
});

test("hoop plane accepts real crossings and rejects near misses and standing inside", () => {
  const h = hoops[0];
  assert.ok(
    crossesHoop(
      h,
      { x: h.x, y: h.y - 1.5, z: h.z - 1 },
      { x: h.x, y: h.y - 1.5, z: h.z },
    ),
  );
  assert.equal(
    crossesHoop(
      h,
      { x: h.x + 10, y: h.y, z: h.z - 1 },
      { x: h.x + 10, y: h.y, z: h.z + 1 },
    ),
    false,
  );
  assert.equal(
    crossesHoop(h, { x: h.x, y: h.y, z: h.z }, { x: h.x, y: h.y, z: h.z }),
    false,
  );
});
