import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  FolderPlus,
  FolderOpen,
  Link2,
  Pencil,
  Plus,
} from "lucide-react";
import FileLibrary from "./FileLibrary";
import NotebookPanel from "./NotebookPanel";
import { formatDate, jsonRequest, requestJson } from "./types";
import type { WorkspaceFile, WorkspaceProject } from "./types";
export function RecentProjects({
  projects,
  files,
  onOpen,
  onRead,
  onAll,
}: {
  projects: WorkspaceProject[];
  files: WorkspaceFile[];
  onOpen: (id: string) => void;
  onRead: (file: WorkspaceFile, project: WorkspaceProject) => void;
  onAll: () => void;
}) {
  return (
    <section className="wb-project-recent">
      <div className="wb-section-heading">
        <h2>你的项目空间</h2>
        <button type="button" onClick={onAll}>
          {projects.length ? "全部项目" : "创建项目"}
          <ArrowUpRight size={14} />
        </button>
      </div>
      {projects.length ? (
        <div className="wb-project-grid">
          {[...projects]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 3)
            .map((project) => {
              const last = files.find((file) => file.id === project.lastFileId);
              return (
                <article key={project.id} className="wb-project-card">
                  <button
                    type="button"
                    className="wb-project-open"
                    onClick={() => onOpen(project.id)}
                  >
                    <FolderOpen size={21} />
                    <strong>{project.name}</strong>
                    <ArrowUpRight size={16} />
                  </button>
                  <p>
                    {project.fileIds.length} 份资料 ·{" "}
                    {formatDate(project.updatedAt)}
                  </p>
                  {last && (
                    <button
                      type="button"
                      className="wb-project-resume"
                      onClick={() => onRead(last, project)}
                    >
                      <BookOpen size={14} />
                      <span>继续阅读 · {last.name}</span>
                    </button>
                  )}
                </article>
              );
            })}
        </div>
      ) : (
        <button type="button" className="wb-project-start" onClick={onAll}>
          <FolderPlus size={26} />
          <span>
            <strong>把同一件事的资料，放在一起。</strong>
            <small>一个项目，收纳文件、阅读进度和笔记。</small>
          </span>
          <Plus size={18} />
        </button>
      )}
    </section>
  );
}
export default function ProjectSpace({
  projects,
  project,
  files,
  uploading,
  onSelect,
  onUpdate,
  onUpload,
  onRead,
  onConvert,
}: {
  projects: WorkspaceProject[];
  project?: WorkspaceProject;
  files: WorkspaceFile[];
  uploading: boolean;
  onSelect: (id: string | null) => void;
  onUpdate: (project: WorkspaceProject) => void;
  onUpload: (files: File[], projectId: string) => Promise<void>;
  onRead: (file: WorkspaceFile, project: WorkspaceProject) => void;
  onConvert: (files: WorkspaceFile[]) => void;
}) {
  const [name, setName] = useState("");
  const [rename, setRename] = useState(false),
    [renameValue, setRenameValue] = useState("");
  const [chosen, setChosen] = useState<string[]>([]),
    [filter, setFilter] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const attachment = useRef<HTMLDetailsElement>(null);
  async function action(run: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }
  const available = files.filter(
    (file) =>
      !project?.fileIds.includes(file.id) &&
      file.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
  );
  return (
    <section className="wb-project-space">
      {error && (
        <p className="wb-note-error" role="alert">
          {error}
        </p>
      )}
      {!project ? (
        <>
          <div className="wb-page-heading">
            <div>
              <span className="wb-kicker">
                ONE PROJECT, EVERYTHING TOGETHER
              </span>
              <h1>给正在做的事，一个空间。</h1>
              <p>资料、摘录和笔记放在一起，下次从这里继续。</p>
            </div>
          </div>
          <form
            className="wb-project-create"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const created = await requestJson<WorkspaceProject>(
                  "/projects",
                  jsonRequest("POST", { name }),
                );
                onUpdate(created);
                setName("");
                onSelect(created.id);
              });
            }}
          >
            <FolderPlus size={20} />
            <input
              aria-label="新项目名称"
              placeholder="例如：产品调研、课程阅读、季度方案"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <button
              className="wb-primary"
              type="submit"
              disabled={busy || !name.trim()}
            >
              创建项目
            </button>
          </form>
          <div className="wb-project-grid">
            {[...projects]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((item) => (
                <article key={item.id} className="wb-project-card">
                  <button
                    type="button"
                    className="wb-project-open"
                    onClick={() => onSelect(item.id)}
                  >
                    <FolderOpen size={22} />
                    <strong>{item.name}</strong>
                    <ArrowUpRight size={16} />
                  </button>
                  <p>
                    {item.fileIds.length} 份资料 · {formatDate(item.updatedAt)}
                  </p>
                  {item.lastFileId &&
                    files.find((f) => f.id === item.lastFileId) && (
                      <button
                        type="button"
                        className="wb-project-resume"
                        onClick={() =>
                          onRead(
                            files.find((f) => f.id === item.lastFileId)!,
                            item,
                          )
                        }
                      >
                        <BookOpen size={14} />
                        继续上次阅读
                      </button>
                    )}
                </article>
              ))}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className="wb-plain"
            onClick={() => onSelect(null)}
          >
            <ArrowLeft size={15} />
            全部项目
          </button>
          <header className="wb-project-heading">
            <div>
              <span className="wb-kicker">PROJECT SPACE</span>
              <h1>{project.name}</h1>
              <p>
                {project.fileIds.length} 份资料 ·
                文件可关联多个项目，原文件保留在文件库
              </p>
            </div>
            <button
              type="button"
              className="wb-secondary"
              onClick={() => {
                setRenameValue(project.name);
                setRename(!rename);
              }}
            >
              <Pencil size={14} />
              重命名
            </button>
          </header>
          {rename && (
            <form
              className="wb-project-create"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  const updated = await requestJson<WorkspaceProject>(
                    "/projects/" + project.id,
                    jsonRequest("PATCH", { name: renameValue }),
                  );
                  onUpdate(updated);
                  setRename(false);
                });
              }}
            >
              <input
                aria-label="修改项目名称"
                value={renameValue}
                maxLength={80}
                onChange={(e) => setRenameValue(e.target.value)}
                required
              />
              <button type="submit" className="wb-primary" disabled={busy}>
                保存名称
              </button>
            </form>
          )}
          <details ref={attachment} className="wb-project-attach">
            <summary>
              <Link2 size={15} />
              关联文件库中的资料
            </summary>
            <input
              aria-label="搜索可关联文件"
              placeholder="搜索文件名"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="wb-attach-list">
              {available.map((file) => (
                <label key={file.id}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(file.id)}
                    onChange={(e) =>
                      setChosen((prev) =>
                        e.target.checked
                          ? [...prev, file.id]
                          : prev.filter((id) => id !== file.id),
                      )
                    }
                  />
                  <span>{file.name}</span>
                </label>
              ))}
              {!available.length && (
                <p>没有待关联的文件，可在下方导入新资料。</p>
              )}
            </div>
            <button
              type="button"
              className="wb-primary"
              disabled={busy || !chosen.length}
              onClick={() =>
                void action(async () => {
                  const updated = await requestJson<WorkspaceProject>(
                    "/projects/" + project.id + "/files",
                    jsonRequest("POST", { fileIds: chosen }),
                  );
                  onUpdate(updated);
                  setChosen([]);
                  if (attachment.current) attachment.current.open = false;
                })
              }
            >
              关联 {chosen.length || "所选"} 份文件
            </button>
          </details>
          <FileLibrary
            projectMode
            files={files.filter((file) => project.fileIds.includes(file.id))}
            uploading={uploading}
            onUpload={(list) => onUpload(list, project.id)}
            onRead={(file) => onRead(file, project)}
            onConvert={onConvert}
          />
          <div className="wb-project-overview-note">
            <NotebookPanel
              key={project.id}
              scope={project.id}
              title="项目总览"
              projectName={project.name}
            />
          </div>
        </>
      )}
    </section>
  );
}
