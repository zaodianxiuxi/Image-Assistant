import { useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRightLeft,
  Download,
  FileText,
  FolderOpen,
  Image,
  Search,
  Upload,
  LoaderCircle,
  Check,
} from "lucide-react";
import type { WorkspaceFile } from "./types";
import { fileUrl, fileExtension, formatSize, formatDate } from "./types";
type Props = {
  files: WorkspaceFile[];
  uploading: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onRead: (file: WorkspaceFile) => void;
  onConvert: (files: WorkspaceFile[]) => void;
  conversionMode?: boolean;
};
export function FileThumbnail({ file }: { file: WorkspaceFile }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={"wb-file-thumbnail kind-" + file.kind}>
      {file.kind === "image" && !failed ? (
        <img src={fileUrl(file.id)} alt="" onError={() => setFailed(true)} />
      ) : file.kind === "image" ? (
        <Image size={22} />
      ) : (
        <FileText size={22} />
      )}
    </span>
  );
}
export default function FileLibrary({
  files,
  uploading,
  onUpload,
  onRead,
  onConvert,
  conversionMode = false,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const matches = files.filter((file) =>
    file.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const chosen = files.filter((file) => selected.includes(file.id));
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }
  async function upload(list: File[]) {
    if (uploading || !list.length) return;
    await onUpload(list);
  }
  return (
    <section
      className="wb-file-library"
      aria-label={conversionMode ? "文件转换" : "文件库"}
    >
      <div className="wb-page-heading">
        <div>
          <span className="wb-kicker">
            {conversionMode ? "CONVERT & CONTINUE" : "YOUR FILES, TOGETHER"}
          </span>
          <h1>
            {conversionMode ? "让文件，换一种形式。" : "每一份文件，都有去处。"}
          </h1>
          <p>
            {conversionMode
              ? "选择已有文件，转换格式后继续阅读或下载。"
              : "把资料放在这里。阅读、转换，再开始下一步。"}
          </p>
        </div>
        <button
          className="wb-primary"
          type="button"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? (
            <LoaderCircle className="wb-spin" size={17} />
          ) : (
            <Upload size={17} />
          )}
          导入文件
        </button>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          void upload(Array.from(event.target.files || []));
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className={"wb-dropzone" + (dragging ? " is-dragging" : "")}
        disabled={uploading}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="wb-drop-icon">
          <Upload size={24} />
        </span>
        <strong>{uploading ? "正在保存文件…" : "拖入文件，或点击选择"}</strong>
        <span>PDF、图片、文档与文本 · 每次最多 10 个，单个 50 MB</span>
        <small>保存到当前电脑的工作台目录</small>
      </button>
      <div className="wb-list-toolbar">
        <label className="wb-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文件名称"
            aria-label="搜索文件"
          />
        </label>
        <span>{files.length} 份文件</span>
        {chosen.length > 0 && (
          <>
            <button
              type="button"
              className="wb-plain"
              onClick={() => setSelected([])}
            >
              取消选择
            </button>
            <button
              type="button"
              className="wb-primary"
              onClick={() => onConvert(chosen)}
            >
              <ArrowRightLeft size={15} />
              转换 {chosen.length} 个文件
            </button>
          </>
        )}
      </div>
      {matches.length ? (
        <div className="wb-file-list">
          <div className="wb-file-list-head">
            <span>选择 / 文件名称</span>
            <span>大小</span>
            <span>加入时间</span>
            <span>操作</span>
          </div>
          {matches.map((file) => (
            <article className="wb-file-row" key={file.id}>
              <div className="wb-file-identity">
                <label className="wb-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.includes(file.id)}
                    onChange={() => toggle(file.id)}
                    aria-label={"选择 " + file.name}
                  />
                  <span>
                    <Check size={12} />
                  </span>
                </label>
                <button
                  type="button"
                  className="wb-file-open"
                  onClick={() => onRead(file)}
                >
                  <FileThumbnail file={file} />
                  <span>
                    <strong>{file.name}</strong>
                    <small>
                      {fileExtension(file.name)}
                      {file.sourceId ? " · 转换结果" : ""}
                    </small>
                  </span>
                </button>
              </div>
              <span className="wb-file-size">{formatSize(file.size)}</span>
              <span className="wb-file-date">{formatDate(file.createdAt)}</span>
              <div className="wb-file-actions">
                <button
                  type="button"
                  title="阅读文件"
                  aria-label={"阅读 " + file.name}
                  onClick={() => onRead(file)}
                >
                  <ArrowUpRight size={17} />
                </button>
                <button
                  type="button"
                  title="转换格式"
                  aria-label={"转换 " + file.name}
                  onClick={() => onConvert([file])}
                >
                  <ArrowRightLeft size={16} />
                </button>
                <a
                  href={fileUrl(file.id, true)}
                  title="下载文件"
                  aria-label={"下载 " + file.name}
                >
                  <Download size={16} />
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="wb-empty">
          <FolderOpen size={33} />
          <h3>{query ? "没有找到这个文件" : "你的文件库还是空的"}</h3>
          <p>
            {query
              ? "换一个关键词试试。"
              : "先导入一份资料，就可以开始阅读或转换。"}
          </p>
        </div>
      )}
    </section>
  );
}
