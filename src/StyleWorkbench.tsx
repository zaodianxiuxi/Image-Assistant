import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Check,
  FileImage,
  Link2,
  LoaderCircle,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  WandSparkles,
  X
} from "lucide-react";
import {
  REUSABLE_STYLE_FIELDS,
  STYLE_PROFILE_STORAGE_KEY,
  createStyleProfile,
  parseStyleProfiles,
  removeStyleProfile,
  updateStyleProfile
} from "./style-profiles.mjs";
import type { ReusableStyleField, StyleAnalysis, StyleProfile } from "./style-profiles.mjs";

type StyleWorkbenchProps = {
  open: boolean;
  onClose: () => void;
  onApplyPrompt: (prompt: string) => void;
  databaseConfigured: boolean;
};

const EMPTY_ANALYSIS: StyleAnalysis = {
  sourceContent: "",
  composition: "",
  camera: "",
  lighting: "",
  color: "",
  material: "",
  style: "",
  negativePrompt: ""
};

const ANALYSIS_FIELDS: Array<{ key: keyof StyleAnalysis; label: string; description: string }> = [
  { key: "sourceContent", label: "原图内容", description: "仅供本次查看，不会保存到模板" },
  { key: "composition", label: "构图与画面组织", description: "主体位置、层次和视觉动线" },
  { key: "camera", label: "镜头与视角", description: "景别、焦段、机位和透视" },
  { key: "lighting", label: "光影", description: "光源、方向、强度和氛围" },
  { key: "color", label: "色彩", description: "主色、饱和度和色彩关系" },
  { key: "material", label: "材质与质感", description: "表面、介质和细节表现" },
  { key: "style", label: "视觉风格", description: "媒介、流派和整体表现" },
  { key: "negativePrompt", label: "负面提示词", description: "需要避免的元素和视觉缺陷" }
];

async function readStyleApiError(response: Response) {
  try {
    const body = await response.json();
    return typeof body?.error === "string" ? body.error : "请求失败，请稍后重试。";
  } catch {
    return "请求失败，请检查本地服务是否已启动。";
  }
}

