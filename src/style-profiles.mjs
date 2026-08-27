export const STYLE_PROFILE_STORAGE_KEY = "image-assistant-style-profiles";
export const REUSABLE_STYLE_FIELDS = [
  "composition",
  "camera",
  "lighting",
  "color",
  "material",
  "style",
  "negativePrompt"
];

const MAX_PROFILES = 100;

function normalizedText(value, maxLength = 2000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizedLockedFields(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)].filter((field) => REUSABLE_STYLE_FIELDS.includes(field));
}

function normalizedProfile(value) {
  const id = normalizedText(value?.id, 120);
  const name = normalizedText(value?.name, 80);
  if (!id.startsWith("local-style-") || !name) return null;

  const fields = Object.fromEntries(REUSABLE_STYLE_FIELDS.map((field) => [
    field,
    normalizedText(value?.[field])
  ]));
  if (Object.values(fields).some((field) => !field)) return null;

  return {
    id,
    name,
    ...fields,
    lockedFields: normalizedLockedFields(value?.lockedFields),
    createdAt: normalizedText(value?.createdAt, 40) || new Date().toISOString(),
    updatedAt: normalizedText(value?.updatedAt, 40) || new Date().toISOString()
  };
}

export function parseStyleProfiles(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const profiles = parsed.slice(0, MAX_PROFILES).map(normalizedProfile);
    return profiles.every(Boolean) ? profiles : [];
  } catch {
    return [];
  }
}

export function createStyleProfile({ name, analysis, lockedFields }) {
  const now = new Date().toISOString();
  const profile = normalizedProfile({
    id: `local-style-${globalThis.crypto.randomUUID()}`,
    name,
    ...Object.fromEntries(REUSABLE_STYLE_FIELDS.map((field) => [field, analysis?.[field]])),
    lockedFields,
    createdAt: now,
    updatedAt: now
  });
  if (!profile) throw new Error("模板名称和七个风格字段都不能为空。");
  return profile;
}

export function updateStyleProfile(items, id, patch) {
  return items.map((item) => {
    if (item.id !== id) return item;
    const next = normalizedProfile({
      ...item,
      ...Object.fromEntries([
        ["name", patch?.name ?? item.name],
        ...REUSABLE_STYLE_FIELDS.map((field) => [field, patch?.[field] ?? item[field]]),
        ["lockedFields", patch?.lockedFields ?? item.lockedFields]
      ]),
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: new Date().toISOString()
    });
    if (!next) throw new Error("模板名称和七个风格字段都不能为空。");
    return next;
  }).slice(0, MAX_PROFILES);
}

export function removeStyleProfile(items, id) {
  return items.filter((item) => item.id !== id);
}
