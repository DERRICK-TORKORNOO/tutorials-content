import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
async function walk(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((item) =>
        item.isDirectory()
          ? walk(path.join(dir, item.name))
          : path.join(dir, item.name),
      ),
    )
  ).flat();
}
const files = (await walk("out")).filter(
  (file) =>
    !file.endsWith("/sw.js") &&
    !file.endsWith("/sw-assets.js") &&
    !/\.(md|map)$/.test(file),
);
const urls = files.map((file) => file.slice(3).replace(/\/index\.html$/, "/"));
const hash = createHash("sha256");
for (const file of files) {
  hash.update(file);
  hash.update(await readFile(file));
}
await writeFile(
  "out/sw-assets.js",
  `self.__KUDI_BUILD=${JSON.stringify(hash.digest("hex").slice(0, 16))};self.__KUDI_ASSETS=${JSON.stringify(urls)};\n`,
);
console.log(
  `Offline shop: ${urls.filter((url) => url.endsWith("/")).length} pages + ${urls.filter((url) => !url.endsWith("/")).length} data/static files. All catalog pages included.`,
);
