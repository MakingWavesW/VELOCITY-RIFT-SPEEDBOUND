import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "colyseus.js";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
test("pause discards queued movement, rejects stale motion, and resumes with bounded commands", async () => {
  const room = await new Client("ws://localhost:2567").create("plaza", {
    name: "Pause regression",
  });
  let p: any;
  room.onMessage("snapshot", (s) => (p = s.players[room.sessionId]));
  for (const name of ["engagement", "orbPatch", "trailInventory"])
    room.onMessage(name, () => {});
  try {
    for (let n = 0; !p && n < 100; n++) await wait(20);
    assert.ok(p);
    room.send("presence", false);
    await wait(80);
    const x = p.x;
    for (let seq = 0; seq < 12; seq++)
      room.send("input", { seq, x: 1, z: 0, jump: false });
    await wait(200);
    assert.equal(p.x, x);
    assert.equal(p.steps, 0);
    room.send("presence", true);
    room.send("input", { seq: 12, x: 1, z: 0, jump: false });
    for (let n = 0; p.seq !== 12 && n < 100; n++) await wait(20);
    assert.equal(p.seq, 12);
    assert.ok(p.x > x);
    for (let seq = 13; seq < 25; seq++)
      room.send("input", { seq, x: 1, z: 0, jump: false });
    room.send("presence", false);
    await wait(200);
    const stopped = p.x;
    await wait(200);
    assert.equal(p.x, stopped);
    room.send("presence", true);
    room.send("input", { seq: 25, x: 1, z: 0, jump: false });
    for (let n = 0; p.seq !== 25 && n < 100; n++) await wait(20);
    assert.equal(p.seq, 25);
    assert.ok(p.x > stopped);
  } finally {
    if (room.connection.isOpen) await room.leave();
  }
});
