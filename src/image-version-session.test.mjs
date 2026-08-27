import assert from "node:assert/strict";
import test from "node:test";
import { enrichSessionVersion, markSessionDelivery } from "./image-version-session.mjs";

const baseResult = { id: "db-10", src: "/generated-images/a.png", prompt: "原始提示词", kind: "generate", createdAt: new Date() };

test("creates a first session version without changing its prompt", () => {
  const version = enrichSessionVersion(baseResult);

  assert.equal(version.versionNumber, 1);
  assert.equal(version.parentVersionId, null);
  assert.match(version.versionGroupId, /^local-group-/);
  assert.match(version.versionId, /^local-version-/);
  assert.equal(version.isDelivery, false);
  assert.equal(version.prompt, baseResult.prompt);
});

test("creates a child version in the same group", () => {
  const first = enrichSessionVersion(baseResult);
  const second = enrichSessionVersion({ ...baseResult, id: "local-result-2", prompt: "修改后的提示词" }, first);

  assert.equal(second.versionGroupId, first.versionGroupId);
  assert.equal(second.parentVersionId, first.versionId);
  assert.equal(second.versionNumber, 2);
  assert.equal(second.prompt, "修改后的提示词");
});

test("marks only the selected version as the delivery version", () => {
  const first = enrichSessionVersion(baseResult);
  const second = enrichSessionVersion({ ...baseResult, id: "local-result-2" }, first);
  const delivered = markSessionDelivery([first, second], second.versionId);

  assert.equal(delivered.find((item) => item.versionId === first.versionId).isDelivery, false);
  assert.equal(delivered.find((item) => item.versionId === second.versionId).isDelivery, true);
});
