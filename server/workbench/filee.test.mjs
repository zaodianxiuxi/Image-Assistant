import test from "node:test";
import assert from "node:assert/strict";
import { parseTargets, parseConversion, containedPath } from "./filee.mjs";
test("capabilities only include installed conversion routes", () => {
  assert.deepEqual(
    parseTargets(
      "PNG (.png) converts to:\n  jpg, webp, pdf\nWith optional engines (install them in Filee, Settings → Engines):\n  avif, heic",
    ),
    ["jpg", "webp", "pdf"],
  );
  assert.deepEqual(
    parseTargets(
      "PDF (.pdf) converts to:\n  (nothing with the engines installed now)\nWith optional engines:\n  docx",
    ),
    [],
  );
});
test("converter preserves warnings and rejects unsuccessful reports", () => {
  const result = parseConversion(
    JSON.stringify({
      failed: 0,
      files: [
        {
          state: "done",
          outputs: ["/out/a.png"],
          notice: "Layout may differ",
          missingFonts: ["Test Font"],
        },
      ],
    }),
  );
  assert.deepEqual(result.outputs, ["/out/a.png"]);
  assert.match(result.warning, /Test Font/);
  assert.throws(
    () =>
      parseConversion(
        JSON.stringify({
          failed: 1,
          files: [{ state: "failed", error: "engine missing" }],
        }),
      ),
    /engine missing/,
  );
});
test("output paths cannot escape their task directory", () => {
  assert.ok(containedPath("/tmp/work-job", "/tmp/work-job/out.png"));
  assert.throws(() =>
    containedPath("/tmp/work-job", "/tmp/work-job-other/out.png"),
  );
  assert.throws(() => containedPath("/tmp/work-job", "/tmp/secrets.txt"));
});
