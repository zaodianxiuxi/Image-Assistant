import { ArrowRight, BookOpen, ImagePlus, Route } from "lucide-react";
import ExplodedCreation from "./ExplodedCreation";

type Props = { paper?: boolean; preview?: { src: string; alt: string }; onStory: () => void; onPrompt: () => void; onPoetry: () => void };

export default function CreativeWelcome({ paper = false, preview, onStory, onPrompt, onPoetry }: Props) {
  return <section className="creative-welcome space-welcome" aria-label="开始创作">
    <div className="space-hero">
      <div className="space-copy"><h2>让想象，<br /><em>拥有层次。</em></h2><p>{paper ? "从一句诗、一段故事开始。让文字与画面，在这里慢慢相遇。" : "从一个念头，到一组画面。展开创作的每一层，让故事在眼前发生。"}</p><button className="space-primary" type="button" onClick={onPrompt}><ImagePlus size={17} />开始单图创作<ArrowRight size={17} /></button><button className="space-text-action" type="button" onClick={onStory}>或从一个故事开始<ArrowRight size={14} /></button></div>
      <ExplodedCreation preview={preview} />
    </div>
    <div className="space-paths"><button type="button" onClick={onStory}><Route size={19} /><span><strong>把故事连成画面</strong><small>规划分镜 · 沿路径展映</small></span><ArrowRight size={17} /></button><button type="button" onClick={onPoetry}><BookOpen size={19} /><span><strong>走进诗词意境</strong><small>读懂诗句 · 看见山河</small></span><ArrowRight size={17} /></button></div>
  </section>;
}
