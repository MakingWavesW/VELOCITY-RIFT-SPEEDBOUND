import type { OrbReward } from "./orbs.js";
export type TrailFamily =
  | "ribbon"
  | "dual"
  | "snow"
  | "sparks"
  | "storm"
  | "coin"
  | "soul"
  | "lightning"
  | "gem"
  | "speed"
  | "fire"
  | "hyperblast";
export type TrailRarity =
  | "Starter"
  | "Basic"
  | "Advanced"
  | "Advanced Variants"
  | "Rare"
  | "Epic"
  | "Unique"
  | "Special";
export type TrailDefinition = {
  id: string;
  name: string;
  rarity: TrailRarity;
  family: TrailFamily;
  colors: number[];
  steps: number;
  gems: number;
  level: 1;
  stepMultiplier: 1;
  gemMultiplier: 1;
  unlockLevel: number;
  rainbow: boolean;
};
export const DEFAULT_TRAIL = "default-white";
export const TRAIL_UPGRADES: Readonly<
  Record<string, { level: number; steps: number; gems: number; cost: number }[]>
> = Object.freeze({});
export const RARITY_COLORS: Record<TrailRarity, string> = {
  Starter: "#dbe7ef",
  Basic: "#68d59d",
  Advanced: "#62bafa",
  "Advanced Variants": "#5b9ded",
  Rare: "#b88aff",
  Epic: "#ffd275",
  Unique: "#ed9ee3",
  Special: "#ff926d",
};
const colors: Record<string, number> = {
  Red: 0xff636b,
  Blue: 0x48caff,
  Green: 0x69efad,
  Purple: 0xb58aff,
  Orange: 0xffac58,
  Pink: 0xff8ed7,
  Yellow: 0xffed70,
  Golden: 0xffcd55,
  White: 0xf2f7ff,
};
function look(
  name: string,
): Pick<TrailDefinition, "family" | "colors" | "rainbow"> {
  let family: TrailFamily = "ribbon";
  const key: [string, TrailFamily][] = [
    [" & ", "dual"],
    ["Snow", "snow"],
    ["Sparks", "sparks"],
    ["Storm", "storm"],
    ["Coin", "coin"],
    ["Soul", "soul"],
    ["Lightning", "lightning"],
    ["Gem", "gem"],
    ["Speed", "speed"],
    ["Steps", "speed"],
  ];
  for (const [word, value] of key) if (name.includes(word)) family = value;
  let palette = Object.entries(colors)
    .filter(([word]) => name.includes(word))
    .map(([, color]) => color);
  const pairs: Record<string, number[]> = {
    RB: [colors.Red, colors.Blue],
    OG: [colors.Orange, colors.Green],
    PP: [colors.Purple, colors.Pink],
    BG: [colors.Blue, colors.Green],
    YB: [colors.Yellow, colors.Blue],
  };
  palette = pairs[name.split(" ")[0]] || palette;
  if (name === "Dragonfire") {
    family = "fire";
    palette = [0xff7138, 0xffda75];
  }
  if (name === "Hyperblast") {
    family = "hyperblast";
    palette = [0x78f7ff, 0xd58aff];
  }
  const ordinal: Record<string, number[]> = {
    "Fifth Trail": [0xb6d9ff, 0xffffff],
    "Fourth Trail": [0x80eddd, 0x829bff],
    "Third Trail": [0xd295ff, 0x90eeff],
    "2nd Trail": [0xffd779, 0xff9bcb],
    "1st Trail": [0xffffff, 0xfecb61],
  };
  if (ordinal[name]) palette = ordinal[name];
  if (!palette.length) palette = [0xf2f7ff, 0x9ddaff];
  return { family, colors: palette, rainbow: name.includes("Rainbow") };
}
const catalog: TrailDefinition[] = [];
function add(
  rarity: TrailRarity,
  steps: number,
  gems: number,
  unlockLevel: number,
  names: string[],
) {
  for (const name of names)
    catalog.push({
      id:
        rarity.toLowerCase().replaceAll(" ", "-") +
        "-" +
        name.toLowerCase().replaceAll(" & ", "-and-").replaceAll(" ", "-"),
      name,
      rarity,
      steps,
      gems,
      unlockLevel,
      level: 1,
      stepMultiplier: 1,
      gemMultiplier: 1,
      ...look(name),
    });
}
add("Starter", 0, 0, 1, ["Default Trail"]);
catalog[0].id = DEFAULT_TRAIL;
catalog[0].colors = [0xf2f7ff];
add("Basic", 2, 1, 2, [
  "Red Trail",
  "Blue Trail",
  "Green Trail",
  "Purple Trail",
  "Orange Trail",
  "Pink Trail",
  "Yellow Trail",
  "Red & Blue",
  "Green & Orange",
  "Purple & Pink",
  "Yellow & Blue",
  "Blue & Green",
  "Orange Snow",
  "Blue Snow",
  "Green Snow",
  "White Snow",
  "Red Snow",
  "Pink Snow",
  "Fifth Trail",
]);
add("Advanced", 6, 3, 5, [
  "Red Sparks",
  "Blue Sparks",
  "Green Sparks",
  "Purple Sparks",
  "Orange Sparks",
  "Pink Sparks",
  "Yellow Sparks",
  "Blue Storm",
  "Green Storm",
  "Purple Storm",
  "Red Storm",
  "Orange Storm",
  "Pink Storm",
  "Blue Coin",
]);
add("Advanced Variants", 6, 5, 7, [
  "Purple Coin",
  "Red Coin",
  "Green Coin",
  "Yellow Soul",
  "Green Soul",
  "Fourth Trail",
]);
add("Rare", 10, 5, 10, [
  "Red Soul",
  "Blue Soul",
  "Green Soul",
  "Orange Soul",
  "Purple Soul",
  "Pink Soul",
  "Yellow Soul",
  "Blue Lightning",
  "Green Lightning",
  "Purple Lightning",
  "Orange Lightning",
  "Golden Lightning",
  "Red Lightning",
  "Pink Lightning",
  "Rainbow Trail",
  "Third Trail",
]);
add("Epic", 14, 8, 15, [
  "Rainbow Soul",
  "Rainbow Sparks",
  "Rainbow Storm",
  "Rainbow Lightning",
  "Purple Gem",
  "Green Gem",
  "Red Gem",
  "Blue Gem",
  "Orange Gem",
  "Pink Gem",
  "RB Speed",
  "OG Speed",
  "PP Speed",
  "BG Speed",
  "YB Speed",
  "2nd Trail",
]);
add("Unique", 20, 10, 25, ["Rainbow Speed", "Rainbow Steps", "1st Trail"]);
add("Special", 25, 15, 35, ["Dragonfire"]);
add("Special", 20, 25, 40, ["Hyperblast"]);
export const TRAILS: readonly TrailDefinition[] = Object.freeze(
  catalog.map((t) => Object.freeze(t)),
);
export const TRAIL_BY_ID = new Map(TRAILS.map((t) => [t.id, t]));
export type TrailInventory = {
  owned: string[];
  equipped: string;
  level: number;
  sessionOnly: boolean;
  message?: string;
};
export function eligibleTrails(level: number) {
  return TRAILS.filter((t) => t.unlockLevel <= level).map((t) => t.id);
}
export function resolveOwnedTrail(
  id: string | undefined,
  owned: ReadonlySet<string>,
): TrailDefinition {
  return id && owned.has(id) ? TRAIL_BY_ID.get(id) || TRAILS[0] : TRAILS[0];
}
// Only called by the authoritative reward path after an atomic pickup claim.
export function trailReward(
  base: OrbReward,
  trail: TrailDefinition,
): OrbReward {
  return {
    steps: base.steps > 0 ? base.steps + trail.steps : 0,
    gems: base.gems > 0 ? base.gems + trail.gems : 0,
    xp: base.xp,
  };
}
