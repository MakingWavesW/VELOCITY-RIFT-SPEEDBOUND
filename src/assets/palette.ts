import * as T from "three";
type Pixels = { data: Uint8ClampedArray; width: number; height: number };
const images = new WeakMap<object, Pixels>();
/** Kenney palette textures use constant-color triangles. Bake only verified flat
 * triangles; retain the original texture whenever interpolation/detail is needed. */
export function bakePalette(
  geometry: T.BufferGeometry,
  map: T.Texture,
): boolean {
  const uv = geometry.getAttribute("uv");
  if (!uv || map.channel !== 0 || !map.image || geometry.hasAttribute("color"))
    return false;
  let pixels = images.get(map.image);
  if (!pixels) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = map.image.width;
      canvas.height = map.image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(map.image, 0, 0);
      pixels = {
        data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
      };
      images.set(map.image, pixels);
    } catch {
      return false;
    }
  }
  const pixelCoords = new Int32Array(uv.count * 2);
  const colors = new Float32Array(uv.count * 3),
    raw = new Uint8Array(uv.count * 3),
    point = new T.Vector2(),
    color = new T.Color();
  map.updateMatrix();
  for (let i = 0; i < uv.count; i++) {
    point.set(uv.getX(i), uv.getY(i));
    map.transformUv(point);
    const x = Math.min(
        pixels.width - 1,
        Math.max(0, Math.floor(point.x * pixels.width)),
      ),
      y = Math.min(
        pixels.height - 1,
        Math.max(0, Math.floor(point.y * pixels.height)),
      ),
      offset = (y * pixels.width + x) * 4;
    pixelCoords[i * 2] = x;
    pixelCoords[i * 2 + 1] = y;
    if (pixels.data[offset + 3] !== 255) return false;
    raw.set(pixels.data.subarray(offset, offset + 3), i * 3);
    color.setRGB(
      raw[i * 3] / 255,
      raw[i * 3 + 1] / 255,
      raw[i * 3 + 2] / 255,
      map.colorSpace === T.SRGBColorSpace
        ? T.SRGBColorSpace
        : T.LinearSRGBColorSpace,
    );
    color.toArray(colors, i * 3);
  }
  const checked = new Set<string>();
  const count = geometry.index?.count || uv.count;
  for (let i = 0; i < count; i += 3) {
    const a = geometry.index?.getX(i) ?? i,
      b = geometry.index?.getX(i + 1) ?? i + 1,
      c = geometry.index?.getX(i + 2) ?? i + 2;
    const left = Math.min(
        pixelCoords[a * 2],
        pixelCoords[b * 2],
        pixelCoords[c * 2],
      ),
      right = Math.max(
        pixelCoords[a * 2],
        pixelCoords[b * 2],
        pixelCoords[c * 2],
      ),
      top = Math.min(
        pixelCoords[a * 2 + 1],
        pixelCoords[b * 2 + 1],
        pixelCoords[c * 2 + 1],
      ),
      bottom = Math.max(
        pixelCoords[a * 2 + 1],
        pixelCoords[b * 2 + 1],
        pixelCoords[c * 2 + 1],
      );
    const region = [
      left,
      top,
      right,
      bottom,
      raw[a * 3],
      raw[a * 3 + 1],
      raw[a * 3 + 2],
    ].join(",");
    if (!checked.has(region)) {
      // A uniform enclosing rectangle is stronger than sampling corners: no hidden texture detail can be lost.
      for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++) {
          const at = (y * pixels.width + x) * 4;
          if (pixels.data[at + 3] !== 255) return false;
          for (let k = 0; k < 3; k++)
            if (Math.abs(pixels.data[at + k] - raw[a * 3 + k]) > 2)
              return false;
        }
      checked.add(region);
    }
    for (let k = 0; k < 3; k++)
      if (
        Math.abs(raw[a * 3 + k] - raw[b * 3 + k]) > 2 ||
        Math.abs(raw[a * 3 + k] - raw[c * 3 + k]) > 2
      )
        return false;
  }
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  return true;
}

const textures = new WeakMap<object, Map<string, T.Texture>>();
/** Reuse the GPU palette when GLTFLoader has created equivalent textures for the same cached image. */
export function sharePaletteTexture(texture: T.Texture) {
  if (!texture.image) return texture;
  texture.updateMatrix();
  const key = [
    texture.colorSpace,
    texture.wrapS,
    texture.wrapT,
    texture.magFilter,
    texture.minFilter,
    texture.anisotropy,
    texture.flipY,
    texture.premultiplyAlpha,
    texture.channel,
    texture.mapping,
    ...texture.matrix.elements,
  ].join("/");
  let variants = textures.get(texture.image);
  if (!variants) {
    variants = new Map();
    textures.set(texture.image, variants);
  }
  const existing = variants.get(key);
  if (existing) return existing;
  variants.set(key, texture);
  return texture;
}
