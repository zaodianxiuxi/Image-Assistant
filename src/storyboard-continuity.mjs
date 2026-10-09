export function selectStoryShots(shots, results, mode) {
  return (mode === "trial" ? shots.slice(0, 4) : shots).filter(shot => !results[shot.id]?.image || results[shot.id]?.stale);
}

export function selectStoryReferences(shot, references, previous) {
  const selected = references.filter(ref =>
    (ref.kind === "character" && shot.characterIds.includes(ref.targetId)) ||
    (ref.kind === "setting" && shot.settingId === ref.targetId));
  if (previous?.image && previous.shot.settingId === shot.settingId) {
    selected.push({ id: "previous", kind: "previous", targetId: "", image: previous.image });
  }
  return selected;
}

export function buildStoryImagePrompt(plan, shot, references = []) {
  const cast = plan.characters.filter(c => shot.characterIds.includes(c.id));
  const setting = plan.settings.find(s => s.id === shot.settingId);
  return [
    "创作连续故事中的一张独立画面。只表现当前镜头的单一瞬间，不要拼贴、多格漫画、字幕、水印。",
    "视觉风格：" + plan.styleGuide,
    "出场角色（仅出现本镜角色）：" + (cast.map(c => c.name + "：" + c.description).join("；") || "本镜无人"),
    "场景：" + (setting ? setting.name + "：" + setting.description : "以当前分镜为准"),
    ...references.map((ref, i) => {
      if (ref.kind === "character") return `参考图${i + 1}是${cast.find(c => c.id === ref.targetId)?.name || "角色"}的身份参考，只继承脸型、发型、服装与配饰，不照搬参考图的姿势、背景、构图或目光。`;
      if (ref.kind === "setting") return `参考图${i + 1}是本场景参考，继承建筑、物件和光源位置，允许按当前镜头改变机位、景别与取景范围。`;
      return `参考图${i + 1}是同场景紧邻上一镜，只衔接动作、道具状态与空间方向；当前镜头的机位、动作和景别优先，不要复制上一镜。`;
    }),
    "当前镜头：" + shot.title,
    "景别与机位：" + shot.framing,
    "可见动作：" + shot.action,
    "表情与视线：" + shot.emotion,
    "前后衔接：" + shot.continuity,
    "画面细节：" + shot.prompt,
    "动作应有真实重心、接触关系和明确视线目标，表情克制自然，人物专注于正在发生的事情，不为镜头摆拍。光线有合理来源，材质真实，避免塑料皮肤与过度锐化。"
  ].join("\n");
}

export function buildStoryReferencePrompt(plan, entity, kind) {
  return kind === "character"
    ? `任务是拍摄角色选角定妆照。角色：${entity.name}，${entity.description}。仅参考以下风格的色彩与材质：${plan.styleGuide}。定妆照构图优先于故事里的行进方向或动作：只有一个人，正面放松站立面对相机，眼睛和五官清楚可见，完整头顶及双脚全部入画，人物占画面高度约75%，头顶和脚下各留出空白。纯浅灰摄影棚背景，均匀柔和光线，不要街道或故事场景，不要裁切头部，不要文字、标签、拼图或多视图。`
    : `为故事制作场景定稿图，单张环境全景，无人物、文字或拼贴，明确空间布局与光源位置。视觉风格：${plan.styleGuide}。场景：${entity.name}，${entity.description}。`;
}
