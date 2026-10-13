import type { StoryProject } from './story-project-store';
export type ExportShot = { number: number; title: string; caption: string; image: string | null; status: string; warning: boolean };
export type ExportSnapshot = { title: string; synopsis: string; inputChanged: boolean; incomplete: number; shots: ExportShot[] };
export function exportFileStem(value: string): string;
export function storyExportSnapshot(project: Pick<StoryProject, 'title' | 'plan' | 'results'>, inputChanged: boolean): ExportSnapshot;
export function storyExportText(snapshot: ExportSnapshot): string;
export function wrapExportText(text: string, maxWidth: number, measure: (text: string) => number): string[];
export function paginateExport(shotHeights: number[], firstHeader: number, nextHeader: number, maxHeight?: number): { indices: number[]; height: number }[];
