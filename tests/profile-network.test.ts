import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, type Room } from "colyseus.js";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function track(room: Room) {
  const d: { token: string; p: any; offer: any; rebirth: any } = {
    token: "",
    p: null,
    offer: null,
    rebirth: null,
  };
  room.onMessage("snapshot", (s) => (d.p = s.players[room.sessionId]));
  for (const event of ["orbPatch", "pickup", "hoop", "trailInventory"])
    room.onMessage(event, () => {});
  room.onMessage("profile", (v) => (d.token = v.token));
  room.onMessage("rewardOffer", (v) => (d.offer = v));
  room.onMessage("progression", (v) => (d.rebirth = v));
  room.send("profile");
  for (let i = 0; i < 100 && (!d.token || !d.p); i++) await wait(20);
  assert.ok(d.token);
  assert.ok(d.p);
  return d;
}
test("real reconnect restores runner, forged ad/level/rebirth payloads cannot grant rewards", async () => {
  const c = new Client("ws://localhost:2567");
  let room = await c.create("plaza", { name: "Profile test" });
  try {
    const d = await track(room);
    for (let seq = 0; seq < 15; seq++) {
      room.send("input", { seq, x: 0, z: 1, jump: false });
      await wait(45);
    }
    await wait(200);
    const saved = { steps: d.p.steps, level: d.p.level, gems: d.p.gems };
    assert.ok(saved.steps > 0);
    room.send("rewardOffer", { kind: "level", completed: true });
    room.send("rebirth", { expected: 0, level: 999 });
    await wait(100);
    assert.equal(d.offer.available, false);
    assert.equal(d.rebirth.ok, false);
    assert.equal(d.p.rebirths, 0);
    const token = d.token;
    let rejected = false;
    room.onLeave(() => {
      rejected = true;
    });
    room.send("adCompleted", {
      kind: "level",
      completed: true,
      transaction: "fake",
    });
    for (let n = 0; n < 100 && !rejected; n++) await wait(20);
    assert.equal(rejected, true, "unrecognized forged claims must be rejected");
    await wait(100);
    room = await c.create("plaza", {
      name: "Returning runner",
      resumeToken: token,
    });
    const restored = await track(room);
    assert.equal(restored.token, token);
    assert.equal(restored.p.level, saved.level);
    assert.equal(restored.p.gems, saved.gems);
    assert.ok(restored.p.steps >= saved.steps);
  } finally {
    if (room.connection.isOpen) await room.leave();
  }
});
