import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Route types are generated per branch. Clear stale ones before generating them again.
export async function cleanBuild(root = process.cwd(), typesOnly = false) {
  const generated = typesOnly
    ? [".next/dev/types", ".next/types", "tsconfig.tsbuildinfo"]
    : [".next", "out", "tsconfig.tsbuildinfo"];
  await Promise.all(
    generated.map((name) =>
      rm(path.join(root, name), { recursive: true, force: true }),
    ),
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await cleanBuild(process.cwd(), process.argv.includes("--types"));
  console.log("Cleared generated build files.");
}
