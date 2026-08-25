export const DEFAULT_IMAGE_SIZE = "1024x1024";
export const IMAGE_SIZES = new Set(["1024x1024", "1536x864", "864x1536"]);

export function isSupportedImageSize(size) {
  return typeof size === "string" && IMAGE_SIZES.has(size);
}
