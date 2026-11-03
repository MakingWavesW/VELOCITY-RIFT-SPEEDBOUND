import { WORLD_HALF, blocked, groundAt, ramps } from "./world.js";
export const DT = 1 / 25;
export type Input = { seq: number; x: number; z: number; jump: boolean };
export type Player = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  verticalVelocity: number;
  velocityX: number;
  velocityZ: number;
  equippedTrailId?: string;
  angle: number;
  seq: number;
  steps: number;
  xp: number;
  gems: number;
  level: number;
  moving: boolean;
  launchCooldown?: number;
  rebirths?: number;
  pets?: Record<string, number>;
  equippedPetId?: string;
  boostUntil?: number;
  speedMultiplier?: number;
};
export const speed = (p: Player) =>
  Math.min(32, 9 + (p.level - 1) * 0.7) * (p.speedMultiplier === 2 ? 2 : 1);
export const MOVEMENT = Object.freeze({
  acceleration: 15,
  braking: 36,
  turning: 21,
  airControl: 0.65,
  airBraking: 9,
  facing: 14,
  stopSpeed: 0.12,
  gravity: 26,
  maxSubstep: 0.2,
});
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const actualSpeed = (p: Player) => Math.hypot(p.velocityX, p.velocityZ);
export function move(p: Player, input: Input, dt = DT) {
  const oldX = p.x,
    oldZ = p.z;
  const grounded = p.y <= groundAt(p.x, p.z, p.y) + 0.01;
  const n = Math.max(1, Math.hypot(input.x, input.z));
  const tx = (input.x / n) * speed(p),
    tz = (input.z / n) * speed(p);
  const hasInput = Math.hypot(tx, tz) > 0.01;
  const turning = p.velocityX * tx + p.velocityZ * tz < 0;
  const rate = grounded
    ? hasInput
      ? turning
        ? MOVEMENT.turning
        : MOVEMENT.acceleration
      : MOVEMENT.braking
    : hasInput
      ? MOVEMENT.acceleration * MOVEMENT.airControl
      : MOVEMENT.airBraking;
  const blend = 1 - Math.exp(-rate * dt);
  p.velocityX += (tx - p.velocityX) * blend;
  p.velocityZ += (tz - p.velocityZ) * blend;
  if (!hasInput && actualSpeed(p) < MOVEMENT.stopSpeed)
    p.velocityX = p.velocityZ = 0;
  if (input.jump && grounded)
    p.verticalVelocity = 11 + Math.min(4, p.level * 0.1);
  p.launchCooldown = Math.max(0, (p.launchCooldown || 0) - dt);
  // Subdivide horizontal travel so even maximum speed cannot skip a thin wall or stair.
  const count = Math.max(
    1,
    Math.ceil((actualSpeed(p) * dt) / MOVEMENT.maxSubstep),
  );
  for (let step = 0; step < count; step++) {
    const nx = Math.max(
      -WORLD_HALF + 3,
      Math.min(WORLD_HALF - 3, p.x + (p.velocityX * dt) / count),
    );
    if (!blocked(nx, p.z, p.y)) p.x = nx;
    else p.velocityX = 0;
    const nz = Math.max(
      -WORLD_HALF + 3,
      Math.min(WORLD_HALF - 3, p.z + (p.velocityZ * dt) / count),
    );
    if (!blocked(p.x, nz, p.y)) p.z = nz;
    else p.velocityZ = 0;
    // Climb ordinary steps during the sweep, without raising airborne runners.
    if (grounded && p.verticalVelocity <= 0)
      p.y = Math.max(p.y, groundAt(p.x, p.z, p.y));
  }
  const traveled = Math.hypot(p.x - oldX, p.z - oldZ);
  p.moving = traveled > 0.001;
  // Report actual velocity after collision, including world boundaries.
  p.velocityX = (p.x - oldX) / dt;
  p.velocityZ = (p.z - oldZ) / dt;
  if (p.moving)
    p.angle +=
      angleDelta(p.angle, Math.atan2(p.velocityX, p.velocityZ)) *
      (1 - Math.exp(-MOVEMENT.facing * dt));
  if (
    grounded &&
    p.moving &&
    !p.launchCooldown &&
    ramps.some(
      (r) => Math.abs(p.x - r.x) < r.w / 2 && Math.abs(p.z - r.z) < r.d / 2,
    )
  ) {
    p.verticalVelocity = 20;
    p.launchCooldown = 2;
  }
  p.verticalVelocity -= MOVEMENT.gravity * dt;
  const floor = groundAt(p.x, p.z, p.y);
  p.y = Math.max(floor, p.y + p.verticalVelocity * dt);
  if (p.y === floor) p.verticalVelocity = 0;
  p.seq = input.seq;
  return traveled;
}

export function reward(p: Player, amount: number) {
  p.xp += amount;
  while (p.xp >= p.level * 40) {
    p.xp -= p.level * 40;
    p.level++;
  }
}
export function validInput(v: unknown): v is Input {
  const i = v as Input;
  return (
    !!i &&
    Number.isSafeInteger(i.seq) &&
    i.seq >= 0 &&
    Number.isFinite(i.x) &&
    Number.isFinite(i.z) &&
    Math.abs(i.x) <= 1 &&
    Math.abs(i.z) <= 1 &&
    typeof i.jump === "boolean"
  );
}
