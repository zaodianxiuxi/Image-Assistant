import {
  CheckCircle2,
  Clock3,
  FileQuestion,
  LoaderCircle,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import type { WorkspaceFile, WorkspaceTask } from "./types";
import { formatDate, fileUrl } from "./types";
type Props = {
  tasks: WorkspaceTask[];
  files: WorkspaceFile[];
  onRead: (file: WorkspaceFile) => void;
  onRetry: (files: WorkspaceFile[]) => void;
  onFiles: () => void;
};
const statusLabel = {
  queued: "排队中",
  running: "正在转换",
  completed: "已完成",
  failed: "未完成",
};
export default function TaskCenter({
  tasks,
  files,
  onRead,
  onRetry,
  onFiles,
}: Props) {
  const running = tasks.filter((t) =>
    ["queued", "running"].includes(t.status),
  ).length;
  return (
    <section className="wb-task-center">
      <div className="wb-page-heading">
        <div>
          <span className="wb-kicker">WORK, IN PROGRESS</span>
          <h1>把等待，交给工作台。</h1>
          <p>
            {running
              ? running + " 个任务正在处理或等待，你可以继续使用其他工具。"
              : "每一次处理与结果，都在这里保留。"}
          </p>
        </div>
        <button type="button" className="wb-secondary" onClick={onFiles}>
          前往文件库
          <ArrowUpRight size={16} />
        </button>
      </div>
      {!tasks.length ? (
        <div className="wb-empty wb-empty-tall">
          <Clock3 size={38} />
          <h3>还没有处理任务</h3>
          <p>在文件库中选择文件，开始第一次转换。</p>
          <button type="button" className="wb-primary" onClick={onFiles}>
            选择文件
          </button>
        </div>
      ) : (
        <div className="wb-task-list">
          {tasks.map((task) => {
            const original = files.find((f) => f.id === task.fileId);
            const outputs = files.filter((f) => task.outputIds.includes(f.id));
            return (
              <article
                className={"wb-task status-" + task.status}
                key={task.id}
              >
                <span className="wb-task-icon">
                  {task.status === "running" ? (
                    <LoaderCircle className="wb-spin" size={22} />
                  ) : task.status === "completed" ? (
                    <CheckCircle2 size={22} />
                  ) : task.status === "failed" ? (
                    <FileQuestion size={22} />
                  ) : (
                    <Clock3 size={22} />
                  )}
                </span>
                <div className="wb-task-body">
                  <div className="wb-task-title">
                    <h3>{task.fileName}</h3>
                    <span className="wb-task-state">
                      {statusLabel[task.status]}
                    </span>
                  </div>
                  <p>
                    转换为 {task.target.toUpperCase()}{" "}
                    <span>· {formatDate(task.createdAt)}</span>
                  </p>
                  {task.status === "running" && (
                    <div className="wb-task-working">
                      <span />
                      正在处理原文件，请稍候
                    </div>
                  )}
                  {task.status === "queued" && (
                    <p className="wb-form-help">等待前一个任务完成</p>
                  )}
                  {task.error && <p className="wb-error">{task.error}</p>}
                  {task.warning && (
                    <p className="wb-task-warning">{task.warning}</p>
                  )}
                  {outputs.length > 0 && (
                    <div className="wb-task-outputs">
                      {outputs.map((file) => (
                        <div key={file.id}>
                          <button type="button" onClick={() => onRead(file)}>
                            {file.name}
                            <ArrowUpRight size={15} />
                          </button>
                          <a href={fileUrl(file.id, true)}>下载</a>
                        </div>
                      ))}
                    </div>
                  )}
                  {task.status === "failed" && original && (
                    <button
                      type="button"
                      className="wb-secondary"
                      onClick={() => onRetry([original])}
                    >
                      <RefreshCw size={14} />
                      重新选择格式
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
