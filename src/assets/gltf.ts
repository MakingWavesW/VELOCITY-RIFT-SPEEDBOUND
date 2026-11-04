import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
// External texture files are cached as well as GLBs.
T.Cache.enabled = true;
const cache = new Map<string, Promise<GLTF>>();
export function disposeTree(root: T.Object3D) {
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
export function loadGLTF(url: string) {
  let promise = cache.get(url);
  if (!promise) {
    promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw Error(`GLB asset ${response.status}: ${url}`);
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

// Shared GPU resources live for the page; individual avatars own only skeletons and mixers.
addEventListener("pagehide", (event) => {
  if ((event as PageTransitionEvent).persisted) return;
  for (const promise of cache.values())
    void promise.then((g) => disposeTree(g.scene)).catch(() => {});
  cache.clear();
});
