import assert from "node:assert/strict";
import test from "node:test";
import { MAX_UPLOAD_BYTES, hasUploadSizeWithinLimit } from "./upload-limits.mjs";

test("accepts uploads exactly at the 50 MB total limit", () => {
  assert.equal(hasUploadSizeWithinLimit([{ size: MAX_UPLOAD_BYTES }]), true);
});

test("rejects uploads larger than the 50 MB total limit", () => {
  assert.equal(hasUploadSizeWithinLimit([{ size: MAX_UPLOAD_BYTES + 1 }]), false);
});
