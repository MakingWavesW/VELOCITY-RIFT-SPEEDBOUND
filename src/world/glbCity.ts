import { sharePaletteTexture } from "../assets/palette";
import { bakePalette } from "../assets/palette";
import * as T from "three";
import { loadGLTF } from "../assets/gltf";
import { cityPlacements, type Placement } from "./cityLayout";
import { cube, sphere, material } from "./models";
type Quality = "low" | "medium" | "high";
type Part = {
  geometry: T.BufferGeometry;
  material: T.MeshLambertMaterial;
  lowMaterial: T.MeshBasicMaterial;
  mesh: T.InstancedMesh;
};
type Asset = {
  parts: Part[];
  placements: Placement[];
  matrices: T.Matrix4[];
  colors: T.Color[];
};
export function createGLBCity(scene: T.Scene) {
  const root = new T.Group();
  root.name = "GLB Main City";
  scene.add(root);
  const assets = new Map<string, Asset>(),
    failed = new Set<string>(),
    loading = new Set<string>();
  const byModel = new Map<string, Placement[]>();
  cityPlacements.forEach((p) => {
    const list = byModel.get(p.model) || [];
    list.push(p);
    byModel.set(p.model, list);
  });
  const time = { value: 0 },
    wind = { value: 1 },
    night = { value: 0 };
  const fallback = cityPlacements
    .filter(
      (p) =>
        p.role === "building" ||
        (p.origin && p.model.includes("tree")) ||
        (p.origin && p.role === "prop") ||
        p.model.includes("fence-low"),
    )
    .map((p) => {
      const tree = p.model.includes("tree"),
        pole = p.role === "prop" && !p.model.includes("fence");
      const body = new T.Matrix4().compose(
        new T.Vector3(p.x, p.y + p.h / 2, p.z),
        new T.Quaternion().setFromEuler(new T.Euler(0, p.rotation || 0, 0)),
        new T.Vector3(
          tree ? 0.9 : pole ? 0.55 : p.w,
          p.h,
          tree ? 0.9 : pole ? 0.55 : p.d,
        ),
      );
      const crown = tree
        ? new T.Matrix4().compose(
            new T.Vector3(p.x, p.y + p.h * 0.78, p.z),
            new T.Quaternion(),
            new T.Vector3(p.w * 0.5, p.h * 0.28, p.d * 0.5),
          )
        : undefined;
      return {
        p,
        body,
        crown,
        color: new T.Color(
          tree ? 0x976a48 : pole ? 0x42657a : p.color || 0x97b9d7,
        ),
      };
    });
  for (const p of cityPlacements.filter((p) =>
    p.model.startsWith("nature/bridge"),
  )) {
    for (const [dx, w, h] of [
      [0, p.w, 0.23],
      [-p.w / 2 + 0.25, 0.5, p.h],
      [p.w / 2 - 0.25, 0.5, p.h],
    ]) {
      fallback.push({
        p,
        body: new T.Matrix4().compose(
          new T.Vector3(p.x + dx, h / 2, p.z),
          new T.Quaternion(),
          new T.Vector3(w, h, p.d),
        ),
        crown: undefined,
        color: new T.Color(0xaa9475),
      });
    }
  }
  const fallbackBodies = new T.InstancedMesh(
      cube,
      material(0xffffff),
      fallback.length,
    ),
    fallbackCrowns = new T.InstancedMesh(
      sphere,
      material(0x43a972),
      fallback.length,
    );
  for (const mesh of [fallbackBodies, fallbackCrowns]) {
    mesh.count = 0;
    mesh.castShadow = true;
    root.add(mesh);
  }
  let quality: Quality = "high",
    comfort = false,
    x = 0,
    z = 0,
    dirty = true,
    disposed = false,
    visibleInstances = 0;
  const position = new T.Vector3(),
    rotation = new T.Quaternion(),
    scale = new T.Vector3();
  function range(p: Placement) {
    return p.role === "road"
      ? quality === "low"
        ? 240
        : 520
      : p.role === "building"
        ? quality === "low"
          ? 120
          : quality === "medium"
            ? 160
            : 220
        : quality === "low"
          ? 105
          : quality === "medium"
            ? 180
            : 290;
  }
  function visible(p: Placement) {
    return (
      !(quality === "low" && p.tier) && Math.hypot(p.x - x, p.z - z) < range(p)
    );
  }
  function decorateMaterial(
    source: T.MeshStandardMaterial,
    plant: boolean,
    building: boolean,
    lamp: boolean,
    baked: boolean,
  ) {
    // Stylized palette meshes need diffuse lighting, not per-fragment PBR evaluation.
    const m = new T.MeshLambertMaterial({
      color: source.color,
      map: source.map,
      vertexColors: source.vertexColors,
      emissive: source.emissive,
      emissiveMap: source.emissiveMap,
      emissiveIntensity: source.emissiveIntensity,
      normalMap: source.normalMap,
      normalScale: source.normalScale,
      transparent: source.transparent,
      opacity: source.opacity,
      alphaTest: source.alphaTest,
      alphaMap: source.alphaMap,
      side: source.side,
      depthWrite: source.depthWrite,
    });
    m.name = source.name;
    if (m.map) m.map = sharePaletteTexture(m.map);
    if (baked) {
      m.map = null;
      m.vertexColors = true;
    }
    if (/leafsGreen/i.test(m.name)) m.color.setHex(0x35ca82);
    if (/woodBark/i.test(m.name)) m.color.setHex(0x976a48);
    m.onBeforeCompile = (shader) => {
      shader.uniforms.cityTime = time;
      shader.uniforms.cityWind = wind;
      shader.uniforms.cityNight = night;
      shader.vertexShader =
        "uniform float cityTime; uniform float cityWind;\n" +
        (baked ? "varying vec3 cityPalette;\n" : "") +
        shader.vertexShader;
      if (baked)
        shader.vertexShader = shader.vertexShader.replace(
          "#include <color_vertex>",
          "#include <color_vertex>\ncityPalette = color;",
        );
      if (plant)
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\ntransformed.x += sin(cityTime * 0.7 + instanceMatrix[3].x * 0.17 + instanceMatrix[3].z * 0.09) * pow(max(0.0, position.y), 2.0) * 0.018 * cityWind;`,
        );
      if (building || lamp) {
        shader.fragmentShader =
          "uniform float cityNight;\n" +
          (baked ? "varying vec3 cityPalette;\n" : "") +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>\n${baked ? "vec3 cityTex = cityPalette;" : "#ifdef USE_MAP\n vec3 cityTex = sampledDiffuseColor.rgb;"}\n float pane = step(cityTex.r * 1.12, cityTex.b) * step(0.32, cityTex.b);\n totalEmissiveRadiance += vec3(0.42,0.55,0.7) * pane * cityNight * 0.9;
 ${lamp ? "float bulb=step(.65,cityTex.r)*step(.55,cityTex.g)*(1.0-step(.7,cityTex.b));totalEmissiveRadiance += vec3(1.0,.8,.35)*bulb*(.4+cityNight*1.4);" : ""}\n${baked ? "" : "#endif"}`,
        );
      }
    };
    m.customProgramCacheKey = () =>
      `city2-${plant}-${building}-${lamp}-${baked}`;
    return m;
  }
  function lowMaterial(full: T.MeshLambertMaterial, model: string) {
    const m = new T.MeshBasicMaterial({
      color: full.color,
      map: full.map,
      vertexColors: full.vertexColors,
      side: full.side,
      transparent: full.transparent,
      opacity: full.opacity,
      alphaTest: full.alphaTest,
    });
    const illuminated = model.includes("building") || model.includes("light");
    m.onBeforeCompile = (shader, renderer) => {
      full.onBeforeCompile(shader, renderer);
      shader.uniforms.cityNight = night;
      shader.vertexShader = "varying float cityShade;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ncityShade=.75+.25*max(0.0,dot(normalize(normal),normalize(vec3(.5,1.0,.6))));",
      );
      shader.fragmentShader =
        "varying float cityShade;\n" +
        (!illuminated ? "uniform float cityNight;\n" : "") +
        shader.fragmentShader;
      const glow = illuminated
        ? `#ifdef USE_MAP\nvec3 lowPane=sampledDiffuseColor.rgb;outgoingLight+=vec3(.25,.35,.5)*step(lowPane.r*1.12,lowPane.b)*step(.32,lowPane.b)*cityNight;\n#endif\n`
        : "";
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "outgoingLight *= cityShade*(1.1-cityNight*.55);\n" +
          glow +
          "#include <opaque_fragment>",
      );
    };
    m.customProgramCacheKey = () => full.customProgramCacheKey() + "-low";
    return m;
  }
  async function build(model: string) {
    loading.add(model);
    const staged: Part[] = [];
    try {
      const gltf = await loadGLTF("/models/" + model);
      if (disposed) return;
      const source = gltf.scene;
      source.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(source),
        size = bounds.getSize(new T.Vector3());
      if (size.x < 0.001 || size.y < 0.001 || size.z < 0.001)
        throw Error("Invalid world GLB bounds " + model);
      const placements = byModel.get(model)!;
      const parts = staged;
      const materialCache = new Map<string, T.MeshLambertMaterial>();
      const cheapCache = new Map<T.MeshLambertMaterial, T.MeshBasicMaterial>();
      source.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        if (o instanceof T.SkinnedMesh)
          throw Error("World mesh must be static");
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        // GLTFLoader splits source primitives into meshes; preserve groups if supplied.
        for (
          let materialIndex = 0;
          materialIndex < materials.length;
          materialIndex++
        ) {
          const original = materials[materialIndex] as T.MeshStandardMaterial;
          const geometry: T.BufferGeometry = o.geometry
            .clone()
            .applyMatrix4(o.matrixWorld);
          const baked = !!original.map && bakePalette(geometry, original.map);
          const materialKey = original.uuid + "/" + baked;
          let mat = materialCache.get(materialKey);
          if (!mat) {
            mat = decorateMaterial(
              original,
              model.startsWith("nature/") &&
                !model.includes("rock") &&
                !model.includes("bridge"),
              model.includes("building"),
              model.includes("light"),
              baked,
            );
            materialCache.set(materialKey, mat);
          }
          geometry.translate(
            -(bounds.min.x + size.x / 2),
            -bounds.min.y,
            -(bounds.min.z + size.z / 2),
          );
          geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
          if (materials.length > 1) {
            const groups = geometry.groups.filter(
              (g) => g.materialIndex === materialIndex,
            );
            geometry.clearGroups();
            for (const g of groups) geometry.addGroup(g.start, g.count, 0);
          }
          let cheap = cheapCache.get(mat);
          if (!cheap) {
            cheap = lowMaterial(mat, model);
            cheapCache.set(mat, cheap);
          }
          const mesh = new T.InstancedMesh(
            geometry,
            quality === "low" ? cheap : mat,
            placements.length,
          );
          mesh.count = 0;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
          root.add(mesh);
          parts.push({ geometry, material: mat, lowMaterial: cheap, mesh });
        }
      });
      const matrices = placements.map((p) => {
        rotation.setFromAxisAngle(T.Object3D.DEFAULT_UP, p.rotation || 0);
        position.set(p.x, p.y, p.z);
        if (p.origin) {
          const offset = new T.Vector3(
            ((bounds.min.x + size.x / 2) * p.w) / size.x,
            0,
            ((bounds.min.z + size.z / 2) * p.d) / size.z,
          ).applyQuaternion(rotation);
          position.add(offset);
        }
        return new T.Matrix4().compose(
          position,
          rotation,
          scale.set(p.w, p.h, p.d),
        );
      });
      assets.set(model, {
        parts,
        placements,
        matrices,
        colors: placements.map((p) => new T.Color(p.color || 0xffffff)),
      });
      dirty = true;
    } catch (e) {
      for (const p of staged) {
        p.mesh.removeFromParent();
        p.mesh.dispose();
        p.geometry.dispose();
        p.material.dispose();
        p.lowMaterial.dispose();
      }
      failed.add(model);
      console.warn("City GLB unavailable; retaining fallback:", model, e);
    } finally {
      loading.delete(model);
      pump();
    }
  }
  function pump() {
    if (disposed) return;
    const queue = [...byModel].filter(
      ([model, ps]) =>
        !assets.has(model) &&
        !failed.has(model) &&
        !loading.has(model) &&
        ps.some(visible),
    );
    queue.sort((a, b) => priority(a[1]) - priority(b[1]));
    for (const [model] of queue) {
      if (loading.size >= 3) break;
      void build(model);
    }
  }
  function priority(ps: Placement[]) {
    return Math.min(
      ...ps.map(
        (p) => Math.hypot(p.x - x, p.z - z) + (p.role === "plant" ? 80 : 0),
      ),
    );
  }
  function refresh() {
    visibleInstances = 0;
    for (const [model, asset] of assets) {
      let count = 0;
      asset.placements.forEach((p, i) => {
        if (!visible(p)) return;
        for (const part of asset.parts) {
          part.mesh.setMatrixAt(count, asset.matrices[i]);
          part.mesh.setColorAt(count, asset.colors[i]);
        }
        count++;
      });
      for (const part of asset.parts) {
        part.mesh.material =
          quality === "low" ? part.lowMaterial : part.material;
        part.mesh.count = count;
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
        part.mesh.computeBoundingSphere();
      }
      visibleInstances += count;
    }
    let bodies = 0,
      crowns = 0;
    for (const item of fallback) {
      if (assets.has(item.p.model) && visible(item.p)) continue;
      fallbackBodies.setMatrixAt(bodies, item.body);
      fallbackBodies.setColorAt(bodies, item.color);
      bodies++;
      if (item.crown) fallbackCrowns.setMatrixAt(crowns++, item.crown);
    }
    fallbackBodies.count = bodies;
    fallbackCrowns.count = crowns;
    for (const mesh of [fallbackBodies, fallbackCrowns]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    dirty = false;
    pump();
  }
  return {
    setQuality(q: Quality, reduced: boolean) {
      quality = q;
      comfort = reduced;
      wind.value = comfort ? 0 : q === "low" ? 0.45 : 1;
      dirty = true;
    },
    update(t: number, dt: number, px: number, pz: number, n: number) {
      time.value = comfort ? 0 : t;
      night.value = n;
      const moved = Math.hypot(px - x, pz - z) > 12;
      if (moved) {
        x = px;
        z = pz;
        dirty = true;
      }
      if (dirty) refresh();
    },
    get diagnostics() {
      return {
        loaded: assets.size,
        failed: [...failed],
        pending: loading.size,
        visibleInstances,
        selected: byModel.size,
        quality,
        sourceModels: 656,
        paletteParts: [...assets.values()].reduce(
          (n, a) =>
            n +
            a.parts.filter((p) => p.material.vertexColors && !p.material.map)
              .length,
          0,
        ),
      };
    },
    dispose() {
      disposed = true;
      const materials = new Set<T.Material>();
      for (const asset of assets.values())
        for (const part of asset.parts) {
          part.mesh.dispose();
          part.geometry.dispose();
          materials.add(part.material);
          materials.add(part.lowMaterial);
        }
      materials.forEach((m) => m.dispose());
      fallbackBodies.dispose();
      fallbackCrowns.dispose();
      root.removeFromParent();
    },
  };
}
