/** Stable ground props. Low flowers/grass are intentionally soft scenery; trunks,
 * planters, lamps, benches and coastal cabins have matching authoritative volumes. */
export type Decor = {
  id: string;
  model: string;
  x: number;
  z: number;
  h: number;
  w: number;
  d: number;
  rotation?: number;
  solid?: { w: number; d: number; h: number };
  tier?: number;
};
export const cityDecor: Decor[] = [];
const add = (
  model: string,
  x: number,
  z: number,
  w: number,
  h: number,
  d = w,
  solid?: Decor["solid"],
  tier = 0,
) => {
  const p = {
    id: `decor-${cityDecor.length}`,
    model,
    x,
    z,
    w,
    h,
    d,
    solid,
    tier,
  };
  cityDecor.push(p);
  return p;
};
const trees = [
  "tree_default",
  "tree_oak",
  "tree_small",
  "tree_detailed",
  "tree_cone",
  "tree_fat_fall",
  "tree_pineRoundA",
];
function tree(x: number, z: number, i: number, h = 10) {
  return add(
    `nature/${trees[i % trees.length]}.glb`,
    x,
    z,
    h * 0.48,
    h,
    h * 0.48,
    { w: 0.9, d: 0.9, h: 4 },
  );
}
for (const x of [-27, 27]) for (const z of [-29, 29]) tree(x, z, 3, 9);
for (const x of [-23, 23])
  for (let i = 0; i < 8; i++) tree(x, -48 - i * 23, i, 8 + (i % 3));
for (const x of [-254, -202])
  for (const z of [-254, -202, -150]) tree(x, z, 4, 11);
for (const x of [168, 215])
  for (let i = 0; i < 7; i++) tree(x, -92 - i * 42, i, 10);
for (const x of [-300, -270, -180, -140])
  for (const z of [80, 106, 242, 280]) {
    if (x === -270 && z === 242) continue;
    tree(x, z, Math.abs(x + z) % 7, 10 + Math.abs(z % 3));
  }
for (const x of [-165, -120, 120, 165])
  for (const z of [365, 416])
    add(
      `nature/${Math.abs(x) === 120 ? "tree_palm" : "tree_palmDetailedTall"}.glb`,
      x,
      z,
      10,
      13,
      10,
      { w: 0.9, d: 0.9, h: 4 },
    );
// Lush garden groves surround the pickup loop, leaving the road and pond mouths open.
for (let i = 0; i < 48; i++) {
  const a = i * 2.399,
    r = i % 3 === 0 ? 26 : 62 + (i % 4) * 6;
  const x = -210 + Math.sin(a) * r,
    z = 170 + Math.cos(a) * r;
  if (Math.abs(z - 170) < 18 || Math.hypot(x + 178, z - 178) < 12) continue;
  if (Math.abs(x + 210) < 10 && z < 154) continue;
  if (
    ((x + 210) / 25) ** 2 + ((z - 120) / 21) ** 2 < 1 ||
    ((x + 260) / 25) ** 2 + ((z - 230) / 21) ** 2 < 1
  )
    continue;
  tree(x, z, i, 11 + (i % 4));
}
// Lamps stand at the road shoulders, with poles away from every sprint lane.
for (const x of [-12, 12, 178, 202])
  for (const z of [-80, -180, -280])
    add("city/roads/roads/light-curved.glb", x, z, 0.55, 8, 2.7, {
      w: 0.55,
      d: 0.55,
      h: 7,
    });
for (const x of [-85, -45, 45, 85])
  add("city/roads/roads/light-curved.glb", x, 399, 0.55, 8, 2.7, {
    w: 0.55,
    d: 0.55,
    h: 7,
  });
for (const [x, z] of [
  [-16, 44],
  [16, -42],
  [174, -42],
  [-16, 183],
])
  add("city/roads/roads/road-sign-street.glb", x, z, 2, 5, 2, {
    w: 0.4,
    d: 0.4,
    h: 4,
  });
for (const [x, z] of [
  [-12, -12],
  [202, 12],
  [178, 158],
])
  add("city/roads/roads/traffic-light.glb", x, z, 1.2, 5.8, 0.9, {
    w: 0.4,
    d: 0.4,
    h: 5,
  });
// Cabins occupy the six existing visible hut footprints, not new road space.
for (let i = 0; i < 6; i++)
  add(
    "city/commercial/commercial/building-" + ["a", "c", "d"][i % 3] + ".glb",
    -75 + i * 30,
    365,
    12,
    5,
    9,
    { w: 12, d: 9, h: 5 },
  );
// Dense soft planting around the tree bases; all positions are seeded by index.
const bases = [...cityDecor].filter((p) => p.model.startsWith("nature/tree"));
const soft = [
  "plant_bush",
  "plant_bushSmall",
  "plant_bushLarge",
  "plant_bushTriangle",
  "flower_purpleA",
  "flower_redA",
  "flower_yellowA",
  "grass",
  "grass_large",
  "plant_flatShort",
  "plant_flatTall",
];
bases.forEach((p, i) => {
  for (let j = 0; j < 6; j++) {
    const a = i * 2.399 + (j * Math.PI) / 3,
      r = 1.8 + (j % 2) * 0.6,
      name = soft[(i + j) % soft.length];
    add(
      `nature/${name}.glb`,
      p.x + Math.sin(a) * r,
      p.z + Math.cos(a) * r,
      name.includes("bush") ? 2 : 1,
      name.includes("bush") ? 1.1 : 0.65,
      undefined,
      undefined,
      j % 3 === 0 ? 0 : 1,
    );
  }
});
// Decorative rocky shore stays outside the walkable boundary.
for (let i = 0; i < 32; i++)
  add(
    `nature/${["rock_largeA", "rock_largeB", "rock_smallA", "rock_smallB"][i % 4]}.glb`,
    -425 + i * 27,
    446,
    7,
    3.5,
    6,
    undefined,
    1,
  );

// Flower beds outside the garden pickup loop; flat, deliberately pass-through planting.
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6,
    x = -210 + Math.sin(a) * 53,
    z = 170 + Math.cos(a) * 55;
  if (Math.abs(z - 170) < 15) continue;
  for (let j = 0; j < 12; j++) {
    const b = j * 2.399,
      r = 1 + (j % 3) * 0.65;
    add(
      "nature/" +
        ["flower_purpleA", "flower_redA", "flower_yellowA"][i % 3] +
        ".glb",
      x + Math.cos(b) * r,
      z + Math.sin(b) * r,
      0.85,
      1.2,
      0.85,
      undefined,
      j % 3 === 0 ? 0 : 1,
    );
  }
}
