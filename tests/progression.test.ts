import { test } from "node:test";
import assert from "node:assert/strict";
import { Profiles, progress } from "../server/profiles.js";
import {
  rebirth,
  rebirthRequirement,
  verifiedReward,
  expireBoost,
} from "../shared/progression.js";
import { speed, move, type Player } from "../shared/game.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const player = (): Player => ({
  id: "x",
  name: "Runner",
  x: 0,
  y: 0,
  z: 0,
  verticalVelocity: 0,
  velocityX: 0,
  velocityZ: 0,
  angle: 0,
  seq: 0,
  steps: 5000,
  xp: 12,
  gems: 100,
  level: 50,
  moving: false,
  equippedTrailId: "default",
  rebirths: 0,
});
test("rebirth eligibility, retained gems/trails and duplicate rejection", () => {
  const p = player();
  p.level = 49;
  assert.equal(rebirth(p), false);
  p.level = 50;
  assert.equal(rebirth(p), true);
  assert.equal(p.level, 1);
  assert.equal(p.steps, 0);
  assert.equal(p.xp, 0);
  assert.equal(p.gems, 100);
  assert.equal(p.equippedTrailId, "default");
  assert.equal(p.rebirths, 1);
  assert.equal(rebirth(p), false);
  assert.equal(rebirthRequirement(1), 75);
});
test("verified speed is exactly double for 120 seconds, never stacks; one level preserves partial XP", () => {
  const p = player(),
    base = speed(p);
  assert.equal(verifiedReward(p, "speed", 1000), true);
  assert.equal(speed(p), base * 2);
  assert.equal(verifiedReward(p, "speed", 2000), false);
  expireBoost(p, 120999);
  assert.equal(speed(p), base * 2);
  expireBoost(p, 121000);
  assert.equal(speed(p), base);
  verifiedReward(p, "level", 121001);
  assert.equal(p.level, 51);
  assert.equal(p.xp, 12);
  p.speedMultiplier = 2;
  for (let i = 0; i < 300; i++) move(p, { seq: i, x: 1, z: 0, jump: false });
  assert.ok(p.x < 440);
  assert.ok(Number.isFinite(p.x));
});
test("profile bearer resumes server data across restart, rejects simultaneous use and ignores forged IDs", () => {
  const dir = mkdtempSync(join(tmpdir(), "rift-profile-")),
    file = join(dir, "test.sqlite");
  let store = new Profiles(file);
  try {
    const profile = store.acquire(),
      p = player();
    rebirth(p);
    store.save(profile.id, progress(p, new Set(["default", "rare-trail"])));
    assert.throws(() => store.acquire(profile.token), /already connected/);
    store.release(profile.id);
    store.close();
    store = new Profiles(file);
    const restored = store.acquire(profile.token);
    assert.equal(restored.data.rebirths, 1);
    assert.equal(restored.data.gems, 100);
    assert.deepEqual(restored.data.owned, ["default", "rare-trail"]);
    const forged = store.acquire("a".repeat(64));
    assert.equal(forged.data.level, 1);
    assert.notEqual(forged.token, "a".repeat(64));
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
