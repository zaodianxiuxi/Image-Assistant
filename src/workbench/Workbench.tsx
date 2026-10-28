import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowRightLeft,
  BookOpen,
  Box,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Image,
  Layers3,
  LoaderCircle,
  Moon,
  RefreshCw,
  Sun,
  X,
} from "lucide-react";
import type {
  EngineStatus,
  WorkspaceFile,
  WorkspaceState,
  WorkspaceView,
} from "./types";
import { formatDate, requestJson } from "./types";
import FileLibrary, { FileThumbnail } from "./FileLibrary";
import DocumentReader from "./DocumentReader";
import ConversionDialog from "./ConversionDialog";
import TaskCenter from "./TaskCenter";
import "./workbench.css";
import "./workbench-materials.css";
const SpatialDesk = lazy(() => import("./SpatialDesk"));
const ImageWorkspace = lazy(() => import("../App"));
const views: WorkspaceView[] = [
  "desk",
  "files",
  "reader",
  "tools",
  "tasks",
  "create",
];
const tools = [
  {
    id: "files" as const,
    name: "文件库",
    sceneName: "文件托盘",
    description: "收纳资料，随时取用",
    icon: FolderOpen,
    color: "blue",
  },
  {
    id: "reader" as const,
    name: "阅读台",
    sceneName: "阅读台",
    description: "给阅读留一点空间",
    icon: BookOpen,
    color: "green",
  },
  {
    id: "tools" as const,
    name: "格式转换",
    sceneName: "转换工具",
    description: "换个格式，继续工作",
    icon: ArrowRightLeft,
    color: "orange",
  },
  {
    id: "create" as const,
    name: "图片创作",
    sceneName: "创作画板",
    description: "把想法变成画面",
    icon: Image,
    color: "purple",
  },
  {
    id: "tasks" as const,
    name: "任务中心",
    sceneName: "任务架",
    description: "进度与结果，都在这里",
    icon: Clock3,
    color: "yellow",
  },
];
function initialView(): WorkspaceView {
  const hash = location.hash.replace("#/", "");
  return views.includes(hash as WorkspaceView)
    ? (hash as WorkspaceView)
    : "desk";
}
function initialTheme() {
  try {
    const saved = localStorage.getItem("image-assistant-theme");
    if (["dark", "light", "paper", "studio"].includes(saved || ""))
      return saved!;
  } catch {}
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export default function Workbench() {
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [imageOpened, setImageOpened] = useState(initialView() === "create");
  const [theme, setTheme] = useState(initialTheme);
  const [state, setState] = useState<WorkspaceState>({ files: [], tasks: [] });
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [engineLoading, setEngineLoading] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [converting, setConverting] = useState<WorkspaceFile[] | null>(null);
  const refresh = useCallback(async () => {
    try {
      const data = await requestJson<WorkspaceState>("/state");
      setState(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "工作区读取失败。");
    } finally {
      setLoading(false);
    }
  }, []);
  const refreshEngine = useCallback(async () => {
    setEngineLoading(true);
    try {
      setEngine(await requestJson<EngineStatus>("/engine"));
    } catch {
      setEngine({
        available: false,
        version: null,
        message: "本地文件服务尚未连接。",
      });
    } finally {
      setEngineLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    void refreshEngine();
  }, [refresh, refreshEngine]);
  const processing = state.tasks.filter(
    (t) => t.status === "running" || t.status === "queued",
  ).length;
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 2000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [processing, refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("image-assistant-theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const next = document.documentElement.dataset.theme;
      if (next && ["dark", "light", "paper", "studio"].includes(next))
        setTheme(next);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const change = () => {
      const next = initialView();
      setView(next);
      if (next === "create") setImageOpened(true);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  function navigate(next: WorkspaceView) {
    setView(next);
    if (next === "create") setImageOpened(true);
    location.hash = "/" + next;
  }
  function read(file: WorkspaceFile) {
    setReadingId(file.id);
    navigate("reader");
  }
  async function upload(files: File[]) {
    if (!files.length) return;
    if (files.length > 10) {
      setError("每次最多上传 10 个文件。");
      return;
    }
    if (files.some((f) => f.size > 50 * 1024 * 1024)) {
      setError("单个文件最大 50 MB，请先缩小文件。");
      return;
    }
    setUploading(true);
    setError("");
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    try {
      await requestJson("/files", { method: "POST", body: form });
      await refresh();
      setNotice("已保存 " + files.length + " 份文件，可以阅读或转换。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败。");
      await requestJson<WorkspaceState>("/state")
        .then(setState)
        .catch(() => {});
    } finally {
      setUploading(false);
    }
  }
  async function startConversion(
    ids: string[],
    target: string,
    quality: number,
  ) {
    const result = await requestJson<{ tasks: WorkspaceState["tasks"] }>(
      "/tasks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: ids, target, quality }),
      },
    );
    setState((current) => ({
      ...current,
      tasks: [...result.tasks, ...current.tasks],
    }));
    setConverting(null);
    navigate("tasks");
    void refresh();
  }
  const reading = state.files.find((f) => f.id === readingId);
  const pageTitle =
    view === "desk"
      ? "我的工作台"
      : tools.find((tool) => tool.id === view)?.name || "工作台";
  const completed = state.tasks.filter((t) => t.status === "completed").length;
  return (
    <>
      <div className="wb-shell" hidden={view === "create"}>
        <aside className="wb-sidebar">
          <button
            className="wb-brand"
            type="button"
            onClick={() => navigate("desk")}
            aria-label="返回工作台"
          >
            <span>
              <Box size={23} />
            </span>
            <div>
              <strong>我的工作台</strong>
              <small>IMAGE ASSISTANT</small>
            </div>
          </button>
          <span className="wb-sidebar-label">WORKSPACE</span>
          <nav aria-label="工作台工具">
            <button
              type="button"
              className={view === "desk" ? "is-active" : ""}
              aria-current={view === "desk" ? "page" : undefined}
              onClick={() => navigate("desk")}
            >
              <Layers3 size={18} />
              <span>空间桌面</span>
            </button>
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className={view === tool.id ? "is-active" : ""}
                aria-current={view === tool.id ? "page" : undefined}
                onClick={() => navigate(tool.id)}
              >
                <tool.icon size={18} />
                <span>{tool.name}</span>
                {tool.id === "tasks" && processing > 0 && <b>{processing}</b>}
              </button>
            ))}
          </nav>
          <div className="wb-sidebar-bottom">
            <span
              className={
                "wb-local-status " + (engine?.available ? "is-ready" : "")
              }
            >
              <i />
              {engineLoading
                ? "连接本地引擎…"
                : engine?.available
                  ? "Filee 已连接"
                  : "本地工作空间"}
            </span>
            <button
              type="button"
              className="wb-engine-refresh"
              onClick={() => void refreshEngine()}
              disabled={engineLoading}
            >
              <RefreshCw size={12} />
              刷新引擎状态
            </button>
            <p>
              文件留在本机
              <br />
              工作在这里继续
            </p>
          </div>
        </aside>
        <div className="wb-main">
          <header className="wb-topbar">
            <span>
              <span className="wb-breadcrumb">工作空间</span>
              <span className="wb-breadcrumb-slash">/</span>
              {pageTitle}
            </span>
            <div className="wb-top-actions">
              <span className="wb-local-tag">
                <i />
                本地
              </span>
              <label className="wb-theme-picker">
                <span className="sr-only">工作台主题</span>
                {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
                <select
                  aria-label="工作台主题"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="light">明亮</option>
                  <option value="dark">深色</option>
                  <option value="studio">暖灰</option>
                  <option value="paper">纸上</option>
                </select>
              </label>
            </div>
          </header>
          {(error || notice) && (
            <div
              className={"wb-banner " + (error ? "has-error" : "")}
              role={error ? "alert" : "status"}
            >
              <span>{error || notice}</span>
              {error && (
                <button type="button" onClick={() => void refresh()}>
                  重试连接
                </button>
              )}
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <main className={"wb-content view-" + view}>
            {view === "desk" && (
              <>
                <div className="wb-home-heading">
                  <div>
                    <span className="wb-kicker">
                      A SPACE FOR EVERYTHING YOU DO
                    </span>
                    <h1>
                      让每一件事，<em>各得其所。</em>
                    </h1>
                    <p>阅读一份资料，转换一个文件，或开始一次创作。</p>
                  </div>
                  <span className="wb-space-badge">
                    <Box size={16} />
                    你的 3D 工作空间
                  </span>
                </div>
                <section className="wb-desk-card" aria-label="三维工作桌">
                  <div className="wb-desk-topline">
                    <span>
                      <i />
                      SPATIAL DESK
                    </span>
                    <small>从桌面上的一个物件开始</small>
                  </div>
                  <Suspense
                    fallback={
                      <div className="wb-scene-loading">
                        <LoaderCircle className="wb-spin" size={22} />
                        正在展开你的工作桌…
                      </div>
                    }
                  >
                    <SpatialDesk onOpen={navigate} theme={theme} />
                  </Suspense>
                  <nav className="wb-station-nav" aria-label="桌面物件快捷入口">
                    {tools.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => navigate(tool.id)}
                      >
                        <span className={"wb-station-icon " + tool.color}>
                          <tool.icon size={19} />
                        </span>
                        <span>
                          <strong>{tool.sceneName}</strong>
                          <small>{tool.description}</small>
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </nav>
                </section>
                <div className="wb-home-bottom">
                  <section className="wb-recent">
                    <div className="wb-section-heading">
                      <h2>接着上次的工作</h2>
                      <button type="button" onClick={() => navigate("files")}>
                        全部文件
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    {loading ? (
                      <p className="wb-inline-empty">正在读取文件…</p>
                    ) : state.files.length ? (
                      <div className="wb-recent-files">
                        {state.files.slice(0, 3).map((file) => (
                          <button
                            type="button"
                            key={file.id}
                            onClick={() => read(file)}
                          >
                            <FileThumbnail file={file} />
                            <span>
                              <strong>{file.name}</strong>
                              <small>{formatDate(file.createdAt)}</small>
                            </span>
                            <ArrowUpRight size={16} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="wb-start-import"
                        onClick={() => navigate("files")}
                      >
                        <FolderOpen size={28} />
                        <span>
                          <strong>从第一份资料开始</strong>
                          <small>将文件放入工作台，随后即可阅读与转换。</small>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    )}
                  </section>
                  <section className="wb-at-a-glance">
                    <span className="wb-kicker">AT A GLANCE</span>
                    <div>
                      <span>
                        <strong>
                          {state.files.length.toString().padStart(2, "0")}
                        </strong>
                        <small>份文件</small>
                      </span>
                      <span>
                        <strong>
                          {processing.toString().padStart(2, "0")}
                        </strong>
                        <small>进行中</small>
                      </span>
                      <span>
                        <strong>{completed.toString().padStart(2, "0")}</strong>
                        <small>已完成</small>
                      </span>
                    </div>
                  </section>
                </div>
              </>
            )}
            {(view === "files" || view === "tools") && (
              <>
                {view === "tools" && (
                  <div
                    className={
                      "wb-engine-card " + (engine?.available ? "is-ready" : "")
                    }
                  >
                    <span>
                      {engine?.available ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <Box size={20} />
                      )}
                      <strong>
                        {engine?.available ? "本地转换已就绪" : "转换引擎状态"}
                      </strong>
                    </span>
                    <p>
                      {engine?.available
                        ? engine.version + " · 根据文件类型显示可用工具"
                        : engine?.message || "正在检测本机可用的转换能力…"}
                    </p>
                    <button
                      className="wb-plain"
                      type="button"
                      disabled={engineLoading}
                      onClick={() => void refreshEngine()}
                    >
                      <RefreshCw size={14} />
                      重新检测
                    </button>
                  </div>
                )}
                <FileLibrary
                  files={state.files}
                  uploading={uploading}
                  onUpload={upload}
                  onRead={read}
                  onConvert={setConverting}
                  conversionMode={view === "tools"}
                />
              </>
            )}
            {view === "reader" && (
              <DocumentReader
                file={reading}
                onFiles={() => navigate("files")}
                onConvert={setConverting}
              />
            )}
            {view === "tasks" && (
              <TaskCenter
                files={state.files}
                tasks={state.tasks}
                onRead={read}
                onRetry={setConverting}
                onFiles={() => navigate("files")}
              />
            )}
          </main>
          <footer className="wb-footer">
            <span>一个空间，连接你的日常。</span>
            <span>LOCAL FIRST · MADE FOR YOUR FLOW</span>
          </footer>
        </div>
      </div>
      {imageOpened && (
        <div className="wb-image-workspace" hidden={view !== "create"}>
          <div className="wb-image-return">
            <button type="button" onClick={() => navigate("desk")}>
              <ArrowLeft size={15} />
              返回工作台
            </button>
            <span>图片创作</span>
          </div>
          <Suspense
            fallback={
              <div className="wb-empty">
                <LoaderCircle className="wb-spin" />
                正在打开图片创作…
              </div>
            }
          >
            <ImageWorkspace />
          </Suspense>
        </div>
      )}
      {converting && (
        <ConversionDialog
          files={converting}
          engine={engine}
          onClose={() => setConverting(null)}
          onStart={startConversion}
        />
      )}
    </>
  );
}
