# 图库层级数据 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为图库记录补充节点字段，并提供可测试的系列 → 节点 → 图片分组排序数据。

**Architecture:** 后端图库查询左连接故事节点，返回节点 ID、标题和顺序；前端新增纯分组函数，将无系列和无节点记录分别归入固定分组。当前阶段不改 UI，只建立稳定数据契约。

**Tech Stack:** React 18、TypeScript、Node.js ES modules、Node Test Runner、MySQL 8。

## Global Constraints

- 没有数据库时使用静态测试夹具，不在正常页面注入伪造数据。
- “其他”固定接收所有无系列图片并排在父级末尾。
- 节点按 `nodeOrder` 正序，节点内图片按生成时间倒序、同时间按 ID 倒序。
- 每张记录保留自己的 `prompt` 字段。

### Task 1: 分组函数测试

**Files:**
- Create: `src/gallery-groups.test.mjs`
- Create: `src/gallery-groups.mjs`
- Create: `src/gallery-groups.d.mts`

**Interfaces:**
- Consumes: image records with `id`, `seriesId`, `seriesName`, `nodeId`, `nodeTitle`, `nodeOrder`, `createdAt`, and `prompt`.
- Produces: `groupHistoryRecords(items)` returning `{ key, title, seriesId, nodes }[]`, where each node is `{ key, title, nodeId, nodeOrder, items }`.

- [ ] **Step 1: Write static fixture tests**

  Use records from two series, two nodes, one unassigned series record, and two records without a series. Assert one `其他` parent, parent ordering, node ordering, image time/ID ordering, and prompt preservation.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --test src/gallery-groups.test.mjs`
  Expected: FAIL because `groupHistoryRecords` is not implemented.

- [ ] **Step 3: Implement the minimal grouping function**

  Normalize IDs, use `createdAt` timestamps for sorting, keep the `其他` and `未分配节点` keys stable, and return cloned arrays without mutating input.

- [ ] **Step 4: Run tests to verify they pass**

  Run: `node --test src/gallery-groups.test.mjs`
  Expected: PASS.

### Task 2: Return node metadata from the gallery API

**Files:**
- Modify: `server/database.mjs:224-243`
- Modify: `src/App.tsx:25-43, 140-163`

**Interfaces:**
- Consumes: Existing `image_records` and `series_nodes` tables.
- Produces: API records with `nodeId`, `nodeTitle`, and `nodeOrder`; frontend `Result` records carrying the same fields.

- [ ] **Step 1: Extend the SQL projection**

  Left join `series_nodes n ON n.id = i.node_id` and select `n.title AS node_title, n.node_order` so legacy records remain visible.

- [ ] **Step 2: Map fields at the API boundary**

  Add `nodeId`, `nodeTitle`, and `nodeOrder` to `listGeneratedImages()` output and the frontend saved-result mapping.

- [ ] **Step 3: Run the grouping and existing tests**

  Run: `node --test src/gallery-groups.test.mjs src/prompt-hotlist.test.mjs src/prompt-hotlist-ui.test.mjs server/generated-image-store.test.mjs server/generated-image-route.test.mjs`
  Expected: all tests pass.

### Task 3: Build verification

**Files:**
- Modify: none

- [ ] **Step 1: Run TypeScript and Vite build**

  Run: `npm run build`
  Expected: build succeeds.

- [ ] **Step 2: Review worktree**

  Run: `git status --short`
  Expected: only intended files and pre-existing `package-lock.json` changes remain.
