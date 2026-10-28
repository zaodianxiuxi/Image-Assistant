import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ArrowRightLeft, LoaderCircle, X } from "lucide-react";
import type { ConversionTarget, EngineStatus, WorkspaceFile } from "./types";
import { requestJson } from "./types";
type Props = {
  files: WorkspaceFile[];
  engine: EngineStatus | null;
  onClose: () => void;
  onStart: (ids: string[], target: string, quality: number) => Promise<void>;
};
export default function ConversionDialog({
  files,
  engine,
  onClose,
  onStart,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [targets, setTargets] = useState<ConversionTarget[]>([]);
  const [target, setTarget] = useState("");
  const [quality, setQuality] = useState(85);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      files.map((file) =>
        requestJson<{ targets: ConversionTarget[]; message: string }>(
          "/files/" + file.id + "/targets",
        ),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const common = results[0].targets.filter((t) =>
          results.every((r) => r.targets.some((x) => x.id === t.id)),
        );
        setTargets(common);
        setTarget(common[0]?.id || "");
        setMessage(
          common.length
            ? "只列出本机可用、且所有所选文件都支持的目标格式。"
            : results.find((r) => !r.targets.length)?.message ||
                "所选文件没有共同转换格式，请分别选择。",
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [files]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onStart(
        files.map((f) => f.id),
        target,
        quality,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交任务失败。");
      setBusy(false);
    }
  }
  return createPortal(
    <dialog
      className="wb-conversion-dialog"
      ref={dialog}
      aria-labelledby="wb-convert-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <span className="wb-dialog-symbol">
          <ArrowRightLeft size={24} />
        </span>
        <button
          type="button"
          className="wb-icon-button"
          aria-label="关闭转换设置"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <span className="wb-kicker">A NEW FORMAT, SAME CONTENT</span>
      <h2 id="wb-convert-title">为文件选择下一种形式。</h2>
      <p className="wb-convert-note">原文件会保留，结果另存到文件库。</p>
      <div className="wb-convert-files">
        {files.slice(0, 4).map((file) => (
          <span key={file.id}>{file.name}</span>
        ))}
        {files.length > 4 && <small>另有 {files.length - 4} 个文件</small>}
      </div>
      <div className="wb-convert-direction">
        <span>{files.length} 个原文件</span>
        <ArrowRight size={20} />
        <strong>{target ? target.toUpperCase() : "选择格式"}</strong>
      </div>
      {loading ? (
        <p className="wb-convert-loading">
          <LoaderCircle className="wb-spin" size={16} />
          正在检测可用格式…
        </p>
      ) : (
        <>
          <label className="wb-field">
            目标格式
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={!targets.length || busy}
            >
              {!targets.length && <option value="">暂无可用格式</option>}
              {targets.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <p className="wb-form-help">{message}</p>
          {["jpg", "webp", "avif"].includes(target) && (
            <label className="wb-field">
              图像质量 · {quality}%
              <input
                type="range"
                min="30"
                max="100"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                disabled={busy}
              />
            </label>
          )}
        </>
      )}
      {engine && !engine.available && (
        <p className="wb-form-help">{engine.message}</p>
      )}
      {error && (
        <p className="wb-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="wb-primary wb-convert-submit"
        disabled={loading || busy || !target}
        onClick={() => void submit()}
      >
        {busy ? (
          <LoaderCircle className="wb-spin" size={17} />
        ) : (
          <ArrowRightLeft size={17} />
        )}{" "}
        {busy ? "正在加入任务…" : "开始转换"}
      </button>
      <small className="wb-convert-engine">
        由本机 Filee 处理 · 无需上传到第三方服务
      </small>
    </dialog>,
    document.body,
  );
}
