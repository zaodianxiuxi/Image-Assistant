---
name: Image Assistant
description: 电影创作室与纸上故事馆的现有设计规范
colors:
  light-surface-page: "#edf1f5"
  light-surface-panel: "#ffffff"
  light-surface-subtle: "#f6f8fb"
  light-surface-canvas: "#f8fafc"
  light-text-strong: "#172033"
  light-text-muted: "#617089"
  light-border-subtle: "#dce3ec"
  light-accent: "#2463eb"
  light-accent-soft: "#eaf0ff"
  light-accent-ink: "#fff"
  light-success: "#178252"
  light-danger: "#b42318"
  dark-surface-page: "#121414"
  dark-surface-panel: "#1a1d1c"
  dark-surface-subtle: "#222624"
  dark-surface-canvas: "#171a19"
  dark-text-strong: "#eeeee7"
  dark-text-muted: "#9baba3"
  dark-border-subtle: "#323934"
  dark-accent: "#dfb778"
  dark-accent-soft: "#302b22"
  dark-accent-ink: "#211d16"
  dark-success: "#94c3a5"
  dark-danger: "#f3a49c"
  studio-surface-page: "#e5e1db"
  studio-surface-panel: "#f7f4ee"
  studio-surface-subtle: "#ece7df"
  studio-surface-canvas: "#d8d2c8"
  studio-text-strong: "#302d29"
  studio-text-muted: "#716c63"
  studio-border-subtle: "#c9c1b5"
  studio-accent: "#8b5748"
  studio-accent-soft: "#f0dfd8"
  studio-accent-ink: "#fff"
  studio-success: "#417357"
  studio-danger: "#a64b43"
  paper-surface-page: "#f1ece2"
  paper-surface-panel: "#fffcf5"
  paper-surface-subtle: "#f3ede2"
  paper-surface-canvas: "#f8f3e9"
  paper-text-strong: "#302f2a"
  paper-text-muted: "#70675a"
  paper-border-subtle: "#d8cebd"
  paper-accent: "#9c4635"
  paper-accent-soft: "#f3e3d9"
  paper-accent-ink: "#fffcf5"
  paper-success: "#3b7156"
  paper-danger: "#ac342c"
typography:
  paper-body:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "15px"
    lineHeight: 1.7
  paper-display:
    fontFamily: '"Noto Serif SC Variable", "Songti SC", "SimSun", serif'
    fontSize: "clamp(26px, 2.45vw, 42px)"
    fontWeight: 600
    lineHeight: 1.65
  paper-input:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "15px"
    lineHeight: 1.9
rounded:
  paper-control: "4px"
  paper-panel: "5px"
  generate-control: "9px"
  workspace-panel: "16px"
spacing:
  desktop-grid-gap: "20px"
  wide-grid-gap: "28px"
  medium-grid-gap: "14px"
components:
  paper-generate-button:
    backgroundColor: "{colors.paper-accent}"
    textColor: "{colors.paper-accent-ink}"
    rounded: "{rounded.paper-control}"
  paper-welcome-button:
    backgroundColor: "{colors.paper-accent}"
    textColor: "{colors.paper-accent-ink}"
    rounded: "{rounded.paper-control}"
    padding: "12px 17px"
---

# Design System: Image Assistant

## Overview

**Creative North Star: "电影创作室 / 纸上故事馆"**

延续既有电影创作室与纸上故事馆：围绕描述画面、观看结果和连续阅读组织界面。深色使用石墨与暖金，纸上主题使用象牙白与砖红；主题可切换，操作含义保持一致。本文件记录现状与延续规则；2026-10-26 经用户确认，首页改为 3D 创作分层，系列图片增加路径展映。

记录日期：2026-10-26。规范来自现有代码、既有设计文档和实际页面；没有另行创造品牌隐喻或色彩方案。YAML 中的前缀区分主题，名称是文档索引，应用仍使用 --accent 等既有 CSS 变量。记录的尺寸是现状，不代表已经解决审查中指出的问题。

**Key Characteristics:**

- 输入、结果画布、常驻工具入口形成清晰的桌面分区。
- 深色与纸上主题有各自明确的视觉身份。
- 中文标题和长文本承担主要信息层次。
- 首页以参考、描述、风格、画面四层呈现创作要素；无已有图片时显示代码绘制的示意场景。

来源：src/main.tsx；src/styles.css；src/cinema-workspace.css；src/paper-theme.css；src/select-theme.css；src/creation-space.css；src/journey.css；各工作台的专用 CSS。

## Colors

