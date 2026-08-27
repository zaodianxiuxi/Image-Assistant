import assert from "node:assert/strict";
import { once } from "node:events";
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

async function waitForStartup(server) {
  const output = [];
  const timeout = setTimeout(() => {
    server.kill();
  }, 3000);
  try {
    for await (const chunk of server.stdout) {
      output.push(chunk.toString());
      if (output.join("").includes("server_started")) return output.join("");
    }
  } finally {
    clearTimeout(timeout);
  }
  throw new Error(output.join("") || "server exited before startup");
}

test("starts without mysql2 when MySQL is not configured", async () => {
  const port = await reservePort();
  const environment = { ...process.env, PORT: String(port), SUDOCODE_API_KEY: "" };
  delete environment.MYSQL_HOST;
  delete environment.MYSQL_DATABASE;
  delete environment.MYSQL_USER;
  delete environment.MYSQL_PASSWORD;

  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: environment,
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForStartup(server);
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.databaseConfigured, false);
  } finally {
    server.kill();
  }
});
