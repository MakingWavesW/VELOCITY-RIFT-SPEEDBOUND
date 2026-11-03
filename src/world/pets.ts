import * as T from "three";
import { PET_BY_ID } from "../../shared/pets";
import { sphere, material } from "./models";
export function createPetRenderer(scene: T.Scene) {
  const body = new T.InstancedMesh(sphere, material(0xffffff), 20),
    features = new T.InstancedMesh(sphere, material(0xffffff), 40),
    eyes = new T.InstancedMesh(sphere, material(0x173049), 40);
  for (const mesh of [body, features, eyes]) {
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  const object = new T.Object3D(),
    color = new T.Color(),
    positions = new Map<string, T.Vector3>();
  const put = (
    mesh: T.InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle: number,
    tint?: number,
  ) => {
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    object.rotation.set(0, angle, 0);
    object.updateMatrix();
    mesh.setMatrixAt(index, object.matrix);
    if (tint !== undefined) mesh.setColorAt(index, color.setHex(tint));
  };
  return {
    update(
      players: {
        id: string;
        pet?: string;
        position: T.Vector3;
        angle: number;
      }[],
      t: number,
      dt: number,
      comfort: boolean,
    ) {
      let count = 0;
      const present = new Set<string>();
      for (const p of players) {
        const d = p.pet ? PET_BY_ID.get(p.pet) : undefined;
        if (!d || count >= 20) continue;
        present.add(p.id);
        const tx =
            p.position.x - Math.sin(p.angle) * 3 + Math.cos(p.angle) * 2.5,
          tz = p.position.z - Math.cos(p.angle) * 3 - Math.sin(p.angle) * 2.5;
        let v = positions.get(p.id);
        if (!v) {
          v = new T.Vector3(tx, p.position.y + 2, tz);
          positions.set(p.id, v);
        }
        const blend = 1 - Math.exp(-dt * 7);
        v.x += (tx - v.x) * blend;
        v.z += (tz - v.z) * blend;
        v.y +=
          (p.position.y +
            2 +
            (comfort ? 0 : Math.sin(t * 3 + count) * 0.2) -
            v.y) *
          blend;
        if (v.distanceToSquared(p.position) > 1600)
          v.set(tx, p.position.y + 2, tz);
        put(body, count, v.x, v.y, v.z, 0.7, 0.6, 0.65, p.angle, d.color);
        for (const side of [-1, 1]) {
          const index = count * 2 + (side === 1 ? 1 : 0);
          const offset = d.shape === "wing" ? 1 : 0.42;
          put(
            features,
            index,
            v.x + Math.cos(p.angle) * side * offset,
            v.y + (d.shape === "ears" ? 0.65 : 0),
            v.z - Math.sin(p.angle) * side * offset,
            d.shape === "wing" ? 0.65 : 0.22,
            d.shape === "ears" ? 0.5 : 0.16,
            0.3,
            p.angle,
            d.color,
          );
          put(
            eyes,
            index,
            v.x + Math.cos(p.angle) * side * 0.24 + Math.sin(p.angle) * 0.58,
            v.y + 0.12,
            v.z - Math.sin(p.angle) * side * 0.24 + Math.cos(p.angle) * 0.58,
            0.1,
            0.13,
            0.1,
            p.angle,
          );
        }
        count++;
      }
      for (const id of positions.keys())
        if (!present.has(id)) positions.delete(id);
      body.count = count;
      features.count = eyes.count = count * 2;
      for (const mesh of [body, features, eyes]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of [body, features, eyes]) {
        mesh.removeFromParent();
        mesh.dispose();
      }
      positions.clear();
    },
  };
}
