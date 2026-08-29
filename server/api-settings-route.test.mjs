import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

async function reservePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

test("stores an API key locally without returning it to the browser", async () => {
  const port = await reservePort();
  const directory = await mkdtemp(path.join(tmpdir(), "image-assistant-api-settings-"));
  const envFile = path.join(directory, ".env");
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), SUDOCODE_API_KEY: "", IMAGE_ASSISTANT_ENV_FILE: envFile },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await once(server.stdout, "data");
    const response = await fetch(`http://127.0.0.1:${port}/api/settings/api-key`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-local-test-key" })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { configured: true });
    assert.doesNotMatch(JSON.stringify(body), /sk-local-test-key/);
    assert.match(await readFile(envFile, "utf8"), /SUDOCODE_API_KEY="sk-local-test-key"/);

    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal((await health.json()).configured, true);
  } finally {
    server.kill();
    await rm(directory, { recursive: true, force: true });
  }
});
