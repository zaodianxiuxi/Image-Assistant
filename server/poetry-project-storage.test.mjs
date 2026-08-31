import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("persists editable poetry projects and restores legacy poetry series", async () => {
  const database = await readFile(new URL("./database.mjs", import.meta.url), "utf8");
  const server = await readFile(new URL("./index.mjs", import.meta.url), "utf8");

  assert.match(database, /CREATE TABLE IF NOT EXISTS poetry_projects/);
  assert.match(database, /UNIQUE KEY uq_poetry_projects_series/);
  assert.match(database, /WHERE s\.description = '诗词意境创作合集' AND p\.id IS NULL/);
  assert.match(database, /export async function listPoetryProjects/);
  assert.match(database, /export async function upsertPoetryProject/);
  assert.match(database, /ON DUPLICATE KEY UPDATE title=VALUES\(title\)/);
  assert.match(server, /app\.get\("\/api\/poetry\/projects"/);
  assert.match(server, /app\.post\("\/api\/poetry\/projects"/);
  assert.match(server, /app\.patch\("\/api\/poetry\/projects\/:id"/);
});
