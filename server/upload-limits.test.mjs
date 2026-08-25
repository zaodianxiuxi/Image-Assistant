import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MAX_UPLOAD_BYTES, hasUploadSizeWithinLimit } from "./upload-limits.mjs";

test("accepts uploads exactly at the 50 MB total limit", () => {
  assert.equal(hasUploadSizeWithinLimit([{ size: MAX_UPLOAD_BYTES }]), true);
});

test("rejects uploads larger than the 50 MB total limit", () => {
  assert.equal(hasUploadSizeWithinLimit([{ size: MAX_UPLOAD_BYTES + 1 }]), false);
});

test("frontend exposes a ten-image reference limit", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /const MAX_REFERENCE_IMAGES = 10;/);
});

test("frontend exposes common output ratios for every creation mode", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /value: "1536x864", name: "电脑横屏", detail: "16:9"/);
  assert.match(source, /value: "864x1536", name: "手机竖屏", detail: "9:16"/);
  assert.match(source, /form\.append\("size", size\)/);
  assert.doesNotMatch(source, /mode === "generate" && !referenceImages\.length/);
});
