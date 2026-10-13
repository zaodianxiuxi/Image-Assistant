import { strToU8 } from 'fflate';
import { exportFileStem, paginateExport, storyExportText, wrapExportText } from './story-export-data.mjs';
import type { ExportSnapshot } from './story-export-data.mjs';

type Progress = (message: string) => void;
type Loaded = { blob: Blob; bitmap: ImageBitmap; extension: string };
export type StoryExportFile = { blob: Blob; filename: string; pages: number };
const WIDTH = 1080, MARGIN = 72, INNER = WIDTH - MARGIN * 2, FOOTER = 70;
const SANS = '"Noto Sans SC Variable", "Microsoft YaHei", sans-serif';
const SERIF = '"Noto Serif SC Variable", "SimSun", serif';
const abortError = () => new DOMException('导出已取消', 'AbortError');
function check(signal: AbortSignal) { if (signal.aborted) throw abortError(); }

async function abortable<T>(task: Promise<T>, signal: AbortSignal, timeout = 30000, disposeLate?: (value: T) => void): Promise<T> {
  check(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => finish(() => reject(abortError()));
    const timer = window.setTimeout(() => finish(() => reject(new Error('读取图片或字体超时，请检查本地服务后重试。'))), timeout);
    const finish = (action: () => void) => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort); action(); };
    signal.addEventListener('abort', abort, { once: true });
    task.then(value => { if (settled) disposeLate?.(value); else finish(() => resolve(value)); }, error => finish(() => reject(error)));
  });
}

// Fetch only stored image assets, never a generation endpoint or a third-party URL.
async function readImage(source: string, signal: AbortSignal): Promise<Blob> {
  const url = new URL(source, window.location.href);
  const localFile = (url.protocol === 'blob:' && url.origin === location.origin) || /^data:image\/(png|jpeg|webp);base64,/i.test(source);
  if (!localFile && !(url.origin === location.origin && url.pathname.startsWith('/generated-images/'))) throw new Error('图片不是本地作品文件，请重新保存该镜图片。');
  const request = new AbortController();
  const cancel = () => request.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = window.setTimeout(cancel, 30000);
  const limit = 20 * 1024 * 1024;
  try {
    check(signal);
    const response = await fetch(url, { signal: request.signal });
    if (!response.ok) throw new Error('图片文件无法读取，请确认本地服务正在运行、图片未移动或删除。');
    if (Number(response.headers.get('content-length')) > limit) throw new Error('单张图片超过 20MB，请缩小图片后重试。');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('图片内容为空。');
    const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw new Error('单张图片超过 20MB，请缩小图片后重试。'); }
        chunks.push(new Uint8Array(value));
      }
    } finally { reader.releaseLock(); }
    const blob = new Blob(chunks, { type: response.headers.get('content-type')?.split(';')[0] || '' });
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('图片格式不支持，请使用 PNG、JPEG 或 WebP。');
    return blob;
  } catch (error) {
    check(signal);
    if (request.signal.aborted) throw new Error('图片读取超时，请检查本地服务后重试。');
    throw error;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}

