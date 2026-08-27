export type SessionVersionResult = {
  id: string;
  versionGroupId?: string | number | null;
  versionId?: string | number | null;
  parentVersionId?: string | number | null;
  versionNumber?: number | null;
  isDelivery?: boolean;
  [key: string]: unknown;
};

export function enrichSessionVersion<T extends SessionVersionResult>(result: T, parent?: T | null): T;
export function markSessionDelivery<T extends SessionVersionResult>(items: T[], versionId: string | number): T[];
