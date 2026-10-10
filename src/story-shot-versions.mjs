// Keep immutable generation snapshots separate from the currently selected result.
export function shotContextKey(project, shotId) {
  const plan = project.plan;
  const index = plan?.shots.findIndex(s => s.id === shotId) ?? -1;
  if (index < 0) return "";
  const shot = plan.shots[index];
  const before = plan.shots[index - 1];
  const previous = before && project.results[before.id];
  return JSON.stringify({ size: project.size, style: plan.styleGuide, shot,
    characters: plan.characters.filter(c => shot.characterIds.includes(c.id)),
    setting: plan.settings.find(s => s.id === shot.settingId),
    references: project.references.filter(r => r.confirmed && (r.kind === "character" && shot.characterIds.includes(r.targetId) || r.kind === "setting" && r.targetId === shot.settingId)).map(r => ({ id: r.id, kind: r.kind, targetId: r.targetId, image: r.image })),
    previous: before?.settingId === shot.settingId && previous?.image && !previous.stale ? previous.image : null
  });
}

export function getShotVersions(project, shotId) {
  const saved = project.shotVersions?.[shotId] || [];
  const result = project.results[shotId];
  if (!result?.image || saved.some(v => v.result.image === result.image)) return saved;
  return [...saved, { id: result.localVersionId || `legacy:${result.image}`, result: { ...result }, createdAt: null, prompt: "", instruction: "已有图片（早期生成记录）", contextKey: result.stale || result.error ? "" : shotContextKey(project, shotId) }];
}

export function isShotVersionCurrent(project, shotId, version) {
  const inputChanged = project.plannedInput && project.plannedInput !== JSON.stringify([project.story, project.style, project.shotCount]);
  return !inputChanged && Boolean(version.contextKey) && version.contextKey === shotContextKey(project, shotId);
}

export function adoptShotVersion(project, shotId, versionId) {
  const versions = getShotVersions(project, shotId);
  const version = versions.find(v => v.id === versionId);
  const index = project.plan?.shots.findIndex(s => s.id === shotId) ?? -1;
  if (!version?.result.image || index < 0 || project.results[shotId]?.image === version.result.image) return project;
  const downstream = new Set(project.plan.shots.slice(index + 1).map(s => s.id));
  const results = Object.fromEntries(Object.entries(project.results).map(([id, result]) => [id, downstream.has(id) ? { ...result, stale: true } : result]));
  results[shotId] = { ...version.result, error: undefined, localVersionId: version.id, stale: !isShotVersionCurrent(project, shotId, version) };
  return { ...project, shotVersions: { ...project.shotVersions, [shotId]: versions }, results };
}

export function addShotVersion(project, shotId, result, details, autoAdopt) {
  if (!result.image || !project.plan?.shots.some(s => s.id === shotId)) throw new Error("图片结果无效，已有版本已保留。");
  const previous = getShotVersions(project, shotId);
  const version = { ...details, createdAt: details.createdAt ?? Date.now(), prompt: details.prompt || "", instruction: details.instruction || "", result: { ...result, error: undefined, stale: false, localVersionId: details.id }, contextKey: shotContextKey(project, shotId) };
  const next = { ...project, shotVersions: { ...project.shotVersions, [shotId]: [...previous, version] } };
  return autoAdopt ? adoptShotVersion(next, shotId, version.id) : next;
}

export const RETAKE_ISSUES = [
  { id: "identity", label: "人物不一致", instruction: "严格对齐已选定角色参考图的脸型、年龄、发型、服装与配饰；保持当前镜头动作和机位，不照搬定妆照的姿势。" },
  { id: "action", label: "动作太僵", instruction: "调整为自然的动作中间态，让重心、关节弯曲、手与道具接触可信；表情克制，目光指向当前任务，不看镜头摆拍。" },
  { id: "continuity", label: "和上一镜接不上", instruction: "依据前后衔接说明检查人物行进方向、左右手、道具状态和时间顺序；有上一镜参考时衔接其状态，但表现本镜新动作，不复制前一幅画面。" },
  { id: "composition", label: "构图不理想", instruction: "按本镜景别重新安排人物、环境和留白，完整保留头部和关键动作，避免遮挡、意外裁切和多余肢体。" }
];

export function buildRetakeInstruction(issues, notes) {
  return [...RETAKE_ISSUES.filter(item => issues.includes(item.id)).map(item => item.instruction), notes.trim() ? "补充要求：" + notes.trim() : ""].filter(Boolean).join("\n");
}

export function appendRetakeInstruction(prompt, instruction) {
  return instruction.trim() ? `${prompt}\n\n本次重拍修改要求（只调整本镜，保持故事设定、角色身份及所选画幅）：\n${instruction.trim()}` : prompt;
}