使用语义变量，不在新组件中复制某一主题的具体颜色。纸上与深色主题互为完整变体，不是给同一张白色卡片换背景。

| 主题 | 页面 / 面板 | 主文字 / 辅助文字 | 主色 / 按钮文字 |
|---|---|---|---|
| light | #edf1f5 / #ffffff | #172033 / #617089 | #2463eb / #fff |
| dark | #121414 / #1a1d1c | #eeeee7 / #9baba3 | #dfb778 / #211d16 |
| studio | #e5e1db / #f7f4ee | #302d29 / #716c63 | #8b5748 / #fff |
| paper | #f1ece2 / #fffcf5 | #302f2a / #70675a | #9c4635 / #fffcf5 |

- --surface-page、--surface-panel、--surface-subtle、--surface-canvas：页面、面板、次级区域、画布。
- --text-strong、--text-muted、--border-subtle：主要文本、辅助说明、边界。
- --accent、--accent-soft、--accent-ink：主操作、浅强调底与主操作文字。深色按钮文字应保留 --accent-ink 的深色值。
- --success、--danger：状态语义；不能只依靠颜色传达结果。
- --studio-gold：非纸上欢迎区的标题与装饰强调；不强行替换为主题主色。

加载顺序在 main.tsx 中是基础样式 → 电影工作台 → 本地中文字体 → 纸上主题 → 下拉菜单 → 3D 创作区 → 路径展映。工作台组件还引入其专用 CSS；变更前检查最终 computed style，避免只读到被覆盖的早期颜色。

## Typography

纸上主题正文及表单使用 Noto Sans SC Variable；标题、章节与故事标题使用 Noto Serif SC Variable，均有现有中文回退字体。本地字体按 Unicode 子集加载。首页与工作台正文统一优先使用本地 Noto Sans SC Variable；保留系统回退字体。

| 层级 | 已有值 | 使用位置 |
|---|---|---|
| 欢迎标题 | clamp(30px, 3.1vw, 48px)，行高 1.35，字重 500 | .space-copy h2 |
| 纸上欢迎标题 | 同尺寸，使用 Noto Serif SC Variable | paper 主题 .space-copy h2 |
| 窄屏欢迎标题 | 35px | ≤600px |
| 纸上正文 | 15px，行高 1.7 | body |
| 纸上提示词输入 | 15px，行高 1.9，最小高度 165px | .prompt-box textarea |
| 纸上工作台章节 | 22px；窄屏 20px | .story-section h2 |
| 纸上表单与生成按钮 | 14px，字重 500 | .field-label 等 |

现有部分辅助说明为 10–12px，手机操作尺寸也尚不统一；这是待评估的现状，不应作为未来小字号设计的目标。不要用拉丁字宽规则直接替代中文长文本的实际阅读检查。

## Layout

- 桌面：312px 编辑区 + minmax(0, 1fr) 画布 + 88px 工具栏，间隔 20px，高度 calc(100dvh - 104px)。编辑区内容可滚动，生成操作有独立区域。
- ≥1500px：340px / 自适应 / 96px，间隔 28px。
- 851–1100px：280px / 自适应 / 72px，间隔 14px。
- ≤850px：转为纵向布局，主区域解除固定高度；工具入口横向排列，规划中入口隐藏。
- ≤600px：3D 欢迎场景与文案上下排列，快捷入口单列。
- 纸上主题在 ≤850px 的空画布恢复正常文档顺序；单图输入区位于欢迎场景之前。
- 故事抽屉使用头部、可滚动正文、状态底栏；诗词工作台承载原文、分析和分镜。滚动区和操作位置需结合内容长度验证。
- 主图与预览默认完整显示；图库缩略图可以使用统一容器，但不能改变原图比例或导出内容。

## Elevation & Depth

使用浅边框、面板层次与克制阴影。纸上主题通过书页与轻微硬边阴影体现纸张，避免把每段文字装进独立高浮起卡片。

- 普通控制面板：0 8px 24px #0000000a。
- 纸上控制面板：0 5px 18px #54412708。
- 3D 图层：0 15px 28px #00000018，层间距 44–58px。
- 纸上故事卡片：2px 3px 0 #d8cebd3d。

## Shapes

普通工作台面板 16px 圆角，生成按钮 9px；纸上面板 5px，主要输入和按钮 4px。现有圆角并未集中为 CSS 变量，前置 YAML 记录的是已使用值，不声明已有全局尺寸系统。

## Components

### 创作控制区与主操作

App.tsx 负责提示词、参考图、画幅、画面观感及生成状态。生成按钮通过 form 属性关联表单；不要在整理布局时破坏提交行为。

