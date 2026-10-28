export type WorkspaceView =
  | "desk"
  | "files"
  | "reader"
  | "tools"
  | "tasks"
  | "create";
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
export type WorkspaceState = { files: WorkspaceFile[]; tasks: WorkspaceTask[] };
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
  if (!response.ok) throw new Error(data.error || "操作未完成，请重试。");
  return data as T;
}
