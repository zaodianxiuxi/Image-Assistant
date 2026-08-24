# Image Assistant

本地运行的 `gpt-image-2` 网页工具，接入 SudoCode 的 OpenAI 兼容图片 API。它提供文本生图、参考图创作、局部遮罩编辑、下载和可追踪的本地调用日志。

## 项目结构

```text
src/              React + Vite 前端
server/           Express 本地 API 代理
.env.example      环境变量模板，不含真实密钥
```

浏览器只请求本地代理；真实 API Key 仅由 `server/index.mjs` 读取，不会发送到前端。

## 启动

```powershell
Copy-Item .env.example .env
# 编辑 .env，填入 SUDOCODE_API_KEY
npm install
npm run dev
```

打开 `http://localhost:5173`。

开发模式会同时启动：

- 前端：`http://localhost:5173`
- 本地代理：`http://localhost:3001`

修改 `.env`、前端或服务端文件后，开发服务会自动重载。

## 能力

- 文本生成图片：`POST /v1/images/generations`
- 图片编辑：`POST /v1/images/edits`，支持可选遮罩
- 参考图生成：在“生成”模式可一次或分次上传最多 4 张参考图，自动通过图片编辑接口发起请求
- `gpt-image-2` 模型与方形、横向、纵向画幅
- 会话内历史记录、查看与下载

## 配置

`.env` 文件只应保留在本机，已被 `.gitignore` 排除。请勿将真实 API Key 提交到 Git 仓库。

默认上游地址为 `https://api.sudocode.chat/v1`。如果需要使用文档中的备用入口，可在 `.env` 设置：

```ini
SUDOCODE_BASE_URL=https://api.sudorelay.com/v1
```

界面采用紧凑的开源工具型 UI 设计取向，参考 [shadcn/ui](https://github.com/shadcn-ui/ui) 的组件风格，并使用 Lucide 图标。

## 排查日志

在启动 `npm run dev` 的终端查看 `[image-api]` 日志。输入开始、参考图选择、点击生成、上游请求、上游响应和错误都会记录请求 ID；日志会打印目标地址、状态码和上游错误信息，但不会打印 API Key 或完整提示词。网页报错中的请求 ID 可直接对应终端中的日志。

常见网络问题：如果默认域名无法访问，可在 `.env` 中配置文档提供的备用地址后重启服务。
