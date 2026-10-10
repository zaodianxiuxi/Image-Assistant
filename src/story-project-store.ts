import type { StoryPlan, StoryReference, StoryResult } from "./storyboard-continuity.mjs";
import type { StoryInspirationState } from "./StoryInspiration";
import type { ShotVersion, RetakeDraft } from "./story-shot-versions.mjs";

export type StoryProject = {
  id: string; title: string; updatedAt: number; story: string; style: string; shotCount: number; size: string;
  plannedInput?: string; plan: StoryPlan | null; references: StoryReference[]; results: Record<string, StoryResult>;
  inspiration?: StoryInspirationState;
  shotVersions?: Record<string, ShotVersion[]>;
  retakeDrafts?: Record<string, RetakeDraft>;
};

let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("image-assistant-stories", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开故事存储"));
  }).catch(error => { database = undefined; throw error; });
  return database;
}

export async function listStoryProjects(): Promise<StoryProject[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("projects").objectStore("projects").getAll();
    request.onsuccess = () => resolve((request.result as StoryProject[]).sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error);
  });
}

let writes: Promise<void> = Promise.resolve();
export function saveStoryProject(project: StoryProject) {
  const saved = writes.catch(() => {}).then(async () => {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(project);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("保存故事失败"));
    });
  });
  writes = saved;
  return saved;
}

export function newStoryProject(): StoryProject {
  return { id: crypto.randomUUID(), title: "新故事", updatedAt: Date.now(), story: "", style: "自然写实，生活抓拍感，表情克制", shotCount: 0, size: "1536x864", plan: null, references: [], results: {} };
}
