# Image Assistant

本地运行的 `gpt-image-2` 网页工具，接入 SudoCode 的 OpenAI 兼容图片 API。它提供文本生图、参考图创作、局部遮罩编辑、下载和可追踪的本地调用日志。

## 项目结构

```text
src/              React + Vite 前端
server/           Express 本地 API 代理
.env.example      环境变量模板，不含真实密钥
```

浏览器只请求本地代理；真实 API Key 仅由 `server/index.mjs` 读取，不会发送到前端。

相关文档：

- [今日提示词热榜](docs/今日提示词热榜.md)
- [后续方向](docs/后续方向.md)
- [开发交接](HANDOFF.md)

## 启动

```powershell
Copy-Item .env.example .env
# 编辑 .env，填入 SUDOCODE_API_KEY
# 如需生成热榜新灵感，再配置可用的 SUDOCODE_TEXT_MODEL
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
- 参考图生成：在“生成”模式可一次或分次上传最多 10 张参考图，单张最大 20 MB，图片和遮罩总量最大 50 MB，自动通过图片编辑接口发起请求
- `gpt-image-2` 模型支持正方形 1:1、电脑横屏 16:9 和手机竖屏 9:16 输出；参考图仅提供内容和风格参考，输出始终按所选画幅生成
- 图片持久化：生成和编辑结果自动保存到当前 Windows 用户桌面的 `Image-Assisant` 文件夹；上游临时 URL 和 Base64 结果都会转换为本地 PNG，通过本地路由预览和下载
- 今日提示词热榜：内置 17 条复杂中文提示词，每日稳定随机展示 6 条；点击刷新图标可即时切换本地内容，点击条目即可填入
- 热榜新灵感：在配置文本模型后可点击“生成新灵感”，服务端会生成、校验并缓存 6 条复杂中文提示词；缓存位于桌面 `Image-Assisant\prompt-cache.json`，最多保留 120 条
- 会话内历史记录、查看、下载与大图预览；主图和缩略图均按原比例展示
- 浅色、深色主题切换，主题偏好保存在本机浏览器中

## 配置

`.env` 文件只应保留在本机，已被 `.gitignore` 排除。请勿将真实 API Key 提交到 Git 仓库。

默认上游地址为 `https://api.sudocode.chat/v1`。如果需要使用文档中的备用入口，可在 `.env` 设置：

```ini
SUDOCODE_BASE_URL=https://api.sudorelay.com/v1
```

文本模型为可选能力，且仅供“生成新灵感”使用。填写的模型必须与所选上游兼容 `/chat/completions`：

```ini
SUDOCODE_TEXT_MODEL=gpt-4.1-mini
```

未设置 `SUDOCODE_TEXT_MODEL` 时，图片生成、桌面保存和热榜本地刷新仍可正常使用；“生成新灵感”会返回明确的配置提示。

界面采用紧凑的开源工具型 UI 设计取向，参考 [shadcn/ui](https://github.com/shadcn-ui/ui) 的组件风格，并使用 Lucide 图标。

## 排查日志

在启动 `npm run dev` 的终端查看 `[image-api]` 日志。输入开始、参考图选择、点击生成、上游请求、上游响应和错误都会记录请求 ID；日志会打印目标地址、状态码和上游错误信息，但不会打印 API Key 或完整提示词。网页报错中的请求 ID 可直接对应终端中的日志。

常见网络问题：如果默认域名无法访问，可在 `.env` 中配置文档提供的备用地址后重启服务。
