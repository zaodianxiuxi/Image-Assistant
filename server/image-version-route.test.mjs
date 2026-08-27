import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
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

test("reports delivery-version storage unavailable without MySQL", async () => {
  const port = await reservePort();
  const environment = { ...process.env, PORT: String(port), SUDOCODE_API_KEY: "" };
  delete environment.MYSQL_HOST;
  delete environment.MYSQL_DATABASE;
  delete environment.MYSQL_USER;

  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: environment,
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("server startup timeout")), 3000);
      for await (const chunk of server.stdout) {
        if (chunk.toString().includes("server_started")) {
          clearTimeout(timer);
          resolve();
          break;
        }
      }
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/library/images/versions/1/deliver`, { method: "POST" });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.match(body.error, /未配置 MySQL/);
  } finally {
    server.kill();
  }
});

test("exposes version metadata in the gallery query and response mapping", async () => {
  const databaseSource = await readFile(new URL("./database.mjs", import.meta.url), "utf8");
  assert.match(databaseSource, /v\.version_number/);
  assert.match(databaseSource, /v\.is_delivery/);
  assert.match(databaseSource, /versionGroupId/);
});
