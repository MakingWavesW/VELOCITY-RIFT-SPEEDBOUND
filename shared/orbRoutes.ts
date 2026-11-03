import { CRYSTALS } from "./pets.js";
import { WORLD_HALF, blocked, groundAt } from "./world.js";
import { ORB_BALANCE, ORB_TYPES, type OrbTier } from "./orbs.js";
export type Point = { x: number; y: number; z: number };
export type OrbRoute = {
  id: string;
  name: string;
  hint: string;
  count: number;
  weights: Record<OrbTier, number>;
  points: Point[];
  color: number;
  zones?: { x: number; z: number; w: number; d: number; y: number }[];
  sign: Point;
};
const line = (
  x: number,
  z: number,
  dx: number,
  dz: number,
  n: number,
  spacing: number,
  y = 0,
): Point[] =>
  Array.from({ length: n }, (_, i) => ({
    x: x + dx * i * spacing,
    y,
    z: z + dz * i * spacing,
  }));
const loop = (
  x: number,
  z: number,
  rx: number,
  rz: number,
  n: number,
  y = 0,
): Point[] =>
  Array.from({ length: n }, (_, i) => ({
    x: x + Math.sin((i / n) * Math.PI * 2) * rx,
    y,
    z: z + Math.cos((i / n) * Math.PI * 2) * rz,
  }));
const base = {
  blue: ORB_TYPES.blue.weight,
  purple: ORB_TYPES.purple.weight,
  red: ORB_TYPES.red.weight,
  gem: ORB_TYPES.gem.weight,
};
export const orbRoutes: OrbRoute[] = [
  {
    id: "starter",
    name: "First Steps",
    hint: "Mostly Blue · follow the plaza loops",
    count: 36,
    weights: { blue: 91, purple: 8, red: 1, gem: 3 },
    points: [
      ...loop(0, 0, 14, 14, 18),
      ...loop(0, 0, 27, 25, 30),
      ...line(0, -34, 0, -1, 6, 5),
    ],
    color: 0x10dcff,
    sign: { x: 10, y: 0, z: -31 },
  },
  {
    id: "north",
    name: "Blueway Run",
    hint: "Blue stream · launch toward the Solar Ring",
    count: 34,
    weights: { blue: 85, purple: 12, red: 3, gem: 4 },
    points: [...line(-3, -80, 0, -1, 48, 6), ...line(3, -80, 0, -1, 48, 6)],
    color: 0x10dcff,
    sign: { x: -13, y: 0, z: -82 },
  },
  {
    id: "south",
    name: "Coastal Current",
    hint: "Mixed orbs · follow the ocean road",
    count: 34,
    weights: base,
    points: [...line(-3, 42, 0, 1, 55, 6), ...line(3, 42, 0, 1, 55, 6)],
    color: 0x8ef2ee,
    sign: { x: 13, y: 0, z: 48 },
  },
  {
    id: "downtown",
    name: "Violet Avenue",
    hint: "Purple finds · between the city blocks",
    count: 38,
    weights: { blue: 57, purple: 35, red: 8, gem: 4 },
    points: [
      ...line(-98, -98, -1, 0, 42, 6),
      ...line(-98, -98, 0, -1, 38, 6),
      ...line(-150, -95, 0, -1, 38, 6),
    ],
    color: 0xb880ff,
    sign: { x: -91, y: 0, z: -92 },
  },
  {
    id: "garden",
    name: "Amethyst Grove",
    hint: "Purple-rich · explore the crystal paths",
    count: 42,
    weights: { blue: 43, purple: 48, red: 9, gem: 4 },
    points: [
      ...loop(-210, 170, 42, 44, 52),
      ...line(-100, 170, -1, 0, 40, 6),
      ...line(-210, 145, 0, -1, 6, 6),
    ],
    color: 0xb880ff,
    sign: { x: -170, y: 0, z: 150 },
  },
  {
    id: "speedway",
    name: "Slipstream Circuit",
    hint: "Blue stream · chase the Azure Ring",
    count: 42,
    weights: { blue: 83, purple: 12, red: 5, gem: 4 },
    points: [
      ...line(186, -80, 0, -1, 48, 6),
      ...line(194, -80, 0, -1, 48, 6),
      ...line(20, 0, 1, 0, 35, 6),
    ],
    color: 0x10dcff,
    sign: { x: 178, y: 0, z: -85 },
  },
  {
    id: "skyline",
    name: "Scarlet Skyline",
    hint: "Red-rich · climb the marked stairs",
    count: 16,
    weights: { blue: 25, purple: 35, red: 40, gem: 4 },
    points: [
      ...line(86, 76, 0, 1, 7, 5, 0),
      ...line(84, 114, 1, 0, 3, 6, 12),
      ...line(84, 126, 1, 0, 3, 6, 12),
      ...line(90, 138, 0, 1, 3, 6, 12),
      ...line(117, 99, 1, 0, 4, 6, 26),
      ...line(117, 105, 1, 0, 4, 6, 26),
      ...line(117, 111, 1, 0, 4, 6, 26),
    ],
    color: 0xff6653,
    sign: { x: 81, y: 0, z: 66 },
  },
  {
    id: "hidden",
    name: "Ember Hideaway",
    hint: "Rare Red pocket · beyond the gardens",
    count: 10,
    weights: { blue: 25, purple: 35, red: 40, gem: 4 },
    points: loop(-335, 270, 22, 22, 24),
    color: 0xff6653,
    sign: { x: -310, y: 0, z: 252 },
  },
  {
    id: "coast",
    name: "Sunset Stroll",
    hint: "Mixed orbs & Gems · beach promenade",
    count: 20,
    weights: base,
    points: line(-85, 387, 1, 0, 29, 6),
    color: 0xffcf42,
    sign: { x: -88, y: 0, z: 380 },
  },
];
// 96 shared slots, continuously sampled over valid ground, gardens and accessible roofs.
const zones: Record<
  string,
  { x: number; z: number; w: number; d: number; y: number }[]
