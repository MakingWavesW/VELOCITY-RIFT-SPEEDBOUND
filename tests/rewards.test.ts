import { test } from "node:test";
import assert from "node:assert/strict";
import { Profiles } from "../server/profiles.js";
import { Rewards } from "../server/rewards.js";
import {
  rewardVerifier,
  type RewardVerifier,
} from "../server/rewardVerifier.js";
import type { Player } from "../shared/game.js";
const player = (): Player => ({
  id: "test",
  name: "Test",
  x: 0,
  y: 0,
  z: 0,
  velocityX: 0,
  velocityZ: 0,
  verticalVelocity: 0,
  angle: 0,
  seq: 0,
  steps: 0,
  gems: 0,
  xp: 12,
  level: 1,
  moving: false,
});
test("production verifier disables preparation and rejects even invented completion claims", async () => {
  const store = new Profiles(":memory:");
  try {
    const p = store.acquire(),
      r = new Rewards(store, rewardVerifier);
    assert.equal(r.available, false);
    assert.equal(r.prepare(p.id, "level", player()), undefined);
    assert.equal(
      await r.settle(p.id, "invented", () => ({
        player: player(),
        owned: new Set(),
      })),
      false,
    );
  } finally {
    store.close();
  }
});
test("test-only verifier: ownership, failed/expired claims, concurrency, durable deduplication, cooldown and speed stacking", async () => {
  const store = new Profiles(":memory:");
  try {
    const profile = store.acquire(),
      p = player(),
      owned = new Set(["default-white"]);
    let time = 1_000_000;
    let verdict: "verified" | "pending" | "rejected" = "pending";
    const verifier: RewardVerifier = {
      available: true,
      async verify() {
        await Promise.resolve();
        return verdict;
      },
    };
    const r = new Rewards(store, verifier),
      current = () => ({ player: p, owned });
    const tx = r.prepare(profile.id, "level", p, time)!;
    assert.ok(tx.id);
    assert.equal(r.prepare(profile.id, "level", p, time), undefined);
    assert.equal(
      await r.settle("wrong-profile", tx.id, current, () => time),
      false,
    );
    assert.equal(await r.settle(profile.id, tx.id, current, () => time), false);
    assert.equal(p.level, 1);
    verdict = "rejected";
    assert.equal(await r.settle(profile.id, tx.id, current, () => time), false);
    verdict = "verified";
    const results = await Promise.all([
      r.settle(profile.id, tx.id, current, () => time),
      r.settle(profile.id, tx.id, current, () => time),
    ]);
    assert.deepEqual(results.sort(), [false, true]);
    assert.equal(p.level, 2);
    assert.equal(p.xp, 12);
    assert.equal(
      await new Rewards(store, verifier).settle(
        profile.id,
        tx.id,
        current,
        () => time,
      ),
      false,
    );
    assert.equal(r.prepare(profile.id, "speed", p, time + 299999), undefined);
    time += 300001;
    const speed = r.prepare(profile.id, "speed", p, time)!;
    assert.ok(speed);
    assert.equal(
      await r.settle(profile.id, speed.id, current, () => time),
      true,
    );
    assert.equal(p.speedMultiplier, 2);
    assert.equal(p.boostUntil, time + 120000);
    assert.equal(r.prepare(profile.id, "speed", p, time + 1), undefined);
    time += 300001;
    const expired = r.prepare(profile.id, "level", p, time)!;
    time += 300001;
    assert.equal(
      await r.settle(profile.id, expired.id, current, () => time),
      false,
    );
    assert.equal(p.level, 2);
  } finally {
    store.close();
  }
});
