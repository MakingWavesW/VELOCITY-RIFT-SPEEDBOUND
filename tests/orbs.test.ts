import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ORB_TYPES,
  ORB_BALANCE,
  orbReward,
  type OrbTier,
} from "../shared/orbs.js";
import { orbRoutes, validOrbPoint } from "../shared/orbRoutes.js";
import { OrbManager, chooseTier, touchesOrb } from "../server/orbManager.js";
const rng = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
test("level 1 and 10 tier Steps/XP match exact targets, with gradual capped growth", () => {
  for (const [tier, base] of [
    ["blue", 2],
    ["purple", 5],
    ["red", 10],
  ] as const) {
    assert.deepEqual(orbReward(tier, 1), { steps: base, xp: base, gems: 0 });
    assert.equal(orbReward(tier, 10).steps, base * 5);
    for (let level = 2; level <= 100; level++) {
      const gain =
        orbReward(tier, level).steps - orbReward(tier, level - 1).steps;
      assert.ok(gain >= 0 && gain <= Math.ceil(base * ORB_BALANCE.levelGrowth));
    }
    assert.equal(orbReward(tier, 10000).steps, base * 20);
  }
  assert.deepEqual(orbReward("gem", 10), { steps: 10, xp: 15, gems: 3 });
  assert.equal(orbReward("blue", 10, { world: 2, rebirth: 1.5 }).steps, 30);
  assert.throws(() => orbReward("blue", 1, { pet: NaN }));
});
test("base rarity sampler matches configurable 65/25/10 proportions", () => {
  const random = rng(17),
    counts = { blue: 0, purple: 0, red: 0, gem: 0 };
  for (let i = 0; i < 50000; i++)
    counts[chooseTier({ blue: 65, purple: 25, red: 10, gem: 0 }, random)]++;
  for (const [tier, expected] of [
    ["blue", 0.65],
    ["purple", 0.25],
    ["red", 0.1],
  ] as const)
    assert.ok(Math.abs(counts[tier] / 50000 - expected) < 0.01);
});
test("random layouts remain valid, separated, varied, and district weighted over 24 seeds", () => {
  const counts = { blue: 0, purple: 0, red: 0, gem: 0 };
  let total = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const manager = new OrbManager(rng(seed), 0),
      orbs = manager.active;
    assert.ok(
      orbs.length >= 90 && orbs.length <= 100,
      `population ${orbs.length}`,
    );
    for (const a of orbs) {
      counts[a.tier]++;
      total++;
      assert.ok(validOrbPoint({ x: a.x, y: a.y - 1.3, z: a.z }));
      for (const b of orbs)
        if (a.id < b.id)
          assert.ok(
            Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >=
              ORB_BALANCE.minSpacing,
          );
    }
    assert.ok(
      orbs.some((o) => o.y > 20),
      "roof rewards present",
    );
    assert.ok(orbs.filter((o) => o.route === "starter").length >= 20);
  }
  assert.ok(counts.blue > counts.purple && counts.purple > counts.red);
  assert.ok(counts.red / total < 0.16);
  assert.ok(
    orbRoutes.find((r) => r.id === "garden")!.weights.purple >
      orbRoutes[0].weights.purple,
  );
  assert.notDeepEqual(
    new OrbManager(rng(1), 0).active,
    new OrbManager(rng(2), 0).active,
  );
  console.log("24-layout tier totals:", counts, "population", total / 24);
});
test("claim is single-use; delayed respawn relocates and advances generation", () => {
  const m = new OrbManager(rng(12), 0),
    orb = m.active.find((o) => o.tier === "blue")!;
  assert.ok(m.claim(orb.id, orb.generation, 100));
  assert.equal(m.claim(orb.id, orb.generation, 100), undefined);
  const remove = m.flush()!;
  assert.deepEqual(remove.removed, [orb.id]);
  m.tick(100 + ORB_TYPES.blue.respawn[0] - 1);
  assert.ok(!m.active.some((o) => o.id === orb.id));
  m.tick(100 + ORB_TYPES.blue.respawn[1] + 1001);
  const next = m.active.find((o) => o.id === orb.id)!;
  assert.ok(next);
  assert.equal(next.generation, orb.generation + 1);
  assert.ok(Math.hypot(next.x - orb.x, next.z - orb.z) >= 3);
  assert.equal(next.route, orb.route);
  assert.equal(m.claim(next.id, orb.generation, 20000), undefined);
  assert.ok(m.flush()!.spawned.some((o) => o.id === orb.id));
});
test("swept pickup accepts crossings, rejects remote and wrong-height claims", () => {
  const orb = new OrbManager(rng(1), 0).active[0];
  assert.ok(
    touchesOrb(
      orb,
      { x: orb.x - 5, y: orb.y - 1.3, z: orb.z },
      { x: orb.x + 5, y: orb.y - 1.3, z: orb.z },
    ),
  );
  assert.equal(
    touchesOrb(
      orb,
      { x: orb.x, y: orb.y + 10, z: orb.z },
      { x: orb.x, y: orb.y + 10, z: orb.z },
    ),
    false,
  );
  assert.equal(
    touchesOrb(orb, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
    false,
  );
});
test("respawn collected in the same tick cannot reappear in the outgoing patch", () => {
  const m = new OrbManager(rng(14), 0),
    orb = m.active[0];
  m.claim(orb.id, orb.generation, 0);
  m.flush();
  m.tick(23000);
  const next = m.active.find((o) => o.id === orb.id)!;
  assert.ok(next);
  m.claim(next.id, next.generation, 23000);
  const patch = m.flush()!;
  assert.ok(patch.removed.includes(orb.id));
  assert.ok(!patch.spawned.some((o) => o.id === orb.id));
});

test("heavy collection replenishes at least fifty slots on the next tick", () => {
  const m = new OrbManager(rng(9), 0);
  for (const o of m.active) m.claim(o.id, o.generation, 1);
  m.tick(2);
  assert.ok(m.active.length >= 50 && m.active.length <= 100);
});
