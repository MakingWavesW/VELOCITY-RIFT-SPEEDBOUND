import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { Client, type Room } from "colyseus.js";
import { Profiles } from "../server/profiles.js";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean) {
  for (let n = 0; n < 200; n++) {
    if (fn()) return;
    await wait(20);
  }
  throw Error("Expected server state timed out");
}
test(
  "real crystal spend, duplicate protection, remote pet visibility and saved ownership",
  { timeout: 20000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "rift-crystal-")),
      db = join(dir, "profiles.sqlite");
    const profiles = new Profiles(db),
      profile = profiles.acquire();
    profiles.save(profile.id, {
      ...profile.data,
      level: 50,
      xp: 20,
      steps: 40000,
      gems: 73,
      owned: ["default-white", "basic-red"],
      equippedTrailId: "basic-red",
    });
    profiles.release(profile.id);
    profiles.close();
    const socket = createServer();
    await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
    const port = (socket.address() as { port: number }).port;
    await new Promise<void>((r) => socket.close(() => r()));
    const server = spawn(
      process.execPath,
      ["--import", "tsx", "server/index.ts"],
      {
        env: { ...process.env, PORT: String(port), RIFT_PROFILE_DB: db },
        stdio: "ignore",
      },
    );
    let room: Room | undefined;
    try {
      let ready = false;
      for (let n = 0; n < 150 && !ready; n++) {
        try {
          ready = (await fetch(`http://localhost:${port}/health`)).ok;
        } catch {}
        if (!ready) await wait(50);
      }
      assert.ok(ready);
      const client = new Client(`ws://localhost:${port}`);
      room = await client.create("plaza", { resumeToken: profile.token });
      let p: any, remote: any, inventory: any;
      const results: any[] = [];
      const track = (r: Room) => {
        r.onMessage("snapshot", (v) => (p = v.players[r.sessionId]));
        r.onMessage("crystalResult", (v) => results.push(v));
        r.onMessage("petInventory", (v) => (inventory = v));
        for (const e of ["orbPatch", "pickup", "hoop", "trailInventory"])
          r.onMessage(e, () => {});
      };
      track(room);
      await until(() => !!p);
      room.send("equipPet", "rift-dragon");
      await wait(60);
      assert.equal(p.equippedPetId, undefined);
      room.send("openCrystal", {
        id: "far-away-test-0001",
        crystal: "sunrise",
      });
      await until(() => results.length === 1);
      assert.ok(results[0].error);
      let seq = 0;
      for (let n = 0; n < 120 && Math.hypot(p.x - 18, p.z - 16) > 4; n++) {
        const dx = 18 - p.x,
          dz = 16 - p.z,
          l = Math.max(1, Math.hypot(dx, dz));
        room.send("input", { seq: seq++, x: dx / l, z: dz / l, jump: false });
        await wait(45);
      }
      room.send("input", { seq: seq++, x: 0, z: 0, jump: false });
      await wait(250);
      assert.ok(Math.hypot(p.x - 18, p.z - 16) < 9);
      const before = p.gems;
      room.send("openCrystal", {
        id: "one-opening-test-001",
        crystal: "sunrise",
      });
      room.send("openCrystal", {
        id: "one-opening-test-001",
        crystal: "sunrise",
      });
      await until(() => results.length === 3 && !!p.equippedPetId);
      assert.equal(p.gems, before - 9);
      assert.equal(
        Object.values(p.pets).reduce((a: any, b: any) => a + b, 0),
        1,
      );
      assert.equal(results[2].repeated, true);
      const pet = p.equippedPetId;
      const observer = await client.joinById(room.roomId, {
        name: "Pet observer",
      });
      try {
        observer.onMessage(
          "snapshot",
          (v) => (remote = v.players[room!.sessionId]),
        );
        observer.onMessage("orbPatch", () => {});
        await until(() => remote?.equippedPetId === pet);
        assert.equal(remote.pets[pet], 1);
      } finally {
        await observer.leave();
      }
      room.send("equipPet", null);
      await until(() => !p.equippedPetId);
      room.send("equipPet", pet);
      await until(() => p.equippedPetId === pet);
      await room.leave();
      room = undefined;
      await wait(100);
      room = await client.create("plaza", { resumeToken: profile.token });
      p = undefined;
      track(room);
      await until(() => !!p);
      assert.equal(p.equippedPetId, pet);
      assert.equal(p.pets[pet], 1);
      assert.equal(p.gems, before - 9);
    } finally {
      if (room?.connection.isOpen) await room.leave();
      server.kill("SIGTERM");
      await new Promise<void>((r) => {
        if (server.exitCode !== null) r();
        else server.once("exit", () => r());
      });
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
