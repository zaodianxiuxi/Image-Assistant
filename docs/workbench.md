# 空间工作台

默认入口为 `#/desk`，侧栏提供文件库、阅读台、格式转换、图片创作和任务中心。Three.js 只在桌面加载；离开桌面释放场景资源。WebGL 不可用时仍可通过普通按钮使用工具。

## Filee 配置

本项目通过独立 CLI 接入 [Filee](https://github.com/KnifeLemon/Filee)，没有嵌入它的桌面窗口。当前本机已校验并配置官方 v2.1.0 Windows portable。

在其他电脑上：

1. 从 [官方 v2.1.0 发布页](https://github.com/KnifeLemon/Filee/releases/tag/v2.1.0) 下载 Windows portable 与 SHA256SUMS 文件，按校验值核对下载内容。
2. 将完整便携包解压到项目的 `.local/tools/filee/`，保留依赖、许可及说明文件。入口为 `filee-cli.exe`，不是 GUI 的 `Filee.exe`。
3. 或者在项目 `.env` 设置 `FILEE_CLI_PATH=C:/tools/Filee/filee-cli.exe`，然后重启服务。可执行文件路径无需附加命令参数。
4. 点击侧栏“刷新引擎状态”，连接成功后从文件的转换按钮选择格式。未安装 Filee 时仍能使用文件库、阅读和图片创作。

适配器使用 `version`、`formats <扩展名>` 和 `convert <输入> --to <格式> --output <任务目录> --json`。子进程使用参数数组，不经过 shell。可选引擎格式不会冒充已安装能力；本项目不会自动安装这些引擎。格式可用不保证每份复杂文档都能无损转换，任务会记录实际错误与警告。

Filee 原项目采用 MIT 许可，详见其 [LICENSE](https://github.com/KnifeLemon/Filee/blob/main/LICENSE)。其随包工具与可选引擎的许可应随原发行包保留。本仓库不提交 Filee 二进制。

## 数据与恢复

- `.local/workbench/index.json`：文件元数据、任务状态及输出关联。
- `.local/workbench/files/`：以内部 ID 隔离的原文件和转换结果，显示名称不作为磁盘路径。
- `.local/workbench/jobs/`：转换临时工作目录。
- 需要迁移或备份时，停止服务后复制完整 `.local/workbench/`。
- 当前服务采用单进程串行队列；重启后中断任务标记失败，可在任务中心重新选择格式执行。不要让多个后端进程同时写同一个工作台目录。
- 文件处理在本地执行；图片创作仍按原有设置访问模型服务。

## 当前范围

支持本地文件整理、PDF/图片/文本阅读，以及 Filee 当前可用的格式转换。Office 文件先选择可用格式转换后阅读，尚未提供 Word/Excel/PPT 在线编辑、OCR 界面、全文知识库或多人同步。转换不覆盖原文件。文本预览最多读取 1 MB；完整内容可下载。

## 本轮验证

真实 PNG → WebP 转换成功，输出 1200 × 800，内容接口返回 200。浏览器确认了场景旋转、物件导航和中文文本阅读。没有调用图片或文本模型；没有进行全量转换格式矩阵验证。
