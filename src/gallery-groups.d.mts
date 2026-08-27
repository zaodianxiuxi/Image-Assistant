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

export type GalleryNodeGroup = {
  key: string;
  title: string;
  nodeId: number | null;
  nodeOrder: number | null;
  items: GalleryHistoryRecord[];
};

export type GalleryGroup = {
  key: string;
  title: string;
  seriesId: number | null;
  nodes: GalleryNodeGroup[];
};

export function groupHistoryRecords(records?: GalleryHistoryRecord[]): GalleryGroup[];
