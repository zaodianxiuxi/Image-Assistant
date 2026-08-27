import assert from "node:assert/strict";
import test from "node:test";
import { groupHistoryRecords } from "./gallery-groups.mjs";

const records = [
  { id: 1, seriesId: 10, seriesName: "山海夜行", nodeId: 102, nodeTitle: "遇狐", nodeOrder: 2, createdAt: "2026-08-27T10:00:00Z", prompt: "遇狐提示词" },
  { id: 2, seriesId: 10, seriesName: "山海夜行", nodeId: 101, nodeTitle: "入山", nodeOrder: 1, createdAt: "2026-08-27T09:00:00Z", prompt: "入山提示词" },
  { id: 3, seriesId: 10, seriesName: "山海夜行", nodeId: null, nodeTitle: null, nodeOrder: null, createdAt: "2026-08-27T11:00:00Z", prompt: "未分配提示词" },
  { id: 4, seriesId: 20, seriesName: "河灯", nodeId: 201, nodeTitle: "放灯", nodeOrder: 1, createdAt: "2026-08-27T08:00:00Z", prompt: "河灯提示词" },
  { id: 5, seriesId: null, seriesName: null, nodeId: null, nodeTitle: null, nodeOrder: null, createdAt: "2026-08-27T12:00:00Z", prompt: "无系列新图" },
  { id: 6, seriesId: null, seriesName: null, nodeId: null, nodeTitle: null, nodeOrder: null, createdAt: "2026-08-27T12:00:00Z", prompt: "无系列旧图" }
];

test("groups gallery records into ordered series and node levels", () => {
  const groups = groupHistoryRecords(records);

  assert.deepEqual(groups.map((group) => group.title), ["山海夜行", "河灯", "其他"]);
  assert.deepEqual(groups[0].nodes.map((node) => node.title), ["入山", "遇狐", "未分配节点"]);
  assert.deepEqual(groups[0].nodes.at(-1).items.map((item) => item.prompt), ["未分配提示词"]);
  assert.deepEqual(groups[2].nodes.map((node) => node.title), ["未分配节点"]);
  assert.deepEqual(groups[2].nodes[0].items.map((item) => item.id), [6, 5]);
  assert.equal(groups[0].nodes[0].items[0].prompt, "入山提示词");
});

test("sorts images newest first and breaks equal timestamps by id", () => {
  const groups = groupHistoryRecords([
    { ...records[0], id: 8, createdAt: "2026-08-27T10:00:00Z" },
    { ...records[0], id: 9, createdAt: "2026-08-27T11:00:00Z" },
    { ...records[0], id: 7, createdAt: "2026-08-27T10:00:00Z" }
  ]);

  assert.deepEqual(groups[0].nodes[0].items.map((item) => item.id), [9, 8, 7]);
});
