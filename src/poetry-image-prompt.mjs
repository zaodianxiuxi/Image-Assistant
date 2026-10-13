export function canReferencePoetryImage(scene, previous, seriesId) {
  return scene.referenceMode === "continuation" && scene.sceneOrder > 1 && Boolean(previous)
    && previous.seriesId === seriesId && Number(previous.nodeOrder) === scene.sceneOrder - 1;
}

export function buildPoetryImagePrompt({ scene, styleGuide = "", characterBible = "", continuityGuide = "", supplement = "", hasReference = false }) {
  return [
    "创作一张完整的诗意画面，以当前分镜为构图依据。每镜只呈现一个可见瞬间，留出安静空间，用距离、光线和具体细节传达情绪。不要拼贴多个镜头，不添加题字、水印或说明文字。",
    supplement.trim() && "用户创作偏好（与旧风格冲突时优先采用）：" + supplement.trim(),
    styleGuide.trim() ? "统一风格：" + styleGuide.trim() : !supplement.trim() && "默认视觉：自然写实摄影，克制色彩，可信材质与光源，避免舞台摆拍。",
    "光线忠于时辰和天气；保留暮色、阴影、薄雾及远近层次，不为看清人脸强行补光。避免过度锐化、塑料质感和夸张光效。用户明确指定绘画风格时，按该媒介表现层次。",
    characterBible.trim() && "人物与视觉锚点（仅在当前分镜明确出现时使用，不为满足设定新增人物或道具）：" + characterBible.trim(),
    continuityGuide.trim() && "连续性参考（当前分镜的地点、视点与时刻优先，不沿用无关旧景物）：" + continuityGuide.trim(),
    "诗句依据（理解用，不写在图上）：" + scene.sourceLine,
    "情绪方向（通过画面表达，不使用夸张表情）：" + scene.mood,
    "当前分镜：" + scene.prompt,
    hasReference && "附图为紧邻上一镜，仅参考相同人物的身份、衣着和同场景材质。重新按当前分镜安排景别、人物位置与构图；不要复制原姿势，不带入当前分镜未出现的人物。"
  ].filter(Boolean).join("\n");
}
