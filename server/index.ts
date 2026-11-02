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
export class Plaza extends Room {
  maxClients = 20;
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
      sessionOnly: true,
      message,
    };
    client.send("trailInventory", inventory);
  }
  onCreate() {
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
        this.inventory(client, "That trail is locked for this session.");
        return;
      }
      p.equippedTrailId = resolveOwnedTrail(v, this.ownedTrails.get(p.id)!).id;
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
  onJoin(client: Client, options: { name?: string }) {
    const name =
      String(options.name || "Runner")
        .replace(/[^a-zA-Z0-9 _-]/g, "")
        .trim()
        .slice(0, 18) || "Runner";
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
      steps: 0,
      xp: 0,
      gems: 0,
      level: 1,
      moving: false,
      equippedTrailId: DEFAULT_TRAIL,
    };
    this.ownedTrails.set(client.sessionId, new Set([DEFAULT_TRAIL]));
  }
  onLeave(client: Client) {
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
      // One queued command per wall-clock tick: acknowledged inputs are simulated exactly once.
      const i = this.inputs.get(p.id)?.shift();
      const old = Math.floor(p.steps / 10);
      const previous = { x: p.x, y: p.y, z: p.z };
      p.steps += move(p, i || { seq: p.seq, x: 0, z: 0, jump: false });
      if (Math.floor(p.steps / 10) > old) reward(p, 2);
      for (const h of hoops) {
        const key = p.id + ":" + h.id;
        if (
          crossesHoop(h, previous, p) &&
          (this.hoopCooldowns.get(key) || 0) < now
        ) {
          this.hoopCooldowns.set(key, now + 20000);
          reward(p, h.xp);
          this.broadcast("hoop", { id: h.id, player: p.id, xp: h.xp });
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
