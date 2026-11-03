import { chromium } from "@playwright/test";
import { enterMenu } from "./menu-helper.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const ctx = await browser.newContext({
    viewport: { width: 960, height: 640 },
  });
  await ctx.addInitScript(() =>
    localStorage.setItem(
      "rift-visual-settings",
      JSON.stringify({ quality: "low" }),
    ),
  );
  const p = await ctx.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://localhost:5173");
  await enterMenu(p);
  await p.locator("#name").fill("Beginner run");
  await p.locator("#join").click();
  await p.waitForFunction(() => window.riftDiagnostics?.predicted);
  const start = Date.now(),
    samples = [],
    held = new Set();
  let firstMinute, afforded;
  async function steer(x, z) {
    const wanted = [];
    if (Math.abs(x) > 0.6) wanted.push(x > 0 ? "d" : "a");
    if (Math.abs(z) > 0.6) wanted.push(z > 0 ? "s" : "w");
    for (const k of held)
      if (!wanted.includes(k)) {
        await p.keyboard.up(k);
        held.delete(k);
      }
    for (const k of wanted)
      if (!held.has(k)) {
        await p.keyboard.down(k);
        held.add(k);
      }
  }
  while (Date.now() - start < 180000) {
    const d = await p.evaluate(() => window.riftDiagnostics),
      me = d.players[d.localId],
      seconds = (Date.now() - start) / 1000;
    samples.push({
      seconds,
      level: me.level,
      gems: me.gems,
      xp: me.xp,
      steps: me.steps,
      frameMs: d.frameMs,
      drawCalls: d.drawCalls,
    });
    if (seconds >= 60 && !firstMinute) firstMinute = samples.at(-1);
    if (me.gems >= 9 && !afforded) afforded = seconds;
    if (firstMinute && afforded) break;
    const orbs = d.orbs.filter((o) => o.y < 3 && Math.hypot(o.x, o.z) < 145);
    orbs.sort(
      (a, b) =>
        Math.hypot(a.x - me.x, a.z - me.z) / (a.tier === "gem" ? 1.6 : 1) -
        Math.hypot(b.x - me.x, b.z - me.z) / (b.tier === "gem" ? 1.6 : 1),
    );
    const target = orbs[0];
    if (target) await steer(target.x - me.x, target.z - me.z);
    await p.waitForTimeout(100);
  }
  for (let n = 0; n < 300; n++) {
    const d = await p.evaluate(() => window.riftDiagnostics),
      me = d.players[d.localId];
    if (Math.hypot(me.x - 18, me.z - 16) < 5) break;
    await steer(18 - me.x, 16 - me.z);
    await p.waitForTimeout(100);
  }
  await steer(0, 0);
  await p.waitForTimeout(300);
  assert.ok(afforded, "normal pickups should reach 9 Gems within 3 minutes");
  await p.locator("#crystalInteract").click();
  await p.locator("#openCrystal").click();
  await p.waitForFunction(() => window.riftDiagnostics.predicted.equippedPetId);
  await p.waitForTimeout(400);
  await p.screenshot({
    path: "artifacts/v5/natural-first-pet.png",
    animations: "disabled",
  });
  await fs.writeFile(
    "artifacts/v5/beginner.json",
    JSON.stringify(
      {
        firstMinute,
        affordedSeconds: afforded,
        samples,
        errors,
        note: "Fresh guest; keyboard steering toward visible ground orbs. No claims, seeded Gems or direct position edits. Software rendering; not human enjoyment evidence.",
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  console.log({ firstMinute, affordedSeconds: afforded, pet: true, errors });
} finally {
  await browser.close();
}
