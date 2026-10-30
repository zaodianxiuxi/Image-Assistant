import { useEffect, useRef, useState } from "react";
import { jsonRequest, requestJson } from "./types";
import type { Notebook } from "./types";

export function useNotebook(scope: string, fileId: string) {
  const [note, setNote] = useState<Notebook | null>(null);
  const [status, setStatus] = useState("正在读取笔记…");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<Notebook | null>(null);
  const current = useRef<Notebook | null>(null);
  const dirty = useRef(false),
    saving = useRef(false),
    blocked = useRef(false),
    alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const key = "workbench-notebook:" + scope + ":" + fileId;
  const url = "/notebooks/" + scope + "/" + fileId;
  function keepDraft(value: Notebook) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      if (alive.current)
        setError("浏览器草稿存储不可用，请保持页面打开直到服务器保存完成。");
    }
  }
  async function flush() {
    if (!dirty.current || saving.current || blocked.current || !current.current)
      return;
    saving.current = true;
    const snapshot = current.current;
    if (alive.current) {
      setStatus("正在保存…");
      setError("");
    }
    try {
      const saved = await requestJson<Notebook>(
        url,
        jsonRequest("PUT", snapshot),
      );
      if (current.current === snapshot) {
        current.current = saved;
        dirty.current = false;
        try {
          localStorage.removeItem(key);
        } catch {}
        if (alive.current) {
          setNote(saved);
          setStatus("已保存到本机");
        }
      } else {
        current.current = {
          ...current.current!,
          revision: saved.revision,
          updatedAt: saved.updatedAt,
        };
        keepDraft(current.current);
      }
    } catch (e) {
      const reason = e as Error & { status?: number };
      blocked.current = true;
      if (alive.current) {
        setStatus("尚未同步");
        setError(reason.message);
      }
      if (reason.status === 409) {
        const latest = await requestJson<Notebook>(url).catch(() => null);
        if (alive.current) setConflict(latest);
      }
    } finally {
      saving.current = false;
      if (dirty.current && !blocked.current) void flush();
    }
  }
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    requestJson<Notebook>(url)
      .then((server) => {
        if (cancelled) return;
        let draft: Notebook | null = null;
        try {
          const raw = JSON.parse(localStorage.getItem(key) || "null");
          if (
            raw &&
            typeof raw.body === "string" &&
            Array.isArray(raw.excerpts) &&
            Number.isInteger(raw.revision)
          )
            draft = raw;
        } catch {}
        const same =
          draft &&
          draft.body === server.body &&
          JSON.stringify(draft.excerpts) === JSON.stringify(server.excerpts);
        if (draft && !same) {
          current.current = { ...draft, scope, fileId };
          dirty.current = true;
          if (draft.revision !== server.revision) {
            blocked.current = true;
            setConflict(server);
            setError("发现本地草稿与另一版本，请检查并合并。");
            setStatus("草稿待合并");
          } else {
            setStatus("已恢复本地草稿");
            void flush();
          }
        } else {
          current.current = server;
          setStatus("已保存到本机");
        }
        setNote(current.current);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setStatus("读取失败");
        }
      });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      cancelled = true;
      alive.current = false;
      clearTimeout(timer.current);
      void flush();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [scope, fileId]);
  function update(patch: Partial<Pick<Notebook, "body" | "excerpts">>) {
    if (!current.current) return;
    current.current = { ...current.current, ...patch };
    dirty.current = true;
    keepDraft(current.current);
    setNote(current.current);
    setStatus(blocked.current ? "草稿已保留，待同步" : "正在编辑…");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  }
  async function retry(merge = false) {
    if (!current.current) {
      location.reload();
      return;
    }
    if (merge && conflict)
      current.current = { ...current.current, revision: conflict.revision };
    if (conflict && !merge) return;
    setConflict(null);
    blocked.current = false;
    await flush();
  }
  return { note, status, error, conflict, update, retry };
}
