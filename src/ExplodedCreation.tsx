import { useRef, useState } from "react";
import { ArrowDownToLine, Layers3, ScanLine, Sparkles } from "lucide-react";
import type { PointerEvent } from "react";

const layers = [
  { name: "参考", detail: "从一个主体、一处场景，找到画面的起点。" },
  { name: "描述", detail: "把想看到的内容，写成清楚的画面描述。" },
  { name: "风格", detail: "选择光线与观感，让表达更接近你的想象。" },
  { name: "画面", detail: "让各个创作要素汇合，成为完整的作品。" }
];

export default function ExplodedCreation({ preview }: { preview?: { src: string; alt: string } }) {
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState(3);
  const [failedSource, setFailedSource] = useState<string>();
  const scene = useRef<HTMLDivElement>(null);
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    scene.current?.style.setProperty("--scene-yaw", ((event.clientX - box.left) / box.width * 6 - 3) + "deg");
    scene.current?.style.setProperty("--scene-pitch", ((event.clientY - box.top) / box.height * -4 + 2) + "deg");
  }
  const showPreview = preview && failedSource !== preview.src;
  return <div className="exploded-creation" data-expanded={expanded}>
    <div className="space-scene" ref={scene} onPointerMove={tilt} onPointerLeave={() => { scene.current?.style.removeProperty("--scene-yaw"); scene.current?.style.removeProperty("--scene-pitch"); }} role="img" aria-label={(expanded ? "参考、描述、风格与画面沿空间分层展开" : "四个创作要素合拢为完整画面") + (showPreview ? "。最近作品：" + preview.alt : "。创作示意场景")}>
      <div className="space-orbit" aria-hidden="true" />
      <div className="space-stack" aria-hidden="true">
        <div className={"space-layer layer-reference" + (selected === 0 ? " is-selected" : "")}><div className="layer-face"><span className="layer-corner">01 / REFERENCE</span><div className="reference-tiles"><i /><i /><i /></div></div></div>
        <div className={"space-layer layer-prompt" + (selected === 1 ? " is-selected" : "")}><div className="layer-face"><span className="layer-corner">02 / DESCRIPTION</span><div className="prompt-lines"><i /><i /><i /><i /></div></div></div>
        <div className={"space-layer layer-style" + (selected === 2 ? " is-selected" : "")}><div className="layer-face"><span className="layer-corner">03 / ATMOSPHERE</span><div className="style-spectrum"><i /><i /><i /><i /><i /></div></div></div>
        <div className={"space-layer layer-image" + (selected === 3 ? " is-selected" : "")}><div className="layer-face">{showPreview ? <img src={preview.src} alt="" onError={() => setFailedSource(preview.src)} /> : <div className="space-landscape"><i className="landscape-sun" /><i className="landscape-back" /><i className="landscape-front" /><i className="landscape-water" /></div>}<span className="image-layer-label">{showPreview ? "最近作品" : "创作示意"}</span></div></div>
        <div className="space-guide guide-left" /><div className="space-guide guide-right" />
      </div>
    </div>
    <div className="space-interaction">
      <div className="space-layer-controls" role="group" aria-label="创作要素">{layers.map((layer, index) => <button key={layer.name} type="button" aria-pressed={selected === index} onClick={() => { setSelected(index); setExpanded(true); }}><span>{String(index + 1).padStart(2, "0")}</span>{layer.name}</button>)}</div>
      <button className="space-expand" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <ArrowDownToLine size={15} /> : <Layers3 size={15} />}{expanded ? "合拢" : "展开"}</button>
    </div>
    <p className="space-layer-detail" role="status">{selected === 2 ? <Sparkles size={13} /> : <ScanLine size={13} />}{layers[selected].detail}</p>
  </div>;
}
