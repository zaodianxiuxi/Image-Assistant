import { ChangeEvent, FormEvent, SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Eraser,
  FolderKanban,
  ImagePlus,
  LoaderCircle,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  WandSparkles,
  X
} from "lucide-react";
import { getDailyPromptHotlist } from "./prompt-hotlist.mjs";
import type { PromptHotlistItem } from "./prompt-hotlist.mjs";
import { groupHistoryRecords } from "./gallery-groups.mjs";

type Mode = "generate" | "edit";
type ExecutionStage = "idle" | "validating" | "sending" | "processing" | "completed" | "failed";
type Theme = "light" | "dark";
type ReferenceImage = {
  file: File;
  preview: string;
};
type Result = {
  id: string;
  src: string;
  fileName?: string;
  seriesId?: number | null;
  seriesName?: string | null;
  nodeId?: number | null;
  nodeTitle?: string | null;
  nodeOrder?: number | null;
  prompt: string;
  kind: Mode;
  createdAt: Date;
};
type LibraryPrompt = {
  id: number;
  title: string;
  category: string;
  content: string;
  favorite: boolean;
};
type SeriesRecord = { id: number; name: string; description?: string; global_prompt?: string; style_prompt?: string };
type SeriesNode = { id: number; series_id: number; node_order: number; title: string; story_text?: string; prompt?: string; status: string };

const SIZES = [
  { value: "1024x1024", name: "正方形", detail: "1:1" },
  { value: "1536x864", name: "电脑横屏", detail: "16:9" },
  { value: "864x1536", name: "手机竖屏", detail: "9:16" }
];

