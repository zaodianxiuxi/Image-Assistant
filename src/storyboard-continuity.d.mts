export type StoryEntity = { id: string; name: string; description: string };
export type StoryShot = { id: string; title: string; storyText: string; characterIds: string[]; settingId: string; framing: string; action: string; emotion: string; continuity: string; prompt: string };
export type StoryPlan = { title: string; synopsis: string; styleGuide: string; characters: StoryEntity[]; settings: StoryEntity[]; shots: StoryShot[] };
export type StoryReference = { id: string; kind: "character" | "setting" | "previous"; targetId: string; image?: string; blob?: Blob; confirmed?: boolean };
export type StoryResult = { image?: string; fileName?: string; model?: string; error?: string; stale?: boolean; localVersionId?: string; databaseId?: number | null; versionId?: number | null; versionGroupId?: number | null; versionNumber?: number | null; parentVersionId?: number | null; isDelivery?: boolean };
export function selectStoryShots(shots: StoryShot[], results: Record<string, StoryResult>, mode: "trial" | "remaining"): StoryShot[];
export function selectStoryReferences(shot: StoryShot, references: StoryReference[], previous: { shot: StoryShot; image: string } | null): StoryReference[];
export function buildStoryImagePrompt(plan: StoryPlan, shot: StoryShot, references?: StoryReference[]): string;
export function buildStoryReferencePrompt(plan: StoryPlan, entity: StoryEntity, kind: "character" | "setting"): string;
