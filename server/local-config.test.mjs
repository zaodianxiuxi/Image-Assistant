import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { saveApiKey, setEnvValue } from "./local-config.mjs";

test("updates an existing API key without changing unrelated configuration", () => {
  const source = "SUDOCODE_BASE_URL=https://api.example.com/v1\nSUDOCODE_API_KEY=old-key\nMYSQL_HOST=127.0.0.1\n";
  const updated = setEnvValue(source, "SUDOCODE_API_KEY", "new-key#value");

  assert.equal(updated, "SUDOCODE_BASE_URL=https://api.example.com/v1\nSUDOCODE_API_KEY=\"new-key#value\"\nMYSQL_HOST=127.0.0.1\n");
});

test("creates a local environment file when no configuration exists", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "image-assistant-config-"));
  const envFile = path.join(directory, ".env");

  try {
    await saveApiKey(envFile, "new-key");
    assert.equal(await readFile(envFile, "utf8"), "SUDOCODE_API_KEY=\"new-key\"\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
