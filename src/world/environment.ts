import * as T from "three";
import {
  districts,
  solids,
  hoops,
  ramps,
  WORLD_HALF,
} from "../../shared/world";
import { orbRoutes, validOrbPoint } from "../../shared/orbRoutes";
import {
  Batch,
  cube,
  bevel,
  sphere,
  cylinder,
  material,
  tree,
  crystal,
  bench,
  lamp,
  label,
  aura,
} from "./models";
export function createWorld(scene: T.Scene) {
  const b = new Batch();
  const animated: T.Object3D[] = [];
  b.box(0x75bd84, 0, -1.5, 0, 880, 3, 880);
  b.box(0xf1d9a3, 0, -5, 0, 900, 5, 900);
  b.box(0x466b81, 0, -11, 0, 895, 10, 895);
  const water = new T.Mesh(
    new T.PlaneGeometry(5000, 5000),
    new T.MeshStandardMaterial({
      color: 0x32b7cb,
      roughness: 0.3,
      metalness: 0.35,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -7;
  scene.add(water);
  // Broad continuous avenues and clear white shoulders.
  for (const x of [0, 190, -330, 330]) {
    b.box(0xe8f4e7, x, 0.01, 0, 17, 0.09, 870);
    b.box(0x294158, x, 0.07, 0, 15, 0.09, 870);
  }
  for (const z of [0, 170, -330, 330]) {
    b.box(0xe8f4e7, 0, 0.01, z, 870, 0.09, 17);
    b.box(0x294158, 0, 0.07, z, 870, 0.09, 15);
  }
  for (let i = -420; i <= 420; i += 14) {
    for (const x of [0, 190]) b.box(0xa7b8be, x, 0.13, i, 0.3, 0.02, 4);
    for (const z of [0, 170]) b.box(0xa7b8be, i, 0.13, z, 4, 0.02, 0.3);
  }
  b.add(cylinder, 0xe9d8b6, 0, 0.12, 0, 34, 0.15, 34);
  b.add(cylinder, 0xf5e8cd, 0, 0.22, 0, 30, 0.08, 30);
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16;
    b.add(
      cube,
      0xd9c7aa,
      Math.sin(a) * 32,
      0.23,
      Math.cos(a) * 32,
      1.5,
      0.1,
      2,
      false,
      -a,
    );
  }
  // The rift monument is offset from spawn and the central movement lanes.
  b.add(cylinder, 0x335a73, -21, 0.35, -18, 5, 0.6, 5);
  b.add(cylinder, 0xffd67d, -21, 0.7, -18, 4, 0.2, 4);
  const core = new T.Mesh(
    new T.OctahedronGeometry(2.6),
    material(0x80efff, true),
  );
  core.position.set(-21, 5, -18);
  scene.add(core);
  animated.push(core);
  for (let i = 0; i < 2; i++) {
    const r = new T.Mesh(
      new T.TorusGeometry(4.1 + i * 0.5, 0.12, 8, 48),
      material(i ? 0xffd06c : 0x7eeaff, true),
    );
    r.position.copy(core.position);
    r.rotation.x = i ? 1.1 : 0.5;
    r.rotation.y = i;
    scene.add(r);
    animated.push(r);
  }

  for (const s of solids) {
    if (s.kind === "platform") {
      b.box(0x7084ab, s.x, s.h / 2, s.z, s.w, s.h, s.d);
      b.box(0xd4e7ee, s.x, s.h + 0.03, s.z, s.w, 0.06, s.d);
      continue;
    }
    const color = [0x63bbdf, 0xdc93b9, 0xa49add, 0xeac269, 0x6cc6b2][s.style];
    b.add(bevel, color, s.x, s.h / 2, s.z, s.w, s.h, s.d);
    b.box(0x48657e, s.x, 0.5, s.z, s.w + 1, 1, s.d + 1);
    b.add(bevel, 0x3f5773, s.x, s.h - 0.45, s.z, s.w + 1.5, 0.9, s.d + 1.5);
    b.box(0xcde8eb, s.x, s.h - 0.06, s.z, s.w * 0.68, 0.12, s.d * 0.68);
    b.box(0x244158, s.x, 1.8, s.z + s.d / 2 + 0.1, 3, 3.6, 0.3);
    b.box(0xffdc9c, s.x, 3.8, s.z + s.d / 2 + 0.4, 4, 0.25, 1.5);
    for (let y = 6; y < s.h - 1; y += 4.5)
      for (let j = -1; j <= 1; j++) {
        b.box(
          0xc8f6ff,
          s.x + j * s.w * 0.27,
          y,
          s.z + s.d / 2 + 0.1,
          1.8,
          2.5,
          0.15,
          true,
        );
        b.box(
          0xffe7b5,
          s.x + s.w / 2 + 0.1,
          y,
          s.z + j * s.d * 0.27,
          0.15,
          2.5,
          1.8,
          true,
        );
        b.box(
          0xb9e6ff,
          s.x - s.w / 2 - 0.1,
          y,
          s.z + j * s.d * 0.27,
          0.15,
          2.5,
          1.8,
          true,
        );
      }
  }
  // A sequence of urban gardens frames the plaza rather than filling its running lanes.
  for (const x of [-27, 27])
    for (const z of [-29, 29]) {
      b.add(bevel, 0xe8d9bb, x, 0.45, z, 9, 0.9, 9);
      tree(b, x, z, 2, 0.8);
      bench(b, x, z + 6);
      lamp(b, x + 6, z);
    }
  for (const side of [-1, 1])
    for (let i = 0; i < 8; i++) {
      tree(b, side * 23, -48 - i * 23, i % 2, 0.7);
      lamp(b, side * 12, -50 - i * 30);
    }
  for (let i = 0; i < 10; i++) {
    const z = -95 - i * 28;
    tree(b, 173, z, i % 2, 0.85);
    tree(b, 208, z, i % 2, 0.85);
    lamp(b, 181, z);
  }
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 7; j++) {
      const x = -300 + i * 27,
        z = 80 + j * 30;
      if (Math.abs(z - 170) < 20) continue;
      tree(b, x, z, (i + j) % 5, 0.8 + (i % 3) * 0.15);
      if ((i + j) % 3 === 0) crystal(b, x + 7, z + 6, 3);
    }
  // Crystal ponds and flower beds.
  for (const [x, z] of [
    [-210, 120],
    [-260, 230],
  ]) {
    b.add(cylinder, 0xd2dcb7, x, 0.12, z, 15, 0.2, 11);
    b.add(cylinder, 0x5dc9d1, x, 0.26, z, 13, 0.12, 9);
    crystal(b, x, z, 7);
  }
  for (let i = 0; i < 90; i++) {
    const a = i * 2.4,
      r = 35 + (i % 4) * 8,
      x = -210 + Math.sin(a) * r,
      z = 170 + Math.cos(a) * r;
    if (Math.abs(z - 170) < 15) continue;
    b.add(
      sphere,
      [0xffc56e, 0xed95c2, 0xf2e1a5][i % 3],
      x,
      0.6,
      z,
      0.65,
      0.65,
      0.65,
    );
  }
  // Coastal promenade, piers, beach huts and rocky shore.
  b.box(0xb99167, 0, 0.17, 390, 180, 0.3, 15);
  for (let i = -85; i < 90; i += 4)
    b.box(0xe2bc87, i, 0.34, 390, 0.1, 0.04, 15);
  for (const x of [-60, 60]) {
    b.box(0xb99167, x, -1, 422, 10, 2, 45);
    for (let z = 405; z < 445; z += 8) {
      b.box(0x6f6c61, x - 5, -2, z, 0.8, 9, 0.8);
      b.box(0x6f6c61, x + 5, -2, z, 0.8, 9, 0.8);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = -75 + i * 30;
    b.add(bevel, [0xed97a2, 0x75c6d6, 0xf4cf85][i % 3], x, 2.5, 365, 12, 5, 9);
    b.box(0xf8e7c7, x, 5, 365, 13, 0.6, 10);
    b.box(0x476c82, x, 1.8, 370, 3, 3.6, 0.2);
  }
  for (let i = 0; i < 60; i++) {
    const side = i % 4,
      offset = -430 + Math.floor(i / 4) * 61;
    const x = side < 2 ? offset : side === 2 ? -443 : 443,
      z = side >= 2 ? offset : side === 0 ? -443 : 443;
    b.add(sphere, 0x6e8c98, x, -3, z, 8 + (i % 3) * 3, 7, 10);
  }
  // Far islands, deliberately outside authoritative boundaries.
  for (const [x, z] of [
    [-610, -220],
    [580, -500],
    [600, 200],
  ]) {
    b.add(sphere, 0x6b8996, x, -22, z, 65, 35, 45);
    b.add(cylinder, 0x78b991, x, 3, z, 48, 4, 33);
    tree(b, x, z, 3, 3);
  }
  for (const d of districts.slice(1)) {
    const sign = label(d.name.toUpperCase(), "#e8f9ff", 20);
    sign.position.set(d.x, 13, d.z - 30);
    scene.add(sign);
    b.box(0x385971, d.x, 4, d.z - 30, 0.8, 8, 0.8);
  }
  // Shared trigger definitions determine every visible hoop and launch pad.
  const rings = hoops.map((h) => {
    const g = new T.Group();
    g.position.set(h.x, h.y, h.z);
    const ring = new T.Mesh(
      new T.TorusGeometry(h.r, 0.22, 10, 64),
      material(h.color, true),
    );
    g.add(ring);
    const outer = new T.Mesh(
      new T.TorusGeometry(h.r + 0.45, 0.08, 6, 48),
      material(0xf6e5bd),
    );
    g.add(outer);
    for (let i = 0; i < 4; i++) {
      const m = new T.Mesh(
        new T.OctahedronGeometry(0.4),
        material(h.color, true),
      );
      const a = (i * Math.PI) / 2;
      m.position.set(Math.cos(a) * (h.r + 0.45), Math.sin(a) * (h.r + 0.45), 0);
      outer.add(m);
    }
    const text = label(`${h.name}  +${h.xp} XP`, "#ffffff", 7);
    text.position.y = h.r + 1.5;
    g.add(text);
    scene.add(g);
    return { g, outer };
  });
  for (const r of ramps) {
    b.add(bevel, 0x294962, r.x, 0.3, r.z, r.w, 0.6, r.d);
    b.box(0x6ce6ff, r.x, 0.63, r.z, r.w - 0.8, 0.08, r.d - 0.6, true);
    for (let i = -1; i <= 1; i++) {
      b.add(
        cube,
        0xffffff,
        r.x - 0.7,
        0.7,
        r.z + i * 2,
        1.7,
        0.1,
        0.35,
        true,
        -0.65,
      );
      b.add(
        cube,
        0xffffff,
        r.x + 0.7,
        0.7,
        r.z + i * 2,
        1.7,
        0.1,
        0.35,
        true,
        0.65,
      );
    }
  }
  // Flat route waymarkers are scenery, never client-only collectible copies.
  for (const route of orbRoutes) {
    const sign = label(
      route.name.toUpperCase(),
      "#" + route.color.toString(16).padStart(6, "0"),
      9,
    );
    sign.position.set(route.sign.x, route.sign.y + 4, route.sign.z);
    scene.add(sign);
    b.box(
      0x2e5069,
      route.sign.x,
      route.sign.y + 1.7,
      route.sign.z,
      0.3,
      3.4,
      0.3,
    );
    route.points.forEach((p, i) => {
      if (i % 4 || !validOrbPoint(p)) return;
      b.box(route.color, p.x, p.y + 0.31, p.z, 1.6, 0.06, 0.3, true);
    });
  }
  // Scarlet terrace edge paint and roof target visually match the shared support heights.
  for (const x of [88.3, 91.7])
    b.box(0xff7766, x, 12.07, 140, 0.16, 0.08, 20, true);
  b.finish(scene);
  const clouds = new T.InstancedMesh(sphere, material(0xf1f5ef), 78);
  const cloudTransform = new T.Object3D();
  for (let i = 0; i < 26; i++)
    for (let j = 0; j < 3; j++) {
      cloudTransform.position.set(
        Math.sin(i * 2.4) * 620 + j * 11,
        90 + (i % 4) * 18,
        Math.cos(i * 2.4) * 620,
      );
      cloudTransform.scale.set(17, 7 + (j % 2) * 3, 10);
      cloudTransform.updateMatrix();
      clouds.setMatrixAt(i * 3 + j, cloudTransform.matrix);
    }
  clouds.computeBoundingSphere();
  scene.add(clouds);
  const starsGeo = new T.BufferGeometry();
  const pos = [];
  for (let i = 0; i < 400; i++) {
    const a = i * 2.399,
      r = 700;
    pos.push(Math.cos(a) * r, 150 + (i % 31) * 15, Math.sin(a) * r);
  }
  starsGeo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  const stars = new T.Points(
    starsGeo,
    new T.PointsMaterial({ color: 0xd4edff, size: 2, sizeAttenuation: true }),
  );
  scene.add(stars);
  stars.visible = false;
  const hemi = new T.HemisphereLight(0xd3f0ff, 0x67704b, 2);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffedce, 2.7);
  sun.position.set(80, 120, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -80,
    right: 80,
    top: 80,
    bottom: -80,
    near: 1,
    far: 350,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.25;
  scene.add(sun, sun.target);
  let night = 0,
    desired = 0;
  const skyDay = new T.Color(0x94d6ed),
    skyNight = new T.Color(0x122443);
  scene.background = skyDay.clone();
  scene.fog = new T.Fog(skyDay, 200, 1050);
  return {
    rings,
    sun,
    setNight(value: boolean) {
      desired = value ? 1 : 0;
    },
    update(t: number, dt: number, x: number, z: number) {
      night = T.MathUtils.lerp(night, desired, 1 - Math.exp(-dt * 2));
      (scene.background as T.Color).copy(skyDay).lerp(skyNight, night);
      (scene.fog as T.Fog).color.copy(scene.background as T.Color);
      hemi.intensity = 1.65 - night * 1.2;
      sun.intensity = 2.4 - night * 2.15;
      stars.visible = night > 0.5;
      sun.position.set(x + 80, 120, z + 50);
      sun.target.position.set(x, 0, z);
      clouds.rotation.y = t * 0.001;
      water.position.y = -7 + Math.sin(t * 0.5) * 0.15;
      animated.forEach((o, i) => {
        o.rotation.y = t * (0.3 + i * 0.1);
      });
      rings.forEach((r) => (r.outer.rotation.z = t * 0.2));
    },
    cameraSolids: solids.filter((s) => s.kind === "building"),
  };
}
