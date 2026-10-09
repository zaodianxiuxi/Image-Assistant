# 电影创作室实施计划

**Goal:** 改善首页和故事工作台的视觉层次，让生成操作与故事入口容易找到。

**Architecture:** 提取纯展示的 CreativeWelcome 组件，通过 onStory / onPrompt / onPoetry 回调复用现有功能。cinema-workspace.css 负责新工作台布局与主题，故事样式仍保留在 story-workbench.css；不改接口与数据存储。

**Tech Stack:** React 18、TypeScript、CSS、lucide-react；不增加依赖。

## 约束

- 尊重已保存主题，深色主题采用石墨黑与暖金配色。
- 不调用付费生成服务，不更改用户故事数据。
- 保留减少动态效果、键盘焦点、错误反馈与三主题适配。

## 步骤

- [x] 首页：添加 CreativeWelcome.tsx，三个回调分别打开故事、聚焦提示词、打开诗词。绘制注明为示意的原生 SVG 分镜装饰。
- [x] App.tsx：输入区优先展示描述；生成按钮通过 form="image-prompt-form" 保持提交语义，放在独立底栏；常驻显示工具文字。main.tsx 引入新样式。
- [x] cinema-workspace.css：布局采用 312px / 自适应 / 88px，深色主题暖金重点，850px 以下单列；补齐主题变量、可见焦点、160–280ms 反馈。
- [x] StoryWorkbench.tsx / StoryInspiration.tsx / story-workbench.css：加入由真实项目数据计算的阶段提示、灵感卡片标题层次、选中样式和分镜状态标签。
- [x] 验证：npm run build 与 npm test；移除被新设计替代的纯像素与隐藏标签断言，不增加镜像实现测试。
- [x] 浏览器检查：1280px 首页、故事入口、灵感展开、主题切换、390px 窄屏；验证无溢出和按钮遮挡。保存最终截图，更新 README。
