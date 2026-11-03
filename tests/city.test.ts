import { test } from "node:test";
import assert from "node:assert/strict";
import { CRYSTALS, PET_BY_ID, choosePet, equippedPet } from "../shared/pets.js";
import { daylight, DAY_NIGHT } from "../shared/dayNight.js";
import { OfferTiming } from "../shared/offerTiming.js";
import { citySkyline, blocked, groundAt } from "../shared/world.js";
import { Profiles } from "../server/profiles.js";
import { pickupReward } from "../shared/pickupReward.js";
import { TRAILS } from "../shared/trails.js";
import type { Player } from "../shared/game.js";
test("pickup bonuses preserve base tiers and never create Gems on energy orbs", () => {
  const p: Pick<Player, "level" | "rebirths" | "pets" | "equippedPetId"> = {
    level: 10,
    rebirths: 2,
    pets: { "sun-puff": 1 },
    equippedPetId: "sun-puff",
  };
  const trail = { ...TRAILS[0], steps: 5, gems: 2 };
  assert.deepEqual(pickupReward(p, "blue", trail), {
    steps: 24,
    gems: 0,
    xp: 15,
  });
  assert.deepEqual(pickupReward(p, "gem", trail), {
    steps: 24,
    gems: 5,
    xp: 22.5,
  });
  p.pets = {};
  assert.equal(pickupReward(p, "blue", trail).steps, 23);
  p.level = 1;
  p.rebirths = 0;
  const noBonus = { ...TRAILS[0], steps: 0, gems: 0 };
  assert.deepEqual(
    ["blue", "purple", "red"].map(
      (tier) =>
        pickupReward(p, tier as "blue" | "purple" | "red", noBonus).steps,
    ),
    [2, 5, 10],
  );
});
test("crystal probabilities are exact, complete and original companions resolve", () => {
  for (const c of CRYSTALS) {
    assert.equal(
      c.drops.reduce((a, d) => a + d.chance, 0),
      100,
    );
    assert.ok(c.cost < 1000);
    const counts: Record<string, number> = {};
    for (let n = 0; n < 10000; n++) {
      const id = choosePet(c, (n + 0.5) / 10000);
      assert.ok(PET_BY_ID.has(id));
      counts[id] = (counts[id] || 0) + 1;
    }
    for (const d of c.drops) assert.equal(counts[d.pet], d.chance * 100);
  }
});
test("single-use crystal transaction atomically persists spend and pets", () => {
  const db = new Profiles(":memory:");
  try {
    const p = db.acquire(),
      data = {
        ...p.data,
        gems: 21,
        pets: { "sun-puff": 1 },
        equippedPetId: "sun-puff",
      };
    assert.equal(
      db.commitCrystal(p.id, "tx-once", data, {
        pet: "sun-puff",
        crystal: "sunrise",
      }),
      true,
    );
    assert.equal(
      db.commitCrystal(
        p.id,
        "tx-once",
        { ...data, gems: 0 },
        { pet: "rift-dragon", crystal: "sky" },
      ),
      false,
    );
    db.release(p.id);
    assert.equal(db.acquire(p.token).data.gems, 21);
  } finally {
    db.close();
  }
});
test("day/night is periodic, smooth and shares the same clock", () => {
  const n = DAY_NIGHT.cycleMs;
  assert.equal(daylight(n / 4).night, 0);
  assert.equal(daylight((3 * n) / 4).night, 1);
  assert.deepEqual(daylight(1234), daylight(n + 1234));
  assert.ok(Math.abs(daylight(0).night - daylight(n - 1).night) < 0.001);
  assert.equal(daylight(0).label, "DAWN");
  assert.equal(daylight(n / 2).label, "DUSK");
});
test("minute offers defer during menus, movement, intro and pause; never catch up in a burst", () => {
  const t = new OfferTiming();
  assert.equal(t.update(60000, false, true, false), false);
  assert.equal(t.update(59999, true, true, false), false);
  assert.equal(t.update(1, true, false, false), false);
  assert.equal(t.update(1000, true, true, true), false);
  assert.equal(t.update(14999, true, true, false), false);
  assert.equal(t.update(1, true, true, false), true);
  assert.equal(t.update(0, true, true, false), false);
});
test("eighteen skyline landmarks and the new rooftop route use authoritative supports", () => {
  assert.equal(citySkyline.length, 18);
  for (const x of [140, 150, 160]) assert.equal(groundAt(x, 105, 26), 26);
  assert.equal(blocked(150, 105, 26), false);
});
