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
  "real server rebirth persists exactly once and restores retained ownership",
  { timeout: 20000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "rift-rebirth-")),
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
      let p: any;
      const replies: any[] = [];
      let owned: string[] = [];
      const track = (r: Room) => {
        r.onMessage("snapshot", (s) => (p = s.players[r.sessionId]));
        r.onMessage("progression", (v) => replies.push(v));
        r.onMessage("trailInventory", (v) => (owned = v.owned));
        r.onMessage("orbPatch", () => {});
      };
      track(room);
      await until(() => p?.level === 50);
      room.send("rebirth", { expected: 0 });
      room.send("rebirth", { expected: 0 });
      await until(() => replies.length === 2 && p?.rebirths === 1);
      assert.deepEqual(
        replies.map((r) => r.ok),
        [true, false],
      );
      assert.equal(p.level, 1);
      assert.equal(p.xp, 0);
      assert.equal(p.steps, 0);
      assert.equal(p.gems, 73);
      assert.ok(owned.includes("basic-red"));
      await room.leave();
      room = undefined;
      await wait(100);
      room = await client.create("plaza", { resumeToken: profile.token });
      p = undefined;
      track(room);
      await until(() => p?.rebirths === 1);
      assert.equal(p.gems, 73);
      assert.equal(p.equippedTrailId, "basic-red");
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
