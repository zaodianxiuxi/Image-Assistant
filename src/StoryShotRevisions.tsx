import { useEffect, useRef, useState } from "react";
import { CheckCircle2, GitCompareArrows, RefreshCw } from "lucide-react";
import { buildRetakeInstruction, getShotVersions, isShotVersionCurrent, RETAKE_ISSUES } from "./story-shot-versions.mjs";
import type { RetakeDraft, ShotVersion } from "./story-shot-versions.mjs";
import type { StoryProject } from "./story-project-store";
import type { StoryResult, StoryShot } from "./storyboard-continuity.mjs";
import "./story-shot-revisions.css";

const emptyDraft = (): RetakeDraft => ({ issues: [], notes: "", instruction: "" });
type Props = { project: StoryProject; shot: StoryShot; order: number; busy: boolean; inputChanged: boolean; onDraft: (draft: RetakeDraft) => void; onGenerate: (instruction: string) => void; onAdopt: (id: string) => void; onPreview: (result: StoryResult) => void };

function VersionImage({ version, onPreview }: { version: ShotVersion; onPreview: () => void }) {
  const [failed, setFailed] = useState(false);
  return failed ? <p className="version-image-error">图片无法读取，请检查本地服务或图片文件。<button type="button" onClick={() => setFailed(false)}>重新加载</button></p> : <button type="button" className="version-image" onClick={onPreview} aria-label="放大查看此版本"><img src={version.result.image} alt="分镜版本画面" onError={() => setFailed(true)} /></button>;
}

export default function StoryShotRevisions({ project, shot, order, busy, inputChanged, onDraft, onGenerate, onAdopt, onPreview }: Props) {
  const versions = getShotVersions(project, shot.id);
  const selected = versions.find(v => v.result.image === project.results[shot.id]?.image);
  const draft = project.retakeDrafts?.[shot.id] || emptyDraft();
  const [leftId, setLeftId] = useState(selected?.id || versions[0]?.id || "");
  const [rightId, setRightId] = useState(versions.at(-1)?.id || "");
  const [open, setOpen] = useState(false);
  const previousCount = useRef(versions.length);
  useEffect(() => {
    if (versions.length > previousCount.current) { setOpen(true); setLeftId(selected?.id || versions[0]?.id || ""); setRightId(versions.at(-1)?.id || ""); }
    previousCount.current = versions.length;
  }, [versions.length, selected?.id]);

  function changePreferences(issues: string[], notes: string) { onDraft({ issues, notes, instruction: buildRetakeInstruction(issues, notes) }); }
  function comparison(side: "left" | "right") {
    const id = side === "left" ? leftId : rightId;
    const version = versions.find(v => v.id === id) || (side === "left" ? versions[0] : versions.at(-1));
    if (!version) return null;
    const active = selected?.id === version.id;
    const compatible = isShotVersionCurrent(project, shot.id, version);
    return <div className={"shot-version" + (active ? " selected" : "")}>
      <label>{side === "left" ? "对比左侧" : "对比右侧"}<select aria-label={`第${order}镜${side === "left" ? "左" : "右"}侧版本`} value={version.id} onChange={e => (side === "left" ? setLeftId : setRightId)(e.target.value)}>{versions.map((item, i) => <option key={item.id} value={item.id}>版本 {i + 1}{selected?.id === item.id ? " · 当前采用" : ""}</option>)}</select></label>
      <VersionImage key={version.id} version={version} onPreview={() => onPreview(version.result)} />
      <small>{version.createdAt ? new Date(version.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "早期记录 · 时间未知"}</small>
      <p>{version.instruction || "按原分镜生成"}</p>
      {!compatible && <p className="version-warning">{version.contextKey ? "与当前设定或前镜不匹配，采用后仍需重拍。" : "缺少原始设定记录，采用后需重新检查。"}</p>}
      {version.prompt && <details><summary>查看这版生成描述</summary><p className="version-prompt">{version.prompt}</p></details>}
      <button type="button" className={active ? "is-selected" : "primary"} disabled={busy || active} onClick={() => onAdopt(version.id)}>{active ? <><CheckCircle2 size={14} />当前采用</> : "采用这个版本"}</button>
    </div>;
  }

  return <details className="shot-revisions" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary><GitCompareArrows size={15} />针对问题重拍 · 版本对比<span>{versions.length} 版</span></summary>
    <div className="retake-editor">
      <strong>这一镜想改哪里？</strong>
      <div className="retake-issues">{RETAKE_ISSUES.map(item => <button key={item.id} type="button" aria-pressed={draft.issues.includes(item.id)} onClick={() => changePreferences(draft.issues.includes(item.id) ? draft.issues.filter(id => id !== item.id) : [...draft.issues, item.id], draft.notes)}>{item.label}</button>)}</div>
      <label>补充修改要求<textarea aria-label={`第${order}镜补充修改要求`} rows={2} maxLength={1000} placeholder="例如：右手握住伞柄，视线看向前方，不要看镜头。" value={draft.notes} onChange={e => changePreferences(draft.issues, e.target.value)} /></label>
      <label>本次修改指令 · 可直接调整<textarea aria-label={`第${order}镜重拍指令`} rows={4} maxLength={3000} value={draft.instruction} onChange={e => onDraft({ ...draft, instruction: e.target.value })} /></label>
      <p className="story-help">选择问题或修改补充内容后会更新指令。重拍使用图片额度，新图生成后再对比选用。</p>
      <button type="button" className="primary" disabled={busy || inputChanged || !draft.instruction.trim()} onClick={() => onGenerate(draft.instruction)}><RefreshCw size={14} />按以上要求生成新版</button>
      {inputChanged && <p className="version-warning">故事输入已修改，请先重新规划。</p>}
    </div>
    {versions.length > 0 && <section className="version-comparison" aria-label={`第${order}镜版本对比`}><div className="version-comparison-heading"><strong>对比后，留下更好的一版</strong><p>采用后更新故事预览与后续参考；后续已生成镜头会标记为需重拍。切换版本不消耗额度。</p></div><div className="version-pair">{comparison("left")}{versions.length > 1 && comparison("right")}</div>{versions.length === 1 && <p className="story-help">已有一版。生成新版后可在这里并排比较，当前图片会保留。</p>}</section>}
  </details>;
}
