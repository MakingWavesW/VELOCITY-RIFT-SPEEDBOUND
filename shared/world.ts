import { cityDecor } from "./cityDecor.js";
/** Authoritative layout: rendering and movement consume the same solids. */
export const WORLD_HALF = 440;
export const districts = [
  {
    name: "Sunburst Plaza",
    x: 0,
    z: 0,
    color: 0xffc556,
    description:
      "The heart of the island. Follow the lights and collect your first orbs.",
  },
  {
    name: "Rainbow Downtown",
    x: -170,
    z: -150,
    color: 0xf680b9,
    description: "Pastel towers, broad avenues, and bright collectible routes.",
  },
  {
    name: "Speedway Boulevard",
    x: 190,
    z: -170,
    color: 0x52dbff,
    description: "A long open sprint route with launch pads and energy rings.",
  },
  {
    name: "Crystal Gardens",
    x: -210,
    z: 170,
    color: 0x8af0c5,
    description: "Glowing crystals, blossom trees, ponds, and winding paths.",
  },
  {
    name: "Skyline Challenge",
    x: 190,
    z: 180,
    color: 0xbba1ff,
    description:
      "Climb the stepped roof route and jump through the violet ring.",
  },
  {
    name: "Coastal Adventure",
    x: 0,
    z: 380,
    color: 0xffb98b,
    description: "Boardwalks, striped beach huts, and ocean views.",
  },
];
export type Solid = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: "building" | "platform" | "scenery";
  style: number;
};
export const solids: Solid[] = [];
// Four blocks around the central plaza; lanes are always clear.
for (const [x, z, style, h] of [
  [-43, -48, 0, 18],
  [-66, -50, 1, 26],
  [43, -48, 2, 21],
  [67, -55, 3, 31],
  [-48, 52, 4, 17],
  [48, 54, 0, 20],
  [-76, 45, 2, 25],
  [77, 40, 1, 16],
])
  solids.push({ x, z, w: 16, d: 16, h, kind: "building", style });
// Downtown gateway frames the view from the spawn plaza.
for (let i = 0; i < 3; i++)
  for (const side of [-1, 1])
    solids.push({
      x: side * (48 + (i % 2) * 17),
      z: -105 - i * 58,
      w: 20,
      d: 20,
      h: 25 + i * 8,
      kind: "building",
      style: (i + (side > 0 ? 2 : 0)) % 5,
    });
for (let i = 0; i < 4; i++)
  for (let j = 0; j < 4; j++) {
    solids.push({
      x: -280 + i * 52,
      z: -280 + j * 52,
      w: 22,
      d: 22,
      h: 20 + ((i + j) % 4) * 9,
      kind: "building",
      style: (i + j) % 5,
    });
    solids.push({
      x: 125 + i * 58,
      z: 105 + j * 60,
      w: 24,
      d: 24,
      h: 26 + ((i * 2 + j) % 4) * 11,
      kind: "building",
      style: (i + j + 2) % 5,
    });
  }
// Accessible staircase to a dedicated skyline terrace, separate from towers.
for (let i = 0; i < 20; i++)
  solids.push({
    x: 90,
    z: 70 + i * 2,
    w: 12,
    d: 2,
    h: (i + 1) * 0.6,
    kind: "platform",
    style: 0,
  });
solids.push({ x: 90, z: 120, w: 20, d: 22, h: 12, kind: "platform", style: 0 });
// Scarlet Skyline: a narrow elevated run and stairs connecting the first tower roof.
solids.push({ x: 90, z: 140, w: 4, d: 20, h: 12, kind: "platform", style: 0 });
for (let i = 0; i < 24; i++)
  solids.push({
    x: 101 + i * 1.5,
    z: 120,
    w: 1.5,
    d: 4,
    h: 12 + (i + 1) * 0.6,
    kind: "platform",
    style: 0,
  });
