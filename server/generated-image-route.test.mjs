import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";

let appServer;
let providerServer;
let baseUrl;
let outputDirectory;

async function reservePort() {
  const listener = createNetServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

before(async () => {
  outputDirectory = await mkdtemp(path.join(os.tmpdir(), "image-assistant-route-"));
  const providerPort = await reservePort();
  const appPort = await reservePort();
  providerServer = createServer((request, response) => {
    assert.equal(request.url, "/images/generations");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({
      data: [{ b64_json: Buffer.from("persisted image").toString("base64") }]
    }));
  });
  providerServer.listen(providerPort, "127.0.0.1");
  await once(providerServer, "listening");

  baseUrl = `http://127.0.0.1:${appPort}`;
  appServer = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(appPort),
      SUDOCODE_API_KEY: "test-key",
      SUDOCODE_BASE_URL: `http://127.0.0.1:${providerPort}`,
      IMAGE_ASSISTANT_STORAGE_DIR: outputDirectory
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await once(appServer.stdout, "data");
});

after(async () => {
  appServer?.kill();
  providerServer?.close();
  await rm(outputDirectory, { recursive: true, force: true });
});

test("returns a locally served URL after saving a generated image", async () => {
  const response = await fetch(`${baseUrl}/api/images/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "测试本地持久化", size: "1024x1024" })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(body.image, /^\/generated-images\/\d{8}-\d{6}-.+\.png$/);
  const imageResponse = await fetch(`${baseUrl}${body.image}`);
  assert.equal(await imageResponse.text(), "persisted image");
});

test("does not serve a generated-image route with a traversal file name", async () => {
  const response = await fetch(`${baseUrl}/generated-images/..%2F.env`);
  assert.equal(response.status, 404);
});

test("proxies generated images through the Vite development server", async () => {
  const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(viteConfig, /"\/generated-images": "http:\/\/localhost:3001"/);
});
