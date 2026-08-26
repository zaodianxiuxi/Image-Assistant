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

const promptText = "未来港口的中文复杂图像提示词，包含主体、环境、光影、镜头、材质和构图控制。".repeat(4);

function generatedPrompts() {
  return Array.from({ length: 6 }, (_, index) => ({
    title: `服务端灵感 ${index + 1}`,
    category: "未来城市",
    size: "1536x864",
    prompt: `${promptText}${index}`
  }));
}

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
    response.setHeader("content-type", "application/json");
    if (request.url === "/images/generations") {
      response.end(JSON.stringify({ data: [{ b64_json: Buffer.from("persisted image").toString("base64") }] }));
      return;
    }
    if (request.url === "/chat/completions") {
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ prompts: generatedPrompts() }) } }] }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: { message: "unknown endpoint" } }));
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
      SUDOCODE_TEXT_MODEL: "test-text-model",
      IMAGE_ASSISTANT_STORAGE_DIR: outputDirectory,
      MYSQL_HOST: "",
      MYSQL_DATABASE: "",
      MYSQL_USER: "",
      MYSQL_PASSWORD: ""
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
  assert.match(body.image, /^\/generated-images\/\d{4}-\d{2}-\d{2}\/.+\.png$/);
  assert.equal(body.fileName, "测试本地持久化.png");
  const imageResponse = await fetch(`${baseUrl}${body.image}`);
  assert.equal(await imageResponse.text(), "persisted image");
});

test("does not serve a generated-image route with a traversal file name", async () => {
  const response = await fetch(`${baseUrl}/generated-images/..%2F.env`);
  assert.equal(response.status, 404);
});

test("returns six server-generated prompt ideas through the local API", async () => {
  const response = await fetch(`${baseUrl}/api/prompts/generate`, { method: "POST" });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.prompts.length, 6);
  assert.ok(body.prompts.every((item) => item.id.startsWith("generated-")));
});

test("proxies generated images through the Vite development server", async () => {
  const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(viteConfig, /"\/generated-images": "http:\/\/localhost:3001"/);
});