async function loadImages(snapshot: ExportSnapshot, signal: AbortSignal, progress: Progress): Promise<(Loaded | null)[]> {
  const loaded: (Loaded | null)[] = []; let bytes = 0;
  try {
    for (const shot of snapshot.shots) {
      check(signal);
      if (!shot.image) { loaded.push(null); continue; }
      progress(`正在读取第 ${shot.number}/${snapshot.shots.length} 镜「${shot.title}」…`);
      try {
        const blob = await readImage(shot.image, signal); bytes += blob.size;
        if (bytes > 120 * 1024 * 1024) throw new Error('原图总量超过 120MB，请分成多个故事导出。');
        // Decode a reduced copy for layout; the original blob remains untouched for ZIP.
        const bitmap = await abortable(createImageBitmap(blob, { resizeWidth: INNER, resizeQuality: 'high' }), signal, 30000, value => value.close());
        if (signal.aborted || bitmap.height > 4096 || !bitmap.height) {
          bitmap.close(); check(signal); throw new Error('图片比例过长，请调整画幅后再导出。');
        }
        loaded.push({ blob, bitmap, extension: blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png' });
      } catch (error) {
        check(signal);
        throw new Error(`第 ${shot.number} 镜「${shot.title}」：${error instanceof Error ? error.message : '图片解码失败，请重试。'}`);
      }
    }
    return loaded;
  } catch (error) { loaded.forEach(item => item?.bitmap.close()); throw error; }
}

function makeZip(files: Record<string, Uint8Array>, signal: AbortSignal): Promise<Blob> {
  check(signal);
  return new Promise((resolve, reject) => {
    // Even uncompressed ZIP creation copies bytes and computes CRCs; keep it off the UI thread.
    const worker = new Worker(new URL('./story-export-zip.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(abortError()); };
    worker.onmessage = (event: MessageEvent<{ bytes?: Uint8Array<ArrayBuffer>; error?: string }>) => {
      cleanup();
      if (signal.aborted) reject(abortError());
      else if (event.data.bytes) resolve(new Blob([event.data.bytes], { type: 'application/zip' }));
      else reject(new Error(event.data.error || '图片打包失败，请重试。'));
    };
    worker.onerror = () => { cleanup(); reject(new Error('无法启动图片打包，请检查浏览器设置后重试。')); };
    signal.addEventListener('abort', abort, { once: true });
    try { worker.postMessage(files, Object.values(files).map(value => value.buffer as ArrayBuffer)); }
    catch (error) { cleanup(); reject(error); }
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('长图生成失败，请关闭其他占用内存的页面后重试。')), 'image/png'));
}

async function drawStory(snapshot: ExportSnapshot, loaded: (Loaded | null)[], signal: AbortSignal, progress: Progress): Promise<Blob[]> {
  progress('正在准备字体与纸页排版…');
  const serifText = [snapshot.title, ...snapshot.shots.map(s => s.title)].join('');
  const sansText = storyExportText(snapshot) + '纸上故事馆镜头待生成故事续页';
  await abortable(Promise.all([document.fonts.load(`600 48px ${SERIF}`, serifText), document.fonts.load(`400 28px ${SANS}`, sansText)]), signal);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('此浏览器无法绘制长图，请换用支持 Canvas 的浏览器。');
  function lines(text: string, font: string) { ctx!.font = font; return wrapExportText(text, INNER, s => ctx!.measureText(s).width); }
  const heading = lines(snapshot.title, `600 48px ${SERIF}`);
  const synopsis = snapshot.synopsis ? lines(snapshot.synopsis, `400 28px ${SANS}`) : [];
  const warning = snapshot.inputChanged ? lines('故事或风格已修改，本次为上次规划的分镜。', `400 24px ${SANS}`) : [];
  const headerHeight = 64 + 28 + 24 + heading.length * 64 + 24 + synopsis.length * 42 + warning.length * 34 + 50;
  const layouts = snapshot.shots.map((shot, i) => {
    const bitmap = loaded[i]?.bitmap;
    const imageHeight = bitmap ? Math.min(1200, Math.round(INNER * bitmap.height / bitmap.width)) : 280;
    const titles = lines(shot.title, `600 34px ${SERIF}`), captions = lines(shot.caption, `400 28px ${SANS}`);
    return { imageHeight, titles, captions, height: 40 + 16 + imageHeight + 26 + titles.length * 46 + 12 + captions.length * 42 + 64 };
  });
  const pages = paginateExport(layouts.map(l => l.height), headerHeight + FOOTER, 150 + FOOTER);
  const blobs: Blob[] = [];
  function text(items: string[], x: number, y: number, lineHeight: number, font: string, color = '#302f2a') {
    ctx!.font = font; ctx!.fillStyle = color;
    items.forEach((line, i) => ctx!.fillText(line, x, y + i * lineHeight));
  }
  try {
    for (const [pageIndex, page] of pages.entries()) {
      check(signal); progress(`正在生成长图 ${pageIndex + 1}/${pages.length}…`);
      canvas.width = WIDTH; canvas.height = Math.ceil(page.height);
      ctx.textBaseline = 'top'; ctx.fillStyle = '#fffcf5'; ctx.fillRect(0, 0, WIDTH, canvas.height);
      ctx.fillStyle = '#9c4635'; ctx.fillRect(MARGIN, 64, 4, 24);
      text([pageIndex ? `故事续页 · ${pageIndex + 1}` : '纸上故事馆 / STORY COLLECTION'], MARGIN + 18, 64, 28, `400 22px ${SANS}`, '#9c4635');
      let y = 150;
      if (!pageIndex) {
        y = 116; text(heading, MARGIN, y, 64, `600 48px ${SERIF}`); y += heading.length * 64 + 24;
        text(synopsis, MARGIN, y, 42, `400 28px ${SANS}`, '#70675a'); y += synopsis.length * 42;
        text(warning, MARGIN, y, 34, `400 24px ${SANS}`, '#9c4635'); y = headerHeight;
      }
      for (const index of page.indices) {
        const shot = snapshot.shots[index], layout = layouts[index], bitmap = loaded[index]?.bitmap;
        const start = y;
        ctx.strokeStyle = '#d8cebd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(MARGIN, y); ctx.lineTo(WIDTH - MARGIN, y); ctx.stroke();
        text([`镜头 ${String(shot.number).padStart(2, '0')}${shot.warning ? `  ·  ${shot.status}` : ''}`], MARGIN, y + 10, 30, `400 22px ${SANS}`, '#9c4635');
        y += 56;
        ctx.fillStyle = '#f1ece2'; ctx.fillRect(MARGIN, y, INNER, layout.imageHeight);
        if (bitmap) {
          const scale = Math.min(INNER / bitmap.width, layout.imageHeight / bitmap.height);
          const w = bitmap.width * scale, h = bitmap.height * scale;
          ctx.drawImage(bitmap, MARGIN + (INNER - w) / 2, y + (layout.imageHeight - h) / 2, w, h);
        } else text(['这一镜还没有画面', '旁白已保留，完成后可重新导出。'], MARGIN + 40, y + 92, 46, `400 28px ${SANS}`, '#70675a');
        y += layout.imageHeight + 26;
        text(layout.titles, MARGIN, y, 46, `600 34px ${SERIF}`); y += layout.titles.length * 46 + 12;
        text(layout.captions, MARGIN, y, 42, `400 28px ${SANS}`); y = start + layout.height;
      }
      text([`${pageIndex + 1} / ${pages.length}  ·  ${snapshot.shots.length} 镜${snapshot.incomplete ? ` · ${snapshot.incomplete} 镜待生成或重拍` : ''}`], MARGIN, canvas.height - 46, 28, `400 20px ${SANS}`, '#70675a');
      blobs.push(await abortable(canvasBlob(canvas), signal));
    }
    return blobs;
  } finally { canvas.width = 0; canvas.height = 0; }
}

export async function createStoryExport(snapshot: ExportSnapshot, kind: 'poster' | 'archive', signal: AbortSignal, progress: Progress): Promise<StoryExportFile> {
  check(signal);
  if (storyExportText(snapshot).length > 100000) throw new Error('故事文字过长，请分成多个故事导出。');
  const loaded = await loadImages(snapshot, signal, progress);
  const stem = exportFileStem(snapshot.title);
  try {
    if (kind === 'archive') {
      const files: Record<string, Uint8Array> = { '故事与旁白.txt': strToU8(storyExportText(snapshot)) };
      for (const [i, image] of loaded.entries()) {
        check(signal); if (!image) continue;
        files[`${String(i + 1).padStart(2, '0')}-${exportFileStem(snapshot.shots[i].title)}.${image.extension}`] = new Uint8Array(await image.blob.arrayBuffer());
      }
      progress('正在打包原图与故事文本…');
      return { blob: await makeZip(files, signal), filename: `${stem}-原图与旁白.zip`, pages: 0 };
    }
    const pages = await drawStory(snapshot, loaded, signal, progress); check(signal);
    if (pages.length === 1) return { blob: pages[0], filename: `${stem}-故事长图.png`, pages: 1 };
    const files: Record<string, Uint8Array> = {};
    for (const [i, page] of pages.entries()) files[`${String(i + 1).padStart(2, '0')}-${stem}-故事长图.png`] = new Uint8Array(await page.arrayBuffer());
    progress(`故事较长，正在打包 ${pages.length} 张长图…`);
    return { blob: await makeZip(files, signal), filename: `${stem}-故事长图-${pages.length}页.zip`, pages: pages.length };
  } finally { loaded.forEach(item => item?.bitmap.close()); }
}
