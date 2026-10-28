import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { GalleryGroup, GalleryHistoryRecord } from "./gallery-groups.mjs";
import { buildGalleryJourney } from "./gallery-journey.mjs";
import JourneyTimeline from "./JourneyTimeline";

export default function SeriesJourney<T extends GalleryHistoryRecord>({ group, renderItem, onClose, notice }: { notice?: string; group: GalleryGroup<T>; renderItem: (item: T) => ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const journey = useMemo(() => buildGalleryJourney(group), [group]);
  useEffect(() => {
    const element = dialog.current!;
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; focus?.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={dialog} className="series-journey" aria-labelledby="series-journey-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="journey-header"><div><h1 id="series-journey-title">{group.title}</h1><p>{journey.steps.length} 个节点 · 按系列顺序，重新走过每一幅画面</p>{notice && <p className="journey-notice" role="status">{notice}</p>}</div><button type="button" className="journey-close" aria-label="关闭路径展映" onClick={onClose}><X size={21} /></button></header>
    <div className="journey-scroll" ref={content}>
      <JourneyTimeline scrollRoot={content} steps={journey.steps.map(step => ({ key: step.key, label: "第 " + String(step.order).padStart(2, "0") + " 镜", title: step.title, description: typeof step.item.prompt === "string" ? step.item.prompt : undefined, content: <>{renderItem(step.item)}{step.alternatives.length > 0 && <details className="journey-versions"><summary>查看其他 {step.alternatives.length} 个版本</summary><div className="history-grid">{step.alternatives.map(renderItem)}</div></details>}</> }))} />
      {!!journey.unsequenced.length && <section className="journey-unsequenced"><h2>尚未编入路径</h2><p>这些图片没有明确的节点顺序，仍保留在这里。</p><div className="history-grid">{journey.unsequenced.map(renderItem)}</div></section>}
    </div>
  </dialog>, document.body);
}
