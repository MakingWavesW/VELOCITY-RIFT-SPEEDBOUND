import * as T from "three";
export function createEffects(scene: T.Scene) {
  const count = 256,
    positions = new Float32Array(count * 3),
    colors = new Float32Array(count * 3),
    life = new Float32Array(count),
    velocity = new Float32Array(count * 3);
  positions.fill(-9999);
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(positions, 3));
  geo.setAttribute("color", new T.BufferAttribute(colors, 3));
  const points = new T.Points(
    geo,
    new T.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  points.frustumCulled = false;
  scene.add(points);
  let cursor = 0;
  function emit(x: number, y: number, z: number, color: number, n = 20) {
    const c = new T.Color(color);
    for (let k = 0; k < n; k++) {
      const i = cursor++ % count;
      life[i] = 0.7;
      positions.set([x, y, z], i * 3);
      colors.set([c.r, c.g, c.b], i * 3);
      velocity.set(
        [Math.sin(k * 2.4) * 3, 2 + (k % 4), Math.cos(k * 2.4) * 3],
        i * 3,
      );
    }
    geo.attributes.color.needsUpdate = true;
  }
  return {
    emit,
    update(dt: number) {
      for (let i = 0; i < count; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        for (let j = 0; j < 3; j++)
          positions[i * 3 + j] += velocity[i * 3 + j] * dt;
        velocity[i * 3 + 1] -= dt * 8;
        if (life[i] <= 0) positions[i * 3 + 1] = -9999;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
