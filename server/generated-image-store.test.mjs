import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getDesktopAppDirectory } from "./desktop-path.mjs";
import { isSafeGeneratedImageFileName, saveProviderImage } from "./generated-image-store.mjs";

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "image-assistant-test-"));
  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("creates and reuses the Image-Assisant folder from the Windows desktop path", async () => {
  await withTemporaryDirectory(async (desktopDirectory) => {
    const calls = [];
    const executeFileImpl = async (command, args) => {
      calls.push({ command, args });
      return { stdout: `${desktopDirectory}\r\n` };
    };

    const first = await getDesktopAppDirectory({ platform: "win32", executeFileImpl });
    const second = await getDesktopAppDirectory({ platform: "win32", executeFileImpl });

    assert.equal(first, path.join(desktopDirectory, "Image-Assisant"));
    assert.equal(second, first);
    assert.deepEqual(calls[0], {
      command: "powershell.exe",
      args: ["-NoProfile", "-Command", "[Environment]::GetFolderPath('Desktop')"]
    });
  });
});

test("writes base64 and remote provider images as local PNG URLs", async () => {
  await withTemporaryDirectory(async (outputDirectory) => {
    const now = new Date("2026-08-26T08:30:15.000Z");
    const base64 = await saveProviderImage({
      item: { b64_json: Buffer.from("base64 image").toString("base64") },
      outputDirectory,
      now,
      randomUuid: () => "base64-id"
    });
    const remote = await saveProviderImage({
      item: { url: "https://example.test/provider-image.png" },
      outputDirectory,
      now,
      randomUuid: () => "remote-id",
      fetchImpl: async (url) => {
        assert.equal(url, "https://example.test/provider-image.png");
        return new Response(Buffer.from("remote image"), { status: 200 });
      }
    });

    assert.match(base64.imageUrl, /^\/generated-images\/\d{8}-\d{6}-base64-id\.png$/);
    assert.match(remote.imageUrl, /^\/generated-images\/\d{8}-\d{6}-remote-id\.png$/);
    assert.equal(await readFile(path.join(outputDirectory, base64.fileName), "utf8"), "base64 image");
    assert.equal(await readFile(path.join(outputDirectory, remote.fileName), "utf8"), "remote image");
  });
});

test("accepts only server-generated PNG file names", () => {
  assert.equal(isSafeGeneratedImageFileName("20260826-083015-a1b2-c3d4.png"), true);
  assert.equal(isSafeGeneratedImageFileName("../.env"), false);
  assert.equal(isSafeGeneratedImageFileName("..%2F.env"), false);
  assert.equal(isSafeGeneratedImageFileName("source.jpg"), false);
});
