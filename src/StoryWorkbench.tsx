import { useEffect, useRef, useState } from "react";
import { X, LoaderCircle, Plus, Clapperboard, CheckCircle2, ImagePlus } from "lucide-react";
import { buildStoryImagePrompt, buildStoryReferencePrompt, selectStoryReferences, selectStoryShots } from "./storyboard-continuity.mjs";
import type { StoryEntity, StoryReference, StoryResult, StoryShot } from "./storyboard-continuity.mjs";
import { listStoryProjects, newStoryProject, saveStoryProject } from "./story-project-store";
import type { StoryProject } from "./story-project-store";
import StoryInspiration, { emptyInspiration } from "./StoryInspiration";
import type { StoryIdea } from "./StoryInspiration";
import "./story-workbench.css";

type Props = { open: boolean; onClose: () => void; onLegacy: () => void; onImage: (image: StoryResult, prompt: string, title: string, project: string, order: number) => void };
const inputKey = (p: StoryProject) => JSON.stringify([p.story, p.style, p.shotCount]);
const message = (error: unknown) => error instanceof Error ? error.message : "请求失败，请重试。";
const staleResults = (results: StoryProject["results"]) => Object.fromEntries(Object.entries(results).map(([id, result]) => [id, { ...result, stale: true }]));

async function readResponse(response: Response) {
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch { throw new Error(`服务响应异常（HTTP ${response.status}），请检查本地服务后重试。`); }
  if (!response.ok) throw new Error((body.error || "请求失败") + (body.requestId ? `（请求 ID：${body.requestId}）` : ""));
  return body;
}

