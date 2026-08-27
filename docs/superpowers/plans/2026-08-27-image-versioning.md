# 图片版本链 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已生成图片接入编辑流程，保留版本历史并支持手动确认交付版本。

**Architecture:** 新增独立版本组和版本表，图片记录通过版本表关联；前端在数据库不可用时使用会话内版本元数据。编辑入口自动下载历史图片并填入编辑模式，交付操作只切换同组标记。

**Tech Stack:** React 18、TypeScript、Express 5、Node.js ES modules、MySQL 8、Node Test Runner。

## Global Constraints

- 新版本默认候选，不自动成为交付版本。
- 有系列节点的图片按节点归组，无系列图片使用独立版本组。
- 无数据库时只保留当前会话版本链，不伪造跨刷新持久化。
- 不删除或改变现有图片生成、编辑接口的必填字段和行为。

### Task 1: Session version logic

**Files:**
- Create: `src/image-version-session.mjs`
- Create: `src/image-version-session.test.mjs`
- Create: `src/image-version-session.d.mts`

**Interfaces:**
- Produces `enrichSessionVersion(result, parent)` and `markSessionDelivery(items, versionId)` for no-database UI behavior.

- [ ] Write static tests for first version, child version increment, delivery replacement, and prompt preservation.
- [ ] Run `node --test src/image-version-session.test.mjs` and observe failure.
- [ ] Implement the two pure functions without mutating inputs.
- [ ] Re-run the test and verify it passes.

### Task 2: Database version persistence and API

**Files:**
- Modify: `server/database.mjs`
- Modify: `server/index.mjs`
- Create: `server/image-version-route.test.mjs`

**Interfaces:**
- Database exports `saveImageVersion(input)`, `markImageVersionDelivered(versionId)`, and extended `listGeneratedImages()` fields.
- API adds `POST /api/library/images/versions/:id/deliver`.

- [ ] Add failing route/source tests for version response fields and delivery endpoint.
- [ ] Add version tables to existing migration and implement transactional version save/delivery.
- [ ] Pass version metadata through generate/edit requests and provider response persistence.
- [ ] Run focused server tests and verify all pass.

### Task 3: Connect gallery images to editing

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/prompt-hotlist-ui.test.mjs`

**Interfaces:**
- History cards expose `continueEditing(result)` and `setDeliveryVersion(result)`.
- `Result` carries version group, parent, number, and delivery fields.

- [ ] Add failing UI structure tests for continue-edit, version badge, delivery action, and prompt display.
- [ ] Implement image-to-File loading, edit context propagation, result mapping, delivery updates, and card controls.
- [ ] Add responsive styles for version metadata and actions.
- [ ] Run full explicit test suite and build.

### Task 4: Commit and handoff

- [ ] Review the diff and preserve pre-existing `package-lock.json` changes.
- [ ] Commit implementation with a Chinese message.
- [ ] Report test/build evidence and current development URL.
