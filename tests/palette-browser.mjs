import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const p = await b.newPage();
  await p.route("**/palette-fixture.html", (r) =>
    r.fulfill({ contentType: "text/html", body: "<body></body>" }),
  );
  await p.goto("http://localhost:5173/palette-fixture.html");
  const result = await p.evaluate(async () => {
    const T = await import("/node_modules/.vite/deps/three.js"),
      { bakePalette, sharePaletteTexture } =
        await import("/src/assets/palette.ts");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 3;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 3, 3);
    ctx.fillStyle = "black";
    ctx.fillRect(1, 1, 1, 1);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.flipY = false;
    function geometry(uv) {
      const g = new T.BufferGeometry();
      g.setAttribute(
        "position",
        new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
      );
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      return g;
    }
    const detailed = geometry([0.01, 0.01, 0.99, 0.01, 0.01, 0.99]),
      flat = geometry([0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
    const keptDetail =
        !bakePalette(detailed, map) && !detailed.hasAttribute("color"),
      bakedFlat =
        bakePalette(flat, map) && flat.getAttribute("color").getX(0) === 1;
    const other = map.clone();
    const shared = sharePaletteTexture(map) === sharePaletteTexture(other);
    other.wrapS = T.RepeatWrapping;
    const samplerPreserved = sharePaletteTexture(other) !== map;
    return { keptDetail, bakedFlat, shared, samplerPreserved };
  });
  assert.deepEqual(result, {
    keptDetail: true,
    bakedFlat: true,
    shared: true,
    samplerPreserved: true,
  });
  console.log(
    "Palette conversion preserves interior detail, bakes constant colors and shares only equivalent samplers",
  );
} finally {
  await b.close();
}
