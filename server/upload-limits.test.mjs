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
