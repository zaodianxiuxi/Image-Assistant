export const IMAGE_QUALITY_OPTIONS = [
  { value: "balanced", label: "自然柔和", description: "亮度适中，细节柔和 · 推荐" },
  { value: "bright", label: "明亮清透", description: "主体更易看清，光线轻盈" },
  { value: "original", label: "忠于原提示", description: "已有成熟提示词时使用" }
];

export function normalizeImageQuality(value) {
  return IMAGE_QUALITY_OPTIONS.some((option) => option.value === value) ? value : "balanced";
}

const shared = "用户明确指定的媒介、画风、时辰、天气、剪影及光影意图优先。保留水墨、插画等原有表现方式，不将绘画强行改成摄影，也不将夜景改成白天。以下只补足未明确的视觉处理，不新增人物、道具或景物。";
const directions = {
  balanced: "亮度适中，中间调舒展，主体在符合场景的光线下自然可辨；不要为了氛围整体压暗，也不抹去必要的阴影。明暗过渡柔和，细节清楚而不生硬，保留远近层次与材质本来的质感；避免过度锐化、清晰度或局部对比增强、HDR 光晕和油亮高光，不添加人工模糊滤镜。",
  bright: "在符合时辰与光源的前提下，让画面明亮轻盈，舒展中间调，让主体及环境颜色更容易辨认。保留夜景的夜色、阴天的柔光及自然阴影；不强行补光，不漂白高光或洗掉层次。细节自然柔和，避免过度锐化、HDR、局部对比增强和油亮高光，不添加人工模糊滤镜。"
};
const blocks = Object.fromEntries(Object.entries(directions).map(([key, value]) => [key,
  "\n\n【出图偏好】\n" + shared + "\n" + value + "\n【出图偏好结束】"
]));

export function applyImageQuality(prompt, quality = "balanced", mode = "generate") {
  if (mode === "edit") return prompt;
  // Remove only an exact suffix produced by this helper, preserving user text and whitespace.
  let base = prompt;
  let previous;
  do {
    previous = base;
    for (const block of Object.values(blocks)) {
      if (base.endsWith(block)) base = base.slice(0, -block.length);
    }
  } while (base !== previous);
  return base + (blocks[normalizeImageQuality(quality)] || "");
}
