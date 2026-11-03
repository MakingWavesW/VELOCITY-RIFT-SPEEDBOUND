import { enterMenu } from "./menu-helper.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { WebSocketServer, WebSocket } from "ws";
const out = "artifacts/trails";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
let latency = 0,
  counter = 0;
const timers = new Set();
const errors = [];
const proxy = new WebSocketServer({ port: 2568, host: "127.0.0.1" });
proxy.on("connection", (client, request) => {
  const upstream = new WebSocket("ws://localhost:2567" + request.url);
  let incomingDeadline = 0,
    outgoingDeadline = 0;
  const queued = [];
  const send = (target, message, incoming) => {
    const delay = latency ? latency + [0, 20, 40, 10][counter++ % 4] : 0;
    const when = Math.max(
      Date.now() + delay,
      (incoming ? incomingDeadline : outgoingDeadline) + 1,
    );
    if (incoming) incomingDeadline = when;
    else outgoingDeadline = when;
    const timer = setTimeout(
      () => {
        timers.delete(timer);
        if (target.readyState === WebSocket.OPEN) target.send(message);
      },
      Math.max(0, when - Date.now()),
    );
    timers.add(timer);
  };
  upstream.on("open", () => {
    for (const msg of queued) send(upstream, msg, false);
    queued.length = 0;
  });
  client.on("message", (msg) => {
    if (upstream.readyState === WebSocket.CONNECTING) queued.push(msg);
    else send(upstream, msg, false);
  });
  upstream.on("message", (msg) => send(client, msg, true));
  client.on("close", () => upstream.close());
  upstream.on("close", () => client.close());
});
async function setup(name, delayed) {
  const ctx = await browser.newContext({
    viewport: { width: 800, height: 600 },
  });
  await ctx.addInitScript(() =>
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    ),
  );
  if (delayed)
    await ctx.addInitScript(() => {
      window.WebSocket = new Proxy(window.WebSocket, {
        construct(target, args) {
          args[0] = String(args[0]).replace("localhost:2567", "localhost:2568");
          return Reflect.construct(target, args);
        },
      });
    });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") console.log("browser error", m.text());
  });
  await p.goto("http://localhost:5173"); await enterMenu(p);
  await p.locator("#name").fill(name);
  await p.locator("#join").click();
  try {
    await p.waitForFunction(
      () => window.riftDiagnostics?.predicted,
      undefined,
      { timeout: 15000 },
    );
  } catch (e) {
    console.log(
      await p.locator("#error").innerText(),
      await p.evaluate(() => window.riftDiagnostics),
    );
    throw e;
  }
  return { ctx, p };
}
const samples = { stable: [], delayed: [] };
async function sample(p, group) {
  const d = await p.evaluate(() => window.riftDiagnostics);
  samples[group].push({
    frameMs: d.frameMs,
    rtt: d.rtt,
    error: d.predictionError,
    correction: d.correctionDistance,
    pending: d.pendingInputs,
    hard: d.hardCorrections,
    snapshotAge: d.snapshotAge,
  });
  return d;
}
try {
  const a = await setup("Network runner", true),
    b = await setup("Network observer", false);
  await a.p.waitForFunction(
    () => Object.keys(window.riftDiagnostics.players).length === 2,
  );
  await a.p.bringToFront();
  await a.p.locator("body > canvas").click({ position: { x: 400, y: 300 } });
  const held = new Set();
  async function keys(next) {
    for (const k of held)
      if (!next.includes(k)) {
        await a.p.keyboard.up(k);
        held.delete(k);
      }
    for (const k of next)
      if (!held.has(k)) {
        await a.p.keyboard.down(k);
        held.add(k);
      }
  }
  // Steer using the same keyboard controls a person uses, towards server-generated starter orbs.
  for (let n = 0; n < 250; n++) {
    const d = await sample(a.p, "stable"),
      p = d.players[d.localId];
    if (p.level >= 2) break;
    const orb = d.orbs
      .filter((o) => o.route === "starter")
      .sort(
        (u, v) =>
          Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z),
      )[0];
    const next = [];
    if (Math.abs(orb.x - p.x) > 0.5) next.push(orb.x > p.x ? "d" : "a");
    if (Math.abs(orb.z - p.z) > 0.5) next.push(orb.z > p.z ? "s" : "w");
    await keys(next);
    await a.p.waitForTimeout(80);
  }
  await keys([]);
  await a.p.waitForFunction(
    () =>
      window.riftDiagnostics.players[window.riftDiagnostics.localId].level >= 2,
    undefined,
    { timeout: 5000 },
  );
  await a.p.locator('[data-panel="trails"]').click();
  await a.p.locator('[data-trail-id="basic-red-trail"]').click();
  await a.p.locator("#equipTrail").click();
  await a.p.waitForFunction(
    () =>
      window.riftDiagnostics.players[window.riftDiagnostics.localId]
        .equippedTrailId === "basic-red-trail",
  );
  const id = await a.p.evaluate(() => window.riftDiagnostics.localId);
  await b.p.waitForFunction(
    (id) =>
      window.riftDiagnostics.avatars.find((a) => a.id === id)?.trail ===
      "basic-red-trail",
    id,
    { timeout: 15000 },
  );
  await a.p.locator("#closePanel").click();
  console.log("Two browsers earned, equipped and replicated Red Trail");
  latency = 100;
  await a.p.bringToFront();
  await a.p.locator("body > canvas").click({ position: { x: 400, y: 300 } });
  await keys(["w"]);
  for (let n = 0; n < 35; n++) {
    await sample(a.p, "delayed");
    if (n === 12) {
      await a.p.keyboard.press("Space");
      await b.p.waitForFunction(
        (id) =>
          window.riftDiagnostics.avatars.find((a) => a.id === id)?.y > 0.2,
        id,
        { timeout: 8000 },
      );
      const remote = await b.p.evaluate(
        (id) => window.riftDiagnostics.avatars.find((a) => a.id === id),
        id,
      );
      assert.equal(remote.trail, "basic-red-trail");
      assert.ok(
        remote.trailStats.segments > 0,
        "remote trail follows moving avatar",
      );
    }
    if (n === 22) await keys(["d"]);
    await a.p.waitForTimeout(100);
  }
  await keys([]);
  await a.p.waitForFunction(
    () =>
      !window.riftDiagnostics.players[window.riftDiagnostics.localId].moving,
    undefined,
    { timeout: 15000 },
  );
  const end = await sample(a.p, "delayed");
  assert.ok(
    samples.delayed.some((s) => s.rtt > 190),
    "delay affected actual WebSocket RTT",
  );
  assert.ok(samples.delayed.every((s) => s.pending <= 12));
  assert.ok(
    Math.max(...samples.delayed.map((s) => s.error)) < 4,
    "bounded prediction correction",
  );
  assert.equal(end.hardCorrections, 0);
  const authoritative = end.players[id],
    visible = end.avatars.find((a) => a.id === id);
  await a.p.waitForTimeout(1000);
  const settled = await a.p.evaluate(() => window.riftDiagnostics);
  assert.ok(
    Math.hypot(
      settled.predicted.x - authoritative.x,
      settled.predicted.z - authoritative.z,
    ) < 0.1,
  );
  await a.p.screenshot({ path: out + "/multiplayer-latency.png" });
  await a.ctx.close();
  await b.p.waitForFunction(
    (id) => !window.riftDiagnostics.avatars.some((a) => a.id === id),
    id,
    { timeout: 15000 },
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    out + "/multiplayer-results.json",
    JSON.stringify({ samples, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: true,
      stableSamples: samples.stable.length,
      delayedSamples: samples.delayed.length,
      maxError: Math.max(...samples.delayed.map((s) => s.error)),
      maxRTT: Math.max(...samples.delayed.map((s) => s.rtt)),
      hardCorrections: end.hardCorrections,
      disconnectCleanup: true,
    }),
  );
} finally {
  for (const timer of timers) clearTimeout(timer);
  await browser.close();
  for (const client of proxy.clients) client.terminate();
  proxy.close();
}
