import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
const base = "/models/hero/";
export const HERO_URLS = [
  base + "kaykit-adventurers/Ranger.glb",
  base + "kaykit-animations/rig-medium/Rig_Medium_MovementBasic.glb",
  base + "kaykit-animations/rig-medium/Rig_Medium_General.glb",
];
const cache = new Map<string, Promise<GLTF>>();
function disposeTree(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>(),
    skeletons = new Set<T.Skeleton>();
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        for (const v of Object.values(m))
          if (v instanceof T.Texture) textures.add(v);
      }
      if (o instanceof T.SkinnedMesh) skeletons.add(o.skeleton);
    }
  });
  geometries.forEach((v) => v.dispose());
  materials.forEach((v) => v.dispose());
  textures.forEach((v) => {
    v.dispose();
    const data = v.source.data;
    if (typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap)
      data.close();
  });
  skeletons.forEach((v) => v.dispose());
}
function load(url: string) {
  let promise = cache.get(url);
  if (!promise) {
    promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw Error(`Hero asset ${response.status}: ${url}`);
        return await new GLTFLoader().parseAsync(
          await response.arrayBuffer(),
          url.slice(0, url.lastIndexOf("/") + 1),
        );
      } finally {
        clearTimeout(timeout);
      }
    })();
    cache.set(url, promise);
  }
  return promise;
}
export const CLIPS = {
  idle: "Idle_A",
  walk: "Walking_A",
  jog: "Running_A",
  sprint: "Running_B",
  "high-speed": "Running_B",
  acceleration: "Running_B",
  braking: "Running_A",
  turning: "Running_B",
  takeoff: "Jump_Start",
  airborne: "Jump_Idle",
  landing: "Jump_Land",
} as const;
// Median planted-toe backward speed at the normalized 3.55-unit height.
// Playback consumes rendered displacement, including collision and interpolation.
const GAIT_SPEED: Record<string, number> = {
  Walking_A: 1.14,
  Running_A: 5.07,
  Running_B: 7.49,
};
let prepared:
  | Promise<{
      root: T.Group;
      clips: T.AnimationClip[];
      scale: number;
      floor: number;
    }>
  | undefined;