> = {
  starter: [
    { x: 0, z: -28, w: 22, d: 50, y: 0 },
    { x: 0, z: 25, w: 40, d: 25, y: 0 },
  ],
  north: [{ x: 0, z: -110, w: 16, d: 110, y: 0 }],
  south: [{ x: 0, z: 100, w: 20, d: 130, y: 0 }],
  downtown: [{ x: -220, z: -200, w: 280, d: 250, y: 0 }],
  garden: [{ x: -230, z: 190, w: 230, d: 240, y: 0 }],
  speedway: [{ x: 230, z: -190, w: 270, d: 280, y: 0 }],
  skyline: [
    { x: 125, z: 105, w: 20, d: 20, y: 26 },
    { x: 152, z: 105, w: 27, d: 3, y: 26 },
    { x: 165, z: 122, w: 3, d: 26, y: 26 },
    { x: 90, z: 120, w: 17, d: 18, y: 12 },
  ],
  hidden: [{ x: -330, z: 270, w: 80, d: 100, y: 0 }],
  coast: [{ x: 0, z: 395, w: 300, d: 55, y: 0 }],
};
const populations = [28, 16, 12, 8, 8, 8, 8, 4, 4];
orbRoutes.forEach((r, i) => {
  r.count = populations[i];
  r.zones = zones[r.id];
  r.weights.gem = ["starter", "north", "south"].includes(r.id) ? 8 : 16;
  if (r.id === "starter") r.weights = { blue: 62, purple: 18, red: 6, gem: 8 };
});
// Decorative ponds are exclusion volumes too, not just the ocean boundary.
const ponds = [
  { x: -210, z: 120, rx: 16, rz: 12 },
  { x: -260, z: 230, rx: 16, rz: 12 },
];
export function validOrbPoint(p: Point) {
  if (CRYSTALS.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < 4 && p.y < 4))
    return false;
  if (
    ![p.x, p.y, p.z].every(Number.isFinite) ||
    Math.abs(p.x) > WORLD_HALF - 8 ||
    Math.abs(p.z) > WORLD_HALF - 8 ||
    Math.hypot(p.x, p.z) < ORB_BALANCE.spawnSafeRadius
  )
    return false;
  if (
    ponds.some((v) => ((p.x - v.x) / v.rx) ** 2 + ((p.z - v.z) / v.rz) ** 2 < 1)
  )
    return false;
  if (blocked(p.x, p.z, p.y) || Math.abs(groundAt(p.x, p.z, p.y) - p.y) > 0.1)
    return false;
  // Central monument, planters and coastal hut footprints.
  if (Math.hypot(p.x + 21, p.z + 18) < 6) return false;
  for (const x of [-27, 27])
    for (const z of [-29, 29])
      if (Math.abs(p.x - x) < 5 && Math.abs(p.z - z) < 5) return false;
  if (p.z > 358 && p.z < 373 && Math.abs(p.x) < 83) return false;
  return true;
}
