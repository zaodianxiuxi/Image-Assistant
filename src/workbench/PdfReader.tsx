import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, TextLayer } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { fileUrl } from "./types";
GlobalWorkerOptions.workerSrc = workerUrl;
export default function PdfReader({
  fileId,
  page,
  onPage,
  zoom,
  onZoom,
}: {
  fileId: string;
  page: number;
  onPage: (page: number) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [noText, setNoText] = useState(false);
  const [width, setWidth] = useState(600);
  const viewport = useRef<HTMLDivElement>(null),
    paper = useRef<HTMLDivElement>(null);
  const callback = useRef(onPage);
  callback.current = onPage;
  useEffect(() => {
    let cancelled = false;
    const task = getDocument({
      url: fileUrl(fileId),
      cMapUrl: "/api/workbench/pdf-assets/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/api/workbench/pdf-assets/standard_fonts/",
      wasmUrl: "/api/workbench/pdf-assets/wasm/",
      iccUrl: "/api/workbench/pdf-assets/iccs/",
    });
    task.promise
      .then((document) => {
        if (!cancelled) setPdf(document);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e.name === "PasswordException"
              ? "这份 PDF 需要密码，请下载后在本机阅读器中打开。"
              : "PDF 读取失败，请下载原文件检查。",
          );
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [fileId]);
  useEffect(() => {
    const target = viewport.current;
    if (!target) return;
    const observer = new ResizeObserver(() =>
      setWidth(Math.max(180, target.clientWidth - 36)),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !paper.current) return;
    let cancelled = false,
      renderTask: RenderTask | undefined,
      textLayer: TextLayer | undefined;
    const container = paper.current;
    const number = Math.max(1, Math.min(page, pdf.numPages));
    if (number !== page) callback.current(number);
    setBusy(true);
    setError("");
    pdf
      .getPage(number)
      .then(async (pdfPage) => {
        if (cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const scale = (Math.min(width / base.width, 1.8) * zoom) / 100;
        const view = pdfPage.getViewport({ scale });
        const ratio = Math.min(devicePixelRatio, 2);
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(view.width * ratio);
        canvas.height = Math.floor(view.height * ratio);
        canvas.style.width = view.width + "px";
        canvas.style.height = view.height + "px";
        canvas.setAttribute("aria-label", "PDF 第 " + number + " 页");
        const text = document.createElement("div");
        text.className = "wb-pdf-text-layer";
        container.replaceChildren(canvas, text);
        container.style.width = view.width + "px";
        container.style.height = view.height + "px";
        container.style.setProperty("--total-scale-factor", String(scale));
        renderTask = pdfPage.render({
          canvas,
          viewport: view,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await renderTask.promise;
        if (cancelled) return;
        const content = await pdfPage.getTextContent();
        if (cancelled) return;
        setNoText(
          !content.items.some((item) => "str" in item && item.str.trim()),
        );
        textLayer = new TextLayer({
          textContentSource: content,
          container: text,
          viewport: view,
        });
        await textLayer.render();
        if (!cancelled) setBusy(false);
      })
      .catch((e) => {
        if (!cancelled && e.name !== "RenderingCancelledException") {
          setError("这一页无法完整显示，可切换页面或下载原文件。");
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, page, width, zoom]);
  return (
    <div className="wb-pdf-reader">
      <div className="wb-pdf-controls">
        <button
          type="button"
          className="wb-icon-button"
          aria-label="PDF 上一页"
          disabled={!pdf || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <label>
          第{" "}
          <input
            aria-label="PDF 页码"
            type="number"
            min={1}
            max={pdf?.numPages || 1}
            value={page}
            disabled={!pdf}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (
                Number.isInteger(value) &&
                value >= 1 &&
                value <= (pdf?.numPages || 1)
              )
                onPage(value);
            }}
          />{" "}
          页 / {pdf?.numPages || "—"}
        </label>
        <button
          type="button"
          className="wb-icon-button"
          aria-label="PDF 下一页"
          disabled={!pdf || page >= pdf.numPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
        <select
          aria-label="PDF 缩放"
          value={zoom}
          onChange={(e) => onZoom(Number(e.target.value))}
        >
          {[75, 100, 125, 150, 200].map((value) => (
            <option key={value} value={value}>
              {value === 100 ? "适应宽度" : value + "%"}
            </option>
          ))}
        </select>
        {busy && <LoaderCircle className="wb-spin" size={15} />}
      </div>
      {error && (
        <div className="wb-note-error" role="alert">
          {error} <a href={fileUrl(fileId, true)}>下载原文件</a>
        </div>
      )}
      {noText && !busy && (
        <p className="wb-pdf-notice">
          这一页没有可选文本，可能是扫描件。可以手动写笔记，本版未启用 OCR。
        </p>
      )}
      <div
        className="wb-pdf-viewport"
        ref={viewport}
        tabIndex={0}
        aria-label="PDF 页面"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || !pdf) return;
          if (e.key === "ArrowRight" && page < pdf.numPages) {
            e.preventDefault();
            onPage(page + 1);
          }
          if (e.key === "ArrowLeft" && page > 1) {
            e.preventDefault();
            onPage(page - 1);
          }
        }}
      >
        <div className="wb-pdf-paper" ref={paper} />
      </div>
    </div>
  );
}
