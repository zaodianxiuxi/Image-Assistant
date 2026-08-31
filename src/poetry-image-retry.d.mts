export class ImageRequestError extends Error {
  status: number;
  constructor(status: number, message: string);
}

export type ImageRetryInfo = {
  attempt: number;
  nextAttempt: number;
  maxAttempts: number;
  delayMs: number;
  error: Error;
};

export function isRetryableImageError(error: unknown): boolean;

export function retryPoetryImageRequest<T>(
  operation: (attempt: number) => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    sleep?: (delayMs: number) => Promise<unknown>;
    onRetry?: (retry: ImageRetryInfo) => void;
  }
): Promise<T>;
