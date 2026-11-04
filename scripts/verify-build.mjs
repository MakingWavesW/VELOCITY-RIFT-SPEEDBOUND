import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const manifest = JSON.parse(
  await fs.readFile("assets/runtime-models.json", "utf8"),
);
const expected = Object.values(manifest)
  .flat()
  .map((p) => "models/" + p)
  .sort();
async function walk(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(p)));
    else result.push(p);
  }
  return result;
}
const files = await walk("dist");
const glbs = files
  .filter((p) => p.endsWith(".glb"))
  .map((p) => path.relative("dist", p).split(path.sep).join("/"))
  .sort();
assert.deepEqual(
  glbs,
  expected,
  "Distribution must contain exactly the runtime GLB manifest",
);
for (const p of glbs) {
  const data = await fs.readFile(path.join("dist", p)),
    source = await fs.readFile(path.join("assets/library", p));
  assert.ok(data.equals(source), p);
  const json = JSON.parse(
    data.subarray(20, 20 + data.readUInt32LE(12)).toString(),
  );
  for (const item of [...(json.images || []), ...(json.buffers || [])])
    if (item.uri && !item.uri.startsWith("data:"))
      await fs.access(path.join("dist", path.dirname(p), item.uri));
}
let totalBytes = 0,
  glbBytes = 0;
for (const p of files) {
  const size = (await fs.stat(p)).size;
  totalBytes += size;
  if (p.endsWith(".glb")) glbBytes += size;
}
console.log(
  JSON.stringify({
    runtimeGLBs: glbs.length,
    glbBytes,
    distributionBytes: totalBytes,
    sourceArchiveExcluded: !files.some((p) => p.includes("library")),
  }),
);
