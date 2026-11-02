import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, type Room } from "colyseus.js";
import { move, type Player } from "../shared/game";
import {
  orbReward,
  type Orb,
  type OrbState,
  type OrbPatch,
  type PickupEvent,
} from "../shared/orbs";
import { DEFAULT_TRAIL, type TrailInventory } from "../shared/trails";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, timeout = 5000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw Error("Server condition timed out");
    await wait(15);
  }
}
function track(room: Room) {
  const d = {
    players: {} as Record<string, Player>,
    orbs: new Map<number, Orb>(),
    pickups: [] as PickupEvent[],
    inventory: undefined as TrailInventory | undefined,
    snapshots: [] as Player[],
  };
  room.onMessage("snapshot", (s) => {
    d.players = s.players;
    d.snapshots.push({ ...s.players[room.sessionId] });
  });
  room.onMessage("orbState", (s: OrbState) => {
    d.orbs = new Map(s.orbs.map((o) => [o.id, o]));
  });
  room.onMessage("orbPatch", (p: OrbPatch) => {
    p.removed.forEach((id) => d.orbs.delete(id));
    p.spawned.forEach((o) => d.orbs.set(o.id, o));
  });
  room.onMessage("pickup", (p: PickupEvent) => d.pickups.push(p));
  room.onMessage("hoop", () => {});
  room.onMessage("trailInventory", (i: TrailInventory) => (d.inventory = i));
  room.send("orbSync");
  room.send("trailInventory");
  return d;
}
test("batched commands are acknowledged only after each simulation, and input spam cannot add server time", async () => {
  const a = await new Client("ws://localhost:2567").create("plaza", {
      name: "Sequence test",
    }),
    d = track(a);
  try {
    await until(() => !!d.players[a.sessionId]);
    let predicted = { ...d.players[a.sessionId] };
    const expected: Player[] = [];
    for (let seq = 0; seq < 3; seq++) {
      const input = { seq, x: 1, z: 0, jump: seq === 1 };
      move(predicted, input);
      expected.push({ ...predicted });
      a.send("input", input);
    }
    await until(() => d.players[a.sessionId].seq === 2);
    for (let seq = 0; seq < 3; seq++) {
      const state = d.snapshots.find((p) => p.seq === seq)!;
      assert.ok(state, `observed ack ${seq}`);
      assert.ok(Math.abs(state.x - expected[seq].x) < 1e-9);
      assert.ok(Math.abs(state.y - expected[seq].y) < 1e-9);
    }
    const before = d.players[a.sessionId].x;
    for (let seq = 3; seq < 100; seq++)
      a.send("input", {
        seq,
        x: 1,
        z: 0,
        jump: false,
        speed: 999,
        steps: 999999,
      });
    await wait(600);
    assert.ok(d.players[a.sessionId].x - before < 9 * 0.65);
    assert.ok(d.players[a.sessionId].seq < 20);
    const ack = d.players[a.sessionId].seq;
    a.send("input", { seq: 0, x: -1, z: 0, jump: true });
    await wait(100);
    assert.equal(d.players[a.sessionId].seq, ack);
  } finally {
    await a.leave();
  }
});
test("session milestones equip authoritatively, replicate to late joiners, award exactly once and reset on reconnect", async () => {
  const a = await new Client("ws://localhost:2567").create("plaza", {
      name: "Collector",
    }),
    d = track(a);
  let b: Room | undefined;
  try {
    await until(
      () => !!d.inventory && !!d.players[a.sessionId] && d.orbs.size > 200,
    );
    assert.deepEqual(d.inventory!.owned, [DEFAULT_TRAIL]);
    assert.equal(d.players[a.sessionId].equippedTrailId, DEFAULT_TRAIL);
    a.send("equipTrail", "special-hyperblast");
    await until(() => !!d.inventory?.message);
    assert.equal(d.inventory!.equipped, DEFAULT_TRAIL);
    let seq = 0;
    // Real pickups and running earn the first milestone; no privileged reward command.
    for (let n = 0; n < 650 && d.players[a.sessionId].level < 2; n++) {
      const p = d.players[a.sessionId];
      const target = [...d.orbs.values()]
        .filter((o) => o.route === "starter")
        .sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
        )[0];
      const dx = target.x - p.x,
        dz = target.z - p.z,
        len = Math.max(1, Math.hypot(dx, dz));
      a.send("input", { seq: seq++, x: dx / len, z: dz / len, jump: false });
      await wait(40);
    }
    a.send("input", { seq: seq++, x: 0, z: 0, jump: false });
    await until(() => !!d.inventory?.owned.includes("basic-red-trail"));
    a.send("equipTrail", "basic-red-trail");
    await until(() => d.inventory!.equipped === "basic-red-trail");
    b = await new Client("ws://localhost:2567").joinById(a.roomId, {
      name: "Observer",
    });
    const observer = track(b);
    await until(
      () =>
        observer.players[a.sessionId]?.equippedTrailId === "basic-red-trail",
    );
    const start = d.pickups.length;
    for (let n = 0; n < 200 && d.pickups.length === start; n++) {
      const p = d.players[a.sessionId],
        target = [...d.orbs.values()]
          .filter((o) => o.route === "starter")
          .sort(
            (a, b) =>
              Math.hypot(a.x - p.x, a.z - p.z) -
              Math.hypot(b.x - p.x, b.z - p.z),
          )[0];
      const dx = target.x - p.x,
        dz = target.z - p.z,
        len = Math.max(1, Math.hypot(dx, dz));
      a.send("input", { seq: seq++, x: dx / len, z: dz / len, jump: false });
      await wait(40);
    }
    a.send("input", { seq: seq++, x: 0, z: 0, jump: false });
    assert.ok(d.pickups.length > start);
    const event = d.pickups[start],
      base = orbReward(event.orb.tier, event.level);
    assert.equal(event.steps, base.steps + 2);
    assert.equal(event.gems, base.gems ? base.gems + 1 : 0);
    assert.equal(event.xp, base.xp);
    await until(() => !d.players[a.sessionId].moving);
    const count = d.pickups.length,
      steps = d.players[a.sessionId].steps;
    for (let n = 0; n < 8; n++) {
      a.send("equipTrail", n % 2 ? "basic-red-trail" : DEFAULT_TRAIL);
      await wait(160);
    }
    assert.equal(d.pickups.length, count);
    assert.equal(d.players[a.sessionId].steps, steps);
    const old = a.sessionId;
    await a.leave();
    await until(() => !observer.players[old]);
    const rejoined = await new Client("ws://localhost:2567").joinById(
        b.roomId,
        { name: "Collector" },
      ),
      fresh = track(rejoined);
    await until(() => !!fresh.inventory);
    assert.deepEqual(fresh.inventory!.owned, [DEFAULT_TRAIL]);
    assert.equal(fresh.inventory!.equipped, DEFAULT_TRAIL);
    await rejoined.leave();
  } finally {
    if (a.connection.isOpen) await a.leave();
    if (b?.connection.isOpen) await b.leave();
  }
});
