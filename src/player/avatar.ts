import type { createHero, CLIPS } from "../assets/hero";
import * as T from "three";
import { bevel, material, label } from "../world/models";
import { actualSpeed, angleDelta, type Player } from "../../shared/game";
function createProceduralAvatar(p: Player, showName = true) {
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
    const knee = new T.Group();
    knee.position.y = -0.58;
    pivot.add(knee);
    part(knee, 0.4, 0.35, 0.42, 0, -0.12, 0, 0x314663);
    part(knee, 0.53, 0.28, 0.78, 0, -0.3, 0.13, 0xf6f1de);
    part(knee, 0.54, 0.08, 0.8, 0, -0.42, 0.13, color);
    pivot.userData.knee = knee;
    return pivot;
  });
  const arms = [-1, 1].map((side) => {
    const pivot = new T.Group();
    pivot.position.set(side * 0.72, 2.22, 0);
    body.add(pivot);
    part(pivot, 0.4, 0.65, 0.45, 0, -0.25, 0, color);
    const elbow = new T.Group();
    elbow.position.y = -0.53;
    pivot.add(elbow);
    part(elbow, 0.34, 0.48, 0.36, 0, -0.19, 0.04, color);
    part(elbow, 0.37, 0.25, 0.4, 0, -0.5, 0.04, 0xffd5ad);
    pivot.userData.elbow = elbow;
    return pivot;
  });
  const name = label(p.name, "#ffffff", 3.3);
  name.position.y = 4.1;
  name.visible = showName;
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
    takeoff = 0,
    waveUntil = 0;
  let phase = 0,
    intensity = 0,
    previousSpeed = 0,
    animation = "idle",
    resetVersion = 0;
  let initialized = false;
  const previousPosition = new T.Vector3();
  const damp = (a: number, b: number, dt: number, rate = 16) =>
    T.MathUtils.lerp(a, b, 1 - Math.exp(-rate * dt));
  return {
    g,
    get animation() {
      return animation;
    },
    get velocity() {
      return previousSpeed;
    },
    get resetVersion() {
      return resetVersion;
    },
    resetMotion() {
      initialized = false;
      phase = 0;
      resetVersion++;
    },
    animate(state: Player, t: number, dt: number, visual = true) {
      const traveled = initialized
        ? Math.hypot(
            state.x - previousPosition.x,
            state.y - previousPosition.y,
            state.z - previousPosition.z,
          )
        : 0;
      const horizontal = initialized
        ? Math.hypot(state.x - previousPosition.x, state.z - previousPosition.z)
        : 0;
      const turn = angleDelta(g.rotation.y, state.angle);
      // Positions/facing already come from prediction or the timestamped buffer.
      g.position.set(state.x, state.y, state.z);
      g.rotation.y = state.angle;
      previousPosition.copy(g.position);
      initialized = true;
      const grounded = Math.abs(state.verticalVelocity) < 0.01;
      const velocity = Math.min(
        actualSpeed(state),
        horizontal / Math.max(dt, 0.001),
      );
      const moving = state.moving && horizontal > 0.0001;
      if (grounded && !prevGround) landing = 0.18;
      if (!grounded && prevGround) takeoff = 0.1;
      prevGround = grounded;
      landing = Math.max(0, landing - dt);
      takeoff = Math.max(0, takeoff - dt);
      animation =
        takeoff > 0
          ? "takeoff"
          : !grounded
            ? "airborne"
            : landing > 0
              ? "landing"
              : moving && previousSpeed - velocity > 0.4
                ? "braking"
                : moving && Math.abs(turn) > 0.13
                  ? "turning"
                  : !moving
                    ? "idle"
                    : velocity - previousSpeed > 0.5
                      ? "acceleration"
                      : velocity < 3
                        ? "walk"
                        : velocity < 8
                          ? "jog"
                          : velocity < 18
                            ? "sprint"
                            : "high-speed";
      previousSpeed = velocity;
      shadow.visible = grounded;
      if (!visual) return;
      // One cycle per two strides; cap cadence by lengthening strides at high speed.
      const stride = 2.7 + Math.max(0, velocity - 9) * 0.14;
      if (grounded && moving && traveled < 8)
        phase += (horizontal / stride) * Math.PI * 2;
      intensity = damp(intensity, moving ? Math.min(1, velocity / 8) : 0, dt);
      const swing =
        Math.sin(phase) * intensity * (0.65 + Math.min(0.35, velocity / 80));
      for (let n = 0; n < 2; n++) {
        const sign = n === 0 ? 1 : -1;
        legs[n].rotation.x = damp(
          legs[n].rotation.x,
          grounded ? sign * swing : n === 0 ? -0.5 : 0.35,
          dt,
        );
        const knee = legs[n].userData.knee as T.Group;
        knee.rotation.x = damp(
          knee.rotation.x,
          grounded
            ? Math.max(0, -sign * Math.sin(phase)) * intensity * 0.85
            : 0.5,
          dt,
        );
        const elbow = arms[n].userData.elbow as T.Group;
        elbow.rotation.x = damp(elbow.rotation.x, -0.15 - intensity * 0.95, dt);
        arms[n].rotation.x = damp(
          arms[n].rotation.x,
          grounded
            ? -sign * swing * (0.7 + Math.min(0.5, velocity / 40))
            : -0.9 - takeoff * 3,
          dt,
        );
      }
      body.scale.y = damp(
        body.scale.y,
        1 - landing * 0.85 - takeoff * 0.4,
        dt,
        24,
      );
      body.position.y = damp(
        body.position.y,
        grounded ? intensity * Math.abs(Math.cos(phase)) * 0.055 : 0,
        dt,
      );
      const lean =
        animation === "braking"
          ? -0.08
          : intensity * Math.min(0.24, velocity * 0.009);
      body.rotation.x = damp(body.rotation.x, grounded ? lean : 0.05, dt);
      head.rotation.x = damp(head.rotation.x, -body.rotation.x * 0.7, dt);
      body.rotation.y = Math.sin(phase) * intensity * 0.045;
      body.rotation.z = damp(
        body.rotation.z,
        Math.max(-0.15, Math.min(0.15, -turn * 0.5)),
        dt,
      );
      arms[1].rotation.z = damp(
        arms[1].rotation.z,
        t < waveUntil ? -0.8 + Math.sin(t * 15) * 0.3 : 0,
        dt,
      );
      if (t < waveUntil) arms[1].rotation.x = -2;
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

export function createAvatar(p: Player, showName = true) {
  const fallback = createProceduralAvatar(p, showName),
    g = fallback.g;
  let hero: Awaited<ReturnType<typeof createHero>> | undefined,
    disposed = false,
    status = "loading";
  void import("../assets/hero")
    .then(({ createHero }) => createHero())
    .then((value) => {
      if (disposed) {
        value.dispose();
        return;
      }
      hero = value;
      g.add(value.container);
      g.children[0].visible = false;
      status = "ready";
    })
    .catch((error) => {
      status = "fallback";
      console.warn("Hero unavailable; using procedural avatar.", error);
    });
  return {
    g,
    get animation() {
      return fallback.animation;
    },
    get resetVersion() {
      return fallback.resetVersion;
    },
    get heroStatus() {
      return status;
    },
    get heroClip() {
      return hero?.clip;
    },
    resetMotion() {
      fallback.resetMotion();
      hero?.reset();
    },
    animate(
      state: Player,
      t: number,
      dt: number,
      options?: { distance: number; low: boolean },
    ) {
      fallback.animate(state, t, dt, !hero);
      if (hero) {
        const cadence =
          options && options.distance > 60
            ? options.low
              ? 1 / 12
              : 1 / 20
            : 0;
        hero.update(
          fallback.animation as keyof typeof CLIPS,
          fallback.velocity,
          dt,
          cadence,
        );
      }
    },
    wave(t: number) {
      fallback.wave(t);
      hero?.wave();
    },
    dispose() {
      disposed = true;
      hero?.dispose();
      fallback.dispose();
    },
  };
}
