# 可选数据库依赖 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未配置 MySQL 时服务端不加载 `mysql2` 也能启动，图片创作主链路保持可用。

**Architecture:** 保留现有数据库接口和路由，仅将 `mysql2/promise` 改为 `getDatabase()` 内的动态导入。数据库配置完整时行为不变；未配置时继续返回 `null` 或现有未配置错误。

**Tech Stack:** Node.js 22、Express 5、ES modules、Node Test Runner。

## Global Constraints

- 未配置 MySQL 时不解析 `mysql2`。
- 不删除数据库路由、不修改数据库表结构、不引入替代存储。
- 图片生成、编辑、桌面落盘和本地提示词缓存必须继续可用。

### Task 1: 启动回归测试

**Files:**
- Create: `server/optional-database-startup.test.mjs`

**Interfaces:**
- Consumes: `server/index.mjs` process startup and `GET /api/health`.
- Produces: A regression check that starts the server with empty MySQL settings and confirms a successful health response.

- [ ] **Step 1: Write the failing test**

  Spawn `server/index.mjs` with `MYSQL_HOST`, `MYSQL_DATABASE`, and `MYSQL_USER` removed, reserve a local port, wait for the startup log, fetch `/api/health`, and assert HTTP 200 plus `databaseConfigured === false`.

- [ ] **Step 2: Run test to verify it fails**

  Run: `node --test server/optional-database-startup.test.mjs`
  Expected: FAIL before the server starts with `ERR_MODULE_NOT_FOUND` for `mysql2`.

### Task 2: Lazy-load MySQL

**Files:**
- Modify: `server/database.mjs:1-32`

**Interfaces:**
- Consumes: Existing `isDatabaseConfigured()`, `getDatabase()`, and all database CRUD callers.
- Produces: `getDatabase()` that dynamically imports `mysql2/promise` only after configuration succeeds.

- [ ] **Step 1: Implement the minimal dynamic import**

  Remove the top-level `mysql2/promise` import, add a cached `mysqlModule` promise/value, and inside the existing initialization block load `const { default: mysql } = await import("mysql2/promise")` before `createPool`. Keep the existing initialization reset on failure.

- [ ] **Step 2: Run the regression test**

  Run: `node --test server/optional-database-startup.test.mjs`
  Expected: PASS.

### Task 3: Full verification

**Files:**
- Modify: none

- [ ] **Step 1: Run focused logic tests**

  Run: `node --test src/prompt-hotlist.test.mjs src/prompt-hotlist-ui.test.mjs server/image-sizes.test.mjs server/upload-limits.test.mjs server/prompt-cache.test.mjs server/prompt-generator.test.mjs server/storyboard-generator.test.mjs server/optional-database-startup.test.mjs`
  Expected: all tests pass.

- [ ] **Step 2: Run production build**

  Run: `npm run build`
  Expected: TypeScript compilation and Vite build succeed.

- [ ] **Step 3: Review worktree**

  Run: `git status --short`
  Expected: only the intended implementation/test files plus any pre-existing user changes remain.
