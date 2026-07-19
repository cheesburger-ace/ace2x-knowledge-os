import { readFile, writeFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
manifest.version = pkg.version;
await writeFile("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

let versions = {};
try { versions = JSON.parse(await readFile("versions.json", "utf8")); } catch {}
versions[pkg.version] = manifest.minAppVersion;
await writeFile("versions.json", JSON.stringify(versions, null, 2) + "\n");
