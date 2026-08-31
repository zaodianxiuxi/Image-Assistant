import assert from "node:assert/strict";
import test from "node:test";
import { ImageRequestError, isRetryableImageError, retryPoetryImageRequest } from "./poetry-image-retry.mjs";

test("retries temporary image errors and reports every retry", async () => {
  const retries = [];
  const delays = [];
  let attempts = 0;
  const result = await retryPoetryImageRequest(async () => {
    attempts += 1;
    if (attempts < 3) throw new ImageRequestError(503, "服务暂时繁忙");
    return "generated";
  }, {
    baseDelayMs: 10,
    sleep: async (delayMs) => delays.push(delayMs),
    onRetry: (retry) => retries.push(retry.nextAttempt)
  });

  assert.equal(result, "generated");
  assert.equal(attempts, 3);
  assert.deepEqual(retries, [2, 3]);
  assert.deepEqual(delays, [10, 20]);
});

test("does not retry permanent image errors", async () => {
  let attempts = 0;
  await assert.rejects(() => retryPoetryImageRequest(async () => {
    attempts += 1;
    throw new ImageRequestError(400, "提示词无效");
  }, { sleep: async () => {} }), /提示词无效/);
  assert.equal(attempts, 1);
  assert.equal(isRetryableImageError(new ImageRequestError(429, "限流")), true);
  assert.equal(isRetryableImageError(new ImageRequestError(401, "密钥无效")), false);
});
