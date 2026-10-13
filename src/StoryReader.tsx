import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, Clapperboard, ImageOff, Maximize2, Pencil, X } from "lucide-react";
import type { StoryProject } from "./story-project-store";
import type { StoryResult, StoryShot } from "./storyboard-continuity.mjs";
import StoryExport from "./StoryExport";
import "./story-reader.css";

function ShotImage({ shot, result }: { shot: StoryShot; result?: StoryResult }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (result?.image && !failed) return <img key={attempt} src={result.image} alt={shot.title} onError={() => setFailed(true)} />;
  return <div className="reader-placeholder"><ImageOff size={30} /><strong>{failed ? "图片暂时无法加载" : result?.error ? "这一镜生成失败" : "这一镜还没有画面"}</strong><p>{failed ? "确认本地服务与图片文件可用后重试。" : "先读旁白，仍然可以检查故事衔接。"}</p>{failed && <button type="button" onClick={() => { setAttempt(n => n + 1); setFailed(false); }}>重新加载图片</button>}</div>;
}

type Props = { project: StoryProject; inputChanged: boolean; onClose: () => void; onEdit: (shotId: string) => void };

export default function StoryReader({ project, inputChanged, onClose, onEdit }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"read" | "screen">("read");
  const [index, setIndex] = useState(0);
  const shots = project.plan?.shots || [];
  const activeIndex = Math.min(index, Math.max(0, shots.length - 1));
  const completed = shots.filter(shot => project.results[shot.id]?.image && !project.results[shot.id]?.stale).length;

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus({ preventScroll: true }); };
  }, []);

  function navigate(next: number) {
    setIndex(Math.max(0, Math.min(shots.length - 1, next)));
    content.current?.scrollTo({ top: 0 });
  }

  function frame(shot: StoryShot, position: number) {
    const result = project.results[shot.id];
    const status = result?.stale && result.image ? "需重拍 · 当前为旧画面" : result?.error ? "生成失败" : result?.image ? "已生成" : "待生成";
    return <article className="reader-frame" key={shot.id} aria-label={`第${position + 1}镜：${shot.title}`}>
      <div className="reader-frame-heading"><span>镜头 {String(position + 1).padStart(2, "0")}</span><span className={result?.stale || result?.error ? "reader-warning" : ""}>{status}</span></div>
      <div className="reader-image"><ShotImage key={`${shot.id}:${result?.image || "empty"}`} shot={shot} result={result} /></div>
      <div className="reader-caption"><div><h2>{shot.title}</h2><p>{shot.storyText || "这一镜还没有旁白。"}</p></div><button type="button" className="reader-edit" onClick={() => onEdit(shot.id)}><Pencil size={13} />返回此镜修改</button></div>
    </article>;
  }

  return createPortal(<dialog ref={dialog} className={`story-reader reader-${mode}`} aria-labelledby="story-reader-title" onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => {
    if (e.key === "Escape") { e.stopPropagation(); return; }
    if ((e.target as HTMLElement).closest('.reader-export')) return;
    if (mode !== "screen" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); navigate(activeIndex + (e.key === "ArrowRight" ? 1 : -1)); }
  }}>
    <header className="reader-toolbar"><div><span className="reader-kicker">STORY SCREENING</span><h1 id="story-reader-title">{project.plan?.title || project.title}</h1><small>{shots.length} 镜 · {completed} 镜画面已就绪</small></div><div className="reader-toolbar-actions"><div className="reader-modes" aria-label="预览方式"><button type="button" aria-pressed={mode === "read"} onClick={() => { setMode("read"); content.current?.scrollTo({ top: 0 }); }}><BookOpen size={15} />连续阅读</button><button type="button" aria-pressed={mode === "screen"} onClick={() => { setMode("screen"); navigate(activeIndex); }}><Maximize2 size={15} />全屏翻看</button></div><button type="button" className="reader-close" aria-label="关闭故事成片预览" onClick={onClose}><X size={21} /></button></div></header>
    <StoryExport project={project} inputChanged={inputChanged} />
    {inputChanged && <p className="reader-version-warning" role="status">故事或风格已修改。这里展示的是上次规划的分镜，请返回工作台重新规划后再检查。</p>}
    <div className="reader-content" ref={content}>
      {mode === "read" && <div className="reader-intro"><Clapperboard size={24} /><span>故事成片预览</span><p>{project.plan?.synopsis}</p><small>按镜头顺序阅读，看看情绪和动作是否自然接续。</small></div>}
      {shots.length ? mode === "read" ? shots.map(frame) : frame(shots[activeIndex], activeIndex) : <p className="reader-no-shots">还没有分镜，请返回工作台先规划故事。</p>}
      {mode === "read" && shots.length > 0 && <div className="reader-end"><span>THE END</span><p>{completed === shots.length ? "故事已到最后一镜。" : `故事已到最后一镜，还有 ${shots.length - completed} 镜待生成或重拍。`}</p></div>}
    </div>
    {mode === "screen" && shots.length > 0 && <nav className="reader-navigation" aria-label="镜头翻页"><button type="button" aria-label="上一镜" disabled={activeIndex === 0} onClick={() => navigate(activeIndex - 1)}><ArrowLeft size={18} /><span>上一镜</span></button><div className="reader-shot-picker">{shots.map((shot, i) => <button key={shot.id} type="button" aria-label={`跳到第${i + 1}镜：${shot.title}`} aria-current={i === activeIndex ? "step" : undefined} onClick={() => navigate(i)}>{String(i + 1).padStart(2, "0")}</button>)}</div><span className="reader-counter" role="status">{activeIndex + 1} / {shots.length}</span><button type="button" aria-label="下一镜" disabled={activeIndex === shots.length - 1} onClick={() => navigate(activeIndex + 1)}><span>下一镜</span><ArrowRight size={18} /></button></nav>}
  </dialog>, document.body);
}
