import { test } from "node:test";
import assert from "node:assert/strict";
import { move, actualSpeed, DT, angleDelta, type Player } from "../shared/game";
import { SnapshotBuffer, NETWORK } from "../src/network/snapshots";
import { solids } from "../shared/world";
const player = (level = 1): Player => ({
  id: "test",
  name: "Test",
  x: 0,
  y: 0,
  z: 0,
  velocityX: 0,
  velocityZ: 0,
  verticalVelocity: 0,
  angle: 0,
  seq: -1,
  steps: 0,
  xp: 0,
  gems: 0,
  level,
  moving: false,
});
const command = (seq: number, x = 1, z = 0, jump = false) => ({
  seq,
  x,
  z,
  jump,
});
test("responsive acceleration and stop targets hold at beginner and maximum speed", () => {
  for (const level of [1, 100]) {
    const p = player(level);
    const max = level === 1 ? 9 : 32;
    move(p, command(0));
    assert.ok(actualSpeed(p) > 0 && actualSpeed(p) < max * 0.6);
    let ticks = 1;
    while (actualSpeed(p) < max * 0.9) {
      move(p, command(ticks++));
    }
    assert.ok(ticks * DT >= 0.12 && ticks * DT <= 0.22);
    for (let n = 0; n < 25; n++) move(p, command(ticks++));
    let braking = 0;
    while (p.moving && braking < 20)
      (move(p, command(ticks++, 0, 0)), braking++);
    assert.ok(
      braking * DT >= 0.1 && braking * DT <= 0.18,
      `level ${level} stopped in ${braking * DT}`,
    );
  }
});
test("diagonal speed, direction reversal, stable stationary facing, and shared replay", () => {
  const a = player(),
    b = player();
  for (let n = 0; n < 150; n++) {
    const input =
      n < 50
        ? command(n, 1, 1)
        : n < 100
          ? command(n, -1, -1)
          : command(n, 0, 0);
    const prev = a.angle;
    move(a, input);
    move(b, input);
    assert.deepEqual(a, b);
    assert.ok(actualSpeed(a) <= 9.000001);
    assert.ok(Math.abs(angleDelta(prev, a.angle)) < Math.PI / 2);
  }
  assert.equal(a.moving, false);
  const angle = a.angle;
  move(a, command(150, 0, 0));
  assert.equal(a.angle, angle);
});
test("high speed cannot tunnel through a wall or farm distance while pushing it", () => {
  const p = player(100),
    wall = solids[0];
  p.x = wall.x - wall.w / 2 - 2;
  p.z = wall.z;
  p.velocityX = 32;
  for (let n = 0; n < 50; n++) move(p, command(n));
  assert.ok(p.x < wall.x - wall.w / 2 - 0.5);
  assert.equal(move(p, command(51)), 0);
  assert.equal(p.moving, false);
  assert.equal(actualSpeed(p), 0);
});
test("timestamp interpolation wraps facing, rejects stale snapshots, bounds extrapolation and resets teleports", () => {
  const buffer = new SnapshotBuffer(),
    p = player();
  p.velocityX = 9;
  p.moving = true;
  buffer.push(1000, { ...p, angle: Math.PI - 0.1 });
  buffer.push(1100, { ...p, x: 0.9, angle: -Math.PI + 0.1 });
  assert.ok(Math.abs(buffer.sample(1050)!.x - 0.45) < 1e-9);
  assert.ok(Math.abs(Math.abs(buffer.sample(1050)!.angle) - Math.PI) < 1e-9);
  assert.equal(buffer.push(1050, { ...p, x: 999 }), false);
  assert.deepEqual(
    buffer.sample(1100 + NETWORK.extrapolationMs),
    buffer.sample(9000),
  );
  assert.equal(buffer.push(1200, { ...p, x: 100 }), true);
  assert.equal(buffer.samples.length, 1);
  assert.equal(buffer.sample(1190)!.x, 100);
});