export function StyleWorkbench({ open, onClose, onApplyPrompt, databaseConfigured }: StyleWorkbenchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState("");
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [lockedFields, setLockedFields] = useState<Set<ReusableStyleField>>(new Set());
  const [newContent, setNewContent] = useState("");
  const [composedPrompt, setComposedPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!open) return;
    setProfiles(parseStyleProfiles(window.localStorage.getItem(STYLE_PROFILE_STORAGE_KEY)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !analyzing && !composing) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [analyzing, composing, onClose, open]);

  useEffect(() => () => {
    if (referencePreview) URL.revokeObjectURL(referencePreview);
  }, [referencePreview]);

  if (!open) return null;

  function persistProfiles(next: StyleProfile[]) {
    setProfiles(next);
    try {
      window.localStorage.setItem(STYLE_PROFILE_STORAGE_KEY, JSON.stringify(next));
      setStatus("本地模板已保存。 ");
    } catch {
      setStatus("当前模板仅保留在本页面，浏览器本地存储不可用。");
    }
  }

  function selectReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择有效的图片文件。");
      return;
    }
    setReferenceFile(file);
    setReferencePreview(URL.createObjectURL(file));
    setAnalysis(null);
    setComposedPrompt("");
    setError("");
    setStatus("参考图已就绪，可以开始分析。");
  }

  async function analyzeReference() {
    if (!referenceFile || analyzing) {
      if (!referenceFile) setError("请先上传一张参考图片。");
      return;
    }
    setAnalyzing(true);
    setError("");
    setStatus("正在读取画面结构和风格...");
    try {
      const form = new FormData();
      form.append("image", referenceFile);
      const response = await fetch("/api/styles/analyze", { method: "POST", body: form });
      if (!response.ok) throw new Error(await readStyleApiError(response));
      const body = await response.json();
      setAnalysis(body.analysis as StyleAnalysis);
      setLockedFields(new Set(REUSABLE_STYLE_FIELDS));
      setComposedPrompt("");
      setStatus("分析完成，可以编辑字段或输入新的画面内容。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "参考图分析失败。");
      setStatus("");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateAnalysisField(field: keyof StyleAnalysis, value: string) {
    setAnalysis((current) => ({ ...(current || EMPTY_ANALYSIS), [field]: value }));
    setComposedPrompt("");
  }

  function toggleLock(field: ReusableStyleField) {
    setLockedFields((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  async function composePrompt() {
    if (!analysis) {
      setError("请先分析参考图或选择一个本地模板。");
      return;
    }
    if (!newContent.trim()) {
      setError("请输入新的画面内容。");
      return;
    }
    setComposing(true);
    setError("");
    setStatus("正在优化并组合完整提示词...");
    try {
      const response = await fetch("/api/styles/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, newContent: newContent.trim(), lockedFields: [...lockedFields] })
      });
      if (!response.ok) throw new Error(await readStyleApiError(response));
      const body = await response.json();
      setComposedPrompt(String(body.prompt || ""));
      setStatus("完整提示词已生成，请确认或修改后再应用。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提示词组合失败。");
      setStatus("");
    } finally {
      setComposing(false);
    }
  }

  function saveAsProfile() {
    if (!analysis) {
      setError("当前没有可保存的风格分析。");
      return;
    }
    if (profiles.length >= 100) {
      setError("本地模板最多保存 100 个，请先删除不再使用的模板。");
      return;
    }
    try {
      const profile = createStyleProfile({ name: profileName, analysis, lockedFields: [...lockedFields] });
      persistProfiles([profile, ...profiles]);
      setSelectedProfileId(profile.id);
      setProfileName(profile.name);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存本地模板失败。");
    }
  }

  function selectProfile(id: string) {
    setSelectedProfileId(id);
    const profile = profiles.find((item) => item.id === id);
    if (!profile) {
      setProfileName("");
      return;
    }
    setProfileName(profile.name);
    setAnalysis((current) => ({
      sourceContent: current?.sourceContent || "",
      ...Object.fromEntries(REUSABLE_STYLE_FIELDS.map((field) => [field, profile[field]]))
    }) as StyleAnalysis);
    setLockedFields(new Set(profile.lockedFields));
    setComposedPrompt("");
    setError("");
    setStatus("本地模板已载入，新的画面内容保持不变。");
  }

  function updateSelectedProfile() {
    if (!selectedProfileId || !analysis) return;
    try {
      persistProfiles(updateStyleProfile(profiles, selectedProfileId, {
        name: profileName,
        ...Object.fromEntries(REUSABLE_STYLE_FIELDS.map((field) => [field, analysis[field]])),
        lockedFields: [...lockedFields]
      }));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新本地模板失败。");
    }
  }

  function deleteSelectedProfile() {
    if (!selectedProfileId) return;
    persistProfiles(removeStyleProfile(profiles, selectedProfileId));
    setSelectedProfileId("");
    setProfileName("");
  }

  return (
    <div className="style-workbench-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="style-workbench" role="dialog" aria-modal="true" aria-labelledby="style-workbench-title">
        <header className="style-workbench-toolbar">
          <div><WandSparkles size={18} /><span><strong id="style-workbench-title">从图片提取风格</strong><small>先预览提示词，再决定是否使用</small></span></div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭风格工作台" aria-label="关闭风格工作台"><X size={18} /></button>
        </header>

        <div className="style-workbench-body">
          <aside className="style-workbench-source">
            <section className="style-workbench-section">
              <div className="style-section-heading"><span><strong>参考图</strong><small>单张图片，仅用于本次分析</small></span></div>
              <input ref={inputRef} type="file" accept="image/*" onChange={selectReference} hidden />
              {referencePreview ? (
                <div className="style-reference-preview">
                  <img src={referencePreview} alt="风格参考图预览" />
                  <div><FileImage size={14} /><span title={referenceFile?.name}>{referenceFile?.name}</span></div>
                </div>
              ) : (
                <button className="style-reference-empty" type="button" onClick={() => inputRef.current?.click()}>
                  <Upload size={20} /><strong>选择参考图片</strong><small>不会写入桌面目录或本地模板</small>
                </button>
              )}
              <div className="style-inline-actions">
                {referencePreview && <button type="button" onClick={() => inputRef.current?.click()}><RefreshCw size={14} /> 更换图片</button>}
                <button className="primary" type="button" onClick={() => void analyzeReference()} disabled={!referenceFile || analyzing}>
                  {analyzing ? <LoaderCircle className="spin" size={14} /> : <WandSparkles size={14} />}
                  {analyzing ? "正在分析" : referenceFile && analysis ? "重新分析" : "分析参考图"}
                </button>
              </div>
            </section>

            <section className="style-workbench-section style-profile-panel">
              <div className="style-section-heading"><span><strong>本地风格模板</strong><small>不保存图片和原图内容</small></span><span>{profiles.length}/100</span></div>
              <select value={selectedProfileId} onChange={(event) => selectProfile(event.target.value)} aria-label="选择本地风格模板">
                <option value="">选择已有模板</option>
                {profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}
              </select>
              <div className="style-profile-name">
                <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="模板名称，例如：冷峻电影光" maxLength={80} />
                <button type="button" onClick={saveAsProfile} title="保存为本地模板" aria-label="保存为本地模板"><Plus size={15} /></button>
              </div>
              <div className="style-inline-actions">
                <button type="button" onClick={updateSelectedProfile} disabled={!selectedProfileId || !analysis}><Pencil size={14} /> 更新</button>
                <button type="button" onClick={deleteSelectedProfile} disabled={!selectedProfileId}><Trash2 size={14} /> 删除</button>
              </div>
              <button className="style-save-profile" type="button" onClick={saveAsProfile} disabled={!analysis || !profileName.trim()}><Save size={14} /> 保存为本地模板</button>
            </section>

            <section className="style-workbench-section style-series-placeholder" data-database-configured={databaseConfigured}>
              <div><Link2 size={16} /><span><strong>绑定到系列</strong><small>连接 MySQL 后可用（本阶段暂未开放）</small></span></div>
              <button type="button" disabled title={databaseConfigured ? "系列绑定接口将在后续版本接入" : "连接 MySQL 后可用"}>选择系列</button>
            </section>
          </aside>

          <div className="style-workbench-editor">
            <section className="style-workbench-section">
              <div className="style-section-heading"><span><strong>结构化分析</strong><small>分析结果会一直保留，可逐项修改并锁定</small></span></div>
              <div className="style-analysis-fields">
                {ANALYSIS_FIELDS.map((field) => {
                  const reusableField = field.key === "sourceContent" ? null : field.key as ReusableStyleField;
                  const locked = reusableField ? lockedFields.has(reusableField) : false;
                  return (
                    <label className={field.key === "sourceContent" ? "style-analysis-field source-content" : "style-analysis-field"} key={field.key}>
                      <span><span><strong>{field.label}</strong><small>{field.description}</small></span>{reusableField && <button type="button" className={locked ? "locked" : ""} onClick={() => toggleLock(reusableField)} aria-pressed={locked} title={locked ? `解除锁定${field.label}` : `锁定${field.label}`}>{locked ? <Lock size={13} /> : <LockOpen size={13} />}{locked ? "已锁定" : "可调整"}</button>}</span>
                      <textarea value={analysis?.[field.key] || ""} onChange={(event) => updateAnalysisField(field.key, event.target.value)} placeholder={analysis ? `补充${field.label}` : "分析参考图后显示"} rows={field.key === "sourceContent" ? 3 : 2} maxLength={2000} />
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="style-workbench-section style-compose-section">
              <label className="style-compose-field"><span><strong>新的画面内容</strong><small>替换原图主体、动作和场景，风格继续复用</small></span><textarea value={newContent} onChange={(event) => { setNewContent(event.target.value); setComposedPrompt(""); }} placeholder="例如：白衣剑客站在雪山顶，远处有被云雾遮住的古城" rows={4} maxLength={3000} /></label>
              <button className="style-compose-button" type="button" onClick={() => void composePrompt()} disabled={!analysis || !newContent.trim() || composing}>{composing ? <LoaderCircle className="spin" size={15} /> : <WandSparkles size={15} />}{composing ? "正在优化" : "优化组合"}</button>
              <label className="style-compose-field final-prompt"><span><strong>完整提示词预览</strong><small>确认后才会应用，不会自动生成图片</small></span><textarea value={composedPrompt} onChange={(event) => setComposedPrompt(event.target.value)} placeholder="优化后的完整提示词会显示在这里，仍可手动修改" rows={7} maxLength={6000} /></label>
              <button className="style-apply-button" type="button" disabled={!composedPrompt.trim()} onClick={() => onApplyPrompt(composedPrompt.trim())}><Check size={16} /> 应用到提示词</button>
            </section>
          </div>
        </div>

        {(error || status) && <footer className={error ? "style-workbench-status error" : "style-workbench-status"} role={error ? "alert" : "status"}>{error || status}</footer>}
      </section>
    </div>
  );
}

export default StyleWorkbench;
