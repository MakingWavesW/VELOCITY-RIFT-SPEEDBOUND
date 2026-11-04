import * as T from "three";
import { solids } from "../../shared/world";
import { Batch, cylinder, material } from "./models";
export function addLandscape(scene: T.Scene, b: Batch) {
  // Flat pavement and lawns add visual density without changing walkable elevations.
  for (const s of solids.filter((s) => s.kind === "building")) {
    const downtown = s.x < -80 && s.z < 0;
    b.box(
      downtown ? 0xc7bfcf : 0xc5d7cb,
      s.x,
      0.017,
      s.z,
      s.w + 9,
      0.025,
      s.d + 9,
    );
    b.box(0xe0dcc5, s.x, 0.035, s.z + s.d / 2 + 3, s.w + 9, 0.025, 2.5);
  }
  const garden = new T.Mesh(new T.CircleGeometry(100, 80), material(0x56a874));
  garden.rotation.x = -Math.PI / 2;
  garden.position.set(-215, 0.022, 176);
  garden.scale.set(1, 1.12, 1);
  scene.add(garden);
  const path = new T.Mesh(new T.RingGeometry(0.9, 1.1, 80), material(0xd9c895));
  path.rotation.x = -Math.PI / 2;
  path.position.set(-210, 0.06, 170);
  path.scale.set(42, 44, 1);
  scene.add(path);
  // Keep the cross-garden avenue fully visible over the garden ground layer.
  b.box(0x294158, -210, 0.08, 170, 220, 0.06, 15);
  // Bloom beds sit outside the running ring, with clear openings at the road.
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      x = -210 + Math.sin(a) * 53,
      z = 170 + Math.cos(a) * 55;
    if (Math.abs(z - 170) < 15) continue;
    b.add(cylinder, 0x387957, x, 0.09, z, 5, 0.08, 3);
    b.add(cylinder, 0x8ebd79, x, 0.14, z, 4.7, 0.05, 2.7);
  }
  // Coastal sand and boardwalk shoulders preserve all existing ground heights.
  b.box(0xe6d09a, 0, 0.02, 406, 410, 0.03, 62);
  b.box(0xb99167, 0, 0.07, 390, 190, 0.04, 17);
  // Fountain bowl around the existing Rift landmark, clear of the spawn point.
  b.add(cylinder, 0x477c89, -21, 0.82, -18, 3.3, 0.12, 3.3);
  b.add(cylinder, 0x64d9ec, -21, 0.9, -18, 2.9, 0.025, 2.9, true);
  const rim = new T.Mesh(
    new T.TorusGeometry(3.15, 0.15, 6, 40),
    material(0xeed4a2),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(-21, 0.9, -18);
  scene.add(rim);
  // Energy shoulders and roof edges use instancing; no additional dynamic lights.
  for (const s of solids.filter((s) => s.kind === "platform" && s.h >= 12)) {
    if (s.w > 8 && s.d > 8) continue;
    if (s.w > s.d)
      for (const side of [-1, 1])
        b.box(
          0xa4a0ff,
          s.x,
          s.h + 0.02,
          s.z + side * (s.d / 2 - 0.1),
          s.w,
          0.035,
          0.12,
          true,
        );
    else
      for (const side of [-1, 1])
        b.box(
          0xa4a0ff,
          s.x + side * (s.w / 2 - 0.1),
          s.h + 0.02,
          s.z,
          0.12,
          0.035,
          s.d,
          true,
        );
  }
}