export const ramps = [
  { x: 0, z: -63, w: 7, d: 9 },
  { x: 190, z: -150, w: 9, d: 12 },
  { x: 190, z: -240, w: 9, d: 12 },
];
export const hoops = [
  { id: 0, x: 0, y: 8, z: -68, r: 4, color: 0xffc149, name: "SOLAR", xp: 20 },
  {
    id: 1,
    x: 190,
    y: 9,
    z: -155,
    r: 5,
    color: 0x42dcff,
    name: "AZURE",
    xp: 20,
  },
  {
    id: 2,
    x: -210,
    y: 2.5,
    z: 153,
    r: 3.3,
    color: 0x84ffaf,
    name: "VERDANT",
    xp: 20,
  },
  {
    id: 3,
    x: 90,
    y: 15,
    z: 119,
    r: 3.5,
    color: 0xc59aff,
    name: "VIOLET",
    xp: 20,
  },
];
export function districtAt(x: number, z: number) {
  return districts.reduce((a, b) =>
    Math.hypot(x - b.x, z - b.z) < Math.hypot(x - a.x, z - a.z) ? b : a,
  );
}
export function groundAt(x: number, z: number, feet: number) {
  let h = 0;
  for (const s of solids)
    if (
      Math.abs(x - s.x) < s.w / 2 + 0.4 &&
      Math.abs(z - s.z) < s.d / 2 + 0.4 &&
      s.h <= feet + 0.65
    )
      h = Math.max(h, s.h);
  return h;
}
export function blocked(x: number, z: number, feet: number) {
  return solids.some(
    (s) =>
      Math.abs(x - s.x) < s.w / 2 + 0.55 &&
      Math.abs(z - s.z) < s.d / 2 + 0.55 &&
      s.h > feet + 0.65,
  );
}
/** Test the swept player center against the hoop plane, including exact-plane hits. */
export function crossesHoop(
  h: (typeof hoops)[number],
  before: { x: number; y: number; z: number },
  after: { x: number; y: number; z: number },
) {
  if (!(
    (before.z < h.z && after.z >= h.z) ||
    (before.z > h.z && after.z <= h.z)
  ))
    return false;
  const t = (h.z - before.z) / (after.z - before.z);
  return (
    Math.hypot(
      before.x + (after.x - before.x) * t - h.x,
      before.y + (after.y - before.y) * t + 1.5 - h.y,
    ) <
    h.r - 0.5
  );
}

// Main City outer skyline: 18 blocks frame the existing neighborhoods without blocking roads.
export const citySkyline: Solid[] = Array.from({ length: 18 }, (_, i) => ({
  x:
    i < 9
      ? [-385, -280, -225, -140, -80, 70, 140, 250, 385][i]
      : i < 14
        ? -390
        : 390,
  z: i < 9 ? -395 : -240 + (i % 9) * 65,
  w: 26,
  d: 26,
  h: 35 + (i % 5) * 9,
  kind: "building",
  style: i % 5,
}));
solids.push(...citySkyline);
// A roof-level out-and-back loop branches from the already accessible first skyline roof.
solids.push({ x: 152, z: 105, w: 32, d: 5, h: 26, kind: "platform", style: 0 });
solids.push({ x: 165, z: 121, w: 5, d: 32, h: 26, kind: "platform", style: 0 });
solids.push({ x: 149, z: 135, w: 32, d: 5, h: 26, kind: "platform", style: 0 });
solids.push({ x: 139, z: 122, w: 5, d: 26, h: 26, kind: "platform", style: 0 });

// Explicit prop volumes; the existing building/platform array and heights above are unchanged.
export const scenerySolids: Solid[] = cityDecor
  .filter((p) => p.solid)
  .map((p) => ({
    x: p.x,
    z: p.z,
    w: p.solid!.w,
    d: p.solid!.d,
    h: p.solid!.h,
    kind: "scenery",
    style: 0,
  }));
solids.push(...scenerySolids);
for (const x of [-27, 27])
  for (const z of [-29, 29]) {
    solids.push({ x, z, w: 9, d: 9, h: 0.6, kind: "scenery", style: 0 });
    solids.push({
      x,
      z: z + 6,
      w: 4,
      d: 1.4,
      h: 1.1,
      kind: "scenery",
      style: 0,
    });
  }
for (const x of [-60, 60])
  for (const side of [-1, 1])
    solids.push({
      x: x + side * 4.8,
      z: 422,
      w: 0.2,
      d: 43,
      h: 1,
      kind: "scenery",
      style: 0,
    });
// The shallow bridge decks span existing decorative ponds; two rails sit outside the deck lane.
for (const [x, z] of [
  [-201, 120],
  [-251, 230],
]) {
  solids.push({ x, z, w: 7, d: 12, h: 0.23, kind: "scenery", style: 0 });
  for (const side of [-1, 1])
    solids.push({
      x: x + side * 3.25,
      z,
      w: 0.5,
      d: 12,
      h: 0.9,
      kind: "scenery",
      style: 0,
    });
}
