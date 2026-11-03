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
  trailReward,
  type TrailInventory,
} from "../shared/trails.js";
import { OrbManager, touchesOrb } from "./orbManager.js";
import { orbReward, ORB_BALANCE, type PickupEvent } from "../shared/orbs.js";
import { hoops, crossesHoop } from "../shared/world.js";
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
const rewards = new Rewards(profiles, rewardVerifier);
export class Plaza extends Room {
  rewardChecks = new Set<string>();
  maxClients = 20;
  profiles = new Map<string, { id: string; token: string }>();
  nextSave = 0;
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
        p && profile && (v?.kind === "level" || v?.kind === "speed")
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
    delete this.players[client.sessionId];
    this.inputs.delete(client.sessionId);
  }
  tick(now = Date.now()) {
    this.orbManager.tick(now);
    for (const p of Object.values(this.players)) {
      expireBoost(p, now);
      // One queued command per wall-clock tick: acknowledged inputs are simulated exactly once.
      const i = this.inputs.get(p.id)?.shift();
      const old = Math.floor(p.steps / 10);
      const previous = { x: p.x, y: p.y, z: p.z };
      p.steps += move(p, i || { seq: p.seq, x: 0, z: 0, jump: false });
      if (Math.floor(p.steps / 10) > old)
        reward(p, 2 * rebirthMultiplier(p.rebirths || 0));
      for (const h of hoops) {
        const key = p.id + ":" + h.id;
        if (
          crossesHoop(h, previous, p) &&
          (this.hoopCooldowns.get(key) || 0) < now
        ) {
          this.hoopCooldowns.set(key, now + 20000);
          reward(p, h.xp * rebirthMultiplier(p.rebirths || 0));
          this.broadcast("hoop", {
            id: h.id,
            player: p.id,
            xp: h.xp * rebirthMultiplier(p.rebirths || 0),
          });
        }
      }
      for (const orb of this.orbManager.active) {
        if (!touchesOrb(orb, previous, p)) continue;
        const claimed = this.orbManager.claim(orb.id, orb.generation, now);
        if (!claimed) continue;
        const level = p.level,
          gains = trailReward(
            orbReward(claimed.tier, level),
            resolveOwnedTrail(p.equippedTrailId, this.ownedTrails.get(p.id)!),
          );
        gains.xp *= rebirthMultiplier(p.rebirths || 0);
        p.steps += gains.steps;
        p.gems += gains.gems;
        reward(p, gains.xp);
        const old = this.streaks.get(p.id);
        const streak =
          old && now - old.last <= ORB_BALANCE.streakWindowMs
            ? old.count + 1
            : 1;
        this.streaks.set(p.id, { last: now, count: streak });
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
    const patch = this.orbManager.flush();
    if (patch) this.broadcast("orbPatch", patch);
    this.broadcast("snapshot", {
      players: this.players,
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
