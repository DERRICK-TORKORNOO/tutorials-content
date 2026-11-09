import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  access,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cleanBuild } from "../scripts/clean-build.mjs";
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "kudi-clean-"));
  for (const file of [
    ".next/dev/types/stale.ts",
    ".next/types/stale.ts",
    ".next/cache/build",
    "out/index.html",
    "tsconfig.tsbuildinfo",
    ".env.local",
    "src/page.tsx",
    "public/data/products.json",
  ]) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), "keep-private-fixture");
  }
  return root;
}
async function missing(file) {
  await assert.rejects(access(file), { code: "ENOENT" });
}
test("build cleanup removes stale generated routes without touching source or local configuration", async () => {
  const root = await fixture();
  try {
    await cleanBuild(root);
    await missing(path.join(root, ".next"));
    await missing(path.join(root, "out"));
    for (const file of [
      ".env.local",
      "src/page.tsx",
      "public/data/products.json",
    ])
      assert.equal(
        await readFile(path.join(root, file), "utf8"),
        "keep-private-fixture",
      );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("type-check cleanup preserves existing exported pages and build caches", async () => {
  const root = await fixture();
  try {
    await cleanBuild(root, true);
    await missing(path.join(root, ".next/dev/types"));
    await missing(path.join(root, ".next/types"));
    assert.equal(
      await readFile(path.join(root, "out/index.html"), "utf8"),
      "keep-private-fixture",
    );
    await access(path.join(root, ".next/cache/build"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