function ReferenceImage({ reference, label }: { reference: StoryReference; label: string }) {
  const [src, setSrc] = useState(reference.image || "");
  useEffect(() => {
    if (!reference.blob) { setSrc(reference.image || ""); return; }
    const url = URL.createObjectURL(reference.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [reference.blob, reference.image]);
  return src ? <img src={src} alt={label} /> : null;
}

export default function StoryWorkbench({ open, onClose, onLegacy, onImage }: Props) {
  const [project, setProject] = useState<StoryProject | null>(null);
  const current = useRef<StoryProject | null>(null);
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [pauseRequested, setPauseRequested] = useState(false);
  const working = useRef(false);
  const stop = useRef(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("正在读取本地故事…");
  const [preview, setPreview] = useState<StoryResult | null>(null);

  function update(next: StoryProject) {
    const value = { ...next, updatedAt: Date.now() };
    current.current = value;
    setProject(value);
    setSaveStatus("正在保存…");
    return value;
  }
  async function persist(snapshot: StoryProject) {
    try {
      await saveStoryProject(snapshot);
      setProjects(items => [snapshot, ...items.filter(p => p.id !== snapshot.id)].sort((a, b) => b.updatedAt - a.updatedAt));
      if (current.current === snapshot) setSaveStatus("已保存在此浏览器");
      return true;
    } catch {
      if (current.current === snapshot) setSaveStatus("保存失败，请勿刷新；请导出故事备份");
      return false;
    }
  }
  useEffect(() => {
    let active = true;
    listStoryProjects().then(items => {
      if (!active) return;
      setProjects(items);
      const value = items[0] || newStoryProject();
      current.current = value; setProject(value);
    }).catch(() => {
      if (!active) return;
      const value = newStoryProject(); current.current = value; setProject(value);
      setError("本地故事存储暂不可用。可以创作，但请先导出故事备份，避免刷新丢失。");
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!project) return;
    const timer = window.setTimeout(() => {
      void persist(project);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { if (preview) setPreview(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, preview, onClose]);

  async function switchProject(id?: string) {
    if (working.current) return;
    working.current = true; setBusy(true);
    try {
      if (current.current) await saveStoryProject(current.current);
      const items = await listStoryProjects();
      setProjects(items);
      update(items.find(p => p.id === id) || newStoryProject());
      setError(""); setStatus("");
    } catch { setError("保存当前故事失败，已保留当前内容。请先导出备份再切换。"); }
    finally { working.current = false; setBusy(false); }
  }
  async function run(task: () => Promise<void>, batch = false) {
    if (working.current) return;
    working.current = true; stop.current = false; setBusy(true); setBatchRunning(batch); setPauseRequested(false); setError("");
    try { await task(); } catch (caught) { setError(message(caught)); setStatus("操作未完成，可修改后重试。"); }
    finally { working.current = false; setBusy(false); setBatchRunning(false); }
  }
  async function planStory() {
    const p = current.current;
    if (!p?.story.trim()) { setError("请先输入故事。"); return; }
    await run(async () => {
      setStatus("正在分析故事因果、人物场景和镜头衔接…");
      const { plan } = await readResponse(await fetch("/api/storyboard/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story: p.story, style: p.style, shotCount: p.shotCount }) }));
      if (p.plan) {
        const [story, style, shotCount] = JSON.parse(p.plannedInput || inputKey(p));
        const archived = { ...p, story, style, shotCount };
        await saveStoryProject(archived);
        setProjects(items => [archived, ...items.filter(item => item.id !== archived.id)]);
      }
      update({ ...p, id: p.plan ? crypto.randomUUID() : p.id, title: plan.title, plan, plannedInput: inputKey(p), references: [], results: {} });
      setStatus(`已规划 ${plan.shots.length} 镜。先检查人物和分镜，再选定角色参考图。${p.plan ? "原版本已保留在故事列表。" : ""}`);
    });
  }
  async function generateIdeas() {
    const p = current.current; if (!p) return;
    const inspiration = p.inspiration || emptyInspiration();
    const { genre, mood, keywords } = inspiration;
    await run(async () => {
      setStatus("正在构思三个不同的故事方向…");
      const { ideas } = await readResponse(await fetch("/api/storyboard/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ genre, mood, keywords, previousTitles: inspiration.ideas.map(idea => idea.title) }) }));
      const snapshot = update({ ...p, inspiration: { ...inspiration, ideas, generatedPreferences: { genre, mood, keywords } } });
      await persist(snapshot);
      setStatus("三个故事方向已生成。选择喜欢的方向展开，已有正文草稿会保留到你重新展开成功。");
    });
  }
  async function expandIdea(idea: StoryIdea) {
    const p = current.current; if (!p?.inspiration) return;
    const inspiration = p.inspiration;
    await run(async () => {
      setStatus(`正在把「${idea.title}」展开成完整故事…`);
      const { draft } = await readResponse(await fetch("/api/storyboard/expand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(inspiration.generatedPreferences || inspiration), idea }) }));
      const snapshot = update({ ...p, inspiration: { ...inspiration, draft, selectedTitle: idea.title } });
      await persist(snapshot);
      setStatus("故事已展开。可以修改正文，满意后点击“采用这个故事”，再规划分镜。");
    });
  }
  async function adoptIdea() {
    const p = current.current; const draft = p?.inspiration?.draft;
    if (!p || !draft?.story.trim() || !draft.title.trim()) return;
    await run(async () => {
      if (!await persist(p)) throw new Error("当前内容保存失败，请先导出备份再采用新故事。");
      const base = p.story.trim() || p.plan ? { ...newStoryProject(), style: p.style, size: p.size, shotCount: p.shotCount, inspiration: p.inspiration } : p;
      const snapshot = update({ ...base, title: draft.title.trim(), story: draft.story.trim() });
      await persist(snapshot);
      setStatus("故事已填入下方输入区。确认内容和风格后，点击“规划故事分镜”。");
    });
  }
  function editShot(id: string, field: keyof StoryShot, value: string) {
    const p = current.current; if (!p?.plan) return;
    const index = p.plan.shots.findIndex(s => s.id === id);
    const affected = new Set(p.plan.shots.slice(index).map(s => s.id));
    update({ ...p, plan: { ...p.plan, shots: p.plan.shots.map(s => s.id === id ? { ...s, [field]: value } : s) }, results: Object.fromEntries(Object.entries(p.results).map(([key, result]) => [key, affected.has(key) ? { ...result, stale: true } : result])) });
  }
  function editEntity(kind: "character" | "setting", id: string, value: string) {
    const p = current.current; if (!p?.plan) return;
    const field = kind === "character" ? "characters" : "settings";
    update({ ...p, plan: { ...p.plan, [field]: p.plan[field].map(e => e.id === id ? { ...e, description: value } : e) }, references: p.references.map(r => r.kind === kind && r.targetId === id ? { ...r, confirmed: false } : r), results: staleResults(p.results) });
  }
  function setReference(ref: StoryReference) {
    const p = current.current; if (!p) return;
    update({ ...p, references: [...p.references.filter(r => !(r.kind === ref.kind && r.targetId === ref.targetId)), ref], results: staleResults(p.results) });
  }
  async function uploadReference(file: File | undefined, entity: StoryEntity, kind: "character" | "setting") {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024) { setError("参考图请使用 PNG、JPEG 或 WebP，单张不超过20 MB。"); return; }
    setReference({ id: crypto.randomUUID(), kind, targetId: entity.id, blob: file, confirmed: false });
    setStatus("请检查上传图片，满意后点击“选定此图”。");
  }
  async function generateReference(entity: StoryEntity, kind: "character" | "setting") {
    const p = current.current; if (!p?.plan) return;
    await run(async () => {
      setStatus(`正在生成${entity.name}的${kind === "character" ? "定妆照" : "场景图"}…`);
      const result = await readResponse(await fetch("/api/images/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: buildStoryReferencePrompt(p.plan!, entity, kind), size: kind === "character" ? "864x1536" : "1536x864", preserveComposition: true, title: entity.name + "参考", seriesName: p.title + "-" + p.id.slice(0, 8) }) }));
      setReference({ id: crypto.randomUUID(), kind, targetId: entity.id, image: result.image, confirmed: false });
      setStatus("参考图已生成。检查外貌和服装，满意后点击“选定此图”。");
    });
  }
  async function generateShots(mode: "trial" | "remaining" | string) {
    const p = current.current; if (!p?.plan) return;
    if (p.plannedInput !== inputKey(p)) { setError("故事、风格或镜头数量已改动，请先重新规划。"); return; }
    const shots = mode === "trial" || mode === "remaining" ? selectStoryShots(p.plan.shots, p.results, mode) : p.plan.shots.filter(s => s.id === mode);
    if (!shots.length) { setStatus("这些镜头已完成，可点击单镜重拍。"); return; }
    const incomplete = shots.find(s => ![s.framing, s.action, s.emotion, s.continuity, s.prompt].every(value => value.trim()));
    if (incomplete || !p.plan.styleGuide.trim() || [...p.plan.characters, ...p.plan.settings].some(e => !e.description.trim())) {
      setError(incomplete ? `请补全「${incomplete.title}」的景别、动作、视线、衔接和画面提示词。` : "请补全视觉风格、人物和场景设定。"); return;
    }
    const needed = new Set(shots.flatMap(s => s.characterIds));
    const missing = p.plan.characters.filter(c => needed.has(c.id) && !p.references.some(r => r.kind === "character" && r.targetId === c.id && r.confirmed));
    if (missing.length) { setError("请先生成或上传并选定角色参考图：" + missing.map(c => c.name).join("、")); return; }
    await run(async () => {
      if (!await persist(p)) throw new Error("故事进度保存失败，请先导出备份并检查浏览器存储后再生成。");
      let completed = 0;
      for (const shot of shots) {
        if (stop.current) break;
        const latest = current.current!;
        const plan = latest.plan!;
        const order = plan.shots.findIndex(s => s.id === shot.id);
        const before = plan.shots[order - 1];
        const lastResult = before && latest.results[before.id];
        const previous = before && lastResult?.image && !lastResult.stale ? { shot: before, image: lastResult.image } : null;
        const refs = selectStoryReferences(shot, latest.references.filter(r => r.confirmed), previous);
        const canvas = latest.size === "1536x864" ? "横向16:9宽画幅" : latest.size === "864x1536" ? "竖向9:16画幅" : "正方形画幅";
        const prompt = `输出一张${canvas}的全新分镜，重新组织构图以铺满目标画布，不沿用参考图片的画幅和裁切。按当前景别保留完整头部及关键动作，不要黑边。\n` + buildStoryImagePrompt(plan, shot, refs);
        setStatus(`正在生成第 ${order + 1} 镜「${shot.title}」，本批 ${completed + 1}/${shots.length}…`);
        try {
          let response: Response;
          const metadata = { prompt, size: latest.size, preserveComposition: true, title: shot.title, seriesName: latest.title + "-" + latest.id.slice(0, 8), nodeOrder: order + 1 };
          if (refs.length) {
            const form = new FormData();
            Object.entries(metadata).forEach(([key, value]) => form.append(key, String(value)));
            let bytes = 0;
            for (const [index, ref] of refs.entries()) {
              let blob = ref.blob;
              if (!blob) {
                const fetched = await fetch(ref.image!);
                if (!fetched.ok) throw new Error("参考图无法读取，请重新上传或生成，避免人物失去一致性。");
                blob = await fetched.blob();
              }
              bytes += blob.size;
              if (blob.size > 20 * 1024 * 1024 || bytes > 50 * 1024 * 1024) throw new Error("本镜参考图总大小超过50 MB或单张超过20 MB，请压缩后重新上传。");
              form.append("image[]", blob, `reference-${index + 1}.${blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png"}`);
            }
            response = await fetch("/api/images/edit", { method: "POST", body: form });
          } else {
            response = await fetch("/api/images/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata) });
          }
          const result: StoryResult = await readResponse(response);
          const next = current.current!;
          // Later frames may depend on this frame; preserve them but mark for review/re-shoot.
          const downstream = new Set(plan.shots.slice(order + 1).map(s => s.id));
          const results = Object.fromEntries(Object.entries(next.results).map(([id, value]) => [id, mode !== "trial" && mode !== "remaining" && downstream.has(id) ? { ...value, stale: true } : value]));
          const snapshot = update({ ...next, results: { ...results, [shot.id]: result } });
          onImage(result, prompt, shot.title, latest.title, order + 1);
          completed++;
          if (!await persist(snapshot)) {
            stop.current = true;
            setError("图片已生成，但故事进度未保存，已停止后续生成。请先导出备份；图片文件仍保存在桌面。");
            break;
          }
        } catch (caught) {
          const next = current.current!;
          update({ ...next, results: { ...next.results, [shot.id]: { ...next.results[shot.id], error: message(caught), stale: true } } });
          throw new Error(`第${order + 1}镜失败，批次已停止，已完成图片保留。${message(caught)}`);
        }
      }
      setStatus(`${stop.current ? "已暂停" : "本批完成"}：生成 ${completed} 张。请检查人物、动作和衔接，再继续或单镜重拍。`);
    }, shots.length > 1);
  }

  async function exportProject() {
    const p = current.current; if (!p) return;
    const references = await Promise.all(p.references.map(async ref => ({ ...ref, blob: undefined, dataUrl: ref.blob ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(ref.blob!); }) : undefined })));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...p, references }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${p.title}-故事备份.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!open) return null;
  const plan = project?.plan;
  const inputChanged = project?.plan && project.plannedInput !== inputKey(project);
  const remaining = plan && project ? selectStoryShots(plan.shots, project.results, "remaining").length : 0;
  const castReady = Boolean(plan && project && plan.characters.filter(c => plan.shots.some(shot => shot.characterIds.includes(c.id))).every(c => project.references.some(r => r.kind === "character" && r.targetId === c.id && r.confirmed)));

  function entityCard(entity: StoryEntity, kind: "character" | "setting") {
    const ref = project!.references.find(r => r.kind === kind && r.targetId === entity.id);
    return <article className="story-reference" key={kind + entity.id}>
      <div><strong>{entity.name}</strong><small>{kind === "character" ? "角色参考 · 出场镜头固定使用" : "场景参考 · 可选，仅用于本场景"}</small></div>
      <textarea aria-label={`${entity.name}设定`} value={entity.description} onChange={e => editEntity(kind, entity.id, e.target.value)} rows={3} />
      {ref && <ReferenceImage reference={ref} label={`${entity.name}参考图`} />}
      <div className="story-actions">
        <button type="button" onClick={() => void generateReference(entity, kind)}><ImagePlus size={14} />{ref ? "重新生成参考" : "生成参考图"}</button>
        <label className="story-upload">上传参考<input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`上传${entity.name}参考图`} onChange={e => { void uploadReference(e.target.files?.[0], entity, kind); e.target.value = ""; }} /></label>
        {ref && <button type="button" className={ref.confirmed ? "is-selected" : "primary"} onClick={() => setReference({ ...ref, confirmed: !ref.confirmed })}>{ref.confirmed ? <><CheckCircle2 size={14} />已选定 · 取消</> : "选定此图"}</button>}
      </div>
    </article>;
  }

  return <div className="manager-backdrop story-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="story-dialog" role="dialog" aria-modal="true" aria-label="故事分镜工作台">
      <header className="manager-toolbar"><div><span className="story-kicker"><Clapperboard size={14} /> STORY STUDIO</span><strong>故事分镜</strong><small>先定人物与镜头，再试拍、续拍</small></div><button className="icon-button" type="button" aria-label="关闭故事分镜" onClick={onClose}><X size={18} /></button></header>
      <div className="story-body">
        <div className="story-project-bar">
          <select aria-label="已保存故事" disabled={busy || !project} value={project?.id || ""} onChange={e => void switchProject(e.target.value)}>{project && !projects.some(p => p.id === project.id) && <option value={project.id}>{project.title}</option>}{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          <button type="button" disabled={busy} onClick={() => void switchProject()}><Plus size={14} />新故事</button>
          <button type="button" disabled={!project || busy} onClick={() => void exportProject().catch(e => setError(message(e)))}>导出备份</button>
          <button type="button" disabled={busy} onClick={onLegacy}>已有数据库系列</button>
          <small role="status">{saveStatus}</small>
        </div>
        {!project ? <p>正在读取故事…</p> : <>
          <div className="story-chapters" aria-label="故事创作阶段">
            <div className={!plan || inputChanged ? "current" : ""}><span>01</span><div><strong>写下故事</strong><small>{plan ? `已规划 ${plan.shots.length} 个镜头` : "一个念头，就是开场"}</small></div></div>
            <div className={plan && !inputChanged && !castReady ? "current" : ""}><span>02</span><div><strong>确定主角</strong><small>{project.references.some(r => r.confirmed) ? `已选定 ${project.references.filter(r => r.confirmed).length} 张参考` : "让人物与场景保持一致"}</small></div></div>
            <div className={plan && !inputChanged && castReady ? "current" : ""}><span>03</span><div><strong>让故事成像</strong><small>{plan ? `${plan.shots.length - (remaining || 0)} 镜已完成 · ${remaining} 镜待完成` : "先试拍，再展开整个故事"}</small></div></div>
          </div>
          <fieldset disabled={busy} className="story-fields">
            <section className="story-section"><h2>1. 故事与风格</h2>
              <StoryInspiration value={project.inspiration || emptyInspiration()} busy={busy} hasStory={Boolean(project.story.trim() || plan)} onChange={inspiration => update({ ...project, inspiration })} onGenerate={() => void generateIdeas()} onExpand={idea => void expandIdea(idea)} onAdopt={() => void adoptIdea()} />
              <label>故事原文或梗概<textarea aria-label="故事原文或梗概" value={project.story} maxLength={20000} rows={4} placeholder="写清楚人物想做什么、遇到什么、发生了什么变化。支持现代、历史、奇幻等题材。" onChange={e => update({ ...project, story: e.target.value })} /></label>
              <div className="story-options"><label>风格偏好<input aria-label="故事风格偏好" value={project.style} maxLength={1500} onChange={e => update({ ...project, style: e.target.value })} /></label>
                <label>镜头数量<select aria-label="故事镜头数量" value={project.shotCount} onChange={e => update({ ...project, shotCount: Number(e.target.value) })}><option value={0}>自动 · 4–12镜</option>{[4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n} 镜</option>)}</select></label>
                <label>画幅<select aria-label="故事画幅" value={project.size} onChange={e => update({ ...project, size: e.target.value, results: staleResults(project.results) })}><option value="1536x864">横屏 16:9</option><option value="864x1536">竖屏 9:16</option><option value="1024x1024">正方形 1:1</option></select></label></div>
              <button className="primary" type="button" disabled={!project.story.trim()} onClick={() => void planStory()}><Clapperboard size={15} />{plan ? "重新规划为新版本" : "规划故事分镜"}</button>
              {inputChanged && <p className="story-warning">故事输入已修改，请重新规划；原版本会保留。</p>}
            </section>
            {plan && <>
              <section className="story-section"><h2>2. 人物与场景定稿</h2><p>{plan.synopsis}</p><label>统一视觉风格<textarea aria-label="统一视觉风格" value={plan.styleGuide} rows={2} onChange={e => update({ ...project, plan: { ...plan, styleGuide: e.target.value }, references: project.references.map(r => ({ ...r, confirmed: false })), results: staleResults(project.results) })} /></label>
                <p className="story-help">先选定每个出场角色的参考图。图像生成会使用当前 API 额度；生成后可检查并重新选择。场景参考为可选。</p>
                <div className="story-reference-grid">{plan.characters.map(e => entityCard(e, "character"))}</div>
                <details><summary>场景设定与参考图（{plan.settings.length}处）</summary><div className="story-reference-grid">{plan.settings.map(e => entityCard(e, "setting"))}</div></details>
              </section>
              <section className="story-section"><h2>3. 检查分镜，先试拍四镜</h2><p className="story-help">每镜一个瞬间。修改分镜会把该镜及后续画面标记为需重拍；改变参考图后需重新检查整组。</p>
                <div className="story-actions"><button className="primary" type="button" disabled={Boolean(inputChanged)} onClick={() => void generateShots("trial")}>四镜试拍</button><button type="button" disabled={!remaining || Boolean(inputChanged)} onClick={() => void generateShots("remaining")}>继续生成 · {remaining} 镜待完成</button></div>
                <div className="story-shot-grid">{plan.shots.map((shot, i) => {
                  const result = project.results[shot.id];
                  return <article className="story-shot" data-state={result?.stale ? "stale" : result?.image ? "done" : "pending"} key={shot.id}>
                    <header><strong>{String(i + 1).padStart(2,"0")} · {shot.title}</strong><span>{result?.stale ? "需重拍" : result?.image ? "已完成" : "待拍"}</span></header>
                    <p>{shot.storyText}</p><small>{plan.settings.find(s => s.id === shot.settingId)?.name} · {shot.characterIds.map(id => plan.characters.find(c => c.id === id)?.name).join("、") || "无人镜头"}</small>
                    {([['framing','景别与机位'],['action','当前动作'],['emotion','表情与视线'],['continuity','前后衔接']] as const).map(([field,label]) => <label key={field}>{label}<textarea aria-label={`第${i + 1}镜${label}`} rows={2} value={shot[field]} onChange={e => editShot(shot.id, field, e.target.value)} /></label>)}
                    <details><summary>画面细节提示词</summary><textarea aria-label={`第${i + 1}镜提示词`} value={shot.prompt} rows={4} onChange={e => editShot(shot.id, "prompt", e.target.value)} /></details>
                    {result?.image && <button className="story-image" type="button" onClick={() => setPreview(result)} aria-label={`预览第${i + 1}镜`}><img src={result.image} alt={shot.title} /></button>}
                    {result?.error && <p className="story-error">{result.error}</p>}
                    <div className="story-actions"><button type="button" disabled={Boolean(inputChanged)} onClick={() => void generateShots(shot.id)}>{result?.image ? "重拍此镜" : result?.error ? "重试此镜" : "生成此镜"}</button>{result?.image && <a href={result.image} download={result.fileName}>下载图片</a>}</div>
                  </article>;
                })}</div>
              </section>
            </>}
          </fieldset>
        </>}
      </div>
      <footer className="story-progress"><div role="status">{busy && <LoaderCircle size={16} className="spin" />}<span>{status || (plan ? `已恢复故事，共 ${plan.shots.length} 镜，${plan.shots.length - (remaining || 0)} 镜已完成，${remaining} 镜待生成或重拍。` : "输入故事开始规划。故事与参考图保存在当前浏览器，图片保存到桌面。")}</span></div>{error && <p role="alert">{error}</p>}{batchRunning && <button type="button" disabled={pauseRequested} onClick={() => { stop.current = true; setPauseRequested(true); setStatus("当前请求完成后暂停，已完成内容会保留。"); }}>{pauseRequested ? "将在当前镜头完成后暂停" : "当前镜头后暂停"}</button>}</footer>
    </section>
    {preview?.image && <div className="story-preview" role="dialog" aria-modal="true" aria-label="故事图片预览" onClick={() => setPreview(null)}><button className="icon-button" aria-label="关闭故事图片预览" type="button" onClick={() => setPreview(null)}><X /></button><img src={preview.image} alt="故事分镜生成结果" /></div>}
  </div>;
}
