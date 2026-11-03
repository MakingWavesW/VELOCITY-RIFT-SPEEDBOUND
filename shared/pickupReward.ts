import type { Player } from "./game.js";
import { orbReward, type OrbTier } from "./orbs.js";
import { equippedPet } from "./pets.js";
import { rebirthMultiplier, xpMultiplier } from "./progression.js";
import { trailReward, type TrailDefinition } from "./trails.js";

/** Server passes an ownership-checked trail. The HUD uses the same calculation for display. */
export function pickupReward(
  p: Pick<
    Player,
    "level" | "rebirths" | "pets" | "equippedPetId" | "xpBoostUntil"
  >,
  tier: OrbTier,
  trail: TrailDefinition,
  now = Date.now(),
) {
  const gains = trailReward(orbReward(tier, p.level), trail);
  const pet = equippedPet(p),
    bonus = rebirthMultiplier(p.rebirths || 0);
  return {
    steps: Math.round(gains.steps * bonus * (pet?.steps || 1)),
    gems: Math.round(gains.gems * (pet?.gems || 1)),
    xp: gains.xp * bonus * xpMultiplier(p, now),
  };
}
