import { solids } from "../../shared/world";
import { cityDecor } from "../../shared/cityDecor";
export type Placement = {
  model: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotation?: number;
  role: "building" | "road" | "plant" | "prop";
  tier?: number;
  color?: number;
  origin?: boolean;
  solidIndex?: number;
};
const commercial = "city/commercial/commercial/",
  roads = "city/roads/roads/";
export const cityPlacements: Placement[] = [];
const colors = [0x68cdda, 0xf4a4bf, 0xb29be8, 0xf3cc7a, 0x85d1af];
const choices = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
];
solids.forEach((s, i) => {
  if (s.kind !== "building") return;
  const skyline = s.h >= 35;
  cityPlacements.push({
    model:
      commercial +
      "building-" +
      (skyline ? "skyscraper-" + "abcde"[i % 5] : choices[i % 14]) +
      ".glb",
    x: s.x,
    y: 0,
    z: s.z,
    w: s.w,
    h: s.h - 0.18,
    d: s.d,
    rotation: 0,
    role: "building",
    color: colors[s.style],
    solidIndex: i,
  });
});
for (const p of cityDecor)
  cityPlacements.push({
    ...p,
    y: p.z === 446 ? -3 : 0,
    origin: true,
    role: p.model.includes("building")
      ? "building"
      : p.model.startsWith("nature/")
        ? "plant"
        : "prop",
    color: p.model.includes("building")
      ? colors[Math.floor(Math.abs(p.x) / 30) % 5]
      : undefined,
  });
const axisX = [-330, 0, 190, 330],
  axisZ = [-330, 0, 170, 330];
function road(
  model: string,
  x: number,
  z: number,
  w: number,
  d: number,
  rotation = 0,
  y = 0.16,
  h = 0.08,
) {
  cityPlacements.push({
    model: roads + model + ".glb",
    x,
    y,
    z,
    w,
    h,
    d,
    rotation,
    role: "road",
  });
}
// Cut segments exactly at junctions instead of overlaying incompatible road tiles.
function avenue(fixed: number, crossings: number[], horizontal: boolean) {
  const limits = [-435, ...crossings, 435];
  for (let i = 0; i < limits.length - 1; i++) {
    let start = limits[i] + (i ? 8 : 0),
      end = limits[i + 1] - (i < limits.length - 2 ? 8 : 0);
    for (let t = start; t < end - 0.01; t += 16) {
      const len = Math.min(16, end - t),
        mid = t + len / 2,
        x = horizontal ? mid : fixed,
        z = horizontal ? fixed : mid;
      if (Math.hypot(x, z) < 36) continue;
      road("road-straight", x, z, len, 16, horizontal ? 0 : Math.PI / 2);
    }
  }
}
axisX.forEach((x) => avenue(x, axisZ, false));
axisZ.forEach((z) => avenue(z, axisX, true));
for (const x of axisX)
  for (const z of axisZ) if (x || z) road("road-crossroad", x, z, 16, 16);
road("road-roundabout", 0, 0, 60, 60, 0, 0.27, 0.035);
for (const [x, z, r] of [
  [-116.5, -116.5, 0],
  [116.5, -116.5, -Math.PI / 2],
  [116.5, 116.5, Math.PI],
  [-116.5, 116.5, Math.PI / 2],
])
  road("road-curve", x, z, 14, 14, r, 0.12, 0.035);
// Existing elevated roof loop: the imported underside never changes its top surface.
for (const s of solids)
  if (s.kind === "platform" && s.h === 26)
    cityPlacements.push({
      model: "platforms/platform-fortified.glb",
      x: s.x,
      y: s.h - 0.4,
      z: s.z,
      w: s.w,
      h: 0.4,
      d: s.d,
      role: "prop",
    });
for (const x of [-60, 60])
  for (const z of [407, 422, 437])
    road("road-bridge", x, z, 10, 15, 0, -0.04, 1.04);
// Flat paving and decorative arrows never introduce new physical road heights.
for (const [x, z] of [
  [0, -40],
  [190, -120],
  [190, -210],
]) {
  road("road-straight-half", x - 4, z, 16, 8, Math.PI / 2);
  cityPlacements.push({
    model: "platforms/arrow.glb",
    x: x + 6,
    y: 0.6,
    z,
    w: 1.4,
    h: 2,
    d: 0.5,
    role: "prop",
  });
}
for (const [x, z] of [
  [0, 380],
  [-210, 170],
])
  road("road-intersection", x, z, 16, 16);
for (const x of [-27, 27])
  for (const z of [-29, 29]) road("tile-low", x, z, 9, 9, 0, 0.31, 0.15);
for (const [x, z] of [
  [177, -100],
  [177, -280],
])
  cityPlacements.push({
    model: roads + "sign-highway.glb",
    x,
    y: 0,
    z,
    w: 1.4,
    h: 10,
    d: 12,
    role: "prop",
    origin: true,
    rotation: Math.PI / 2,
  });
// Raised flagpoles sit on inaccessible corners; traversable roof lanes stay clear.
for (const s of solids
  .filter((s) => s.kind === "building" && s.x !== 125)
  .filter((_, i) => i % 4 === 0))
  cityPlacements.push({
    model: "platforms/flag.glb",
    x: s.x - s.w * 0.32,
    y: s.h,
    z: s.z - s.d * 0.32,
    w: 1.8,
    h: 3.8,
    d: 0.5,
    role: "prop",
    tier: 1,
    origin: true,
  });
// Jewels decorate the existing pond islands, distinct from interactable Crystal stations.
for (const [x, z] of [
  [-210, 120],
  [-260, 230],
])
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    cityPlacements.push({
      model: "platforms/jewel.glb",
      x: x + Math.cos(a) * 3,
      y: 0.3,
      z: z + Math.sin(a) * 3,
      w: 1.4,
      h: 2.5 + (i % 2),
      d: 1.4,
      role: "prop",
      color: 0x9ef7df,
    });
  }
for (const [x, z] of [
  [-210, 120],
  [-260, 230],
])
  cityPlacements.push({
    model: "nature/" + (x === -210 ? "bridge_wood" : "bridge_stone") + ".glb",
    x: x + 9,
    y: 0,
    z,
    w: 7,
    h: 0.9,
    d: 12,
    role: "prop",
  });
for (let i = 0; i < 20; i++)
  cityPlacements.push({
    model: "platforms/stones.glb",
    x: -210 + Math.sin(i * 0.3) * 28,
    y: 0.03,
    z: 140 + i * 3,
    w: 2,
    h: 0.025,
    d: 2,
    role: "road",
  });
for (const x of [-60, 60])
  for (const side of [-1, 1])
    cityPlacements.push({
      model: "platforms/fence-low-straight.glb",
      x: x + side * 4.8,
      y: 0,
      z: 422,
      w: 43,
      h: 1,
      d: 0.2,
      rotation: Math.PI / 2,
      role: "prop",
    });
