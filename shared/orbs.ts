/** Orb economics and wire types. Only the server selects spawns and grants rewards. */
export type OrbTier = "blue" | "purple" | "red" | "gem";
export const ORB_TYPES = {
  blue: {
    label: "BLUE ORB",
    color: 0x10dcff,
    core: 0x89f6ff,
    weight: 65,
    steps: 2,
    xp: 2,
    gems: 0,
    respawn: [1000, 3000],
    radius: 0.65,
  },
  purple: {
    label: "PURPLE ORB",
    color: 0xa660ff,
    core: 0xe5b2ff,
    weight: 25,
    steps: 5,
    xp: 5,
    gems: 0,
    respawn: [1000, 3000],
    radius: 0.8,
  },
  red: {
    label: "RED ORB",
    color: 0xff554a,
    core: 0xffb29b,
    weight: 10,
    steps: 10,
    xp: 10,
    gems: 0,
    respawn: [1000, 3000],
    radius: 1,
  },
  gem: {
    label: "GEM ORB",
    color: 0xffcf42,
    core: 0xffed99,
    weight: 4,
    steps: 10,
    xp: 15,
    gems: 3,
    respawn: [1000, 3000],
    radius: 0.7,
  },
} as const;
export const ORB_BALANCE = {
  levelGrowth: 4 / 9,
  maxLevelScale: 20,
  minSpacing: 4.5,
  spawnSafeRadius: 8,
  pickupRadius: 1.7,
  streakWindowMs: 4500,
};
export type RewardMultipliers = {
  rebirth?: number;
  world?: number;
  upgrade?: number;
  pet?: number;
  trail?: number;
  event?: number;
};
export type OrbReward = { steps: number; xp: number; gems: number };
/** Extension inputs are SERVER-OWNED. No client message accepts multipliers. */
export function orbReward(
  tier: OrbTier,
  level: number,
  multipliers: RewardMultipliers = {},
): OrbReward {
  const def = ORB_TYPES[tier];
  const levelScale =
    tier === "gem"
      ? 1
      : Math.min(
          ORB_BALANCE.maxLevelScale,
          1 + Math.max(0, Math.floor(level) - 1) * ORB_BALANCE.levelGrowth,
        );
  let extra = 1;
  for (const v of Object.values(multipliers)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0)
      throw new Error("Invalid server reward multiplier");
    extra *= v;
  }
  return {
    steps: Math.round(def.steps * levelScale * extra),
    xp: Math.round(def.xp * levelScale * extra),
    gems: def.gems,
  };
}
export type Orb = {
  id: number;
  generation: number;
  tier: OrbTier;
  x: number;
  y: number;
  z: number;
  route: string;
};
export type OrbState = { revision: number; orbs: Orb[] };
export type OrbPatch = { revision: number; removed: number[]; spawned: Orb[] };
export type PickupEvent = OrbReward & {
  orb: Orb;
  player: string;
  level: number;
  streak: number;
};
export const MAX_ORBS = 100;
