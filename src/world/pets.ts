import * as T from "three";
import { PET_BY_ID } from "../../shared/pets";
import { sphere, material, aura } from "./models";
import { loadGLTF } from "../assets/gltf";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
function createFallbackRenderer(scene: T.Scene) {
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

/** Maps stable, persisted species IDs to visual-only models. Economy IDs never change. */
export const PET_MODEL_FILES: Record<string, string> = {
  "sun-puff": "animal-chick.glb",
  "mint-moth": "animal-bee.glb",
  "cloud-kit": "animal-cat.glb",
  "coral-cub": "animal-lion.glb",
  "azure-ray": "animal-fish.glb",
  "violet-fox": "animal-fox.glb",
  "jade-sprite": "animal-bunny.glb",
  "ember-owl": "animal-parrot.glb",
  "prism-lynx": "animal-tiger.glb",
  "lunar-wisp": "animal-penguin.glb",
  "solar-griffin": "animal-parrot.glb",
  "rift-dragon": "animal-caterpillar.glb",
};
type PetView = {
  id: string;
  pet?: string;
  position: T.Vector3;
  angle: number;
};
type PetAsset = Awaited<ReturnType<typeof loadGLTF>>;
type PetActor = {
  species: string;
  group: T.Group;
  body: T.Object3D;
  mixer?: T.AnimationMixer;
  decoration?: T.Object3D;
  halo: T.Sprite;
  position: T.Vector3;
  turn: number;
};
/**
 * GLBs are visual-only. Existing replicated equippedPetId, gameplay bonuses,
 * server authority and the procedural renderer are preserved.
 */
export function createPetRenderer(scene: T.Scene) {
  const fallback = createFallbackRenderer(scene);
  const loaded = new Map<string, PetAsset>();
  const loading = new Set<string>();
  const failed = new Set<string>();
  const actors = new Map<string, PetActor>();
  let disposed = false;

  function request(species: string) {
    if (loaded.has(species) || loading.has(species) || failed.has(species)) return;
    const file = PET_MODEL_FILES[species];
    if (!file) return;
    loading.add(species);
    void loadGLTF("/models/pets/" + file)
      .then((data) => {
        if (!disposed) loaded.set(species, data);
      })
      .catch((error) => {
        if (!disposed) {
          failed.add(species);
          console.warn("Pet GLB unavailable; procedural fallback:", species, error);
        }
      })
      .finally(() => loading.delete(species));
  }

  function remove(id: string) {
    const a = actors.get(id);
    if (!a) return;
    a.mixer?.stopAllAction();
    a.mixer?.uncacheRoot(a.body);
    a.body.traverse((o) => {
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
    });
    a.halo.material.dispose(); // shared aura texture remains owned by models.ts
    a.decoration?.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    scene.remove(a.group);
    actors.delete(id);
  }

  function spawn(id: string, species: string, source: PetAsset, p: PetView) {
    const def = PET_BY_ID.get(species);
    if (!def) return;
    const group = new T.Group();
    group.name = "Pet: " + species + " / " + id;
    const body = cloneSkeleton(source.scene);
    // Keep the GLB's original materials and textures. Never tint shared materials.
    const bounds = new T.Box3().setFromObject(body);
    const size = bounds.getSize(new T.Vector3());
    if (![size.x, size.y, size.z].every(Number.isFinite) ||
        Math.max(size.x, size.y, size.z) < 0.001) throw Error("Invalid Pet GLB bounds: " + species);
    const scale = 1.4 / Math.max(size.x, size.y, size.z);
    body.scale.multiplyScalar(scale);
    body.position.set(
      -(bounds.min.x + size.x * 0.5) * scale,
      -bounds.min.y * scale,
      -(bounds.min.z + size.z * 0.5) * scale,
    );
    body.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = false; // affordable for 20 possible remote players
        o.receiveShadow = false;
      }
    });
    group.add(body);
    const halo = aura(def.color, def.rarity === "Legendary" ? 3.2 : def.rarity === "Epic" ? 2.3 : 1.6);
    halo.position.y = 0.65;
    group.add(halo);

    let decoration: T.Object3D | undefined;
    if (def.rarity === "Legendary" || def.rarity === "Epic") {
      decoration = new T.Group();
      decoration.position.y = 0.7;
      const ring = new T.Mesh(
        new T.TorusGeometry(def.rarity === "Legendary" ? 1.15 : 0.95, 0.045, 5, 28),
        new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.64, depthWrite: false }),
      );
      ring.rotation.x = Math.PI * 0.5;
      decoration.add(ring);
      group.add(decoration);
    }
    let mixer: T.AnimationMixer | undefined;
    if (source.animations.length) {
      mixer = new T.AnimationMixer(body);
      const action = mixer.clipAction(source.animations[0]);
      action.play();
    }
    const position = new T.Vector3(p.position.x, p.position.y + 2, p.position.z);
    group.position.copy(position);
    scene.add(group);
    actors.set(id, { species, group, body, mixer, decoration, halo, position, turn: p.angle });
  }

  return {
    update(players: PetView[], t: number, dt: number, comfort: boolean) {
      if (disposed) return;
      const seen = new Set<string>();
      const missing: PetView[] = [];
      let count = 0;
      for (const p of players) {
        const species = p.pet;
        if (!species || !PET_BY_ID.has(species) || count++ >= 20) continue;
        seen.add(p.id);
        request(species);
        if (actors.get(p.id)?.species !== species) remove(p.id);
        if (!actors.has(p.id) && loaded.has(species)) {
          try { spawn(p.id, species, loaded.get(species)!, p); }
          catch (error) {
            console.warn("Pet renderer fallback:", species, error);
            failed.add(species);
          }
        }
        const a = actors.get(p.id);
        if (!a) { missing.push(p); continue; }
        const tx = p.position.x - Math.sin(p.angle) * 3 + Math.cos(p.angle) * 2.5;
        const tz = p.position.z - Math.cos(p.angle) * 3 - Math.sin(p.angle) * 2.5;
        const ty = p.position.y + 1.5 + (comfort ? 0 : Math.sin(t * 2.5 + count) * 0.22);
        if (a.position.distanceToSquared(new T.Vector3(tx, ty, tz)) > 900)
          a.position.set(tx, ty, tz); // teleport/correction: never stretch followers
        else {
          const k = 1 - Math.exp(-Math.min(dt, 0.1) * 7);
          a.position.lerp(new T.Vector3(tx, ty, tz), k);
        }
        a.group.position.copy(a.position);
        a.turn += Math.atan2(Math.sin(p.angle - a.turn), Math.cos(p.angle - a.turn)) *
          (1 - Math.exp(-Math.min(dt, 0.1) * 9));
        a.group.rotation.set(comfort ? 0 : Math.sin(t * 2 + count) * 0.04, a.turn, 0);
        a.decoration && (a.decoration.rotation.y = comfort ? 0 : t * 0.75);
        if (a.mixer && p.position.distanceToSquared(a.position) < 80 * 80)
          a.mixer.update(Math.min(dt, 0.06));
      }
      for (const id of actors.keys()) if (!seen.has(id)) remove(id);
      fallback.update(missing, t, dt, comfort);
    },
    dispose() {
      disposed = true;
      for (const id of actors.keys()) remove(id);
      fallback.dispose();
      loaded.clear();
      loading.clear();
      failed.clear();
    },
  };
}
