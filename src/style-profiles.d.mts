export type StyleAnalysis = {
  sourceContent: string;
  composition: string;
  camera: string;
  lighting: string;
  color: string;
  material: string;
  style: string;
  negativePrompt: string;
};

export type ReusableStyleField = Exclude<keyof StyleAnalysis, "sourceContent">;

export type StyleProfile = Pick<StyleAnalysis, ReusableStyleField> & {
  id: string;
  name: string;
  lockedFields: ReusableStyleField[];
  createdAt: string;
  updatedAt: string;
};

export const STYLE_PROFILE_STORAGE_KEY: "image-assistant-style-profiles";
export const REUSABLE_STYLE_FIELDS: ReusableStyleField[];
export function parseStyleProfiles(raw: string | null): StyleProfile[];
export function createStyleProfile(input: {
  name: string;
  analysis: StyleAnalysis;
  lockedFields: ReusableStyleField[];
}): StyleProfile;
export function updateStyleProfile(items: StyleProfile[], id: string, patch: Partial<StyleProfile>): StyleProfile[];
export function removeStyleProfile(items: StyleProfile[], id: string): StyleProfile[];
