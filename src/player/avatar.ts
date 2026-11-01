import * as T from "three";
import { bevel, material, label } from "../world/models";
import { speed, type Player } from "../../shared/game";
export function createAvatar(p: Player) {
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);
  const hue = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
  const color = [0x47bdd2, 0xee9d66, 0x9a8ce2, 0xe983aa, 0x6dc39c][hue];
  function part(
    parent: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    c: number,
  ) {
    const m = new T.Mesh(bevel, material(c));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  part(body, 1.05, 1.1, 0.65, 0, 1.85, 0, color);
  part(body, 0.85, 0.15, 0.68, 0, 1.32, 0, 0x263c5c);
  part(body, 0.28, 0.8, 0.05, 0, 1.9, 0.35, 0xf6d776);
  part(body, 0.2, 0.2, 0.07, -0.3, 2.1, 0.36, 0xf4f6e7);
  const head = new T.Group();
  head.position.y = 2.95;
  body.add(head);
  part(head, 1, 0.95, 0.9, 0, 0, 0, 0xffd5ad);
  part(head, 1.09, 0.28, 0.95, 0, 0.49, -0.02, 0x554b64);
  part(head, 0.35, 0.4, 0.97, -0.38, 0.3, 0, 0x554b64);
  for (const x of [-0.23, 0.23]) {
    part(head, 0.12, 0.2, 0.05, x, 0.04, 0.47, 0x26384f);
    part(head, 0.045, 0.06, 0.02, x - 0.02, 0.09, 0.5, 0xffffff);
  }
  part(head, 0.25, 0.05, 0.025, 0, -0.22, 0.48, 0xa96658);
  part(body, 0.7, 0.8, 0.25, 0, 1.85, -0.43, 0x344865);
  part(body, 0.45, 0.35, 0.1, 0, 1.85, -0.61, 0xffd574);
  const legs = [-1, 1].map((side) => {
    const pivot = new T.Group();
    pivot.position.set(side * 0.3, 1.3, 0);
    body.add(pivot);
    part(pivot, 0.43, 0.8, 0.44, 0, -0.4, 0, 0x314663);
    part(pivot, 0.53, 0.28, 0.78, 0, -0.88, 0.13, 0xf6f1de);
    part(pivot, 0.54, 0.08, 0.8, 0, -1, 0.13, color);
    return pivot;
  });
  const arms = [-1, 1].map((side) => {
    const pivot = new T.Group();
    pivot.position.set(side * 0.72, 2.22, 0);
    body.add(pivot);
    part(pivot, 0.4, 0.65, 0.45, 0, -0.25, 0, color);
    part(pivot, 0.37, 0.34, 0.4, 0, -0.7, 0, 0xffd5ad);
    return pivot;
  });
  const name = label(p.name, "#ffffff", 3.3);
  name.position.y = 4.1;
  g.add(name);
  const shadow = new T.Mesh(
    new T.CircleGeometry(0.8, 24),
    new T.MeshBasicMaterial({
      color: 0x143c4e,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  g.add(shadow);
  let prevGround = true,
    landing = 0,
    waveUntil = 0;
  const vector = new T.Vector3();
  return {
    g,
    animate(state: Player, t: number, dt: number, local = false) {
      g.position.lerp(
        vector.set(state.x, state.y, state.z),
        1 - Math.exp(-dt * (local ? 25 : 12)),
      );
      const delta = Math.atan2(
        Math.sin(state.angle - g.rotation.y),
        Math.cos(state.angle - g.rotation.y),
      );
      g.rotation.y += delta * (1 - Math.exp(-dt * 14));
      const grounded = Math.abs(state.vy) < 0.01;
      if (grounded && !prevGround) landing = 0.18;
      prevGround = grounded;
      landing = Math.max(0, landing - dt);
      body.scale.y = 1 - landing * 0.7;
      const rate = Math.min(17, speed(state) * 1.1),
        phase = state.moving ? Math.sin(t * rate) * 0.65 : 0;
      body.position.y = grounded
        ? state.moving
          ? Math.abs(Math.cos(t * rate)) * 0.045
          : Math.sin(t * 2) * 0.025
        : 0;
      legs[0].rotation.x = grounded ? phase : -0.4;
      legs[1].rotation.x = grounded ? -phase : 0.3;
      arms[0].rotation.x = grounded ? -phase : -1;
      arms[1].rotation.x = grounded ? phase : -1;
      arms[1].rotation.z = t < waveUntil ? -0.8 + Math.sin(t * 15) * 0.3 : 0;
      arms[1].rotation.x = t < waveUntil ? -2 : arms[1].rotation.x;
      body.rotation.x = state.moving && grounded ? 0.07 : 0;
      shadow.visible = grounded;
    },
    wave(t: number) {
      waveUntil = t + 2;
    },
    dispose() {
      const mat = name.material as T.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
      shadow.geometry.dispose();
      shadow.material.dispose();
      g.removeFromParent();
    },
  };
}
