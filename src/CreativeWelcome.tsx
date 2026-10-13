import { ArrowRight, BookOpen, Clapperboard, ImagePlus, Sparkles } from "lucide-react";

type Props = { paper?: boolean; onStory: () => void; onPrompt: () => void; onPoetry: () => void };

/** A book illustration made from vectors; it is not a user's saved work. */
function PaperBook() {
  return <div className="paper-book" aria-hidden="true">
    <span className="paper-book-edition">故事未完 · 灵感待续</span>
    <div className="paper-book-spread">
      <div className="paper-book-page paper-book-left"><span>第一章</span><strong>风经过的地方，<br />故事正在发生。</strong><i /><i /><i /><div className="paper-book-seal">故事</div><small>01</small></div>
      <div className="paper-book-page paper-book-right">
        <svg viewBox="0 0 180 240" fill="none">
          <path fill="#eae5d7" d="M0 0h180v240H0z" />
          <circle cx="126" cy="53" r="24" fill="#bc6d50" />
          <path d="M0 112 38 91 85 126 136 82 180 108v132H0z" fill="#a4afa0" />
          <path d="m0 151 61-43 64 47 55-18v103H0z" fill="#6c8274" />
          <path d="M0 194c38-23 90-2 180-32v78H0z" fill="#405b51" />
          <path d="M98 141c-48 37 76 24 12 99h39c50-70-56-69-46-99" fill="#e9d2a9" />
          <path d="M21 0v240M28 0v240M0 33h180" stroke="#f7f2e5" strokeOpacity=".45" />
          <circle cx="102" cy="156" r="4" fill="#3b3933" /><path d="m98 162-3 18h13l-2-18z" fill="#ad503c" /><path d="m99 180-2 11m7-11 3 11" stroke="#3b3933" strokeWidth="2" />
        </svg>
        <small>每一页，都有新的远方。<span>02</span></small>
      </div>
    </div>
    <span className="paper-book-note">一本尚未写完的故事 · 创作示意</span>
  </div>;
}

/** Decorative storyboard artwork, not a generated image or saved project. */
function StoryFrames() {
  return <div className="welcome-art" aria-hidden="true">
    <div className="film-frame film-frame-back"><span>02 / THE JOURNEY</span><div className="frame-horizon" /></div>
    <div className="film-frame film-frame-front">
      <div className="film-frame-bar"><span>01 / THE BEGINNING</span><i /></div>
      <svg viewBox="0 0 320 360" fill="none">
        <defs>
          <linearGradient id="cinema-sky" x1="160" y1="0" x2="160" y2="360" gradientUnits="userSpaceOnUse"><stop stopColor="#39464a" /><stop offset=".55" stopColor="#a88865" /><stop offset="1" stopColor="#e9b874" /></linearGradient>
          <linearGradient id="cinema-light" x1="160" y1="190" x2="160" y2="360" gradientUnits="userSpaceOnUse"><stop stopColor="#eec28a" stopOpacity=".45" /><stop offset="1" stopColor="#eec28a" stopOpacity="0" /></linearGradient>
        </defs>
        <path fill="#1b2427" d="M0 0h320v360H0z" />
        <path fill="url(#cinema-sky)" d="M57 218V117a103 103 0 0 1 206 0v101z" />
        <circle cx="209" cy="135" r="29" fill="#f3ce92" />
        <path d="m57 184 54-38 50 35 45-19 57 36v37H57z" fill="#697274" /><path d="m57 209 75-22 54 20 77-9v37H57z" fill="#475553" />
        <path d="M51 223h218M160 18v203M57 115h206" stroke="#202c2b" strokeWidth="7" />
        <path d="m58 230-38 130h280l-38-130z" fill="url(#cinema-light)" />
        <path d="M0 286h320M0 327h320M100 234 78 360M221 234l27 126M160 234v126" stroke="#c5a57b" strokeOpacity=".12" />
        <ellipse cx="169" cy="312" rx="38" ry="8" fill="#172123" fillOpacity=".5" />
        <circle cx="165" cy="210" r="12" fill="#222a29" /><path d="M149 230q16-12 31 0l7 45h-14l-1 37h-10l-2-37h-15z" fill="#263030" />
        <path d="M183 260h17v29h-17z" fill="#947855" /><path d="M188 260v-5h8v5" stroke="#947855" strokeWidth="3" />
        <path d="M27 44v-17h17m232 0h17v17M27 316v17h17m232 0h17v-17" stroke="#e9d8bd" strokeOpacity=".38" />
      </svg>
      <div className="film-frame-caption"><span>一个故事，从此刻开始</span><span>TAKE 01</span></div>
    </div>
    <span className="art-note">分镜创作示意</span>
  </div>;
}

export default function CreativeWelcome({ paper = false, onStory, onPrompt, onPoetry }: Props) {
  return <section className="creative-welcome" aria-label="开始创作">
    <div className="welcome-hero">
      <div className="welcome-copy">
        <span className="studio-kicker"><span /> {paper ? "纸上故事馆 · 翻开想象的扉页" : "想象力，准备开场"}</span>
        <h2>{paper ? <>把心里的故事，<br />写成<span>眼前的风景。</span></> : <>让一个念头，<br />成为<span>一组画面。</span></>}</h2>
        <p>{paper ? <>记下一闪而过的念头，<br />让文字生根，让画面慢慢展开。</> : <>从一句灵感到完整故事，<br />让人物、情绪与镜头，在这里相遇。</>}</p>
        <button className="welcome-primary" type="button" onClick={onStory}>{paper ? <BookOpen size={17} /> : <Clapperboard size={17} />} 开始故事创作 <ArrowRight size={17} /></button>
        <small>还没有故事？让灵感助手陪你想一个。</small>
      </div>
      {paper ? <PaperBook /> : <StoryFrames />}
    </div>
    <div className="welcome-paths">
      <button type="button" onClick={onPrompt}><ImagePlus size={19} /><span><strong>定格一个想法</strong><small>描述画面，生成单张图片</small></span><ArrowRight size={16} /></button>
      <button type="button" onClick={onStory}><Sparkles size={19} /><span><strong>寻找故事灵感</strong><small>从三个方向，找到想讲的故事</small></span><ArrowRight size={16} /></button>
      <button type="button" onClick={onPoetry}><BookOpen size={19} /><span><strong>走进诗词意境</strong><small>让文字里的风景，有了形状</small></span><ArrowRight size={16} /></button>
    </div>
  </section>;
}
