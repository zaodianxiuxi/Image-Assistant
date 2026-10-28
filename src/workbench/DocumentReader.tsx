import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  BookOpen,
  Download,
  FileQuestion,
  Search,
  Minus,
  Plus,
  LoaderCircle,
} from "lucide-react";
import type { WorkspaceFile } from "./types";
import { fileUrl, formatSize, requestJson } from "./types";
type Props = {
  file?: WorkspaceFile;
  onFiles: () => void;
  onConvert: (files: WorkspaceFile[]) => void;
};
export default function DocumentReader({ file, onFiles, onConvert }: Props) {
  const [text, setText] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [query, setQuery] = useState("");
  const mark = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    setText("");
    setError("");
    setQuery("");
    setZoom(100);
    setTruncated(false);
    setLoading(false);
    if (file?.kind === "text") {
      setLoading(true);
      requestJson<{ text: string; truncated: boolean }>(
        "/files/" + file.id + "/text",
      )
        .then((data) => {
          if (!cancelled) {
            setText(data.text);
            setTruncated(data.truncated);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [file?.id]);
  const found = query
    ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
    : -1;
  useEffect(() => {
    if (found >= 0) mark.current?.scrollIntoView({ block: "center" });
  }, [query, found]);
  if (!file)
    return (
      <section className="wb-reader-empty">
        <span className="wb-kicker">A LITTLE ROOM TO READ</span>
        <BookOpen size={56} strokeWidth={1} />
        <h1>给资料一个安静的位置。</h1>
        <p>选择一份 PDF、图片或文本。阅读与文件处理，在同一个工作台里继续。</p>
        <button type="button" className="wb-primary" onClick={onFiles}>
          从文件库选择
        </button>
      </section>
    );
  return (
    <section className="wb-reader">
      <header className="wb-reader-toolbar">
        <button
          type="button"
          className="wb-icon-button"
          aria-label="返回文件库"
          onClick={onFiles}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1>{file.name}</h1>
          <small>
            {formatSize(file.size)} ·{" "}
            {file.kind === "pdf"
              ? "PDF 阅读"
              : file.kind === "image"
                ? "图片阅读"
                : file.kind === "text"
                  ? "文本阅读"
                  : "文件信息"}
          </small>
        </div>
        <div className="wb-reader-actions">
          <button
            type="button"
            className="wb-secondary"
            onClick={() => onConvert([file])}
          >
            <ArrowRightLeft size={15} />
            转换
          </button>
          <a className="wb-secondary" href={fileUrl(file.id, true)}>
            <Download size={15} />
            下载
          </a>
        </div>
      </header>
      {file.kind === "image" && (
        <div className="wb-reader-subbar">
          <button
            type="button"
            className="wb-icon-button"
            aria-label="缩小"
            disabled={zoom <= 25}
            onClick={() => setZoom((n) => Math.max(25, n - 25))}
          >
            <Minus size={16} />
          </button>
          <span>{zoom}%</span>
          <button
            type="button"
            className="wb-icon-button"
            aria-label="放大"
            disabled={zoom >= 200}
            onClick={() => setZoom((n) => Math.min(200, n + 25))}
          >
            <Plus size={16} />
          </button>
          <button
            className="wb-plain"
            type="button"
            onClick={() => setZoom(100)}
          >
            适应画面
          </button>
        </div>
      )}
      {file.kind === "text" && (
        <div className="wb-reader-subbar">
          <label className="wb-search">
            <Search size={16} />
            <input
              aria-label="查找文本"
              placeholder="查找文本"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {query && <span>{found < 0 ? "未找到" : "已定位首个匹配"}</span>}
          {truncated && <span>预览前 1 MB，下载可查看全文</span>}
        </div>
      )}
      <div className={"wb-reading-surface read-" + file.kind}>
        {error ? (
          <div className="wb-empty" role="alert">
            <FileQuestion size={32} />
            <p>{error}</p>
            <a className="wb-secondary" href={fileUrl(file.id, true)}>
              下载原文件
            </a>
          </div>
        ) : file.kind === "pdf" ? (
          <iframe
            key={file.id}
            title={"阅读 " + file.name}
            src={fileUrl(file.id)}
          />
        ) : file.kind === "image" ? (
          <div className="wb-image-scroll">
            <img
              key={file.id}
              src={fileUrl(file.id)}
              alt={file.name}
              style={{
                width: zoom + "%",
                maxWidth: zoom === 100 ? "100%" : "none",
                maxHeight: zoom === 100 ? "100%" : "none",
              }}
              onError={() =>
                setError("图片无法在浏览器中显示，请下载或转换后查看。")
              }
            />
          </div>
        ) : file.kind === "text" ? (
          loading ? (
            <div className="wb-empty">
              <LoaderCircle className="wb-spin" />
              正在读取…
            </div>
          ) : (
            <pre>
              {found >= 0 ? (
                <>
                  {text.slice(0, found)}
                  <mark ref={mark}>
                    {text.slice(found, found + query.length)}
                  </mark>
                  {text.slice(found + query.length)}
                </>
              ) : (
                text || "文件内容为空。"
              )}
            </pre>
          )
        ) : (
          <div className="wb-empty">
            <FileQuestion size={40} />
            <h2>这份文件适合换个方式打开</h2>
            <p>
              此格式尚不支持直接阅读。可以转换为 PDF 或图片，也可以下载原文件。
            </p>
            <button
              type="button"
              className="wb-primary"
              onClick={() => onConvert([file])}
            >
              查看可用转换
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
