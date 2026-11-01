import { WORLD_HALF, blocked, groundAt, ramps } from "./world.js";
export const DT = 1 / 25;
export type Input = { seq: number; x: number; z: number; jump: boolean };
export type Player = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  vy: number;
  angle: number;
  seq: number;
  steps: number;
  xp: number;
  gems: number;
  level: number;
  moving: boolean;
  launchCooldown?: number;
};
export const orbs = Array.from({ length: 72 }, (_, i) => {
  const a = (i * Math.PI) / 12;
  const r = 12 + Math.floor(i / 24) * 13;
  return { id: i, x: Math.sin(a) * r, z: Math.cos(a) * r, gold: i % 7 === 0 };
});
// Preserve the original 72 collectibles and their rewards; add routes to each district.
for (const [x, z, dx, dz] of [
  [0, -60, 0, -1],
  [-85, -100, -1, 0],
  [190, -65, 0, -1],
  [-90, 170, -1, 0],
  [90, 170, 1, 0],
  [0, 100, 0, 1],
]) {
  for (let i = 0; i < 24; i++) {
    const ox = x + dx * i * 10,
      oz = z + dz * i * 10;
    if (!blocked(ox, oz, 0))
      orbs.push({ id: orbs.length, x: ox, z: oz, gold: i % 7 === 0 });
  }
}
export const speed = (p: Player) => Math.min(32, 9 + (p.level - 1) * 0.7);
export function move(p: Player, input: Input, dt = DT) {
  const oldX = p.x,
    oldZ = p.z;
  const length = Math.hypot(input.x, input.z),
    n = Math.max(1, length);
  const dx = (input.x / n) * speed(p) * dt,
    dz = (input.z / n) * speed(p) * dt;
  const ground = groundAt(p.x, p.z, p.y),
    grounded = p.y <= ground + 0.01;
  const nx = Math.max(-WORLD_HALF + 3, Math.min(WORLD_HALF - 3, p.x + dx));
  if (!blocked(nx, p.z, p.y)) p.x = nx;
  const nz = Math.max(-WORLD_HALF + 3, Math.min(WORLD_HALF - 3, p.z + dz));
  if (!blocked(p.x, nz, p.y)) p.z = nz;
  p.moving = Math.hypot(p.x - oldX, p.z - oldZ) > 0.001;
  if (p.moving) p.angle = Math.atan2(input.x, input.z);
  if (input.jump && grounded) p.vy = 11 + Math.min(4, p.level * 0.1);
  p.launchCooldown = Math.max(0, (p.launchCooldown || 0) - dt);
  if (
    grounded &&
    p.moving &&
    !p.launchCooldown &&
    ramps.some(
      (r) => Math.abs(p.x - r.x) < r.w / 2 && Math.abs(p.z - r.z) < r.d / 2,
    )
  ) {
    p.vy = 20;
    p.launchCooldown = 2;
  }
  p.vy -= 26 * dt;
  const floor = groundAt(p.x, p.z, p.y);
  p.y = Math.max(floor, p.y + p.vy * dt);
  if (p.y === floor) p.vy = 0;
  p.seq = input.seq;
  return Math.hypot(p.x - oldX, p.z - oldZ);
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