const MAX_REFERENCE_IMAGES = 10;
const STORYBOARD_STYLE_PREFIX = "写实、现实质感的东方志怪电影摄影风格，古代中国环境，可信的人物比例和材质，统一角色外貌、服装、时代与光影，不要卡通、插画或现代物品。";
function getInitialTheme(): Theme {
  const savedTheme = window.localStorage.getItem("image-assistant-theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function mergePromptItems(incoming: PromptHotlistItem[], existing: PromptHotlistItem[]) {
  const seenPrompts = new Set<string>();
  return [...incoming, ...existing].filter((item) => {
    if (!item?.prompt || seenPrompts.has(item.prompt)) return false;
    seenPrompts.add(item.prompt);
    return true;
  }).slice(0, 120);
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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [preview, setPreview] = useState<Result | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [failedImageSources, setFailedImageSources] = useState<Set<string>>(() => new Set());
  const [imageRetries, setImageRetries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [executionStage, setExecutionStage] = useState<ExecutionStage>("idle");
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hotlistRefreshIndex, setHotlistRefreshIndex] = useState(0);
  const [extraPrompts, setExtraPrompts] = useState<PromptHotlistItem[]>([]);
  const [promptIdeasLoading, setPromptIdeasLoading] = useState(false);
  const [promptIdeasStatus, setPromptIdeasStatus] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryPrompts, setLibraryPrompts] = useState<LibraryPrompt[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryStatus, setLibraryStatus] = useState("");
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [activeSeries, setActiveSeries] = useState<SeriesRecord | null>(null);
  const [seriesNodes, setSeriesNodes] = useState<SeriesNode[]>([]);
  const [activeNode, setActiveNode] = useState<SeriesNode | null>(null);
  const [seriesStatus, setSeriesStatus] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [storyText, setStoryText] = useState("");
  const [storyboardLoading, setStoryboardLoading] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [activityStatus, setActivityStatus] = useState("准备就绪，可以开始创作。");
  const [activityTone, setActivityTone] = useState<"idle" | "working" | "success" | "error">("idle");
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

  useEffect(() => {
    fetch("/api/prompts")
      .then(async (response) => response.ok ? response.json() : { prompts: [] })
      .then((data) => {
        if (Array.isArray(data.prompts)) setExtraPrompts((items) => mergePromptItems(data.prompts, items));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/library/images?limit=60")
      .then(async (response) => response.ok ? response.json() : { images: [] })
      .then((data) => {
        if (!Array.isArray(data.images)) return;
        const savedResults: Result[] = data.images.map((item: { id: number; image: string; fileName?: string; prompt?: string; kind?: string; seriesId?: number | null; seriesName?: string | null; nodeId?: number | null; nodeTitle?: string | null; nodeOrder?: number | null; createdAt?: string }) => ({
          id: "db-" + item.id,
          src: item.image,
          fileName: item.fileName,
          seriesId: item.seriesId,
          seriesName: item.seriesName,
          nodeId: item.nodeId,
          nodeTitle: item.nodeTitle,
          nodeOrder: item.nodeOrder,
          prompt: item.prompt || item.fileName || "已保存图片",
          kind: item.kind === "edit" ? "edit" : "generate",
          createdAt: new Date(item.createdAt || Date.now())
        }));
        setHistory((items) => {
          const merged = [...items, ...savedResults];
          const seen = new Set<string>();
          return merged.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          }).slice(0, 60);
        });
      })
      .catch(() => undefined)
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("image-assistant-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!preview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [preview]);

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
  const dailyPrompts = useMemo(
    () => getDailyPromptHotlist(new Date(), 6, hotlistRefreshIndex, extraPrompts),
    [extraPrompts, hotlistRefreshIndex]
  );
  const hotlistDate = useMemo(
    () => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date()),
    []
  );
  const groupedHistory = useMemo(() => groupHistoryRecords(history), [history]);

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

  async function handleGeneratePromptIdeas() {
    if (promptIdeasLoading) return;
    setPromptIdeasLoading(true);
    setError("");
    setPromptIdeasStatus("正在请求文本模型生成 6 条新灵感...");
    setActivityStatus("已开始生成新灵感，正在请求文本模型...");
    setActivityTone("working");
    try {
      const response = await fetch("/api/prompts/generate", { method: "POST" });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      if (!Array.isArray(data.prompts) || !data.prompts.length) throw new Error("未获得可用的新灵感，请稍后重试。");
      // New entries lead the session list while cached entries remain available after reload.
      setExtraPrompts((items) => mergePromptItems(data.prompts, items));
      setHotlistRefreshIndex((value) => value + 1);
      setActivityStatus("新灵感生成成功，已保存并显示在提示词列表顶部。");
      setActivityTone("success");
      setPromptIdeasStatus(`已生成 ${data.prompts.length} 条新灵感，已显示在提示词列表顶部。`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "生成新灵感失败，请稍后重试。";
      setError(message);
      setActivityStatus("新灵感生成失败，请查看错误信息。");
      setActivityTone("error");
      setPromptIdeasStatus(`生成失败：${message}`);
    } finally {
      setPromptIdeasLoading(false);
    }
  }

  async function loadLibraryPrompts(search = librarySearch) {
    setLibraryStatus("正在读取提示词库...");
    try {
      const response = await fetch("/api/library/prompts?search=" + encodeURIComponent(search));
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setLibraryPrompts(Array.isArray(data.prompts) ? data.prompts : []);
      setLibraryStatus("已加载 " + (Array.isArray(data.prompts) ? data.prompts.length : 0) + " 条提示词。");
    } catch (caught) {
      setLibraryStatus(caught instanceof Error ? caught.message : "读取提示词库失败。");
    }
  }

  async function saveCurrentPrompt() {
    if (!prompt.trim()) {
      setLibraryStatus("当前没有可保存的提示词。");
      return;
    }
    setLibraryStatus("正在保存提示词...");
    try {
      const response = await fetch("/api/library/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: prompt.trim().slice(0, 12), category: "未分类", content: prompt.trim(), source: "manual" })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      await loadLibraryPrompts();
      setLibraryStatus("提示词已保存到 MySQL。");
    } catch (caught) {
      setLibraryStatus(caught instanceof Error ? caught.message : "保存提示词失败。");
    }
  }

  async function removeLibraryPrompt(id: number) {
    try {
      const response = await fetch("/api/library/prompts/" + id, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response));
      setLibraryPrompts((items) => items.filter((item) => item.id !== id));
      setLibraryStatus("提示词已删除。");
    } catch (caught) {
      setLibraryStatus(caught instanceof Error ? caught.message : "删除提示词失败。");
    }
  }

  async function loadSeries() {
    setSeriesStatus("正在读取系列...");
    try {
      const response = await fetch("/api/series");
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesList(Array.isArray(data.series) ? data.series : []);
      setSeriesStatus("已加载 " + (Array.isArray(data.series) ? data.series.length : 0) + " 个系列。");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "读取系列失败。");
    }
  }

  async function createNewSeries() {
    if (!newSeriesName.trim()) {
      setSeriesStatus("请输入系列名称。");
      return;
    }
    setSeriesStatus("正在创建系列...");
    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSeriesName.trim() })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesList((items) => [data.series, ...items]);
      setActiveSeries(data.series);
      setNewSeriesName("");
      setSeriesNodes([]);
      setSeriesStatus("系列已创建。");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "创建系列失败。");
    }
  }

  async function selectSeries(series: SeriesRecord) {
    setActiveSeries(series);
    setSeriesStatus("正在读取故事节点...");
    try {
      const response = await fetch("/api/series/" + series.id + "/nodes");
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesNodes(Array.isArray(data.nodes) ? data.nodes : []);
      setActiveNode(null);
      setSeriesStatus("系列已选中。");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "读取故事节点失败。");
    }
  }

  async function createNewNode() {
    if (!activeSeries) {
      setSeriesStatus("请先选择一个系列。");
      return;
    }
    if (!newNodeTitle.trim()) {
      setSeriesStatus("请输入节点名称。");
      return;
    }
    setSeriesStatus("正在创建故事节点...");
    try {
      const response = await fetch("/api/series/" + activeSeries.id + "/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeOrder: seriesNodes.length + 1,
          title: newNodeTitle.trim(),
          prompt: prompt.trim() || null
        })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesNodes((items) => [...items, data.node]);
      setActiveNode(data.node);
      setNewNodeTitle("");
      setSeriesStatus("故事节点已创建。");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "创建故事节点失败。");
    }
  }

  async function createStoryboard() {
    if (!activeSeries) {
      setSeriesStatus("请先创建并选择一个系列。");
      return;
    }
    if (!storyText.trim()) {
      setSeriesStatus("请输入故事原文或故事梗概。");
      return;
    }
    setStoryboardLoading(true);
    setSeriesStatus("正在使用文本模型拆分故事节点...");
    setActivityStatus("已开始拆分故事，正在请求文本模型...");
    setActivityTone("working");
    try {
      const response = await fetch("/api/series/" + activeSeries.id + "/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: storyText.trim() })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesNodes(Array.isArray(data.nodes) ? data.nodes : []);
      setActiveNode(null);
      setSeriesStatus("故事已拆分为 " + (Array.isArray(data.nodes) ? data.nodes.length : 0) + " 个连续节点。");
      setActivityStatus("故事拆分成功，已生成 " + (Array.isArray(data.nodes) ? data.nodes.length : 0) + " 个节点。");
      setActivityTone("success");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "自动拆分故事失败。");
      setActivityStatus("故事拆分失败，请查看错误信息。");
      setActivityTone("error");
    } finally {
      setStoryboardLoading(false);
    }
  }

  async function generateStoryboardImages() {
    if (!activeSeries || !seriesNodes.length || batchGenerating) {
      setBatchProgress(activeSeries ? "请先生成故事节点。" : "请先选择一个系列。");
      setActivityStatus(activeSeries ? "未开始：请先自动拆分故事生成节点。" : "未开始：请先选择一个系列。");
      setActivityTone("error");
      return;
    }
    setBatchGenerating(true);
    setBatchProgress("正在准备批量生成...");
    setActivityStatus("批量任务已开始，正在准备第 1 张图片...");
    setActivityTone("working");
    const generated: Result[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];
    let previousImage: { blob: Blob; fileName: string } | null = null;
    try {
      for (let index = 0; index < seriesNodes.length; index += 1) {
        const node = seriesNodes[index];
        const nodePrompt = STORYBOARD_STYLE_PREFIX + " " + (node.prompt || node.story_text || node.title);
        setBatchProgress("正在生成第 " + (index + 1) + " / " + seriesNodes.length + " 张：" + node.title + (previousImage ? "，正在引用上一节点图片。" : ""));
        setActivityStatus("批量生成中：第 " + (index + 1) + " / " + seriesNodes.length + " 张，" + node.title + (previousImage ? "（已引用上一节点图片）" : ""));
        try {
          let response: Response;
          const operation: Mode = previousImage ? "edit" : "generate";
          if (previousImage) {
            const form = new FormData();
            form.append("prompt", nodePrompt);
            form.append("size", size);
            form.append("title", node.title);
            form.append("seriesName", activeSeries.name);
            form.append("seriesId", String(activeSeries.id));
            form.append("nodeId", String(node.id));
            form.append("nodeOrder", String(node.node_order));
            form.append("image[]", previousImage.blob, previousImage.fileName);
            response = await fetch("/api/images/edit", { method: "POST", body: form });
          } else {
            response = await fetch("/api/images/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: nodePrompt,
                size,
                title: node.title,
                seriesName: activeSeries.name,
                seriesId: activeSeries.id,
                nodeId: node.id,
                nodeOrder: node.node_order
              })
            });
          }
          if (!response.ok) throw new Error(await readApiError(response));
          const data = await response.json();
          generated.push({
            id: data.databaseId ? "db-" + data.databaseId : crypto.randomUUID(),
            src: data.image,
            fileName: data.fileName,
            seriesId: activeSeries.id,
            seriesName: activeSeries.name,
            nodeId: node.id,
            nodeTitle: node.title,
            nodeOrder: node.node_order,
            prompt: data.revisedPrompt || nodePrompt,
            kind: operation,
            createdAt: new Date()
          });
          const imageResponse = await fetch(data.image);
          if (imageResponse.ok) {
            previousImage = { blob: await imageResponse.blob(), fileName: data.fileName || ("node-" + node.node_order + ".png") };
          } else {
            previousImage = null;
            warnings.push(node.title + "：无法读取图片作为下一节点参考图，下一张将按普通生成处理");
          }
        } catch (caught) {
          failures.push(node.title + "：" + (caught instanceof Error ? caught.message : "请求失败"));
        }
      }
      if (generated.length) {
        setCurrent(generated.at(-1) || null);
        setHistory((items) => [...generated.reverse(), ...items].slice(0, 60));
      }
      const nodesResponse = await fetch("/api/series/" + activeSeries.id + "/nodes");
      if (nodesResponse.ok) {
        const nodesData = await nodesResponse.json();
        if (Array.isArray(nodesData.nodes)) setSeriesNodes(nodesData.nodes);
      }
      setBatchProgress("批量生成完成：成功 " + generated.length + " 张，失败 " + failures.length + " 张。" + (failures.length ? " 失败节点：" + failures.join("；") : "") + (warnings.length ? " 提示：" + warnings.join("；") : ""));
      setActivityStatus("批量生成完成：成功 " + generated.length + " 张，失败 " + failures.length + " 张。");
      setActivityTone(failures.length ? "error" : "success");
    } catch (caught) {
      setBatchProgress("批量生成已停止：" + (caught instanceof Error ? caught.message : "请求失败。"));
      setActivityStatus("批量生成异常终止，请查看错误信息。");
      setActivityTone("error");
    } finally {
      setBatchGenerating(false);
    }
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

  function openPreview(result: Result) {
    setPreview(result);
  }

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    const source = event.currentTarget.dataset.imageSource;
    if (source) setFailedImageSources((sources) => new Set(sources).add(source));
  }

  function retryImage(source: string) {
    setFailedImageSources((sources) => {
      const nextSources = new Set(sources);
      nextSources.delete(source);
      return nextSources;
    });
    setImageRetries((retries) => ({ ...retries, [source]: (retries[source] || 0) + 1 }));
  }

  function getImageSource(source: string) {
    const retry = imageRetries[source];
    if (!retry || source.startsWith("data:")) return source;
    return `${source}${source.includes("?") ? "&" : "?"}previewRetry=${retry}`;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) {
      setError(mode === "generate" ? "先描述你想要生成的图片。" : "描述希望如何编辑图片。" );
      setActivityStatus("未开始：请先填写提示词。");
      setActivityTone("error");
      logClientEvent("client_validation_failed", { promptChars: 0 });
      return;
    }
    if (mode === "edit" && !referenceImages.length) {
      setError("图片编辑需要至少上传一张原图。" );
      setActivityStatus("未开始：编辑模式至少需要一张图片。");
      setActivityTone("error");
      logClientEvent("client_validation_failed", { promptChars: prompt.trim().length });
      return;
    }

    setLoading(true);
    setError("");
    setActivityStatus("已开始生成，正在校验请求...");
    setActivityTone("working");
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
      setActivityStatus(operation === "edit" ? "已开始上传参考图，正在发送请求..." : "已开始发送提示词，正在连接图片服务...");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      if (operation === "generate") {
        const request = fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            size,
            title: activeNode?.title || undefined,
            seriesName: activeSeries?.name || undefined,
            seriesId: activeSeries?.id || undefined,
            nodeId: activeNode?.id || undefined,
            nodeOrder: activeNode?.node_order || undefined
          })
        });
        setExecutionStage("processing");
        setActivityStatus("图片模型正在生成，请稍候...");
        response = await request;
      } else {
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("size", size);
        if (activeNode?.title) form.append("title", activeNode.title);
        if (activeSeries?.name) form.append("seriesName", activeSeries.name);
        if (activeSeries?.id) form.append("seriesId", String(activeSeries.id));
        if (activeNode?.id) form.append("nodeId", String(activeNode.id));
        if (activeNode?.node_order) form.append("nodeOrder", String(activeNode.node_order));
        referenceImages.forEach((image) => form.append("image[]", image.file));
        if (maskFile) form.append("mask", maskFile);
        const request = fetch("/api/images/edit", { method: "POST", body: form });
        setExecutionStage("processing");
        setActivityStatus("图片模型正在根据参考图生成，请稍候...");
        response = await request;
      }

      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      const result: Result = {
        id: data.databaseId ? "db-" + data.databaseId : crypto.randomUUID(),
        src: data.image,
        fileName: data.fileName,
        seriesId: activeSeries?.id,
        seriesName: activeSeries?.name,
        nodeId: activeNode?.id,
        nodeTitle: activeNode?.title,
        nodeOrder: activeNode?.node_order,
        prompt: data.revisedPrompt || prompt,
        kind: operation,
        createdAt: new Date()
      };
      setCurrent(result);
      setHistory((items) => [result, ...items].slice(0, 60));
      setApiReady(true);
      setExecutionStage("completed");
      setActivityStatus("生成成功，图片已保存到桌面文件夹。");
      setActivityTone("success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "图片请求失败，请稍后重试。" );
      setExecutionStage("failed");
      setActivityStatus("生成失败，请查看错误信息和终端日志。");
      setActivityTone("error");
    } finally {
      setLoading(false);
    }
  }

  function renderHistoryItem(item: Result) {
    return (
      <article className="history-item" key={item.id}>
        <button type="button" onClick={() => { setCurrent(item); openPreview(item); }} aria-label={"预览生成记录：" + item.prompt}>
          {failedImageSources.has(item.src)
            ? <span className="history-image-error">图片加载失败</span>
            : <img key={item.id + "-" + (imageRetries[item.src] || 0)} src={getImageSource(item.src)} data-image-source={item.src} alt={item.prompt} onError={handleImageError} />}
        </button>
        <div><span><Clock3 size={13} /> {formatTime(item.createdAt)}</span><DownloadButton src={item.src} filename={item.fileName || "image-assistant.png"} /></div>
      </article>
    );
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
          <button className="icon-button" type="button" onClick={() => { setLibraryOpen(true); void loadLibraryPrompts(); }} title="提示词库" aria-label="打开提示词库">
            <Search size={17} />
          </button>
          <button className="icon-button" type="button" onClick={() => { setSeriesOpen(true); void loadSeries(); }} title="系列创作" aria-label="打开系列创作">
            <FolderKanban size={17} />
          </button>
          <button
            className="icon-button theme-toggle"
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            title={theme === "light" ? "切换深色主题" : "切换浅色主题"}
            aria-label={theme === "light" ? "切换深色主题" : "切换浅色主题"}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <a href="https://sudocode.chat/docs/image-api" target="_blank" rel="noreferrer" className="docs-link">
            API 文档 <ArrowUpRight size={14} />
          </a>
          <span className={`connection ${apiReady ? "online" : apiReady === false ? "offline" : "checking"}`}>
            <span className="status-dot" />
            {apiReady ? "API 已就绪" : apiReady === false ? "等待配置" : "检查连接"}
          </span>
        </div>
      </header>
      <div className={"activity-banner " + activityTone} role="status" aria-live="polite">
        {(loading || promptIdeasLoading || storyboardLoading || batchGenerating) && <LoaderCircle className="spin" size={15} />}
        {!(loading || promptIdeasLoading || storyboardLoading || batchGenerating) && activityTone === "success" && <CheckCircle2 size={15} />}
        <span>{activityStatus}</span>
      </div>

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

            <div className="field-label-row"><label className="field-label" htmlFor="prompt">提示词</label><button className="save-prompt-button" type="button" onClick={saveCurrentPrompt} title="保存到提示词库"><Plus size={13} /> 保存</button></div>
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

          <section className="prompt-hotlist" aria-label="今日提示词热榜">
            <div className="hotlist-heading">
              <span>今日提示词热榜</span>
              <div className="hotlist-meta">
                <small>{hotlistDate}</small>
                <button
                  className="hotlist-refresh"
                  type="button"
                  onClick={() => {
                    setHotlistRefreshIndex((value) => value + 1);
                    setPromptIdeasStatus("已刷新今日提示词。");
                  }}
                  title="刷新今日提示词"
                  aria-label="刷新今日提示词"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  className="hotlist-generate"
                  type="button"
                  onClick={handleGeneratePromptIdeas}
                  disabled={promptIdeasLoading}
                >
                  {promptIdeasLoading ? <LoaderCircle className="spin" size={13} /> : <WandSparkles size={13} />}
                  {promptIdeasLoading ? "正在生成" : "生成新灵感"}
                </button>
              </div>
            </div>
            {promptIdeasStatus && <p className={`hotlist-status ${promptIdeasLoading ? "is-loading" : ""}`} role="status" aria-live="polite">{promptIdeasStatus}</p>}
            <div className="hotlist-list">
              {dailyPrompts.map((item, index) => (
                <button key={item.id} type="button" className="hotlist-item" onClick={() => setPrompt(item.prompt)}>
                  <span className="hotlist-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="hotlist-copy"><strong>{item.title}</strong><small>{item.category} · {SIZES.find((option) => option.value === item.size)?.detail}</small><em>{item.prompt}</em></span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-heading">
            <div><span className="eyebrow">输出</span><h1>{current ? "最新生成结果" : "创作画布"}</h1></div>
            {current && <DownloadButton src={current.src} filename={current.fileName || "image-assistant.png"} />}
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
                  {failedImageSources.has(current.src) ? (
                    <div className="image-load-error" role="alert"><strong>图片加载失败</strong><button type="button" onClick={() => retryImage(current.src)}><RefreshCw size={14} /> 重新加载</button></div>
                  ) : (
                    <button className="result-preview-trigger" type="button" onClick={() => openPreview(current)} aria-label="预览生成图片">
                      <img key={`${current.id}-${imageRetries[current.src] || 0}`} src={getImageSource(current.src)} data-image-source={current.src} alt={current.prompt} onError={handleImageError} />
                    </button>
                  )}
                  <figcaption><span>{current.kind === "generate" ? "生成" : "编辑"} · {formatTime(current.createdAt)}</span><p>{current.prompt}</p></figcaption>
                </figure>
            ) : (
              <div className="empty-state"><span className="empty-icon"><Sparkles size={26} /></span><strong>{emptyTitle}</strong><p>填写提示词，然后在这里查看生成结果。</p></div>
            )}
          </div>
        </section>
      </section>

      <section className="history-section">
        <div className="history-heading"><div><span className="eyebrow">本地图库</span><h2>图片合集</h2></div>{historyLoading ? <span>正在读取</span> : history.length > 0 && <span>{history.length} 张图片</span>}</div>
          {history.length ? (
            <div className="gallery-groups">
              {groupedHistory.map((group) => (
                <section className="gallery-group" key={group.key}>
                  <div className="gallery-group-heading"><strong>{group.title}</strong><span>{group.nodes.reduce((total, node) => total + node.items.length, 0)} 张</span></div>
                  <div className="gallery-node-groups">
                    {group.nodes.map((node) => (
                      <section className="gallery-node-group" key={node.key}>
                        <div className="gallery-node-heading"><strong>{node.nodeOrder === null ? node.title : `${String(node.nodeOrder).padStart(2, "0")} · ${node.title}`}</strong><span>{node.items.length} 张</span></div>
                        <div className="history-grid">{node.items.map(renderHistoryItem)}</div>
                      </section>
                    ))}
                  </div>
                </section>
              ))}
            </div>
        ) : (
          <div className="history-empty"><Clock3 size={18} /> 还没有已保存的图片。</div>
        )}
      </section>

      <footer><span>Powered by gpt-image-2</span><span>图片已保存到桌面 Image-Assisant 文件夹</span></footer>
      {libraryOpen && (
        <div className="manager-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLibraryOpen(false); }}>
          <section className="manager-dialog" role="dialog" aria-modal="true" aria-label="提示词库">
            <div className="manager-toolbar"><strong>提示词库</strong><button className="icon-button" type="button" onClick={() => setLibraryOpen(false)} title="关闭提示词库" aria-label="关闭提示词库"><X size={18} /></button></div>
            <div className="manager-body">
              <div className="manager-search"><Search size={15} /><input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadLibraryPrompts(); }} placeholder="搜索标题、分类或内容" /><button type="button" onClick={() => void loadLibraryPrompts()}>搜索</button></div>
              <div className="manager-actions"><button type="button" onClick={saveCurrentPrompt}><Plus size={14} /> 保存当前提示词</button><span role="status">{libraryStatus}</span></div>
              <div className="library-list">
                {libraryPrompts.map((item) => <article className="library-item" key={item.id}><button type="button" className="library-content" onClick={() => { setPrompt(item.content); setLibraryOpen(false); }}><strong>{item.title}</strong><small>{item.category}</small><p>{item.content}</p></button><button type="button" className="icon-button small" onClick={() => void removeLibraryPrompt(item.id)} title="删除提示词" aria-label={"删除提示词：" + item.title}><Trash2 size={14} /></button></article>)}
                {!libraryPrompts.length && <p className="manager-empty">暂无已保存提示词。可以先保存当前提示词。</p>}
              </div>
            </div>
          </section>
        </div>
      )}
      {seriesOpen && (
        <div className="manager-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSeriesOpen(false); }}>
          <section className="manager-dialog" role="dialog" aria-modal="true" aria-label="系列创作">
            <div className="manager-toolbar"><strong>系列创作</strong><button className="icon-button" type="button" onClick={() => setSeriesOpen(false)} title="关闭系列创作" aria-label="关闭系列创作"><X size={18} /></button></div>
            <div className="manager-body series-manager">
              <div className="manager-search"><input value={newSeriesName} onChange={(event) => setNewSeriesName(event.target.value)} placeholder="新系列名称" /><button type="button" onClick={() => void createNewSeries()}><Plus size={14} /> 创建系列</button></div>
              {activeSeries && <div className="storyboard-form"><textarea value={storyText} onChange={(event) => setStoryText(event.target.value)} placeholder="粘贴志怪故事原文或故事梗概，程序会自动拆分成连续画面节点。" rows={5} /><div><button type="button" onClick={() => void createStoryboard()} disabled={storyboardLoading || seriesNodes.length > 0}>{storyboardLoading ? <LoaderCircle className="spin" size={14} /> : <WandSparkles size={14} />}{storyboardLoading ? "正在拆分" : "自动拆分故事"}</button><button type="button" onClick={() => void generateStoryboardImages()} disabled={batchGenerating || !seriesNodes.length}>{batchGenerating ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}{batchGenerating ? "正在批量生成" : "批量生成图片"}</button></div></div>}
              <div className="series-layout">
                <div className="series-list">{seriesList.map((series) => <button type="button" key={series.id} className={activeSeries?.id === series.id ? "series-entry active" : "series-entry"} onClick={() => void selectSeries(series)}><strong>{series.name}</strong><small>系列 #{series.id}</small></button>)}{!seriesList.length && <p className="manager-empty">暂无系列。</p>}</div>
                <div className="node-panel">
                  <div className="node-panel-heading"><strong>{activeSeries?.name || "请选择系列"}</strong>{activeSeries && <span>{seriesNodes.length} 个节点</span>}</div>
                  {activeSeries && <div className="manager-search"><input value={newNodeTitle} onChange={(event) => setNewNodeTitle(event.target.value)} placeholder="新故事节点名称" /><button type="button" onClick={() => void createNewNode()}><Plus size={14} /> 添加节点</button></div>}
                  <div className="node-list">{seriesNodes.map((node) => <button type="button" key={node.id} className={activeNode?.id === node.id ? "node-entry active" : "node-entry"} onClick={() => { setActiveNode(node); if (node.prompt) setPrompt(node.prompt); setSeriesOpen(false); }}><span>{String(node.node_order).padStart(2, "0")}</span><strong>{node.title}</strong><small>{node.status}</small></button>)}</div>
                </div>
              </div>
              {seriesStatus && <p className="manager-status" role="status">{seriesStatus}</p>}
              {batchProgress && <p className="manager-status" role="status">{batchProgress}</p>}
            </div>
          </section>
        </div>
      )}
      {preview && (
        <div className="image-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
          <section className="image-preview-dialog" role="dialog" aria-modal="true" aria-label="图片预览">
            <div className="image-preview-toolbar"><span>{preview.kind === "generate" ? "生成图片预览" : "编辑图片预览"}</span><button className="icon-button" type="button" onClick={() => setPreview(null)} title="关闭预览" aria-label="关闭预览"><X size={18} /></button></div>
            <div className="image-preview-media">
              {failedImageSources.has(preview.src) ? (
                <div className="image-load-error" role="alert"><strong>图片加载失败</strong><button type="button" onClick={() => retryImage(preview.src)}><RefreshCw size={14} /> 重新加载</button></div>
              ) : (
                <img key={`${preview.id}-${imageRetries[preview.src] || 0}`} src={getImageSource(preview.src)} data-image-source={preview.src} alt={preview.prompt} onError={handleImageError} />
              )}
            </div>
            <p>{preview.prompt}</p>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
