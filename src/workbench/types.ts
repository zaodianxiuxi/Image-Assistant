export type WorkspaceView =
  "projects" | "desk" | "files" | "reader" | "tools" | "tasks" | "create";
export type WorkspaceFile = {
  id: string;
  name: string;
  size: number;
  kind: "image" | "pdf" | "text" | "document";
  createdAt: string;
  sourceId?: string;
  taskId?: string;
};
export type WorkspaceTask = {
  id: string;
  fileId: string;
  fileName: string;
  target: string;
  quality: number;
  status: "queued" | "running" | "completed" | "failed";
  outputIds: string[];
  createdAt: string;
  updatedAt: string;
  error?: string;
  warning?: string;
};
export type WorkspaceProject = {
  id: string;
  name: string;
  fileIds: string[];
  createdAt: string;
  updatedAt: string;
  lastFileId?: string;
};
export type ReadingPosition = {
  scope: string;
  fileId: string;
  page: number;
  offset: number;
  zoom: number;
  updatedAt?: string;
};
export type Excerpt = {
  id: string;
  text: string;
  page?: number;
  offset?: number;
};
export type Notebook = {
  scope: string;
  fileId: string;
  body: string;
  excerpts: Excerpt[];
  revision: number;
  updatedAt: string | null;
};
export type WorkspaceState = {
  files: WorkspaceFile[];
  tasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  reading: ReadingPosition[];
};
export type EngineStatus = {
  available: boolean;
  version: string | null;
  message: string;
};
export type ConversionTarget = { id: string; label: string };
export const fileUrl = (id: string, download = false) =>
  "/api/workbench/files/" +
  encodeURIComponent(id) +
  "/content" +
  (download ? "?download=1" : "");
export const formatSize = (bytes: number) =>
  bytes < 1024
    ? bytes + " B"
    : bytes < 1024 * 1024
      ? (bytes / 1024).toFixed(1) + " KB"
      : (bytes / 1024 / 1024).toFixed(1) + " MB";
export const fileExtension = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toUpperCase() : "FILE";
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
export async function requestJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch("/api/workbench" + url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("文件服务暂时不可用，请确认本地服务已启动。");
  }
  if (!response.ok)
    throw Object.assign(new Error(data.error || "操作未完成，请重试。"), {
      status: response.status,
    });
  return data as T;
}

export const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
