import {
  CRYSTAL_BY_ID,
  canOpenCrystal,
  choosePet,
  PET_BY_ID,
} from "../shared/pets.js";
import { EngagementService } from "./engagement.js";
import { TRIAL } from "../shared/engagement.js";
import { xpMultiplier } from "../shared/progression.js";
import { randomInt } from "node:crypto";
import { Rewards } from "./rewards.js";
import { rewardVerifier } from "./rewardVerifier.js";
import { Profiles, progress } from "./profiles.js";
import {
  rebirth,
  rebirthMultiplier,
  expireBoost,
} from "../shared/progression.js";
const profiles = new Profiles(
  process.env.RIFT_PROFILE_DB || ".data/profiles.sqlite",
);
import {
  DEFAULT_TRAIL,
  eligibleTrails,
  resolveOwnedTrail,
  type TrailInventory,
} from "../shared/trails.js";
import { OrbManager, touchesOrb } from "./orbManager.js";
import { ORB_BALANCE, type PickupEvent } from "../shared/orbs.js";
import { pickupReward } from "../shared/pickupReward.js";
import { hoops, crossesHoop } from "../shared/world.js";
import { PARKOUR_COURSES, inParkourRange } from "../shared/parkour.js";
import express from "express";
import { createServer } from "node:http";
import { Server, Room, Client } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import {
  DT,
  move,
  reward,
  validInput,
  type Player,
  type Input,
} from "../shared/game.js";
const engagement = new EngagementService(profiles);
const rewards = new Rewards(profiles, rewardVerifier);
export class Plaza extends Room {
  rewardChecks = new Set<string>();
  crystalTimes = new Map<string, number>();
  petInventory(client: Client) {
    const p = this.players[client.sessionId];
    if (p)
      client.send("petInventory", {
        owned: p.pets || {},
        equipped: p.equippedPetId,
        gems: p.gems,
      });
  }
  maxClients = 20;
  profiles = new Map<string, { id: string; token: string }>();
  nextSave = 0;
  nextEngagement = 0;
  savePlayer(id: string) {
    const profile = this.profiles.get(id),
      p = this.players[id],
      owned = this.ownedTrails.get(id);
    if (profile && p && owned) profiles.save(profile.id, progress(p, owned));
  }
  players: Record<string, Player> = {};
  inputs = new Map<string, Input[]>();
  ownedTrails = new Map<string, Set<string>>();
  equipTimes = new Map<string, number>();
  orbManager = new OrbManager();
  orbSyncTimes = new Map<string, number>();
  streaks = new Map<string, { last: number; count: number }>();
  hoopCooldowns = new Map<string, number>();
  parkour = new Map<string, { course: string; checkpoint: number; started: number }>();
  emotes = new Map<string, number>();
  inventory(client: Client, message?: string) {
    const p = this.players[client.sessionId];
    if (!p) return;
    const inventory: TrailInventory = {
      owned: [...(this.ownedTrails.get(p.id) || [])],
      equipped: p.equippedTrailId || DEFAULT_TRAIL,
      level: p.level,
      sessionOnly: false,
      message,
    };
    client.send("trailInventory", inventory);
  }
  onCreate() {
    this.onMessage("presence", (client, v) => {
      engagement.heartbeat(client.sessionId, v === true);
      if (v !== true) {
        const queue = this.inputs.get(client.sessionId),
          p = this.players[client.sessionId];
        // Acknowledge discarded queued intentions without simulating their movement.
        if (p && queue?.length) p.seq = Math.max(p.seq, queue.at(-1)!.seq);
        this.inputs.delete(client.sessionId);
      }
    });
    this.onMessage("engagement", (client) => {
      const p = this.players[client.sessionId];
      if (p) client.send("engagement", engagement.visible(p));
    });
    this.onMessage("claimEngagement", (client, v) => {
      const p = this.players[client.sessionId],
        profile = this.profiles.get(client.sessionId);
      if (!p || !profile) return;
      try {
        const ok = engagement.claim(
          p,
          profile.id,
          this.ownedTrails.get(p.id)!,
          String(v?.kind),
          String(v?.id),
        );
        client.send("engagementResult", {
          ok,
          message: ok
            ? "Reward claimed and saved!"
            : "Reward not ready or already claimed.",
        });
      } catch {
        client.send("engagementResult", {
          ok: false,
          message: "Save unavailable. Please retry.",
        });
      }
      client.send("engagement", engagement.visible(p));
    });
    // Only course selection comes from the client. Checkpoints are derived from
    // authoritative simulation; the client cannot submit a fake finish time.
    this.onMessage("startParkour", (client, id) => {
      const p = this.players[client.sessionId];
      const course = typeof id === "string" ? PARKOUR_COURSES.find((c) => c.id === id) : undefined;
      if (!p || !course) return;
      const send = (message: string) => client.send("parkour", { status: "error", message });
      if (this.parkour.has(p.id)) {
        send("Finish or cancel the current course first."); return;
      }
      if (!inParkourRange(course.start, p)) {
        send("Move to the highlighted course start before joining."); return;
      }
      this.parkour.set(p.id, { course: course.id, checkpoint: 0, started: Date.now() });
      client.send("parkour", {
        status: "started", course: course.id, checkpoint: 0,
        total: course.checkpoints.length, started: Date.now(),
      });
    });
    this.onMessage("cancelParkour", (client) => {
      this.parkour.delete(client.sessionId);
      client.send("parkour", { status: "cancelled" });
    });
    this.onMessage("startTrial", (client) => {
      const p = this.players[client.sessionId];
      if (p) {
        const ok = engagement.start(p);
        client.send("engagementResult", {
          ok,
          message: ok
            ? "Plaza Dash starts in 3 seconds. Follow the checkpoint guide!"
            : "Return to spawn to start the solo time trial.",
        });
        client.send("engagement", engagement.visible(p));
      }
    });
    this.onMessage("petInventory", (client) => this.petInventory(client));
    this.onMessage("equipPet", (client, id) => {
      const p = this.players[client.sessionId];
      if (!p) return;
      if (
        id !== null &&
        (typeof id !== "string" || !PET_BY_ID.has(id) || !p.pets?.[id])
      )
        return;
      p.equippedPetId = id || undefined;
      if (id) engagement.record(p, "equip");
      this.savePlayer(p.id);
      this.petInventory(client);
    });
    this.onMessage("openCrystal", (client, v) => {
      const p = this.players[client.sessionId],
        profile = this.profiles.get(client.sessionId);
      const fail = (message: string) =>
        client.send("crystalResult", { error: message });
      if (
        !p ||
        !profile ||
        typeof v?.id !== "string" ||
        !/^[a-zA-Z0-9-]{16,64}$/.test(v.id)
      )
        return fail("Invalid opening request.");
      const previous = profiles.crystalResult(profile.id, v.id);
      if (previous) {
        client.send("crystalResult", { ...previous, repeated: true });
        this.petInventory(client);
        return;
      }
      const c = CRYSTAL_BY_ID.get(v.crystal);
      if (!c || !canOpenCrystal(p, c))
        return fail("Stand near the crystal and collect enough Gems.");
      const now = Date.now();
      if (now - (this.crystalTimes.get(p.id) || 0) < 1500)
        return fail("Wait for the crystal to settle.");
      this.crystalTimes.set(p.id, now);
      const pet = choosePet(c, randomInt(1_000_000) / 1_000_000);
      if ((p.pets?.[pet] || 0) >= 999)
        return fail("This companion collection is full.");
      const next = {
        ...p,
        gems: p.gems - c.cost,
        pets: { ...p.pets, [pet]: (p.pets?.[pet] || 0) + 1 },
        equippedPetId: p.equippedPetId || pet,
        engagement: structuredClone(engagement.state(p)),
      };
      engagement.record(next, "hatch");
      engagement.record(next, "equip");
      const duplicate = !!p.pets?.[pet];
      try {
        if (
          !profiles.commitCrystal(
            profile.id,
            v.id,
            progress(next, this.ownedTrails.get(p.id)!),
            { pet, crystal: c.id },
          )
        )
          return;
      } catch {
        return fail("Save unavailable. No Gems were spent.");
      }
      Object.assign(p, next);
      this.petInventory(client);
      client.send("crystalResult", { pet, crystal: c.id, duplicate });
    });

    this.onMessage("profile", (client) => {
      const p = this.profiles.get(client.sessionId);
      if (p) client.send("profile", { token: p.token });
    });
    this.onMessage("rebirth", (client, v) => {
      const p = this.players[client.sessionId];
      const candidate = p ? { ...p } : undefined;
      // The expected count makes a repeated/stale confirmation ineligible.
      if (
        !p ||
        !v ||
        !Number.isSafeInteger(v.expected) ||
        v.expected !== (p.rebirths || 0) ||
        !candidate ||
        !rebirth(candidate)
      ) {
        client.send("progression", {
          ok: false,
          message: "Rebirth is not available at your current level.",
        });
        return;
      }
      try {
        profiles.save(
          this.profiles.get(p.id)!.id,
          progress(candidate, this.ownedTrails.get(p.id)!),
        );
      } catch {
        client.send("progression", {
          ok: false,
          message:
            "Your save is unavailable. Rebirth was not applied; try again later.",
        });
        return;
      }
      Object.assign(p, candidate);
      this.inputs.delete(p.id);
      this.inventory(client);
      client.send("progression", {
        ok: true,
        message: "REBORN! Your gems and unlocked trails are preserved.",
      });
    });
    this.onMessage("rewardOffer", (client) =>
      client.send("rewardOffer", {
        available: rewards.available,
        message: rewards.available
          ? "Confirm the offer before watching an ad."
          : "Rewarded offers are not available yet.",
      }),
    );
    this.onMessage("rewardPrepare", (client, v) => {
      const p = this.players[client.sessionId],
        profile = this.profiles.get(client.sessionId);
      const tx =
        p &&
        profile &&
        (v?.kind === "level" || v?.kind === "speed" || v?.kind === "xp")
          ? rewards.prepare(profile.id, v.kind, p)
          : undefined;
      client.send(
        "rewardTransaction",
        tx
          ? { id: tx.id, kind: tx.kind, expires: tx.expires }
          : { error: "Reward unavailable or on cooldown." },
      );
    });
    this.onMessage("rewardCheck", async (client, v) => {
      const profile = this.profiles.get(client.sessionId);
      if (
        !profile ||
        typeof v?.id !== "string" ||
        v.id.length > 64 ||
        this.rewardChecks.has(profile.id)
      )
        return;
      this.rewardChecks.add(profile.id);
      try {
        const ok = await rewards.settle(profile.id, v.id, () => {
          const player = this.players[client.sessionId],
            owned = this.ownedTrails.get(client.sessionId);
          return player && owned ? { player, owned } : undefined;
        });
        client.send("rewardResult", {
          ok,
          message: ok
            ? "Reward verified and saved."
            : "Reward not verified. No progress changed.",
        });
      } catch {
        client.send("rewardResult", {
          ok: false,
          message: "Reward verification unavailable. Try again later.",
        });
      } finally {
        this.rewardChecks.delete(profile.id);
      }
    });

    this.onMessage("trailInventory", (client) => this.inventory(client));
    this.onMessage("equipTrail", (client, v) => {
      const p = this.players[client.sessionId];
      if (!p) return;
      const now = Date.now();
      if (now - (this.equipTimes.get(p.id) || 0) < 150) {
        this.inventory(client, "Please wait a moment before switching again.");
        return;
      }
      this.equipTimes.set(p.id, now);
      if (typeof v !== "string" || !this.ownedTrails.get(p.id)?.has(v)) {
        this.inventory(client, "That trail is not unlocked yet.");
        return;
      }
      p.equippedTrailId = resolveOwnedTrail(v, this.ownedTrails.get(p.id)!).id;
      this.savePlayer(p.id);
      this.inventory(client, "Trail equipped.");
    });
    this.onMessage("ping", (client, v) => {
      if (typeof v === "number" && Number.isFinite(v)) client.send("pong", v);
    });
    this.onMessage("orbSync", (client) => {
      const now = Date.now();
      if (now - (this.orbSyncTimes.get(client.sessionId) || 0) < 500) return;
      this.orbSyncTimes.set(client.sessionId, now);
      client.send("orbState", this.orbManager.snapshot());
    });
    this.onMessage("input", (client, v) => {
      const p = this.players[client.sessionId];
      if (
        !p ||
        !validInput(v) ||
        (!engagement.acceptsMovement(p.id) &&
          (v.x !== 0 || v.z !== 0 || v.jump)) ||
        v.seq <= (this.inputs.get(p.id)?.at(-1)?.seq ?? p.seq) ||
        v.seq > p.seq + 128 ||
        (this.inputs.get(p.id)?.length || 0) >= 12
      )
        return;
      const queue = this.inputs.get(p.id) || [];
      queue.push({ seq: v.seq, x: v.x, z: v.z, jump: v.jump });
      this.inputs.set(p.id, queue);
    });
    this.onMessage("hello", (client) => {
      if (Date.now() - (this.emotes.get(client.sessionId) || 0) < 2000) return;
      this.emotes.set(client.sessionId, Date.now());
      this.broadcast("emote", { id: client.sessionId, text: "Hello!" });
    });
    let budget = 0;
    this.setSimulationInterval((elapsed) => {
      // Keep wall-clock cadence despite timer drift. Catch up at most 200 ms after a stall.
      budget += Math.min(elapsed, 200);
      while (budget >= DT * 1000) {
        budget -= DT * 1000;
        this.tick(Date.now() - budget);
      }
    }, DT * 1000);
  }
  onJoin(client: Client, options: { name?: string; resumeToken?: string }) {
    const name =
      String(options.name || "Runner")
        .replace(/[^a-zA-Z0-9 _-]/g, "")
        .trim()
        .slice(0, 18) || "Runner";
    const profile = profiles.acquire(options.resumeToken);
    this.profiles.set(client.sessionId, {
      id: profile.id,
      token: profile.token,
    });
    const { owned, ...savedProgress } = profile.data;
    this.players[client.sessionId] = {
      id: client.sessionId,
      name,
      x: 0,
      y: 0,
      z: 0,
      verticalVelocity: 0,
      velocityX: 0,
      velocityZ: 0,
      angle: 0,
      seq: -1,
      moving: false,
      ...savedProgress,
    };
    this.ownedTrails.set(client.sessionId, new Set(owned));
  }
  onLeave(client: Client) {
    this.savePlayer(client.sessionId);
    const profile = this.profiles.get(client.sessionId);
    if (profile) profiles.release(profile.id);
    this.profiles.delete(client.sessionId);
    for (const key of this.hoopCooldowns.keys())
      if (key.startsWith(client.sessionId + ":"))
        this.hoopCooldowns.delete(key);
    this.ownedTrails.delete(client.sessionId);
    this.equipTimes.delete(client.sessionId);
    this.orbSyncTimes.delete(client.sessionId);
    this.streaks.delete(client.sessionId);
    this.emotes.delete(client.sessionId);
    this.crystalTimes.delete(client.sessionId);
    engagement.cleanup(client.sessionId);
    this.parkour.delete(client.sessionId);
    delete this.players[client.sessionId];
    this.inputs.delete(client.sessionId);
  }
  updateParkour(p: Player, before: { x: number; y: number; z: number }, now: number) {
    const state = this.parkour.get(p.id);
    if (!state) return;
    const course = PARKOUR_COURSES.find((c) => c.id === state.course);
    if (!course) { this.parkour.delete(p.id); return; }
    const client = this.clients.find((c) => c.sessionId === p.id);
    if (now - state.started > course.maximumMs) {
      this.parkour.delete(p.id);
      client?.send("parkour", { status: "expired", message: "Course time expired. Try again!" });
      return;
    }
    const checkpoint = course.checkpoints[state.checkpoint];
    if (!checkpoint) return;
    let passed = false;
    if (checkpoint.type === "hoop") {
      const hoop = hoops.find((h) => h.id === checkpoint.id);
      passed = !!hoop && crossesHoop(hoop, before, p);
    } else {
      passed = inParkourRange(checkpoint, p);
    }
    if (!passed) return;
    state.checkpoint++;
    if (state.checkpoint < course.checkpoints.length) {
      client?.send("parkour", {
        status: "checkpoint", course: course.id, checkpoint: state.checkpoint,
        total: course.checkpoints.length,
      });
      return;
    }
    this.parkour.delete(p.id);
    const elapsed = now - state.started;
    if (elapsed < course.minimumMs) {
      client?.send("parkour", { status: "error", message: "Course completed too quickly to qualify." });
      return;
    }
    const best = p.parkourBest?.[course.id];
    const improved = !best || elapsed < best;
    const previousGrant = p.parkourRewardAt?.[course.id] || 0;
    const canReward = now - previousGrant >= course.cooldownMs;
    const next: Player = {
      ...p,
      parkourBest: improved ? { ...(p.parkourBest || {}), [course.id]: elapsed } : p.parkourBest,
      parkourRewardAt: canReward
        ? { ...(p.parkourRewardAt || {}), [course.id]: now }
        : p.parkourRewardAt,
      gems: p.gems + (canReward ? course.gems : 0),
    };
    const profile = this.profiles.get(p.id);
    const owned = this.ownedTrails.get(p.id);
    if (!profile || !owned) return;
    try {
      const saved = canReward
        ? profiles.commitGrant(profile.id, `parkour:${course.id}:${state.started}`, progress(next, owned))
        : (profiles.save(profile.id, progress(next, owned)), true);
      if (!saved) throw Error("Duplicate completion");
      Object.assign(p, next);
      client?.send("parkour", {
        status: "finished", course: course.id, milliseconds: elapsed,
        best: p.parkourBest?.[course.id], gems: canReward ? course.gems : 0,
        message: canReward ? "Course reward saved!" : "Completed! Reward on cooldown.",
      });
    } catch {
      client?.send("parkour", { status: "error", message: "Could not safely save course result." });
    }
  }
  tick(now = Date.now()) {
    this.orbManager.tick(now);
    for (const p of Object.values(this.players)) {
      expireBoost(p, now);
      // One queued command per wall-clock tick: acknowledged inputs are simulated exactly once.
      const i = this.inputs.get(p.id)?.shift();
      const old = Math.floor(p.steps / 10);
      const previous = { x: p.x, y: p.y, z: p.z };
      const distance = move(p, i || { seq: p.seq, x: 0, z: 0, jump: false });
      this.updateParkour(p, previous, now);
      p.steps += distance;
      const finished = engagement.tick(p, distance, !!i, now);
      if (finished) {
        const s = engagement.state(p, now),
          profile = this.profiles.get(p.id)!;
        if (now - (s.trialRewardAt || 0) >= TRIAL.cooldown) {
          const next = {
            ...p,
            engagement: { ...s, trialRewardAt: now },
            gems: p.gems + TRIAL.reward,
          };
          try {
            if (
              profiles.commitGrant(
                profile.id,
                `trial:${s.trialRewardAt || 0}`,
                progress(next, this.ownedTrails.get(p.id)!),
              )
            )
              Object.assign(p, next);
          } catch {}
        }
        this.clients
          .find((c) => c.sessionId === p.id)
          ?.send("engagementResult", {
            ok: true,
            message: `Plaza Dash finished in ${(finished / 1000).toFixed(2)}s. Personal best saved.`,
          });
        this.savePlayer(p.id);
      }
      if (Math.floor(p.steps / 10) > old)
        reward(p, 2 * rebirthMultiplier(p.rebirths || 0));
      for (const h of hoops) {
        const key = p.id + ":" + h.id;
        if (
          crossesHoop(h, previous, p) &&
          (this.hoopCooldowns.get(key) || 0) < now
        ) {
          this.hoopCooldowns.set(key, now + 20000);
          engagement.record(p, "hoops");
          reward(
            p,
            h.xp * rebirthMultiplier(p.rebirths || 0) * xpMultiplier(p, now),
          );
          this.broadcast("hoop", {
            id: h.id,
            player: p.id,
            xp:
              h.xp * rebirthMultiplier(p.rebirths || 0) * xpMultiplier(p, now),
          });
        }
      }
      for (const orb of this.orbManager.active) {
        if (!touchesOrb(orb, previous, p)) continue;
        const claimed = this.orbManager.claim(orb.id, orb.generation, now);
        if (!claimed) continue;
        const level = p.level,
          gains = pickupReward(
            p,
            claimed.tier,
            resolveOwnedTrail(p.equippedTrailId, this.ownedTrails.get(p.id)!),
          );
        engagement.record(p, "orbs");
        engagement.record(p, claimed.tier);
        if (gains.gems) engagement.record(p, "gems", gains.gems);
        p.steps += gains.steps;
        p.gems += gains.gems;
        reward(p, gains.xp);
        const old = this.streaks.get(p.id);
        const streak =
          old && now - old.last <= ORB_BALANCE.streakWindowMs
            ? old.count + 1
            : 1;
        this.streaks.set(p.id, { last: now, count: streak });
        const activity = engagement.state(p, now);
        if (
          streak >= 5 &&
          now - (activity.comboAt || 0) >= 30000 &&
          activity.comboRewards < 20
        ) {
          const next = {
            ...p,
            gems: p.gems + 1,
            engagement: {
              ...activity,
              comboAt: now,
              comboRewards: activity.comboRewards + 1,
            },
          };
          try {
            if (
              profiles.commitGrant(
                this.profiles.get(p.id)!.id,
                `combo:${activity.day}:${activity.comboRewards}`,
                progress(next, this.ownedTrails.get(p.id)!),
              )
            ) {
              Object.assign(p, next);
              this.clients
                .find((c) => c.sessionId === p.id)
                ?.send("engagementResult", {
                  ok: true,
                  message: "COMBO RUSH · +1 Gem!",
                });
            }
          } catch {}
        }
        const event: PickupEvent = {
          orb: claimed,
          player: p.id,
          level,
          streak,
          ...gains,
        };
        this.broadcast("pickup", event);
      }
    }
    for (const p of Object.values(this.players)) {
      const owned = this.ownedTrails.get(p.id)!;
      const unlocked = eligibleTrails(p.level).filter((id) => !owned.has(id));
      if (unlocked.length) {
        unlocked.forEach((id) => owned.add(id));
        const client = this.clients.find((c) => c.sessionId === p.id);
        if (client)
          this.inventory(
            client,
            `${unlocked.length} trails unlocked at level ${p.level}!`,
          );
      }
    }
    if (now >= this.nextSave) {
      for (const id of Object.keys(this.players)) this.savePlayer(id);
      this.nextSave = now + 5000;
    }
    if (now >= this.nextEngagement) {
      for (const c of this.clients) {
        const p = this.players[c.sessionId];
        if (p) c.send("engagement", engagement.visible(p, now));
      }
      this.nextEngagement = now + 1000;
    }
    const patch = this.orbManager.flush();
    if (patch) this.broadcast("orbPatch", patch);
    this.broadcast("snapshot", {
      players: Object.fromEntries(
        Object.entries(this.players).map(
          ([id, { engagement: privateProgress, ...p }]) => [id, p],
        ),
      ),
      orbRevision: this.orbManager.revision,
      time: now,
    });
  }
}
const app = express();
app.get("/health", (_req, res) => res.json({ ok: true, version: "0.1.0" }));
const http = createServer(app);
const server = new Server({
  transport: new WebSocketTransport({ server: http }),
});
server.define("plaza", Plaza);
server.listen(Number(process.env.PORT || 2567), "0.0.0.0");
console.log(
  "Velocity Rift multiplayer server starting on port",
  process.env.PORT || 2567,
);
