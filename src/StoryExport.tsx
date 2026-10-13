import { useEffect, useRef, useState } from 'react';
import { Archive, Download, ImageDown, LoaderCircle } from 'lucide-react';
import type { StoryProject } from './story-project-store';
import { storyExportSnapshot } from './story-export-data.mjs';
import './story-export.css';

export default function StoryExport({ project, inputChanged }: { project: StoryProject; inputChanged: boolean }) {
  const active = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const mounted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const shots = project.plan?.shots || [];
  const missing = shots.filter(s => !project.results[s.id]?.image).length;
  const outdated = shots.filter(s => project.results[s.id]?.image && (project.results[s.id]?.stale || project.results[s.id]?.error)).length;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); };
  }, []);

  async function start(kind: 'poster' | 'archive') {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setFile(null); setStatus('正在准备导出…');
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; }
    try {
      const snapshot = storyExportSnapshot(project, inputChanged);
      const { createStoryExport } = await import('./story-export');
      const result = await createStoryExport(snapshot, kind, controller.signal, message => { if (mounted.current && !controller.signal.aborted) setStatus(message); });
      if (!mounted.current || controller.signal.aborted) return;
      const url = URL.createObjectURL(result.blob); objectUrl.current = url;
      setFile({ url, name: result.filename });
      setStatus(result.pages > 1 ? `已按镜头分成 ${result.pages} 张长图，打包为 ZIP。若未自动下载，请点击保存文件。` : '文件已准备好。若未自动下载，请点击保存文件。');
      const link = document.createElement('a'); link.href = url; link.download = result.filename;
      document.body.append(link); link.click(); link.remove();
    } catch (caught) {
      if (mounted.current) {
        setStatus(controller.signal.aborted ? '已取消导出。' : '');
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : '导出失败，请重试。');
      }
    } finally {
      if (active.current === controller) active.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  return <section className="reader-export" aria-label="导出故事作品">
    <div className="reader-export-actions">
      <button type="button" disabled={busy || !shots.length} onClick={() => void start('poster')}><ImageDown size={15} />导出故事长图</button>
      <button type="button" disabled={busy || !shots.length} onClick={() => void start('archive')}><Archive size={15} />打包下载</button>
      {busy && <button type="button" onClick={() => active.current?.abort()}>取消导出</button>}
      {file && <a href={file.url} download={file.name}><Download size={14} />保存文件</a>}
      <span>纸页长图 PNG · 原图与旁白 ZIP · 不消耗生成额度</span>
    </div>
    {(missing > 0 || outdated > 0) && <p className="reader-export-note">{missing > 0 ? `${missing} 镜未有图片：长图保留占位，打包仅收录已有原图。` : ''}{outdated > 0 ? `${outdated} 镜需检查：导出包含当前旧画面及状态说明。` : ''}</p>}
    {status && <p className="reader-export-status" role="status">{busy && <LoaderCircle size={14} className="export-spinner" />}{status}</p>}
    {error && <p className="reader-export-error" role="alert">{error}</p>}
  </section>;
}
