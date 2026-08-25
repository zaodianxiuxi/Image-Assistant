import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Eraser,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  WandSparkles,
  X
} from "lucide-react";

type Mode = "generate" | "edit";
type ExecutionStage = "idle" | "validating" | "sending" | "processing" | "completed" | "failed";
type ReferenceImage = {
  file: File;
  preview: string;
};
type Result = {
  id: string;
  src: string;
  prompt: string;
  kind: Mode;
  createdAt: Date;
};

const SIZES = [
  { value: "1024x1024", name: "正方形", detail: "1:1" },
  { value: "1536x864", name: "电脑横屏", detail: "16:9" },
  { value: "864x1536", name: "手机竖屏", detail: "9:16" }
];

const PROMPTS = [
  "晨雾中的现代玻璃山居，松林环绕，建筑摄影，柔和自然光",
  "一台复古机械相机漂浮在钴蓝色水面上，产品摄影，镜面倒影",
  "一张具有大胆排版的独立书店海报，红色与奶油白，丝网印刷质感"
];

const MAX_REFERENCE_IMAGES = 10;

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

async function readApiError(response: Response) {
  try {
    const data = await response.json();
    const message = data.error || "请求失败，请稍后重试。";
    return data.requestId ? `${message}（请求 ID：${data.requestId}）` : message;
  } catch {
    return "请求失败，请检查本地服务是否已启动。";
  }
}