### 欢迎区

CreativeWelcome.tsx 提供单图、故事、诗词入口，ExplodedCreation.tsx 提供四层 CSS 3D 场景，可合拢、展开和选择图层。优先显示最近作品，加载失败或无作品时回退到标明“创作示意”的山水图形。四层代表创作要素，不意味着能够拆出真实图片图层。只在尚未选择生成结果的画布显示。

### 工具导航

.extension-tool 使用图标和常驻文字；故事入口有浅强调底，规划中功能显示禁用状态，窄屏隐藏。故事入口的可访问名称现已统一为“打开故事创作”。

### 故事与诗词工作台

StoryWorkbench.tsx 管理故事编辑、参考与分镜，StoryReader.tsx 管理成片阅读，StoryShotRevisions.tsx 管理版本比较。诗词工作台当前位于 App.tsx。应延续已有状态、保存与重试语义，不在 UI 整理中更改模型请求和存储结构。

### 系列路径展映

JourneyTimeline.tsx 复用于图库 SeriesJourney 和 StoryReader 的“路径展映”模式。桌面图片交错排列，连接线从图片下方绕行；≤900px 使用左侧纵线。图像完整展示，主图优先采用交付版本，其他版本可展开查看；未编序图片单独保留。本地故事按已有分镜数组展示，包括旧版、失败与缺图状态。

自动展映由用户主动启动，每 4 秒前进一站，到末站停止。滚轮、触摸、键盘导航、点击内容、页面隐藏会停止播放。原生 dialog 限制焦点，Esc 关闭并返回入口；图库图片的预览和继续编辑会退出展映。

### 反馈与交互

现有按钮普遍使用 180ms 过渡；3D 图层展开约 800ms，路径进度约 900ms。prefers-reduced-motion 关闭这些过渡、指针倾斜与平滑导航。按钮、链接、summary 使用 2px 主色焦点轮廓与 3px 偏移。输入框使用 focus-within 边框与光环。

现有 role="dialog" / aria-modal 不是完整焦点管理：本轮故事与诗词抽屉都存在焦点留在背景的问题。后续需要验证进入、Tab 循环、Escape 和关闭后返回入口。

## Do's and Don'ts

### Do

- 使用现有语义颜色变量并检查四套主题。
- 保持图片完整展示、已保存内容与版本行为。
- 区分模型处理中、失败、保存失败和未配置状态。
- 验证中文长文本、键盘操作、窄屏和减少动态效果。

### Don't

- 不因检测器的审美警告自动删除有语义的章节标记。
- 不把手机欢迎区的现有排序当成不可修改的品牌规则。
- 不把审查建议或尚未实现的可访问性行为写成现有能力。
- 不为了界面微调引入新的组件或动画依赖。


## 空间工作台（2026-10-28）

用户已批准多功能工作台与真实 Three.js 视觉方向。`src/workbench/Workbench.tsx` 为统一入口；原图片工作台在“图片创作”中继续使用原主题与存储逻辑。

空间桌面采用现代写实拟物风格：银灰金属、石墨黑、磨砂玻璃和暖白纸张；五个物件分别为薄壁金属文件托盘、弯曲书页、精密转换设备、金属显示器及玻璃文件架。支持旋转、缩放、点击物件与镜头靠近；下方提供等价普通按钮。阅读与表单保持平面布局，以保证文字清晰。

工作台样式使用 `.wb-*` 作用域，四套主题沿用原主题选择。窄屏改为底部导航，文件行重排；减少动态效果偏好下取消镜头过渡。转换面板使用原生 dialog，关闭后恢复入口焦点。

### 材质与摄影棚

`studioScene.ts` 将几何、程序纹理、棚光与 GPU 资源释放集中管理；`workbench-materials.css` 负责控件材质。统一左上方柔光方向，使用 PBR 金属度/粗糙度、拉丝与微表面凹凸、环境反射、玻璃透射和体积衰减。透射/衰减近似薄材质透光，不等价于完整多次次表面散射或路径追踪。

桌面采用轻微景深，窄屏关闭后处理景深，DOM 文本始终清晰。只在相机、物件或视口变化时重绘 GPU 场景；离开页面、隐藏标签页时释放或暂停。用户后续明确取消按钮的新拟物凸凹效果：交互控件采用纯色、细边框和清晰悬停状态，写实材质集中于三维桌面物件。保留四套主题，暖灰/纸上沿用现代材质，不引入仿旧皮革、锈迹或装饰性木纹。
