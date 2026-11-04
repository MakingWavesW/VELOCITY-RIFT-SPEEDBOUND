import fs from "node:fs/promises";
import path from "node:path";
const manifest = JSON.parse(
  await fs.readFile("assets/runtime-models.json", "utf8"),
);
const source = path.resolve("assets/library/models"),
  target = path.resolve("public/models");
// These three folders are generated. The complete, immutable source library lives outside public/.
for (const folder of ["city", "nature", "platforms"])
  await fs.rm(path.join(target, folder), { recursive: true, force: true });
const files = new Set(Object.values(manifest).flat());
for (const file of [...files]) {
  const data = await fs.readFile(path.join(source, file));
  if (data.readUInt32LE(0) !== 0x46546c67) throw Error(`Invalid GLB: ${file}`);
  const json = JSON.parse(
    data.subarray(20, 20 + data.readUInt32LE(12)).toString(),
  );
  for (const resource of [...(json.images || []), ...(json.buffers || [])]) {
    if (!resource.uri || resource.uri.startsWith("data:")) continue;
    if (/^[a-z]+:/i.test(resource.uri))
      throw Error(`Remote asset dependency: ${file}`);
    const dependency = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), resource.uri),
    );
    if (dependency.startsWith("../")) throw Error("Asset outside library");
    files.add(dependency);
  }
}
let bytes = 0;
for (const file of files) {
  const output = path.join(target, file);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.copyFile(path.join(source, file), output);
  bytes += (await fs.stat(output)).size;
}
console.log(
  `Staged ${Object.values(manifest).flat().length} runtime GLBs plus dependencies (${bytes} bytes); source library excluded from public.`,
);
