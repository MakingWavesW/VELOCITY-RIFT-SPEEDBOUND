import { test } from "node:test";
import assert from "node:assert/strict";
import { Profiles, progress } from "../server/profiles.js";
import { EngagementService } from "../server/engagement.js";
import {
  freshEngagement,
  claimEngagement,
  refreshDay,
  PLAYTIME,
  DAILY,
  utcDay,
  TRIAL,
} from "../shared/engagement.js";
import { verifiedReward, xpMultiplier } from "../shared/progression.js";
import { pickupReward } from "../shared/pickupReward.js";
import { TRAILS } from "../shared/trails.js";
import { Rewards } from "../server/rewards.js";
import type { Player } from "../shared/game.js";
const now = Date.UTC(2026, 10, 3, 12);
const player = (): Player => ({
  id: "runner",
  name: "Runner",
  x: 0,
  y: 0,
  z: 0,
  velocityX: 0,
  velocityZ: 0,
  verticalVelocity: 0,
  angle: 0,
  seq: -1,
  moving: false,
  steps: 0,
  xp: 0,
  gems: 0,
  level: 1,
});
test("playtime requires fresh foreground presence and physical movement; time is bounded", () => {
  const db = new Profiles(":memory:"),
    service = new EngagementService(db),
    p = player();
  for (let i = 0; i < 100; i++) service.tick(p, 1, true, now + i * 40);
  assert.equal(p.engagement!.activeMs, 0);
  service.heartbeat(p.id, true, now);
  service.tick(p, 0, true, now);
  assert.equal(p.engagement!.activeMs, 0);
  service.tick(p, 0.5, true, now);
  assert.equal(p.engagement!.activeMs, 40);
  service.heartbeat(p.id, false, now + 40);
  service.tick(p, 0.5, true, now + 40);
  assert.equal(p.engagement!.activeMs, 40);
  service.heartbeat(p.id, true, now);
  service.tick(p, 0.5, true, now + 5000);
  assert.equal(p.engagement!.activeMs, 40);
  db.close();
});
test("playtime claims atomically retain Gems and readiness across reconnect", () => {
  const db = new Profiles(":memory:"),
    profile = db.acquire(),
    service = new EngagementService(db),
    p = player(),
    owned = new Set(["default-white"]);
  p.engagement = freshEngagement(now);
  p.engagement.activeMs = 120000;
  assert.equal(service.claim(p, profile.id, owned, "playtime", "0", now), true);
  assert.equal(p.gems, 5);
  assert.equal(
    service.claim(p, profile.id, owned, "playtime", "0", now),
    false,
  );
  assert.equal(
    service.claim(p, profile.id, owned, "playtime", "1", now),
    false,
  );
  db.release(profile.id);
  const restored = db.acquire(profile.token);
  assert.equal(restored.data.gems, 5);
  assert.deepEqual(restored.data.engagement!.playClaims, [0]);
  assert.equal(
    db.commitGrant(profile.id, `play:${utcDay(now)}:0`, {
      ...progress(p, owned),
      gems: 999,
    }),
    false,
  );
  db.close();
});
test("UTC daily calendar, duplicate rejection, missed-day reset and backwards time", () => {
  const s = freshEngagement(now);
  assert.equal(claimEngagement(s, "daily", "", now)!.gems, 3);
  assert.equal(claimEngagement(s, "daily", "", now), undefined);
  for (let day = 1; day < 7; day++)
    assert.equal(
      claimEngagement(s, "daily", "", now + day * 86400000)!.gems,
      DAILY[day],
    );
  assert.equal(claimEngagement(s, "daily", "", now + 7 * 86400000)!.gems, 3);
  assert.equal(claimEngagement(s, "daily", "", now + 9 * 86400000)!.gems, 3);
  assert.equal(claimEngagement(s, "daily", "", now), undefined);
  s.activeMs = 900000;
  s.playClaims = [0, 1];
  refreshDay(s, now + 10 * 86400000);
  assert.equal(s.activeMs, 0);
  assert.deepEqual(s.playClaims, []);
  assert.equal(PLAYTIME.at(-1)!.gems, 60);
});
test("quest claims require server facts, sequence and single-use status", () => {
  const s = freshEngagement(now);
  assert.equal(claimEngagement(s, "intro", "blue", now), undefined);
  s.counts.blue = 5;
  assert.equal(claimEngagement(s, "intro", "blue", now)!.gems, 2);
  assert.equal(claimEngagement(s, "intro", "blue", now), undefined);
  s.counts.gems = 6;
  assert.equal(claimEngagement(s, "intro", "gems", now), undefined);
  s.counts.purple = 1;
  s.counts.red = 1;
  assert.equal(claimEngagement(s, "intro", "spectrum", now)!.gems, 2);
  assert.equal(claimEngagement(s, "intro", "gems", now)!.gems, 2);
});
test("XP boost has exact expiry, no stacking and affects only eligible XP", () => {
  const p = player();
  p.level = 10;
  p.rebirths = 2;
  p.pets = { "sun-puff": 1 };
  p.equippedPetId = "sun-puff";
  const base = pickupReward(p, "blue", TRAILS[0], now);
  assert.equal(verifiedReward(p, "xp", now), true);
  assert.equal(verifiedReward(p, "xp", now + 1), false);
  assert.equal(p.xpBoostUntil, now + 180000);
  const boosted = pickupReward(p, "blue", TRAILS[0], now + 179999);
  assert.equal(boosted.xp, base.xp * 2);
  assert.equal(boosted.steps, base.steps);
  assert.equal(boosted.gems, base.gems);
  assert.equal(xpMultiplier(p, now + 180000), 1);
  assert.equal(p.speedMultiplier, undefined);
  assert.equal(verifiedReward(p, "speed", now), true);
  assert.equal(p.speedMultiplier, 2);
});
test("XP grants require verification and persist a single-use transaction", async () => {
  const db = new Profiles(":memory:"),
    profile = db.acquire(),
    p = player(),
    owned = new Set(["default-white"]);
  const disabled = new Rewards(db, {
    available: false,
    async verify() {
      return "verified";
    },
  });
  assert.equal(disabled.prepare(profile.id, "xp", p, now), undefined);
  const rewards = new Rewards(db, {
      available: true,
      async verify() {
        return "verified";
      },
    }),
    tx = rewards.prepare(profile.id, "xp", p, now)!;
  assert.equal(
    await rewards.settle(
      profile.id,
      tx.id,
      () => ({ player: p, owned }),
      () => now,
    ),
    true,
  );
  assert.equal(
    await rewards.settle(
      profile.id,
      tx.id,
      () => ({ player: p, owned }),
      () => now,
    ),
    false,
  );
  db.release(profile.id);
  assert.equal(db.acquire(profile.token).data.xpBoostUntil, now + 180000);
  db.close();
});
test("solo trial requires ordered checkpoints after countdown; teleport to finish does nothing", () => {
  const db = new Profiles(":memory:"),
    service = new EngagementService(db),
    p = player();
  assert.equal(service.start(p, now), true);
  assert.equal(service.tick(p, 0, false, now + 4000), undefined);
  let result;
  for (let i = 0; i < TRIAL.points.length; i++) {
    Object.assign(p, TRIAL.points[i]);
    result = service.tick(p, 1, true, now + 5000 + i * 5000);
  }
  assert.equal(result, 17000);
  assert.equal(p.engagement!.counts.trial, 1);
  assert.equal(service.tick(p, 0, false, now + 25000), undefined);
  db.close();
});