function prepare() {
  return (prepared ||= (async () => {
    const results = await Promise.allSettled(HERO_URLS.map(load));
    const failed = results.find((r) => r.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    const [hero, basic, general] = results.map(
      (r) => (r as PromiseFulfilledResult<GLTF>).value,
    );
    const wanted = new Set<string>(Object.values(CLIPS));
    const clips = [...basic.animations, ...general.animations]
      .filter((c) => wanted.has(c.name))
      .map((c) => c.clone());
    for (const name of wanted)
      if (!clips.some((c) => c.name === name))
        throw Error(`Missing hero clip: ${name}`);
    for (const clip of clips)
      for (const track of clip.tracks) {
        const binding = T.PropertyBinding.parseTrackName(track.name);
        if (!hero.scene.getObjectByName(binding.nodeName))
          throw Error(`Incompatible bone: ${binding.nodeName}`);
        if (binding.nodeName === "root" && binding.propertyName === "position")
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = 0;
            track.values[i + 2] = 0;
          }
      }
    hero.scene.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(hero.scene, true),
      height = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(height) || height < 0.1)
      throw Error("Invalid hero bounds");
    // Animation bundles contain preview geometry which is never rendered or retained on the GPU.
    disposeTree(basic.scene);
    disposeTree(general.scene);
    return {
      root: hero.scene,
      clips,
      scale: 3.55 / height,
      floor: bounds.min.y,
    };
  })());
}
export async function createHero() {
  const asset = await prepare();
  const model = clone(asset.root) as T.Group,
    container = new T.Group();
  container.add(model);
  model.scale.setScalar(asset.scale);
  model.position.y = -asset.floor * asset.scale;
  // SkeletonUtils clones per mesh. Meshes using the same skin can share a
  // palette inside this avatar, while every avatar still owns its own bones.
  const palettes = new Map<T.Matrix4[], T.Skeleton>();
  model.traverse((o) => {
    if (o instanceof T.SkinnedMesh) {
      const existing = palettes.get(o.skeleton.boneInverses);
      if (
        existing &&
        existing.bones.length === o.skeleton.bones.length &&
        existing.bones.every((b, i) => b === o.skeleton.bones[i])
      ) {
        o.skeleton.dispose();
        o.skeleton = existing;
      } else palettes.set(o.skeleton.boneInverses, o.skeleton);
    }
    if (o instanceof T.Mesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false;
    }
  });
  const mixer = new T.AnimationMixer(model),
    actions = new Map(asset.clips.map((c) => [c.name, mixer.clipAction(c)]));
  let current: T.AnimationAction | undefined,
    clipName = "",
    accumulated = 0,
    waveRemaining = 0;
  const waveArm = model.getObjectByName("upperarmr")!;
  const armPose = new T.Quaternion(),
    wavePose = new T.Quaternion(),
    parentRotation = new T.Quaternion(),
    modelRotation = new T.Quaternion(),
    waveDirection = new T.Vector3(),
    boneAxis = new T.Vector3(0, 1, 0);
  let armOverridden = false;
  return {
    container,
    model,
    mixer,
    get clip() {
      return clipName;
    },
    update(
      state: keyof typeof CLIPS,
      velocity: number,
      dt: number,
      interval = 0,
    ) {
      accumulated += dt;
      if (accumulated < interval) return;
      const step = accumulated;
      accumulated = 0;
      const next = actions.get(CLIPS[state])!;
      if (current !== next) {
        const locomotionClips = ["Walking_A", "Running_A", "Running_B"];
        const phase =
          current &&
          locomotionClips.includes(current.getClip().name) &&
          locomotionClips.includes(next.getClip().name)
            ? current.time / current.getClip().duration
            : 0;
        next.reset().setEffectiveWeight(1).play();
        next.time = phase * next.getClip().duration;
        if (current) current.crossFadeTo(next, 0.16, false);
        current = next;
        clipName = next.getClip().name;
        const once = state === "takeoff" || state === "landing";
        next.setLoop(once ? T.LoopOnce : T.LoopRepeat, Infinity);
        next.clampWhenFinished = once;
      }
      const locomotion = [
        "walk",
        "jog",
        "sprint",
        "high-speed",
        "acceleration",
        "braking",
        "turning",
      ].includes(state);
      next.setEffectiveTimeScale(
        locomotion
          ? Math.max(0.1, velocity / (GAIT_SPEED[next.getClip().name] || 7.49))
          : 1,
      );
      // Restore the mixer pose before applying the temporary greeting overlay.
      if (armOverridden) waveArm.quaternion.copy(armPose);
      mixer.update(Math.min(step, 0.25));
      armOverridden = waveRemaining > 0;
      if (armOverridden) {
        armPose.copy(waveArm.quaternion);
        const weight = Math.min(
          1,
          waveRemaining / 0.2,
          (2 - waveRemaining) / 0.2,
        );
        model.updateWorldMatrix(true, true);
        waveArm.parent!.getWorldQuaternion(parentRotation).invert();
        model.getWorldQuaternion(modelRotation);
        waveDirection
          .set(-0.4 + Math.sin(waveRemaining * 15) * 0.18, 1, 0.1)
          .normalize()
          .applyQuaternion(modelRotation)
          .applyQuaternion(parentRotation);
        wavePose.setFromUnitVectors(boneAxis, waveDirection);
        waveArm.quaternion.slerp(wavePose, Math.max(0, weight));
        waveRemaining = Math.max(0, waveRemaining - step);
      }
    },
    wave() {
      waveRemaining = 2;
    },
    reset() {
      mixer.stopAllAction();
      if (armOverridden) waveArm.quaternion.copy(armPose);
      armOverridden = false;
      waveRemaining = 0;
      current = undefined;
      accumulated = 0;
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      const skeletons = new Set<T.Skeleton>();
      model.traverse((o) => {
        if (o instanceof T.SkinnedMesh) skeletons.add(o.skeleton);
      });
      skeletons.forEach((s) => s.dispose());
      container.removeFromParent();
    },
  };
}
// Shared GPU resources live for the page; individual avatars own only skeletons and mixers.
addEventListener("pagehide", (event) => {
  if ((event as PageTransitionEvent).persisted) return;
  for (const promise of cache.values())
    void promise.then((g) => disposeTree(g.scene)).catch(() => {});
  cache.clear();
  prepared = undefined;
});
