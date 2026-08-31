export class ImageRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ImageRequestError";
    this.status = status;
  }
}

export function isRetryableImageError(error) {
  const status = Number(error?.status);
  return status === 408 || status === 425 || status === 429 || status === 502 || status === 503 || status === 504;
}

export async function retryPoetryImageRequest(operation, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || 3);
  const baseDelayMs = Math.max(0, Number(options.baseDelayMs) || 1000);
  const sleep = options.sleep || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const onRetry = options.onRetry || (() => {});

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableImageError(error)) throw error;
      const delayMs = baseDelayMs * (2 ** (attempt - 1));
      onRetry({ attempt, nextAttempt: attempt + 1, maxAttempts, delayMs, error });
      await sleep(delayMs);
    }
  }
  throw new Error("图片生成重试失败。");
}
