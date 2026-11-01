export const DT = 1 / 25;
export type Input = { seq: number; x: number; z: number; jump: boolean };
export type Player = { id: string; name: string; x: number; y: number; z: number; vy: number; angle: number; seq: number; steps: number; xp: number; gems: number; level: number; moving: boolean };
export const orbs = Array.from({ length: 72 }, (_, i) => { const a = i * Math.PI / 12; const r = 12 + Math.floor(i / 24) * 13; return { id: i, x: Math.sin(a) * r, z: Math.cos(a) * r, gold: i % 7 === 0 }; });
export const speed = (p: Player) => Math.min(32, 9 + (p.level - 1) * 0.7);
export function move(p: Player, input: Input, dt = DT) {
 const length = Math.hypot(input.x, input.z), n = Math.max(1, length);
 const dx = input.x / n * speed(p) * dt, dz = input.z / n * speed(p) * dt;
 p.x = Math.max(-57, Math.min(57, p.x + dx)); p.z = Math.max(-57, Math.min(57, p.z + dz));
 p.moving = length > 0.01; if (p.moving) p.angle = Math.atan2(input.x, input.z);
 if (input.jump && p.y === 0) p.vy = 11 + Math.min(4, p.level * 0.1);
 p.vy -= 26 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (!p.y) p.vy = 0;
 p.seq = input.seq;
 return Math.hypot(dx, dz);
}
export function reward(p: Player, amount: number) { p.xp += amount; while (p.xp >= p.level * 40) { p.xp -= p.level * 40; p.level++; } }
export function validInput(v: unknown): v is Input { const i = v as Input; return !!i && Number.isSafeInteger(i.seq) && i.seq >= 0 && Number.isFinite(i.x) && Number.isFinite(i.z) && Math.abs(i.x) <= 1 && Math.abs(i.z) <= 1 && typeof i.jump === 'boolean'; }
