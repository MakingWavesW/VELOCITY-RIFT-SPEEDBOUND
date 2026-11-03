import type { Player } from "./game.js";
export const PETS = [
  {
    id: "sun-puff",
    name: "Sun Puff",
    rarity: "Common",
    color: 0xffd56d,
    steps: 1.08,
    gems: 1.05,
    shape: "round",
  },
  {
    id: "mint-moth",
    name: "Mint Moth",
    rarity: "Common",
    color: 0x83f3ba,
    steps: 1.1,
    gems: 1.05,
    shape: "wing",
  },
  {
    id: "cloud-kit",
    name: "Cloud Kit",
    rarity: "Common",
    color: 0xd9f2ff,
    steps: 1.08,
    gems: 1.1,
    shape: "ears",
  },
  {
    id: "coral-cub",
    name: "Coral Cub",
    rarity: "Common",
    color: 0xff9d9f,
    steps: 1.12,
    gems: 1.05,
    shape: "ears",
  },
  {
    id: "azure-ray",
    name: "Azure Ray",
    rarity: "Rare",
    color: 0x45caff,
    steps: 1.2,
    gems: 1.15,
    shape: "wing",
  },
  {
    id: "violet-fox",
    name: "Violet Fox",
    rarity: "Rare",
    color: 0xb79aff,
    steps: 1.22,
    gems: 1.12,
    shape: "ears",
  },
  {
    id: "jade-sprite",
    name: "Jade Sprite",
    rarity: "Rare",
    color: 0x62e4bd,
    steps: 1.18,
    gems: 1.2,
    shape: "round",
  },
  {
    id: "ember-owl",
    name: "Ember Owl",
    rarity: "Epic",
    color: 0xff8f56,
    steps: 1.35,
    gems: 1.25,
    shape: "wing",
  },
  {
    id: "prism-lynx",
    name: "Prism Lynx",
    rarity: "Epic",
    color: 0xf5a9ff,
    steps: 1.3,
    gems: 1.3,
    shape: "ears",
  },
  {
    id: "lunar-wisp",
    name: "Lunar Wisp",
    rarity: "Epic",
    color: 0xb8d5ff,
    steps: 1.32,
    gems: 1.28,
    shape: "round",
  },
  {
    id: "solar-griffin",
    name: "Solar Griffin",
    rarity: "Legendary",
    color: 0xffcc43,
    steps: 1.5,
    gems: 1.4,
    shape: "wing",
  },
  {
    id: "rift-dragon",
    name: "Rift Dragon",
    rarity: "Legendary",
    color: 0x7dffff,
    steps: 1.45,
    gems: 1.5,
    shape: "ears",
  },
] as const;
export const PET_BY_ID = new Map<string, (typeof PETS)[number]>(
  PETS.map((p) => [p.id, p]),
);
export type Crystal = {
  id: string;
  name: string;
  cost: number;
  x: number;
  z: number;
  color: number;
  drops: { pet: string; chance: number }[];
};
export const CRYSTALS: Crystal[] = [
  {
    id: "sunrise",
    name: "Sunrise Crystal",
    cost: 9,
    x: 18,
    z: 16,
    color: 0x8de4ff,
    drops: [
      { pet: "sun-puff", chance: 35 },
      { pet: "mint-moth", chance: 25 },
      { pet: "cloud-kit", chance: 20 },
      { pet: "azure-ray", chance: 15 },
      { pet: "ember-owl", chance: 4 },
      { pet: "solar-griffin", chance: 1 },
    ],
  },
  {
    id: "grove",
    name: "Grove Crystal",
    cost: 60,
    x: -178,
    z: 178,
    color: 0xc49cff,
    drops: [
      { pet: "coral-cub", chance: 30 },
      { pet: "violet-fox", chance: 25 },
      { pet: "jade-sprite", chance: 25 },
      { pet: "prism-lynx", chance: 15 },
      { pet: "rift-dragon", chance: 5 },
    ],
  },
  {
    id: "sky",
    name: "Skyline Crystal",
    cost: 180,
    x: 78,
    z: 62,
    color: 0xffb579,
    drops: [
      { pet: "azure-ray", chance: 25 },
      { pet: "jade-sprite", chance: 25 },
      { pet: "lunar-wisp", chance: 25 },
      { pet: "ember-owl", chance: 15 },
      { pet: "solar-griffin", chance: 6 },
      { pet: "rift-dragon", chance: 4 },
    ],
  },
];
export const CRYSTAL_BY_ID = new Map(CRYSTALS.map((c) => [c.id, c]));
export function choosePet(crystal: Crystal, roll: number) {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1)
    throw Error("Invalid random draw");
  let choice = roll * 100;
  for (const d of crystal.drops) {
    choice -= d.chance;
    if (choice < 0) return d.pet;
  }
  throw Error("Invalid probability table");
}
export function equippedPet(p: Pick<Player, "equippedPetId" | "pets">) {
  return p.equippedPetId && (p.pets?.[p.equippedPetId] || 0) > 0
    ? PET_BY_ID.get(p.equippedPetId)
    : undefined;
}
export function canOpenCrystal(p: Player, c: Crystal) {
  return p.gems >= c.cost && Math.hypot(p.x - c.x, p.z - c.z) < 9 && p.y < 3;
}
export type PetInventory = {
  owned: Record<string, number>;
  equipped?: string;
  gems: number;
};