function DownloadButton({ src, filename = "image-assistant.png" }: { src: string; filename?: string }) {
  return (
    <a className="icon-button" href={src} download={filename} title="下载图片" aria-label="下载图片">
      <Download size={17} />
    </a>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(SIZES[0].value);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [maskPreview, setMaskPreview] = useState("");
  const [current, setCurrent] = useState<Result | null>(null);
  const [history, setHistory] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [executionStage, setExecutionStage] = useState<ExecutionStage>("idle");
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const sourceInput = useRef<HTMLInputElement>(null);
  const maskInput = useRef<HTMLInputElement>(null);
  const inputLogged = useRef(false);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setApiReady(Boolean(data.configured)))
      .catch(() => setApiReady(false));
  }, []);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!loading || !requestStartedAt) {
      setElapsedSeconds(0);
      return;
    }
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - requestStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [loading, requestStartedAt]);

  const selectedSize = useMemo(() => SIZES.find((item) => item.value === size)!, [size]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
  }

  function logClientEvent(event: string, details: Record<string, unknown> = {}) {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, mode, ...details })
    }).catch(() => undefined);
  }

  function handlePromptChange(value: string) {
    setPrompt(value);
    if (value.trim() && !inputLogged.current) {
      inputLogged.current = true;
      logClientEvent("prompt_input_started", { promptChars: value.trim().length });
    }
    if (!value.trim()) inputLogged.current = false;
  }

  function createPreview(file: File) {
    const preview = URL.createObjectURL(file);
    previewUrls.current.add(preview);
    return preview;
  }

  function releasePreview(preview: string) {
    URL.revokeObjectURL(preview);
    previewUrls.current.delete(preview);
  }

  function selectReferenceImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (files.some((file) => !file.type.startsWith("image/"))) {
      setError("请上传 PNG、JPG、WebP 等图片文件。");
      return;
    }

    const remaining = MAX_REFERENCE_IMAGES - referenceImages.length;
    const accepted = files.slice(0, remaining);
    if (!accepted.length) {
      setError(`最多可添加 ${MAX_REFERENCE_IMAGES} 张参考图。`);
      return;
    }

    const additions = accepted.map((file) => ({ file, preview: createPreview(file) }));
    setReferenceImages((images) => [...images, ...additions]);
    event.target.value = "";
    logClientEvent("reference_images_selected", {
      referenceCount: referenceImages.length + additions.length,
      file: { mimeType: additions.map((image) => image.file.type).join(","), bytes: additions.reduce((sum, image) => sum + image.file.size, 0) }
    });
    setError(files.length > remaining ? `最多可添加 ${MAX_REFERENCE_IMAGES} 张参考图，已添加前 ${accepted.length} 张。` : "");
  }

  function selectMask(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请上传 PNG、JPG、WebP 等图片文件。");
      return;
    }
    if (maskPreview) releasePreview(maskPreview);
    setMaskFile(file);
    setMaskPreview(createPreview(file));
    event.target.value = "";
    logClientEvent("mask_selected", { file: { mimeType: file.type, bytes: file.size } });
    setError("");
  }

  function clearReferenceImage(index: number) {
    setReferenceImages((images) => {
      const removed = images[index];
      if (removed) releasePreview(removed.preview);
      return images.filter((_, imageIndex) => imageIndex !== index);
    });
    logClientEvent("reference_image_removed", { referenceCount: Math.max(referenceImages.length - 1, 0) });
  }

  function clearMask() {
    if (maskPreview) releasePreview(maskPreview);
    setMaskFile(null);
    setMaskPreview("");
    if (maskInput.current) maskInput.current.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) {
      setError(mode === "generate" ? "先描述你想要生成的图片。" : "描述希望如何编辑图片。" );
      logClientEvent("client_validation_failed", { promptChars: 0 });
      return;
    }
    if (mode === "edit" && !referenceImages.length) {
      setError("图片编辑需要至少上传一张原图。" );
      logClientEvent("client_validation_failed", { promptChars: prompt.trim().length });
      return;
    }

    setLoading(true);
    setError("");
    setExecutionStage("validating");
    setRequestStartedAt(Date.now());
    const operation: Mode = referenceImages.length ? "edit" : "generate";
    logClientEvent("generate_clicked", {
      promptChars: prompt.trim().length,
      referenceCount: referenceImages.length,
      file: referenceImages.length
        ? { mimeType: referenceImages.map((image) => image.file.type).join(","), bytes: referenceImages.reduce((sum, image) => sum + image.file.size, 0) }
        : undefined
    });
    try {
      let response: Response;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      setExecutionStage("sending");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      if (operation === "generate") {
        const request = fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, size })
        });
        setExecutionStage("processing");
        response = await request;
      } else {
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("size", size);
        referenceImages.forEach((image) => form.append("image[]", image.file));
        if (maskFile) form.append("mask", maskFile);
        const request = fetch("/api/images/edit", { method: "POST", body: form });
        setExecutionStage("processing");
        response = await request;
      }

      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      const result: Result = {
        id: crypto.randomUUID(),
        src: data.image,
        prompt: data.revisedPrompt || prompt,
        kind: operation,
        createdAt: new Date()
      };
      setCurrent(result);
      setHistory((items) => [result, ...items].slice(0, 8));
      setApiReady(true);
      setExecutionStage("completed");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "图片请求失败，请稍后重试。" );
      setExecutionStage("failed");
    } finally {
      setLoading(false);
    }
  }

  const sourceTitle = mode === "generate" ? "添加参考图（可选）" : "上传待编辑图片";
  const emptyTitle = referenceImages.length
    ? "参考图已就绪，描述希望保留或修改的部分"
    : mode === "generate" ? "准备好把想法变成图像" : "上传图片后开始编辑";
  const actionLabel = referenceImages.length ? "按参考图生成" : mode === "generate" ? "生成图片" : "生成编辑结果";
  const executionSteps = [
    { id: "validating", label: "校验提示词和请求参数" },
    { id: "sending", label: referenceImages.length ? `上传 ${referenceImages.length} 张参考图到本地代理` : "发送提示词到本地代理" },
    { id: "processing", label: "等待 gpt-image-2 返回图片" }
  ] as const;
  const activeStep = executionStage === "validating" ? 0 : executionStage === "sending" ? 1 : 2;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Image Assistant 首页">
          <span className="brand-mark"><WandSparkles size={19} /></span>
          <span>Image Assistant</span>
        </a>
        <div className="topbar-actions">
          <a href="https://sudocode.chat/docs/image-api" target="_blank" rel="noreferrer" className="docs-link">
            API 文档 <ArrowUpRight size={14} />
          </a>
          <span className={`connection ${apiReady ? "online" : apiReady === false ? "offline" : "checking"}`}>
            <span className="status-dot" />
            {apiReady ? "API 已就绪" : apiReady === false ? "等待配置" : "检查连接"}
          </span>
        </div>
      </header>

      <section className="workspace" aria-label="图片生成工作台">
        <aside className="control-panel">
          <div className="mode-switch" role="tablist" aria-label="工作模式">
            <button className={mode === "generate" ? "active" : ""} onClick={() => switchMode("generate")} role="tab" aria-selected={mode === "generate"}>
              <Sparkles size={16} /> 生成
            </button>
            <button className={mode === "edit" ? "active" : ""} onClick={() => switchMode("edit")} role="tab" aria-selected={mode === "edit"}>
              <Eraser size={16} /> 编辑
            </button>
          </div>

          <form onSubmit={submit} className="prompt-form">
            <div className="upload-stack">
                <input ref={sourceInput} type="file" accept="image/*" multiple onChange={selectReferenceImages} hidden />
                {referenceImages.length ? (
                  <div className="reference-previews">
                    {referenceImages.map((image, index) => (
                      <div className="file-preview" key={image.preview}>
                        <img src={image.preview} alt={`参考图片 ${index + 1} 预览`} />
                        <div><strong>参考图 {index + 1}：{image.file.name}</strong><span>{Math.ceil(image.file.size / 1024)} KB</span></div>
                        <button type="button" className="icon-button small" onClick={() => clearReferenceImage(index)} title={`移除参考图 ${index + 1}`} aria-label={`移除参考图 ${index + 1}`}><X size={15} /></button>
                      </div>
                    ))}
                    {referenceImages.length < MAX_REFERENCE_IMAGES && <button type="button" className="add-reference" onClick={() => sourceInput.current?.click()}><Plus size={15} /> 再添加参考图（{referenceImages.length} / {MAX_REFERENCE_IMAGES}）</button>}
                  </div>
                ) : (
                  <button type="button" className="upload-zone" onClick={() => sourceInput.current?.click()}>
                    <ImagePlus size={19} />
                    <span>{sourceTitle}</span>
                    <small>可一次选择多张，最多 {MAX_REFERENCE_IMAGES} 张，每张最大 20 MB，总计最大 50 MB</small>
                  </button>
                )}
                {mode === "generate" && referenceImages.length > 0 && <p className="reference-note">已启用 {referenceImages.length} 张参考图，会通过图片编辑接口生成结果。</p>}

                <input ref={maskInput} type="file" accept="image/*" onChange={selectMask} hidden />
                {maskPreview ? (
                  <div className="file-preview muted-preview">
                    <img src={maskPreview} alt="遮罩图片预览" />
                    <div><strong>遮罩：{maskFile?.name}</strong><span>白色区域将被编辑</span></div>
                    <button type="button" className="icon-button small" onClick={clearMask} title="移除遮罩" aria-label="移除遮罩"><X size={15} /></button>
                  </div>
                ) : (
                  <button type="button" className="mask-link" onClick={() => maskInput.current?.click()}>
                    <Plus size={15} /> 添加可选编辑遮罩
                  </button>
                )}
            </div>

            <label className="field-label" htmlFor="prompt">提示词</label>
            <div className="prompt-box">
              <textarea id="prompt" value={prompt} onChange={(event) => handlePromptChange(event.target.value)} placeholder={referenceImages.length || mode === "edit" ? "描述希望保留或修改什么，例如：把天空换成黄昏..." : "描述你想生成的画面、风格和细节..."} rows={7} />
              <span>{prompt.length} / 4000</span>
            </div>

            <div className="settings-block">
              <label className="field-label" htmlFor="size">画幅</label>
              <div className="select-wrap">
                <select id="size" value={size} onChange={(event) => setSize(event.target.value)}>
                  {SIZES.map((option) => <option key={option.value} value={option.value}>{option.name} - {option.detail}</option>)}
                </select>
                <ChevronDown size={16} />
              </div>
              <div className={`ratio-preview ratio-${selectedSize.value.replace("x", "-")}`} aria-label={`当前画幅：${selectedSize.name}`} />
            </div>
            {referenceImages.length > 0 && <p className="reference-note canvas-note">参考图仅提供内容和风格参考，输出将按所选画幅生成。</p>}

            {error && <p className="form-error" role="alert">{error}</p>}
            {!apiReady && <p className="setup-note"><CheckCircle2 size={15} /> 在 `.env` 配置 `SUDOCODE_API_KEY` 后即可调用。</p>}

            <button className="generate-button" type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
              {loading ? "正在生成..." : actionLabel}
            </button>
          </form>

          {mode === "generate" && (
            <div className="prompt-ideas">
              <span>试试这些灵感</span>
              {PROMPTS.map((idea) => <button key={idea} type="button" onClick={() => setPrompt(idea)}>{idea}</button>)}
            </div>
          )}
        </aside>

        <section className="canvas-panel">
          <div className="canvas-heading">
            <div><span className="eyebrow">输出</span><h1>{current ? "最新生成结果" : "创作画布"}</h1></div>
            {current && <DownloadButton src={current.src} />}
          </div>
          <div className={`canvas ${current ? "has-result" : ""}`}>
            {loading ? (
              <div className="loading-state">
                <span className="loader-ring"><Sparkles size={23} /></span>
                <strong>{executionStage === "processing" ? "正在等待图片服务响应" : "正在准备图片请求"}</strong>
                <p>已等待 {elapsedSeconds} 秒。终端中可用同次请求的日志查看详细状态。</p>
                <ol className="progress-list">
                  {executionSteps.map((step, index) => <li key={step.id} className={index < activeStep ? "done" : index === activeStep ? "active" : ""}>{step.label}</li>)}
                </ol>
              </div>
            ) : current ? (
              <figure className="result-frame">
                <img src={current.src} alt={current.prompt} />
                <figcaption><span>{current.kind === "generate" ? "生成" : "编辑"} · {formatTime(current.createdAt)}</span><p>{current.prompt}</p></figcaption>
              </figure>
            ) : (
              <div className="empty-state"><span className="empty-icon"><Sparkles size={26} /></span><strong>{emptyTitle}</strong><p>填写提示词，然后在这里查看生成结果。</p></div>
            )}
          </div>
        </section>
      </section>

      <section className="history-section">
        <div className="history-heading"><div><span className="eyebrow">本次会话</span><h2>生成记录</h2></div>{history.length > 0 && <span>{history.length} 张图片</span>}</div>
        {history.length ? (
          <div className="history-grid">
            {history.map((item) => <article className="history-item" key={item.id}><button onClick={() => setCurrent(item)}><img src={item.src} alt={item.prompt} /></button><div><span><Clock3 size={13} /> {formatTime(item.createdAt)}</span><DownloadButton src={item.src} filename={`image-${item.id}.png`} /></div></article>)}
          </div>
        ) : (
          <div className="history-empty"><Clock3 size={18} /> 生成的图片会保留在此浏览器会话中。</div>
        )}
      </section>

      <footer><span>Powered by gpt-image-2</span><span>图片仅在当前浏览器会话中保留</span></footer>
    </main>
  );
}

export default App;
