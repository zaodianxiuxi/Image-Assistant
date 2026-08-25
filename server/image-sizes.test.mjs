import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedImageSize } from "./image-sizes.mjs";

test("accepts the three supported output sizes", () => {
  assert.equal(isSupportedImageSize("1024x1024"), true);
  assert.equal(isSupportedImageSize("1536x864"), true);
  assert.equal(isSupportedImageSize("864x1536"), true);
});

test("rejects an unsupported output size", () => {
  assert.equal(isSupportedImageSize("1920x1080"), false);
});
