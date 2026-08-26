export type PromptHotlistItem = {
  id: string;
  title: string;
  category: string;
  size: "1024x1024" | "1536x864" | "864x1536";
  prompt: string;
};

export const PROMPT_HOTLIST: PromptHotlistItem[];

export function getDailyPromptHotlist(
  date?: Date,
  count?: number,
  refreshIndex?: number,
  extraPrompts?: PromptHotlistItem[]
): PromptHotlistItem[];
