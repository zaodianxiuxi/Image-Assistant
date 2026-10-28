import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { ArrowDown, ArrowUp, Pause, Play, Route } from "lucide-react";
import "./journey.css";
import { buildJourneyRoute } from "./journey-route.mjs";

export type JourneyStep = { key: string; label: string; title: string; description?: string; content: ReactNode };
type Props = { steps: JourneyStep[]; scrollRoot: RefObject<HTMLDivElement> };

export default function JourneyTimeline({ steps, scrollRoot }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const current = useRef(0);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [geometry, setGeometry] = useState({ path: "", progress: [] as number[], width: 1, height: 1 });
  const timelineId = useId();
  const orderKey = steps.map(step => step.key).join("|");
  const activeIndex = Math.min(active, Math.max(0, steps.length - 1));
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function goTo(index: number, automatic = false) {
    const next = Math.min(Math.max(index, 0), steps.length - 1);
    if (!automatic || next === steps.length - 1) setPlaying(false);
    const element = cards.current.get(steps[next]?.key);
    const scroller = scrollRoot.current;
    if (!element || !scroller) return;
    current.current = next; setActive(next);
    const frame = element.getBoundingClientRect();
    const viewport = scroller.getBoundingClientRect();
    scroller.scrollTo({ top: scroller.scrollTop + frame.top - viewport.top - 96, behavior: reducedMotion() ? "instant" : "smooth" });
  }

  useEffect(() => {
    current.current = 0; setActive(0); setPlaying(false);
    const element = track.current;
    const scroller = scrollRoot.current;
    if (!element || !scroller) return;
    let animation = 0;
    function measure() {
      if (!element) return;
      const bounds = element.getBoundingClientRect();
      const points = Array.from(element.querySelectorAll<HTMLElement>(".journey-step")).map(card => {
        const pin = card.querySelector<HTMLElement>(".journey-pin")!;
        const rect = pin.getBoundingClientRect();
        const frame = card.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(card).paddingBottom) || 0;
        return { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2, exitY: frame.bottom - bounds.top - gap * .8 };
      });
      setGeometry({ ...buildJourneyRoute(points), width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
    }
    function updateActive() {
      if (!scroller || !element) return;
      const viewport = scroller.getBoundingClientRect();
      const target = viewport.top + Math.min(scroller.clientHeight * .42, 330);
      let nearest = 0, distance = Infinity;
      Array.from(element.querySelectorAll<HTMLElement>(".journey-step")).forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const next = Math.abs(rect.top + Math.min(rect.height / 2, 160) - target);
        if (next < distance) { distance = next; nearest = index; }
      });
      current.current = nearest; setActive(nearest);
    }
    function onScroll() { cancelAnimationFrame(animation); animation = requestAnimationFrame(updateActive); }
    function stop() { setPlaying(false); }
    function stopOnPointer(event: Event) { if (!(event.target as Element).closest(".journey-transport")) stop(); }
    function stopOnKey(event: KeyboardEvent) { if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "Tab", "Escape"].includes(event.key)) stop(); }
    function onVisibility() { if (document.hidden) stop(); }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll(".journey-step").forEach(card => observer.observe(card));
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", stop, { passive: true });
    scroller.addEventListener("touchstart", stopOnPointer, { passive: true });
    scroller.addEventListener("pointerdown", stopOnPointer);
    scroller.addEventListener("keydown", stopOnKey);
    document.addEventListener("visibilitychange", onVisibility);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    preference.addEventListener("change", stop);
    measure(); updateActive();
    return () => { observer.disconnect(); cancelAnimationFrame(animation); scroller.removeEventListener("scroll", onScroll); scroller.removeEventListener("wheel", stop); scroller.removeEventListener("touchstart", stopOnPointer); scroller.removeEventListener("pointerdown", stopOnPointer); scroller.removeEventListener("keydown", stopOnKey); document.removeEventListener("visibilitychange", onVisibility); preference.removeEventListener("change", stop); };
  }, [orderKey, scrollRoot]);

  useEffect(() => {
    if (!playing || steps.length < 2) return;
    const timer = window.setInterval(() => {
      if (current.current >= steps.length - 1) { setPlaying(false); return; }
      goTo(current.current + 1, true);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [playing, orderKey]);

  if (!steps.length) return <p className="journey-empty">还没有可以按顺序展映的画面。</p>;
  return <section className="journey-timeline" aria-label="系列路径展映">
    <div className="journey-controls"><div className="journey-now"><Route size={17} /><span><strong>{steps[activeIndex]?.title}</strong><small>第 {activeIndex + 1} / {steps.length} 站</small></span></div><div className="journey-transport"><button type="button" aria-label="上一站" disabled={!activeIndex} onClick={() => goTo(activeIndex - 1)}><ArrowUp size={16} /></button><button type="button" className="journey-play" aria-pressed={playing} disabled={steps.length < 2} onClick={() => { if (!playing && activeIndex === steps.length - 1) goTo(0); setPlaying(value => !value); }}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "暂停展映" : "沿线展映"}</button><button type="button" aria-label="下一站" disabled={activeIndex === steps.length - 1} onClick={() => goTo(activeIndex + 1)}><ArrowDown size={16} /></button></div></div>
    <div className="journey-track" ref={track}>
      <svg className="journey-route" width="100%" height="100%" viewBox={"0 0 " + geometry.width + " " + geometry.height} aria-hidden="true"><path d={geometry.path} className="journey-route-base" /><path d={geometry.path} className="journey-route-progress" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - (geometry.progress[activeIndex] || 0)} /></svg>
      {steps.map((step, index) => <article className={"journey-step" + (index === activeIndex ? " is-current" : "") + (index <= activeIndex ? " is-passed" : "")} key={step.key} ref={element => { if (element) cards.current.set(step.key, element); else cards.current.delete(step.key); }} aria-labelledby={timelineId + "-title-" + index}>
        <button type="button" className="journey-pin" aria-label={"跳到" + step.label + "：" + step.title} aria-current={index === activeIndex ? "step" : undefined} onClick={() => goTo(index)}><span /></button>
        <div className="journey-caption"><span className="journey-order">{step.label}</span><h2 id={timelineId + "-title-" + index}>{step.title}</h2>{step.description && <p>{step.description}</p>}</div>
        <div className="journey-picture" onClickCapture={() => setPlaying(false)}>{step.content}</div>
      </article>)}
    </div>
    <div className="journey-end"><span />这一段旅程，已收进画面。<span /></div>
  </section>;
}
