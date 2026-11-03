import type { Player } from "./game.js";
export const rebirthRequirement = (count: number) => 50 + count * 25;
export const rebirthMultiplier = (count: number) => 1 + count * 0.25;
export function rebirth(p: Player) {
  const count = p.rebirths || 0;
  if (p.level < rebirthRequirement(count)) return false;
  p.rebirths = count + 1;
  p.level = 1;
  p.xp = 0;
  p.steps = 0;
  p.velocityX = p.velocityZ = 0;
  return true;
}
// Only a trusted server verification adapter may call this function. Never a room message.
export function verifiedReward(
  p: Player,
  kind: "level" | "speed" | "xp",
  now: number,
) {
  if (kind === "level") {
    p.level++;
    return true;
  }
  if (kind === "xp") {
    if ((p.xpBoostUntil || 0) > now) return false;
    p.xpBoostUntil = now + 180000;
    return true;
  }
  if ((p.boostUntil || 0) > now) return false;
  p.boostUntil = now + 120_000;
  p.speedMultiplier = 2;
  return true;
}
export const xpMultiplier = (
  p: Pick<Player, "xpBoostUntil">,
  now = Date.now(),
) => ((p.xpBoostUntil || 0) > now ? 2 : 1);
export function expireBoost(p: Player, now: number) {
  p.speedMultiplier = (p.boostUntil || 0) > now ? 2 : 1;
}
