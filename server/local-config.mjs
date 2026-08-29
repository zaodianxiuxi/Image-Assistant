import { readFile, writeFile } from "node:fs/promises";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function setEnvValue(contents, name, value) {
  const lineEnding = contents.includes("\r\n") ? "\r\n" : "\n";
  const serializedValue = JSON.stringify(value);
  const matcher = new RegExp(`^(\\s*(?:export\\s+)?${escapeRegExp(name)}\\s*=\\s*).*?$`, "m");

  if (matcher.test(contents)) return contents.replace(matcher, `$1${serializedValue}`);

  const separator = contents && !contents.endsWith("\n") && !contents.endsWith("\r") ? lineEnding : "";
  return `${contents}${separator}${name}=${serializedValue}${lineEnding}`;
}

export async function saveApiKey(envFile, apiKey) {
  let contents = "";
  try {
    contents = await readFile(envFile, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeFile(envFile, setEnvValue(contents, "SUDOCODE_API_KEY", apiKey), "utf8");
}
