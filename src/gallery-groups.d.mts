export type GalleryHistoryRecord = {
  id: string | number;
  seriesId?: string | number | null;
  seriesName?: string | null;
  nodeId?: string | number | null;
  nodeTitle?: string | null;
  nodeOrder?: string | number | null;
  createdAt?: string | Date | null;
  [key: string]: unknown;
};

export type GalleryNodeGroup<T extends GalleryHistoryRecord = GalleryHistoryRecord> = {
  key: string;
  title: string;
  nodeId: number | null;
  nodeOrder: number | null;
  items: T[];
};

export type GalleryGroup<T extends GalleryHistoryRecord = GalleryHistoryRecord> = {
  key: string;
  title: string;
  seriesId: number | null;
  nodes: GalleryNodeGroup<T>[];
};

export function groupHistoryRecords<T extends GalleryHistoryRecord>(records?: T[]): GalleryGroup<T>[];
