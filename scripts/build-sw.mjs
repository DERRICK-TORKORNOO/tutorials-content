import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name),
      ),
    )
  ).flat();
}
const chunks = (await walk(".next/static"))
  .filter((p) => /\.(js|css|woff2?|ttf)$/.test(p))
  .map((p) => "/" + p.replace(".next/", "_next/"));
const assets = (await walk("public"))
  .filter((p) => /\.(webp|woff2?|ttf|svg|png)$/.test(p))
  .map((p) => p.replace("public", ""));
const version = (await readFile(".next/BUILD_ID", "utf8")).trim();
await writeFile(
  "public/sw-assets.js",
  `self.__KUDI_BUILD=${JSON.stringify(version)};self.__KUDI_ASSETS=${JSON.stringify([...chunks, ...assets])};\n`,
);
console.log(
  `Offline shell: ${chunks.length} build files + ${assets.length} local assets.`,
);
