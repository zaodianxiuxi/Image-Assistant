export type StoryIdea = { title: string; premise: string; turn: string; ending: string; visualHook: string };
export type StoryPreferences = { genre: string; mood: string; keywords: string };
export type StoryInspirationState = StoryPreferences & {
  ideas: StoryIdea[]; generatedPreferences?: StoryPreferences;
  draft?: { title: string; story: string }; selectedTitle?: string;
};
export const emptyInspiration = (): StoryInspirationState => ({ genre: "不限题材", mood: "温暖治愈", keywords: "", ideas: [] });

type Props = {
  value: StoryInspirationState; busy: boolean; hasStory: boolean;
  onChange: (value: StoryInspirationState) => void;
  onGenerate: () => void; onExpand: (idea: StoryIdea) => void; onAdopt: () => void;
};
export default function StoryInspiration({ value, busy, hasStory, onChange, onGenerate, onExpand, onAdopt }: Props) {
  return <details className="story-inspiration">
    <summary>没有灵感？帮我想故事</summary>
    <p className="story-help">选一个偏好，获得三个故事方向，再把喜欢的展开成完整故事。使用文本模型额度，选好故事后再规划分镜。</p>
    <div className="story-options">
      <label>题材<select aria-label="灵感题材" value={value.genre} onChange={e => onChange({ ...value, genre: e.target.value })}>{["不限题材", "现代生活", "奇幻童话", "悬疑冒险", "科幻未来", "古风传奇"].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>情绪<select aria-label="灵感情绪" value={value.mood} onChange={e => onChange({ ...value, mood: e.target.value })}>{["温暖治愈", "轻松幽默", "紧张悬念", "孤独诗意", "惊喜反转", "勇气与成长"].map(v => <option key={v}>{v}</option>)}</select></label>
    </div>
    <label>想加入的元素（可选）<input aria-label="灵感关键词" value={value.keywords} maxLength={500} placeholder="例如：旧车站、机器人、一次迟到的告别" onChange={e => onChange({ ...value, keywords: e.target.value })} /></label>
    <button type="button" className="primary" disabled={busy} onClick={onGenerate}>{value.ideas.length ? "换三个故事方向" : "给我三个故事方向"}</button>
    {value.ideas.length > 0 && <div className="story-idea-grid">{value.ideas.map((idea, i) => <article className="story-idea" key={idea.title}>
      <small>方向 {i + 1}</small><h3>{idea.title}</h3><p>{idea.premise}</p>
      <p><strong>转折</strong> {idea.turn}</p><p><strong>关键画面</strong> {idea.visualHook}</p>
      <details><summary>看看故事的结尾</summary><p>{idea.ending}</p></details>
      <button type="button" disabled={busy} onClick={() => onExpand(idea)}>{value.selectedTitle === idea.title && value.draft ? "重新展开这个故事" : "选这个，展开故事"}</button>
    </article>)}</div>}
    {value.draft && <section className="story-draft" aria-label="灵感故事草稿">
      <h3>完整故事 · 可直接修改</h3>
      <label>故事标题<input aria-label="灵感故事标题" maxLength={80} value={value.draft.title} onChange={e => onChange({ ...value, draft: { ...value.draft!, title: e.target.value } })} /></label>
      <textarea aria-label="灵感故事正文" rows={10} maxLength={20000} value={value.draft.story} onChange={e => onChange({ ...value, draft: { ...value.draft!, story: e.target.value } })} />
      <p className="story-help">{hasStory ? "采用后创建一个新故事，当前正文和分镜会保留在故事列表中。" : "采用后填入下方故事输入区，检查内容后再规划分镜。"}</p>
      <button type="button" className="primary" disabled={busy || !value.draft.title.trim() || !value.draft.story.trim()} onClick={onAdopt}>{hasStory ? "采用并创建新故事" : "采用这个故事"}</button>
    </section>}
  </details>;
}
