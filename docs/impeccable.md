# 在本项目使用 Impeccable

## 已安装内容

2026-10-26 安装了项目级 Codex 技能，SKILL.md 声明版本 4.7.0，本地 Windows 引擎版本 0.1.16。未安装自动检查 hooks，未启用 live 模式，未修改应用运行时依赖。

- .agents/skills/impeccable/：技能、参考流程及启动器。
- PRODUCT.md：产品用途、流程、保存边界和待确认事项。
- DESIGN.md：四套主题的现有规范及机器可读颜色记录。
- .impeccable/design.json：设计扩展数据与组件样例，仅供设计工具使用。
- docs/reviews/2026-10-26-impeccable.md：首轮审查和证据。

Windows 引擎在技能 scripts/bin/ 下，本机保留但不纳入 Git。启动器还支持按 scripts/VERSION 下载对应版本到用户缓存，并校验下载结果。

## 使用方法

在 Codex 中将工作目录设为真正的项目根目录 Image-Assistant。项目级技能的发现范围由助手环境决定；若当前聊天仍绑定父目录且未列出技能，可显式引用 .agents/skills/impeccable/SKILL.md，或重新在此项目根目录打开聊天。

安装后的技能说明使用 Codex 的 $impeccable 调用形式；也可以直接说“使用本项目的 impeccable 技能”。例如：

~~~text
$impeccable critique 审查诗词工作台，保留现有主题，只输出问题与优先级。

$impeccable adapt 改善纸上故事馆的 390px 手机首页，保留书页视觉和单图、故事、诗词入口。

$impeccable polish 统一故事抽屉的输入、按钮与状态样式，遵循 PRODUCT.md 和 DESIGN.md。
~~~

普通修饰以现有实现和 DESIGN.md 为依据。不要把审查理解为全面改版，也不要把确定性检测的审美警告自动当成必须修复的错误。

## 手动检查

在项目根目录运行：

~~~powershell
& '.\.agents\skills\impeccable\scripts\impeccable.cmd' detect --json src/
npm test
npm run build
~~~

检测器退出 0 表示没有主要命中，2 表示有发现，1 表示扫描失败。3 条现有侧边强调线警告见首轮报告；仍需浏览器检查主题、键盘、中文长文本和窄屏。

## 安装与更新

本次采用的安装命令：

~~~powershell
npx --yes impeccable install --providers=codex --scope=project --no-hooks
~~~

以后需要更新时先查看差异，再使用更新命令并保留不启用 hooks 的选择。不要将引擎二进制、个人配置、模型密钥或运行日志加入共享技能包。

上游来源：pbakaus/impeccable；原始技能文件按安装器提供的内容保留。第三方许可见技能目录中的 LICENSE 与 NOTICE.md（如存在）。
