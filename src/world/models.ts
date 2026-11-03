import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
export const cube = new T.BoxGeometry(1, 1, 1);
export const bevel = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
export const sphere = new T.IcosahedronGeometry(1, 1);
export const cylinder = new T.CylinderGeometry(1, 1, 1, 24);
export const cone = new T.ConeGeometry(1, 1, 6);
const materials = new Map<string, T.MeshStandardMaterial>();
export function material(color: number, glow = false) {
  const key = `${color}/${glow}`;
  if (!materials.has(key))
    materials.set(
      key,
      new T.MeshStandardMaterial({
        color,
        roughness: 0.7,
        metalness: glow ? 0.15 : 0,
        emissive: glow ? color : 0,
        emissiveIntensity: glow ? 0.7 : 0,
      }),
    );
  return materials.get(key)!;
}
/** Static props use one instanced draw per geometry/material per district chunk. */
export class Batch {
  private entries = new Map<
    string,
    { geo: T.BufferGeometry; mat: T.Material; matrices: T.Matrix4[] }
  >();
  add(
    geo: T.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    glow = false,
    rotation = 0,
  ) {
    const mat = material(color, glow);
    const chunk = `${Math.floor(x / 120)},${Math.floor(z / 120)}`;
    const key = geo.uuid + mat.uuid + chunk;
    let b = this.entries.get(key);
    if (!b) {
      b = { geo, mat, matrices: [] };
      this.entries.set(key, b);
    }
    const q = new T.Quaternion().setFromEuler(new T.Euler(0, rotation, 0));
    b.matrices.push(
      new T.Matrix4().compose(
        new T.Vector3(x, y, z),
        q,
        new T.Vector3(w, h, d),
      ),
    );
  }
  box(
    color: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    glow = false,
  ) {
    this.add(cube, color, x, y, z, w, h, d, glow);
  }
  finish(scene: T.Scene) {
    for (const { geo, mat, matrices } of this.entries.values()) {
      const mesh = new T.InstancedMesh(geo, mat, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.receiveShadow = true;
      mesh.castShadow = !(mat as T.MeshStandardMaterial).emissive.getHex();
      mesh.computeBoundingSphere();
      scene.add(mesh);
    }
    this.entries.clear();
  }
}
export function label(text: string, color = "#ffffff", width = 10) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#123551";
  ctx.beginPath();
  ctx.roundRect(2, 2, 508, 124, 28);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = "bold 40px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 78, 470);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ map: tex, depthWrite: false }),
  );
  sprite.scale.set(width, width / 4, 1);
  return sprite;
}
let glowTexture: T.CanvasTexture;
export function aura(color: number, size: number) {
  if (!glowTexture) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "#ffffffcc");
    g.addColorStop(0.2, "#ffffff66");
    g.addColorStop(1, "#ffffff00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glowTexture = new T.CanvasTexture(c);
  }
  const a = new T.Sprite(
    new T.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.55,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  );
  a.scale.setScalar(size);
  return a;
}
export function tree(b: Batch, x: number, z: number, style: number, scale = 1) {
  const pink = style === 2;
  const color = pink ? 0xf39fc4 : style === 4 ? 0x75dedd : 0x45ad78;
  b.box(0x93674d, x, 3 * scale, z, 1.5 * scale, 6 * scale, 1.5 * scale);
  if (style === 3) {
    for (let i = 0; i < 3; i++)
      b.add(
        cone,
        0x398c79,
        x,
        (6 + i * 2) * scale,
        z,
        (4 - i * 0.7) * scale,
        5 * scale,
        (4 - i * 0.7) * scale,
      );
  } else if (style === 1 || style === 2) {
    b.add(sphere, color, x, 7 * scale, z, 4 * scale, 4 * scale, 4 * scale);
    b.add(
      sphere,
      color,
      x + 2 * scale,
      6 * scale,
      z,
      3 * scale,
      3 * scale,
      3 * scale,
    );
  } else {
    b.add(bevel, color, x, 6 * scale, z, 7 * scale, 3 * scale, 6 * scale);
    b.add(
      bevel,
      pink ? 0xf8bbd5 : 0x65c58a,
      x,
      8 * scale,
      z,
      4 * scale,
      2.5 * scale,
      4 * scale,
    );
  }
}
export function crystal(b: Batch, x: number, z: number, size = 5) {
  for (let i = 0; i < 3; i++)
    b.add(
      sphere,
      [0x89e4f7, 0xa69bfd, 0xdca1fa][i],
      x + (i - 1) * size * 0.45,
      size * 0.6,
      z + i * 0.6,
      size * 0.45,
      size * (i === 1 ? 1.5 : 1),
      size * 0.45,
      true,
    );
}
export function bench(b: Batch, x: number, z: number) {
  b.box(0xa67955, x, 0.9, z, 5, 0.3, 1.5);
  b.box(0xc4996b, x, 1.8, z - 0.65, 5, 1, 0.25);
  for (const dx of [-1.8, 1.8]) b.box(0x295569, x + dx, 0.4, z, 0.3, 0.8, 1.2);
}
export function lamp(b: Batch, x: number, z: number) {
  b.box(0x32556b, x, 3, z, 0.28, 6, 0.28);
  b.add(bevel, 0x34556a, x, 6, z, 1.5, 0.3, 1.5);
  b.box(0xffe6a7, x, 5.6, z, 0.8, 0.7, 0.8, true);
}
