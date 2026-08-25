import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test, { after, before } from "node:test";

let server;
let baseUrl;

async function reservePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

before(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), SUDOCODE_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await once(server.stdout, "data");
});

after(() => {
  server?.kill();
});

test("rejects an unsupported generate size before checking the API key", async () => {
  const response = await fetch(`${baseUrl}/api/images/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "test", size: "1920x1080" })
  });

  assert.equal(response.status, 400);
});

test("rejects an unsupported edit size before checking the API key", async () => {
  const form = new FormData();
  form.append("prompt", "test");
  form.append("size", "1920x1080");
  form.append("image[]", new Blob(["image"], { type: "image/png" }), "reference.png");

  const response = await fetch(`${baseUrl}/api/images/edit`, { method: "POST", body: form });

  assert.equal(response.status, 400);
});
