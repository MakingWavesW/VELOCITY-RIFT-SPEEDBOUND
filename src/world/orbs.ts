import * as T from "three";
import {
  ORB_TYPES,
  MAX_ORBS,
  type Orb,
  type OrbState,
  type OrbPatch,
} from "../../shared/orbs";
/** Fixed GPU allocations. Server packets change slots; no locally invented collectibles. */
export function createOrbRenderer(scene: T.Scene) {
  const active = new Map<number, Orb>();
  let revision = -1;
  const shell = new T.InstancedMesh(
    new T.SphereGeometry(1, 16, 12),
    new T.MeshBasicMaterial({ toneMapped: false }),
    MAX_ORBS,
  );
  const core = new T.InstancedMesh(
    new T.SphereGeometry(1, 12, 8),
    new T.MeshBasicMaterial({
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      toneMapped: false,
    }),
    MAX_ORBS,
  );
  shell.boundingSphere = core.boundingSphere = new T.Sphere(
    new T.Vector3(),
    650,
  );
  scene.add(shell, core);
  const positions = new Float32Array(MAX_ORBS * 3),
    colors = new Float32Array(MAX_ORBS * 3);
  positions.fill(-9999);
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(positions, 3));
  geo.setAttribute("color", new T.BufferAttribute(colors, 3));
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!,
    gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "#ffffffff");
  gradient.addColorStop(0.3, "#ffffff88");
  gradient.addColorStop(1, "#ffffff00");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new T.CanvasTexture(c);
  const halo = new T.Points(
    geo,
    new T.PointsMaterial({
      map: texture,
      size: 4.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
    }),
  );
  halo.frustumCulled = false;
  scene.add(halo);
  const transform = new T.Object3D(),
    zero = new T.Matrix4().makeScale(0, 0, 0),
    color = new T.Color(),
    offset = new T.Vector3();
  for (let i = 0; i < MAX_ORBS; i++) {
    shell.setMatrixAt(i, zero);
    core.setMatrixAt(i, zero);
  }
  function remove(id: number) {
    active.delete(id);
    shell.setMatrixAt(id, zero);
    core.setMatrixAt(id, zero);
    positions[id * 3 + 1] = -9999;
  }
  function add(o: Orb) {
    if (o.id < 0 || o.id >= MAX_ORBS) return;
    active.set(o.id, o);
    const d = ORB_TYPES[o.tier];
    shell.setColorAt(o.id, color.setHex(d.color));
    core.setColorAt(o.id, color.setHex(d.core));
    color.setHex(d.color);
    colors.set([color.r, color.g, color.b], o.id * 3);
  }
  function colorsDirty() {
    if (shell.instanceColor) shell.instanceColor.needsUpdate = true;
    if (core.instanceColor) core.instanceColor.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  return {
    get revision() {
      return revision;
    },
    get active() {
      return [...active.values()];
    },
    clear() {
      for (const id of active.keys()) remove(id);
      revision = -1;
    },
    sync(s: OrbState) {
      if (s.revision < revision) return;
      for (const id of active.keys()) remove(id);
      for (const o of s.orbs) add(o);
      revision = s.revision;
      colorsDirty();
    },
    patch(p: OrbPatch) {
      if (p.revision <= revision) return true;
      if (p.revision !== revision + 1) return false;
      for (const id of p.removed) remove(id);
      for (const o of p.spawned) add(o);
      revision = p.revision;
      colorsDirty();
      return true;
    },
    update(t: number, camera: T.Camera, reduceMotion: boolean) {
      const toward = camera.position;
      for (const o of active.values()) {
        const d = ORB_TYPES[o.tier];
        const pulse = reduceMotion ? 1 : 1 + Math.sin(t * 2.4 + o.id) * 0.045;
        transform.position.set(
          o.x,
          o.y + (reduceMotion ? 0 : Math.sin(t * 1.8 + o.id) * 0.14),
          o.z,
        );
        transform.scale.setScalar(d.radius * pulse);
        transform.rotation.y = t * 0.3;
        transform.updateMatrix();
        shell.setMatrixAt(o.id, transform.matrix);
        offset
          .copy(toward)
          .sub(transform.position)
          .normalize()
          .multiplyScalar(d.radius * 0.83);
        transform.position.add(offset);
        transform.scale.setScalar(d.radius * 0.48 * pulse);
        transform.updateMatrix();
        core.setMatrixAt(o.id, transform.matrix);
        positions.set([o.x, o.y, o.z], o.id * 3);
      }
      shell.instanceMatrix.needsUpdate = true;
      core.instanceMatrix.needsUpdate = true;
      geo.attributes.position.needsUpdate = true;
    },
  };
}
