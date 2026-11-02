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
  inputs = new Map<string, Input>();
  pendingJumps = new Set<string>();
  lastInput = new Map<string, number>();
  orbManager = new OrbManager();
  orbSyncTimes = new Map<string, number>();
  streaks = new Map<string, { last: number; count: number }>();
  hoopCooldowns = new Map<string, number>();
  emotes = new Map<string, number>();
  onCreate() {
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
        v.seq <= (this.inputs.get(p.id)?.seq ?? p.seq) ||
        v.seq > p.seq + 200
      )
        return;
      if (v.jump) this.pendingJumps.add(p.id);
      this.inputs.set(p.id, v);
      this.lastInput.set(p.id, Date.now());
    });
    this.onMessage("hello", (client) => {
      if (Date.now() - (this.emotes.get(client.sessionId) || 0) < 2000) return;
      this.emotes.set(client.sessionId, Date.now());
      this.broadcast("emote", { id: client.sessionId, text: "Hello!" });
    });
    this.setSimulationInterval(() => this.tick(), DT * 1000);
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
      vy: 0,
      angle: 0,
      seq: -1,
      steps: 0,
      xp: 0,
      gems: 0,
      level: 1,
      moving: false,
    };
  }
  onLeave(client: Client) {
    for (const key of this.hoopCooldowns.keys())
      if (key.startsWith(client.sessionId + ":"))
        this.hoopCooldowns.delete(key);
    this.orbSyncTimes.delete(client.sessionId);
    this.streaks.delete(client.sessionId);
    this.emotes.delete(client.sessionId);
    delete this.players[client.sessionId];
    this.pendingJumps.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.lastInput.delete(client.sessionId);
  }
  tick() {
    const now = Date.now();
    this.orbManager.tick(now);
    for (const p of Object.values(this.players)) {
      const i = this.inputs.get(p.id);
      const active = i && now - (this.lastInput.get(p.id) || 0) < 250;
      const old = Math.floor(p.steps / 10);
      const previous = { x: p.x, y: p.y, z: p.z };
      p.steps += move(
        p,
        active
          ? { ...i, jump: this.pendingJumps.has(p.id) }
          : { seq: p.seq, x: 0, z: 0, jump: false },
      );
      this.pendingJumps.delete(p.id);
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
          gains = orbReward(claimed.tier, level);
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
