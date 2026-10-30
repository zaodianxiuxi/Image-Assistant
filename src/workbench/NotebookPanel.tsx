import { useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Quote,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { useNotebook } from "./useNotebook";
import type { Excerpt } from "./types";
export type Capture = Omit<Excerpt, "id"> & { token: number };
export default function NotebookPanel({
  scope,
  fileId = "overview",
  title,
  projectName,
  capture,
  onSource,
}: {
  scope: string;
  fileId?: string;
  title: string;
  projectName: string;
  capture?: Capture | null;
  onSource?: (excerpt: Excerpt) => void;
}) {
  const { note, status, error, conflict, update, retry } = useNotebook(
    scope,
    fileId,
  );
  const [notice, setNotice] = useState("");
  const consumed = useRef(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!capture || !note || consumed.current === capture.token) return;
    consumed.current = capture.token;
    if (note.excerpts.length >= 200) {
      setNotice("最多保留 200 条摘录，请先整理笔记。");
      return;
    }
    update({
      excerpts: [
        ...note.excerpts,
        {
          id: crypto.randomUUID(),
          text: capture.text,
          ...(capture.page ? { page: capture.page } : {}),
          ...(capture.offset !== undefined ? { offset: capture.offset } : {}),
        },
      ],
    });
    setNotice("已加入摘录，来源位置已保留。");
  }, [capture, note]);
  function exportNote() {
    if (!note) return;
    const content = [
      "# " + title,
      "",
      "项目：" + projectName,
      "",
      note.body,
      "",
      "## 来源摘录",
      ...note.excerpts.flatMap((ex) => [
        "",
        "> " + ex.text.replace(/\n/g, "\n> "),
        "",
        "来源：" + title + (ex.page ? " · 第 " + ex.page + " 页" : ""),
      ]),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = title.replace(/[<>:"/\\|?*]/g, "_") + "-笔记.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <aside className="wb-notebook" aria-label="阅读笔记">
      <header>
        <div>
          <span className="wb-kicker">NOTES & EXCERPTS</span>
          <h2>
            <BookOpen size={17} />{" "}
            {fileId === "overview" ? "项目笔记" : "阅读笔记"}
          </h2>
        </div>
        <button
          type="button"
          className="wb-icon-button"
          aria-label="导出笔记 Markdown"
          onClick={exportNote}
          disabled={!note}
        >
          <Download size={16} />
        </button>
      </header>
      <p className="wb-notebook-context">
        {projectName} · {title}
      </p>
      <div className="wb-note-status" role="status">
        {status}
      </div>
      {error && (
        <div className="wb-note-error" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
          {!conflict && (
            <button type="button" onClick={() => void retry()}>
              {note ? "重试保存" : "重试读取"}
            </button>
          )}
        </div>
      )}
      {conflict && (
        <details open className="wb-note-conflict">
          <summary>另一窗口的最新笔记</summary>
          <pre>{conflict.body || "（正文为空）"}</pre>
          {conflict.excerpts.map((ex) => (
            <blockquote key={ex.id}>{ex.text}</blockquote>
          ))}
          <p>先把需要保留的内容合并到下方笔记。当前草稿不会自动覆盖。</p>
          <button
            type="button"
            className="wb-secondary"
            onClick={() => void retry(true)}
          >
            保存当前内容作为合并结果
          </button>
        </details>
      )}
      <label className="wb-note-label" htmlFor="workspace-note-body">
        我的笔记
      </label>
      <textarea
        id="workspace-note-body"
        ref={editor}
        value={note?.body || ""}
        disabled={!note}
        maxLength={100000}
        placeholder={
          "写下理解、待办或想法…\n支持 Markdown 语法，内容自动保存。"
        }
        onChange={(e) => update({ body: e.target.value })}
      />
      <div className="wb-excerpt-heading">
        <h3>
          <Quote size={15} /> 来源摘录
        </h3>
        <span>{note?.excerpts.length || 0}</span>
      </div>
      {notice && (
        <p role="status" className="wb-excerpt-notice">
          {notice}
        </p>
      )}
      {!note?.excerpts.length && (
        <p className="wb-excerpt-empty">
          在左侧 PDF 或文本中选择文字，再点击“摘录到笔记”。
        </p>
      )}
      <div className="wb-excerpts">
        {note?.excerpts.map((ex) => (
          <article key={ex.id}>
            <blockquote>{ex.text}</blockquote>
            <footer>
              <button
                type="button"
                onClick={() => onSource?.(ex)}
                disabled={!onSource}
              >
                <ExternalLink size={12} />
                {ex.page ? "第 " + ex.page + " 页" : "回到原文"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const body =
                    (note.body ? note.body + "\n\n" : "") +
                    "> " +
                    ex.text.replace(/\n/g, "\n> ") +
                    "\n\n来源：" +
                    title +
                    (ex.page ? " · 第 " + ex.page + " 页" : "");
                  if (body.length > 100000) {
                    setNotice("笔记正文最多 10 万字，请整理后再插入摘录。");
                    return;
                  }
                  update({ body });
                  editor.current?.focus();
                }}
              >
                插入正文
              </button>
            </footer>
          </article>
        ))}
      </div>
    </aside>
  );
}
