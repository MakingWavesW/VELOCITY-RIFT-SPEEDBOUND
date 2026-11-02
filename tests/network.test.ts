import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, type Room } from "colyseus.js";
import { validInput } from "../shared/game.js";
import {
  orbReward,
  type Orb,
  type OrbState,
  type OrbPatch,
  type PickupEvent,
  ORB_TYPES,
} from "../shared/orbs.js";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout)
      throw new Error("Timed out awaiting server condition");
    await wait(30);
  }
}
function track(room: Room) {
  const data = {
    state: undefined as any,
    orbs: new Map<number, Orb>(),
    revision: -1,
    pickups: [] as PickupEvent[],
    hoops: [] as any[],
  };
  room.onMessage("snapshot", (s) => (data.state = s));
  room.onMessage("orbState", (s: OrbState) => {
    data.orbs = new Map(s.orbs.map((o) => [o.id, o]));
    data.revision = s.revision;
  });
  room.onMessage("orbPatch", (p: OrbPatch) => {
    for (const id of p.removed) data.orbs.delete(id);
    for (const orb of p.spawned) data.orbs.set(orb.id, orb);
    data.revision = p.revision;
  });
  room.onMessage("pickup", (p: PickupEvent) => data.pickups.push(p));
  room.onMessage("hoop", (h) => data.hoops.push(h));
  room.send("orbSync");
  return data;
}
test("reject malformed movement", () => {
  assert.equal(validInput({ seq: 0, x: Infinity, z: 0, jump: false }), false);
  assert.equal(validInput({ seq: 0, x: 2, z: 0, jump: false }), false);
});
test("two clients share random layout, exact single reward, disappearance and relocated respawn; spoofing fails", async () => {
  const a = await new Client("ws://localhost:2567").create("plaza", {
      name: "Test A",
    }),
    da = track(a);
  const b = await new Client("ws://localhost:2567").joinById(a.roomId, {
      name: "Test B",
    }),
    db = track(b);
  try {
    await until(
      () =>
        !!da.state && !!db.state && da.orbs.size > 200 && db.orbs.size > 200,
    );
    assert.deepEqual([...da.orbs.values()], [...db.orbs.values()]);
    assert.equal(Object.keys(db.state.players).length, 2);
    const target = [...da.orbs.values()]
      .filter((o) => o.tier === "blue" && o.route === "starter")
      .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
    let seq = 0;
    for (
      let n = 0;
      n < 140 && !da.pickups.some((e) => e.orb.id === target.id);
      n++
    ) {
      const p = da.state.players[a.sessionId];
      const dx = target.x - p.x,
        dz = target.z - p.z,
        length = Math.max(1, Math.hypot(dx, dz));
      a.send("input", {
        seq: seq++,
        x: dx / length,
        z: dz / length,
        jump: false,
      });
      await wait(40);
    }
    a.send("input", { seq: seq++, x: 0, z: 0, jump: false });
    const stoppedSeq = seq - 1;
    await until(
      () =>
        da.state.players[a.sessionId].seq >= stoppedSeq &&
        !da.state.players[a.sessionId].moving,
    );
    await until(() => db.pickups.some((e) => e.orb.id === target.id));
    const events = da.pickups.filter((e) => e.orb.id === target.id);
    assert.equal(events.length, 1);
    const e = events[0];
    assert.equal(e.player, a.sessionId);
    assert.deepEqual(
      { steps: e.steps, xp: e.xp, gems: e.gems },
      orbReward(e.orb.tier, e.level),
    );
    assert.ok(!db.orbs.has(target.id) && !da.orbs.has(target.id));
    assert.equal(db.state.players[b.sessionId].gems, 0);
    const count = da.pickups.length;
    const stepsBefore = da.state.players[a.sessionId].steps;
    a.send("input", { seq: seq++, x: 999, z: 0, jump: false, steps: 999999 });
    await wait(350);
    assert.equal(da.pickups.length, count);
    assert.equal(da.state.players[a.sessionId].steps, stepsBefore);
    a.send("input", { seq: seq++, x: 0, z: 0, jump: true });
    a.send("input", { seq: seq++, x: 0, z: 0, jump: false });
    await until(() => db.state.players[a.sessionId].y > 0.2);
    await until(
      () => !!da.orbs.get(target.id) && !!db.orbs.get(target.id),
      ORB_TYPES.blue.respawn[1] + 3000,
    );
    const next = da.orbs.get(target.id)!;
    assert.equal(next.generation, target.generation + 1);
    assert.ok(Math.hypot(next.x - target.x, next.z - target.z) >= 3);
    assert.deepEqual(next, db.orbs.get(target.id));
    const observed = db.pickups.length;
    a.send("pickup", {
      id: target.id,
      generation: next.generation,
      steps: 999999,
    });
    await until(() => Object.keys(db.state.players).length === 1);
    assert.equal(
      db.pickups.length,
      observed,
      "spoofed reward is never broadcast",
    );
    assert.equal(
      a.connection.isOpen,
      false,
      "unknown reward messages are rejected by Colyseus",
    );
  } finally {
    if (a.connection.isOpen) await a.leave();
    await b.leave();
  }
});
test("launch-pad route still grants a server-validated solar hoop reward", async () => {
  const client = await new Client("ws://localhost:2567").create("plaza", {
      name: "Hoop tester",
    }),
    d = track(client);
  try {
    await until(() => !!d.state);
    for (let seq = 0; seq < 300 && !d.hoops.length; seq++) {
      client.send("input", { seq, x: 0, z: -1, jump: false });
      await wait(40);
    }
    assert.equal(d.hoops.length, 1);
    assert.equal(d.hoops[0].id, 0);
    assert.equal(d.hoops[0].xp, 20);
  } finally {
    await client.leave();
  }
});

test("client cannot create a red orb with a spawn message", async () => {
  const client = await new Client("ws://localhost:2567").create("plaza", {
    name: "Spoof test",
  });
  const d = track(client);
  try {
    await until(() => d.orbs.size > 200);
    client.send("spawnOrb", { tier: "red", x: 0, y: 0, z: 0 });
    await until(() => !client.connection.isOpen);
    assert.equal(d.pickups.length, 0);
  } finally {
    if (client.connection.isOpen) await client.leave();
  }
});
