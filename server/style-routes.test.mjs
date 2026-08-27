import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";

async function reservePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function waitForStartup(server) {
  const output = [];
  const timeout = setTimeout(() => server.kill(), 3000);
  try {
    for await (const chunk of server.stdout) {
      output.push(chunk.toString());
      if (output.join("").includes("server_started")) return;
    }
  } finally {
    clearTimeout(timeout);
  }
  throw new Error(output.join("") || "server exited before startup");
}

async function withServer(environment, callback) {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      SUDOCODE_API_KEY: "test-key",
      SUDOCODE_TEXT_MODEL: "",
      SUDOCODE_VISION_MODEL: "",
      MYSQL_HOST: "",
      MYSQL_DATABASE: "",
      MYSQL_USER: "",
      MYSQL_PASSWORD: "",
      ...environment
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  try {
    await waitForStartup(server);
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.kill();
  }
}

test("returns 503 when the vision model is not configured", async () => {
  await withServer({}, async (baseUrl) => {
    const form = new FormData();
    form.append("image", new Blob(["image"], { type: "image/png" }), "reference.png");
    const response = await fetch(`${baseUrl}/api/styles/analyze`, { method: "POST", body: form });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.match(body.error, /SUDOCODE_VISION_MODEL/);
  });
});

test("rejects a non-image reference upload", async () => {
  await withServer({ SUDOCODE_VISION_MODEL: "vision-test" }, async (baseUrl) => {
    const form = new FormData();
    form.append("image", new Blob(["text"], { type: "text/plain" }), "reference.txt");
    const response = await fetch(`${baseUrl}/api/styles/analyze`, { method: "POST", body: form });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /有效的参考图片/);
  });
});

test("rejects composition without new picture content", async () => {
  await withServer({ SUDOCODE_TEXT_MODEL: "text-test" }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/styles/compose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analysis: {}, newContent: "", lockedFields: [] })
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /请输入新的画面内容/);
  });
});
