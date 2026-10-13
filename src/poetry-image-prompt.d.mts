type Scene = { sceneOrder: number; sourceLine: string; mood: string; prompt: string; referenceMode?: "independent" | "continuation" };
export function canReferencePoetryImage(scene: Scene, previous: { nodeOrder?: number | null; seriesId?: number | null } | null, seriesId: number): boolean;
export function buildPoetryImagePrompt(input: { scene: Scene; styleGuide?: string; characterBible?: string; continuityGuide?: string; supplement?: string; hasReference?: boolean }): string;
