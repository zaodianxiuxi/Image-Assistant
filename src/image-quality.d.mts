export type ImageQuality = "balanced" | "bright" | "original";
export const IMAGE_QUALITY_OPTIONS: { value: ImageQuality; label: string; description: string }[];
export function normalizeImageQuality(value: unknown): ImageQuality;
export function applyImageQuality(prompt: string, quality?: ImageQuality, mode?: "generate" | "edit"): string;
