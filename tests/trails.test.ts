import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRAILS,
  TRAIL_BY_ID,
  DEFAULT_TRAIL,
  trailReward,
  eligibleTrails,
  resolveOwnedTrail,
} from "../shared/trails";
import { orbReward } from "../shared/orbs";
test("complete catalog preserves every supplied group count and level-1 stat exception", () => {
  assert.equal(TRAILS.length, 77);
  assert.equal(new Set(TRAILS.map((t) => t.id)).size, 77);
  const expected = {
    Starter: [1, 0, 0],
    Basic: [19, 2, 1],
    Advanced: [14, 6, 3],
    "Advanced Variants": [6, 6, 5],
    Rare: [16, 10, 5],
    Epic: [16, 14, 8],
    Unique: [3, 20, 10],
  };
  for (const [rarity, [count, steps, gems]] of Object.entries(expected)) {
    const group = TRAILS.filter((t) => t.rarity === rarity);
    assert.equal(group.length, count);
    for (const t of group) {
      assert.equal(t.steps, steps);
      assert.equal(t.gems, gems);
      assert.equal(t.level, 1);
    }
  }
  for (const [name, steps, gems] of [
    ["Dragonfire", 25, 15],
    ["Hyperblast", 20, 25],
  ] as const) {
    const t = TRAILS.find((t) => t.name === name)!;
    assert.equal(t.steps, steps);
    assert.equal(t.gems, gems);
  }
  for (const name of ["Yellow Soul", "Green Soul"])
    assert.equal(TRAILS.filter((t) => t.name === name).length, 2);
});
test("default is neutral; bonuses never invent Gems, XP, or rewards on non-paying events", () => {
  for (const trail of TRAILS)
    for (const tier of ["blue", "purple", "red", "gem"] as const) {
      const base = orbReward(tier, 1),
        reward = trailReward(base, trail);
      assert.equal(reward.steps, base.steps + trail.steps);
      assert.equal(reward.xp, base.xp);
      assert.equal(reward.gems, tier === "gem" ? base.gems + trail.gems : 0);
    }
  assert.deepEqual(
    trailReward(orbReward("blue", 1), TRAIL_BY_ID.get(DEFAULT_TRAIL)!),
    orbReward("blue", 1),
  );
  assert.deepEqual(trailReward({ steps: 0, gems: 0, xp: 20 }, TRAILS.at(-1)!), {
    steps: 0,
    gems: 0,
    xp: 20,
  });
  assert.equal(
    trailReward(orbReward("blue", 10), TRAIL_BY_ID.get("basic-red-trail")!)
      .steps,
    12,
  );
});
test("ownership resolution rejects unknown and unowned IDs and milestones are explicit", () => {
  const owned = new Set(eligibleTrails(1));
  assert.deepEqual([...owned], [DEFAULT_TRAIL]);
  assert.equal(
    resolveOwnedTrail("special-hyperblast", owned).id,
    DEFAULT_TRAIL,
  );
  assert.equal(resolveOwnedTrail("__proto__", owned).id, DEFAULT_TRAIL);
  assert.equal(eligibleTrails(2).length, 20);
  assert.equal(eligibleTrails(40).length, 77);
});
