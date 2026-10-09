import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

for (const [configuredModel, expectedModel] of [
  ["", "gpt-image-2.5-sunburst"],
  ["gpt-image-2.5-flare", "gpt-image-2.5-flare"],
  ["gpt-image-2", "gpt-image-2"]
]) {
  test(`uses ${expectedModel} for health, generation and editing`, async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), "image-assistant-model-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const requests = [];
    const provider = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      requests.push({ url: req.url, body: Buffer.concat(chunks).toString() });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ data: [{ b64_json: Buffer.from("test image").toString("base64") }] }));
    });
    provider.listen(0, "127.0.0.1");
    await once(provider, "listening");
    t.after(() => new Promise((resolve) => provider.close(resolve)));

    const portReservation = createServer();
    portReservation.listen(0, "127.0.0.1");
    await once(portReservation, "listening");
    const port = portReservation.address().port;
    await new Promise((resolve) => portReservation.close(resolve));

    const server = spawn(process.execPath, ["server/index.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        PORT: String(port),
        SUDOCODE_API_KEY: "test-key",
        SUDOCODE_BASE_URL: `http://127.0.0.1:${provider.address().port}`,
        SUDOCODE_IMAGE_MODEL: configuredModel,
        IMAGE_ASSISTANT_STORAGE_DIR: directory,
        MYSQL_HOST: "",
        MYSQL_DATABASE: "",
        MYSQL_USER: ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    t.after(async () => {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    });
    await once(server.stdout, "data", { signal: AbortSignal.timeout(10000) });
    const base = `http://127.0.0.1:${port}`;
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.imageModel, expectedModel);

    const generated = await fetch(`${base}/api/images/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "测试模型升级", size: "1536x864" })
    });
    assert.equal(generated.status, 200);
    assert.equal((await generated.json()).model, expectedModel);
    assert.equal(requests[0].url, "/images/generations");
    assert.equal(JSON.parse(requests[0].body).model, expectedModel);
    assert.equal(JSON.parse(requests[0].body).size, "1536x864");

    const form = new FormData();
    form.append("prompt", "保留主体，修改背景");
    form.append("size", "864x1536");
    form.append("image[]", new Blob(["reference"], { type: "image/png" }), "reference.png");
    const edited = await fetch(`${base}/api/images/edit`, { method: "POST", body: form });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).model, expectedModel);
    assert.equal(requests[1].url, "/images/edits");
    assert.ok(requests[1].body.includes(`name="model"\r\n\r\n${expectedModel}\r\n`));
    assert.ok(requests[1].body.includes('name="size"\r\n\r\n864x1536\r\n'));
  });
}
