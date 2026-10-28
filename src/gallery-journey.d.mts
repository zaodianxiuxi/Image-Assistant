import type { GalleryGroup, GalleryHistoryRecord } from './gallery-groups.mjs';
export type GalleryJourneyStep<T> = { key: string; title: string; order: number; item: T; alternatives: T[] };
export function buildGalleryJourney<T extends GalleryHistoryRecord>(group: Pick<GalleryGroup<T>, 'nodes'>): { steps: GalleryJourneyStep<T>[]; unsequenced: T[] };
