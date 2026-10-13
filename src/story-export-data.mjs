export function exportFileStem(value) {
  let name = String(value || '').normalize('NFC').replace(/[\x00-\x1f<>:"/\\|?*]+/g, '-').replace(/^[.\s-]+|[.\s-]+$/g, '');
  name = Array.from(name).slice(0, 60).join('').trim().replace(/[.\s-]+$/g, '') || '故事';
  return /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name) ? `故事-${name}` : name;
}

export function storyExportSnapshot(project, inputChanged) {
  if (!project.plan?.shots?.length) throw new Error('请先规划故事分镜。');
  if (project.plan.shots.length > 12) throw new Error('每次最多导出 12 镜，请分成多个故事。');
  const shots = project.plan.shots.map((shot, index) => {
    const result = project.results[shot.id];
    const image = result?.image || null;
    const status = result?.error ? (image ? '生成失败 · 保留画面' : '生成失败') : result?.stale && image ? '需重拍 · 当前为旧画面' : image ? '已生成' : '待生成';
    return { number: index + 1, title: shot.title || `第${index + 1}镜`, caption: shot.storyText || '这一镜还没有旁白。', image, status, warning: status !== '已生成' };
  });
  return { title: project.plan.title || project.title || '未命名故事', synopsis: project.plan.synopsis || '', inputChanged: Boolean(inputChanged), incomplete: shots.filter(s => s.warning).length, shots };
}

export function storyExportText(snapshot) {
  return [snapshot.title, snapshot.synopsis,
    snapshot.inputChanged ? '提示：故事或风格已修改，本次导出使用上次规划的分镜。' : '',
    ...snapshot.shots.map(s => `${String(s.number).padStart(2, '0')} · ${s.title}\n状态：${s.status}\n${s.caption}`),
    '说明：原图按镜头编号排列，仅包含当前采用版；缺少图片的镜头保留在本文中。'
  ].filter(Boolean).join('\n\n') + '\n';
}

export function wrapExportText(text, maxWidth, measure) {
  if (!(maxWidth > 0)) throw new Error('文字排版宽度无效。');
  const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
  return String(text).replace(/\r\n?/g, '\n').split('\n').flatMap(paragraph => {
    const lines = []; let line = '';
    for (const { segment } of segmenter.segment(paragraph)) {
      if (line && measure(line + segment) > maxWidth) { lines.push(line); line = ''; }
      line += segment;
    }
    lines.push(line); return lines;
  });
}

// Header heights include all surrounding padding/footer, so page bounds are exact.
export function paginateExport(shotHeights, firstHeader, nextHeader, maxHeight = 14000) {
  if ([firstHeader, nextHeader, ...shotHeights].some(h => !Number.isFinite(h) || h < 0) || maxHeight <= 0) throw new Error('导出尺寸无效。');
  if (firstHeader > maxHeight || shotHeights.some(h => h + nextHeader > maxHeight)) throw new Error('故事标题、梗概或单镜文字过长，请缩短后再导出长图。');
  const pages = [{ indices: [], height: firstHeader }];
  for (const [index, height] of shotHeights.entries()) {
    let page = pages.at(-1);
    if (page.height + height > maxHeight) { page = { indices: [], height: nextHeader }; pages.push(page); }
    page.indices.push(index); page.height += height;
  }
  return pages;
}
