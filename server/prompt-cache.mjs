import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isSupportedImageSize } from "./image-sizes.mjs";

const MAX_CACHE_ITEMS = 120;
const MIN_PROMPT_LENGTH = 80;
const MAX_PROMPT_LENGTH = 500;
const CHINESE_CHARACTER = /[\u3400-\u9fff]/;

function normalizedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function promptId(prompt) {
  let hash = 2166136261;
  for (const character of prompt) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `generated-${(hash >>> 0).toString(36)}`;
}

export function validatePromptCandidates(value, existingPrompts = []) {
  const candidates = Array.isArray(value) ? value : [];
  const seenPrompts = new Set(existingPrompts.map((item) => normalizedText(item?.prompt)).filter(Boolean));
  const valid = [];

  for (const item of candidates) {
    const title = normalizedText(item?.title);
    const category = normalizedText(item?.category);
    const size = normalizedText(item?.size);
    const prompt = normalizedText(item?.prompt);
    const promptLength = Array.from(prompt).length;
    if (
      !title || !category || !prompt ||
      !CHINESE_CHARACTER.test(title) || !CHINESE_CHARACTER.test(category) || !CHINESE_CHARACTER.test(prompt) ||
      promptLength < MIN_PROMPT_LENGTH || promptLength > MAX_PROMPT_LENGTH ||
      !isSupportedImageSize(size) || seenPrompts.has(prompt)
    ) continue;

    // IDs are derived server-side so model output cannot control React keys or cache records.
    const id = promptId(prompt);
    seenPrompts.add(prompt);
    valid.push({ id, title, category, size, prompt });
  }

  return valid;
}

export async function readPromptCache(cacheFile) {
  try {
    const parsed = JSON.parse(await readFile(cacheFile, "utf8"));
    return validatePromptCandidates(parsed);
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return [];
    throw error;
  }
}

export async function writePromptCache(cacheFile, prompts) {
  const directory = path.dirname(cacheFile);
  const normalized = validatePromptCandidates(prompts).slice(0, MAX_CACHE_ITEMS);
  await mkdir(directory, { recursive: true });
  const temporaryFile = path.join(directory, `.${path.basename(cacheFile)}.${randomUUID()}.tmp`);

  // Atomic replacement prevents an interrupted write from corrupting the retained prompt cache.
  await writeFile(temporaryFile, JSON.stringify(normalized, null, 2), "utf8");
  await rename(temporaryFile, cacheFile);
}

export { MAX_CACHE_ITEMS };
