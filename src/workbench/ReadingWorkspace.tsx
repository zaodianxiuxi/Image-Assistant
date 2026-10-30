import { useEffect, useRef, useState } from "react";
import { FolderOpen } from "lucide-react";
import DocumentReader from "./DocumentReader";
import NotebookPanel from "./NotebookPanel";
import type { Capture } from "./NotebookPanel";
import type {
  Excerpt,
  ReadingPosition,
  WorkspaceFile,
  WorkspaceProject,
} from "./types";
import { jsonRequest, requestJson } from "./types";
export default function ReadingWorkspace({
  file,
  project,
  initial,
  onFiles,
  onConvert,
  onSaved,
}: {
  file: WorkspaceFile;
  project?: WorkspaceProject;
  initial?: ReadingPosition;
  onFiles: () => void;
  onConvert: (files: WorkspaceFile[]) => void;
  onSaved: (position: ReadingPosition) => void;
}) {
  const scope = project?.id || "library";
  const restored = useRef(Boolean(initial));
  const [position, setPosition] = useState<ReadingPosition>(
    initial || { scope, fileId: file.id, page: 1, offset: 0, zoom: 100 },
  );
  const [capture, setCapture] = useState<Capture | null>(null);
  const [source, setSource] = useState<{
    excerpt: Excerpt;
    token: number;
  } | null>(null);
  const [error, setError] = useState("");
  const current = useRef(position),
    saved = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const callback = useRef(onSaved);
  callback.current = onSaved;
  const alive = useRef(true),
    saving = useRef(false);
  async function persist() {
    if (saving.current) return;
    const snapshot = current.current,
      signature = JSON.stringify(snapshot);
    if (signature === saved.current) return;
    saving.current = true;
    try {
      const result = await requestJson<ReadingPosition>(
        "/reading/" + scope + "/" + file.id,
        jsonRequest("PUT", snapshot),
      );
      saved.current = signature;
      callback.current(result);
      if (alive.current) setError("");
    } catch {
      if (alive.current) setError("阅读位置尚未保存，请重试。");
    } finally {
      saving.current = false;
      if (snapshot !== current.current) void persist();
    }
  }
  useEffect(() => {
    alive.current = true;
    void persist();
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      void persist();
    };
  }, []);
  function move(patch: Partial<ReadingPosition>) {
    const next = { ...current.current, ...patch };
    current.current = next;
    setPosition(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 700);
  }
  return (
    <div className="wb-reading-workspace">
      <div className="wb-reading-context">
        <span>
          <FolderOpen size={14} />
          {project?.name || "全部文件"}
        </span>
        <span>
          {restored.current ? "已恢复上次阅读位置" : "阅读位置会自动保存"}
        </span>
        {error && (
          <button type="button" onClick={() => void persist()}>
            {error}
          </button>
        )}
      </div>
      <div className="wb-reading-split">
        <DocumentReader
          file={file}
          onFiles={onFiles}
          onConvert={onConvert}
          position={position}
          onPosition={move}
          onCapture={(excerpt) => setCapture({ ...excerpt, token: Date.now() })}
          source={source}
        />
        <NotebookPanel
          key={scope + file.id}
          scope={scope}
          fileId={file.id}
          title={file.name}
          projectName={project?.name || "全部文件"}
          capture={capture}
          onSource={(excerpt) => setSource({ excerpt, token: Date.now() })}
        />
      </div>
    </div>
  );
}
