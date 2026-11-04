import { addLandscape } from "./landscape";
import { createAmbient } from "./ambient";
import { createGLBCity } from "./glbCity";
import { loadGLTF } from "../assets/gltf";
import { daylight } from "../../shared/dayNight";
import { CRYSTALS } from "../../shared/pets";
import { PARKOUR_COURSES } from "../../shared/parkour";
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

  // Flat roof decks retain authoritative landing heights above the new facades.
  for (const s of solids) {
    if (s.kind === "scenery") continue;
    if (s.kind === "platform") {
      b.box(0x536c99, s.x, s.h / 2, s.z, s.w, s.h, s.d);
      b.box(0xbfddec, s.x, s.h - 0.03, s.z, s.w, 0.06, s.d);
    } else {
      b.box(0x42586f, s.x, s.h - 0.1, s.z, s.w, 0.2, s.d);
      b.box(
        0x8de7ed,
        s.x,
        s.h + 0.015,
        s.z - s.d / 2 + 0.1,
        s.w,
        0.03,
        0.12,
        true,
      );
    }
  }
  // Existing planters and benches are retained; GLB planting supplies the canopy.
  for (const x of [-27, 27])
    for (const z of [-29, 29]) {
      b.add(bevel, 0xe8d9bb, x, 0.3, z, 9, 0.6, 9);
      bench(b, x, z + 6);
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
    // A lightweight additive inner stream and orbiting markers; no dynamic lights.
    const current = new T.Mesh(
      new T.TorusGeometry(h.r - 0.32, 0.075, 6, 64),
      new T.MeshBasicMaterial({
        color: h.color, transparent: true, opacity: 0.65,
        blending: T.AdditiveBlending, depthWrite: false, toneMapped: false,
      }),
    );
    g.add(current);
    const text = label(`${h.name}  +${h.xp} XP`, "#ffffff", 7);
    text.position.y = h.r + 1.5;
    g.add(text);
    scene.add(g);
    return { g, outer, current };
  });
  // Stage 3 launch pads: visible incline aligned with the shared authoritative
  // entry triggers. GLB cladding is optional; functional neon geometry is always present.
  const rampRoot = new T.Group();
  rampRoot.name = "Sky Launch Ramps";
  scene.add(rampRoot);
  const launchDeck = new T.BoxGeometry(1, 1, 1);
  const deckMaterial = new T.MeshStandardMaterial({
    color: 0x276b9a, emissive: 0x07314e, roughness: 0.5, metalness: 0.3,
  });
  const laneMaterial = new T.MeshBasicMaterial({
    color: 0x63e9ff, toneMapped: false,
  });
  const arrowGeometry = new T.ConeGeometry(0.58, 1.4, 4);
  const borders = new T.BoxGeometry(0.16, 0.16, 1);
  const rampGroups = ramps.map((r) => {
    const group = new T.Group();
    group.position.set(r.x, r.baseY, r.z);
    const deck = new T.Mesh(launchDeck, deckMaterial);
    deck.scale.set(r.w, 0.35, r.d);
    deck.position.y = 0.5;
    deck.rotation.x = 0.16;
    group.add(deck);
    for (const side of [-1, 1]) {
      const strip = new T.Mesh(borders, laneMaterial);
      strip.position.set(side * (r.w / 2 - 0.34), 0.8, 0);
      strip.scale.z = r.d * 0.92;
      strip.rotation.x = 0.16;
      group.add(strip);
    }
    for (let n = -1; n <= 1; n++) {
      const arrow = new T.Mesh(arrowGeometry, laneMaterial);
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.set(0, 0.88 - n * 0.16, n * r.d * 0.25);
      group.add(arrow);
    }
    rampRoot.add(group);
    return group;
  });
  let worldDisposed = false;
  // Kenney platform slope is visual cladding, never a client-only collider.
  void loadGLTF("/models/platforms/block-grass-large-slope.glb")
    .then((asset) => {
      if (worldDisposed) return;
      const bounds = new T.Box3().setFromObject(asset.scene);
      const size = bounds.getSize(new T.Vector3());
      if (Math.min(size.x, size.y, size.z) <= 0) return;
      ramps.forEach((r, i) => {
        const visual = asset.scene.clone(true);
        const sx = (r.w - 0.7) / size.x;
        const sy = 1.35 / size.y;
        const sz = (r.d - 0.5) / size.z;
        visual.scale.set(sx, sy, sz);
        visual.position.set(
          -(bounds.min.x + size.x * 0.5) * sx,
          -bounds.min.y * sy + 0.08,
          -(bounds.min.z + size.z * 0.5) * sz,
        );
        visual.traverse((o) => {
          if (o instanceof T.Mesh) { o.castShadow = false; o.receiveShadow = false; }
        });
        rampGroups[i].add(visual);
      });
    })
    .catch((error) => console.warn("Launch GLB unavailable; functional ramp fallback remains", error));
  // Server-validated Skybound course starts and checkpoints. Visual markers
  // cannot award Gems or complete courses on their own.
  const parkourMarkers = new T.Group();
  parkourMarkers.name = "Skybound Parkour Markers";
  scene.add(parkourMarkers);
  const markerMaterial = new T.MeshBasicMaterial({
    color: 0xffd56d, transparent: true, opacity: 0.7,
    depthWrite: false, toneMapped: false,
  });
  const markerGeometry = new T.TorusGeometry(4.1, 0.15, 6, 40);
  const parkourRings: T.Mesh[] = [];
  PARKOUR_COURSES.forEach((course, i) => {
    const ring = new T.Mesh(markerGeometry, markerMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(course.start.x, course.start.y + 0.2, course.start.z);
    parkourMarkers.add(ring);
    parkourRings.push(ring);
    const sign = label("SKYBOUND: " + course.name.toUpperCase(), "#ffe9a3", 12);
    sign.position.set(course.start.x, course.start.y + 5, course.start.z);
    parkourMarkers.add(sign);
    for (const checkpoint of course.checkpoints) {
      if (checkpoint.type !== "point") continue;
      const beacon = new T.Mesh(
        new T.OctahedronGeometry(0.65),
        new T.MeshBasicMaterial({ color: [0xffd56d, 0x9bffc6, 0xc7aaff][i], toneMapped: false }),
      );
      beacon.position.set(checkpoint.x, checkpoint.y + 2.5, checkpoint.z);
      parkourMarkers.add(beacon);
      const small = label(checkpoint.title, "#dffbff", 7);
      small.position.set(checkpoint.x, checkpoint.y + 5, checkpoint.z);
      parkourMarkers.add(small);
    }
  });
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
  for (const c of CRYSTALS) {
    b.add(cylinder, 0x29475c, c.x, 0.35, c.z, 3.5, 0.7, 3.5);
    b.add(cylinder, c.color, c.x, 0.76, c.z, 3.1, 0.12, 3.1, true);
    const gem = new T.Mesh(
      new T.OctahedronGeometry(1.7),
      material(c.color, true),
    );
    gem.position.set(c.x, 3.2, c.z);
    scene.add(gem);
    animated.push(gem);
    const sign = label(
      `${c.name.toUpperCase()} · ${c.cost} GEMS`,
      "#ffffff",
      9,
    );
    sign.position.set(c.x, 6.2, c.z);
    scene.add(sign);
  }
  // Warm road-edge markers make the central circuit readable at night.
  for (let i = -120; i <= 120; i += 20)
    for (const side of [-1, 1]) {
      b.box(0x86eaff, side * 120, 0.15, i, 0.25, 0.08, 3, true);
      b.box(0x86eaff, i, 0.15, side * 120, 3, 0.08, 0.25, true);
    }
  // Signed circuit: an exploration route, not a timed multiplayer race.
  for (const [x, z, w, d] of [
    [0, -120, 245, 7],
    [0, 120, 245, 7],
    [-120, 0, 7, 245],
    [120, 0, 7, 245],
  ])
    b.box(0x416278, x, 0.04, z, w, 0.06, d);
  for (const [z, title] of [
    [-50, "PLAZA DASH · CHECKPOINT"],
    [-100, "PLAZA DASH · TURN BACK"],
  ] as const) {
    for (const x of [-7, 7]) b.box(0x9be9f5, x, 2, z, 0.3, 4, 0.3, true);
    b.box(0xffdf89, 0, 0.16, z, 14, 0.08, 1, true);
    const gate = label(title, "#ffdf89", 12);
    gate.position.set(0, 6, z);
    scene.add(gate);
  }
  addLandscape(scene, b);
  b.finish(scene);
  const city = createGLBCity(scene);
  let comfort = false;
  const particles = createAmbient(scene);
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
  let autoCycle = true;
  const skyDay = new T.Color(0x94d6ed),
    skyNight = new T.Color(0x122443),
    skySunset = new T.Color(0xf4b38f),
    ambientDay = new T.Color(0xd3f0ff),
    ambientNight = new T.Color(0xa6bbff),
    sunlight = new T.Color(0xffedce),
    moonlight = new T.Color(0xb7d4ff);
  scene.background = skyDay.clone();
  scene.fog = new T.Fog(skyDay, 200, 1050);
  return {
    rings,
    sun,
    get diagnostics() {
      return city.diagnostics;
    },
    setQuality(value: string, reduced: boolean) {
      comfort = reduced;
      const shadowSize = value === "high" ? 2048 : 1024;
      if (sun.shadow.mapSize.x !== shadowSize) {
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        sun.shadow.mapSize.set(shadowSize, shadowSize);
      }
      city.setQuality(
        value === "low" || value === "medium" ? value : "high",
        reduced,
      );
      particles.configure(value, reduced);
    },
    dispose() {
      worldDisposed = true;
      rampRoot.removeFromParent();
      parkourMarkers.removeFromParent();
      markerGeometry.dispose();
      markerMaterial.dispose();
      launchDeck.dispose();
      borders.dispose();
      arrowGeometry.dispose();
      deckMaterial.dispose();
      laneMaterial.dispose();
      rings.forEach((r) => {
        r.current.geometry.dispose();
        r.current.material.dispose();
      });
      city.dispose();
      particles.dispose();
    },
    setCycle(value: boolean) {
      autoCycle = value;
    },
    setNight(value: boolean) {
      desired = value ? 1 : 0;
    },
    update(
      t: number,
      dt: number,
      x: number,
      z: number,
      serverTime = Date.now(),
    ) {
      const cycle = daylight(serverTime);
      if (autoCycle) desired = cycle.night;
      night = T.MathUtils.lerp(night, desired, 1 - Math.exp(-dt * 2));
      (scene.background as T.Color).copy(skyDay).lerp(skyNight, night);
      if (autoCycle)
        (scene.background as T.Color).lerp(skySunset, cycle.sunset * 0.62);
      hemi.color.copy(ambientDay).lerp(ambientNight, night);
      sun.color.copy(sunlight).lerp(moonlight, night);
      (scene.fog as T.Fog).color.copy(scene.background as T.Color);
      hemi.intensity = 1.8 - night * 1.05;
      sun.intensity = 2.6 - night * 2.1;
      stars.visible = night > 0.5;
      sun.position.set(x + 80, 120, z + 50);
      sun.target.position.set(x, 0, z);
      const ambientTime = comfort ? 0 : t;
      city.update(t, dt, x, z, night);
      particles.update(ambientTime, x, z, night);
      clouds.rotation.y = ambientTime * 0.001;
      water.position.y = -7 + Math.sin(ambientTime * 0.5) * 0.15;
      (water.material as T.MeshStandardMaterial).roughness =
        0.28 + Math.sin(ambientTime * 0.15) * 0.025;
      animated.forEach((o, i) => {
        o.rotation.y = ambientTime * (0.3 + i * 0.1);
      });
      parkourRings.forEach((r, i) => {
        r.rotation.z = ambientTime * (0.09 + i * 0.02);
      });
      rings.forEach((r, i) => {
        r.outer.rotation.z = ambientTime * (0.2 + i * 0.035);
        r.current.rotation.z = -ambientTime * (0.28 + i * 0.04);
        (r.current.material as T.MeshBasicMaterial).opacity =
          0.55 + 0.16 * Math.sin(ambientTime * 2.4 + i);
      });
    },
    cameraSolids: solids.filter((s) => s.kind === "building"),
  };
}
