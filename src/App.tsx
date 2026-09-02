import { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FolderKanban,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  WandSparkles,
  X,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { getDailyPromptHotlist } from "./prompt-hotlist.mjs";
import type { PromptHotlistItem } from "./prompt-hotlist.mjs";
import { groupHistoryRecords } from "./gallery-groups.mjs";
import { enrichSessionVersion, markSessionDelivery } from "./image-version-session.mjs";
import { ImageRequestError, retryPoetryImageRequest } from "./poetry-image-retry.mjs";
import StyleWorkbench from "./StyleWorkbench";

type Mode = "generate" | "edit";
type ExecutionStage = "idle" | "validating" | "sending" | "processing" | "completed" | "failed";
type PoetryWorkflowStage = "analysis" | "storyboard" | "images";
type PoetryImageProgress = { status: "idle" | "running" | "done" | "error"; completed: number; total: number; currentTitle: string };
type PoetrySceneGenerationState = { status: "waiting" | "running" | "success" | "error"; message: string; attempt: number };
type Theme = "light" | "dark" | "studio";
type ManagerPanel = "library" | "series";
type ReferenceImage = {
  file: File;
  preview: string;
};
type Result = {
  id: string;
  src: string;
  imageRecordId?: number | null;
  fileName?: string;
  seriesId?: number | null;
  seriesName?: string | null;
  nodeId?: number | null;
  nodeTitle?: string | null;
  nodeOrder?: number | null;
  prompt: string;
  kind: Mode;
  createdAt: Date;
  versionId?: number | string | null;
  versionGroupId?: number | string | null;
  versionNumber?: number | null;
  parentVersionId?: number | string | null;
  isDelivery?: boolean;
};
type LibraryPrompt = {
  id: number;
  title: string;
  category: string;
  content: string;
  favorite: boolean;
};
type SeriesRecord = { id: number; name: string; description?: string; global_prompt?: string; style_prompt?: string };
type SeriesNode = { id: number; series_id: number; node_order: number; title: string; story_text?: string; prompt?: string; status: string };
type PoetryScene = { sceneOrder: number; title: string; sourceLine: string; mood: string; prompt: string };
type PoetryLineReading = { sourceLine: string; meaning: string; emotion: string; visualFocus: string };
type PoetryAllusion = { sourceText: string; explanation: string; confidence: "high" | "medium" | "low" };
type PoetryAnnotation = { term: string; explanation: string };
type PoetrySensoryDetails = { visual: string; auditory: string; spatial: string; temporal: string };
type PoetryAnalysis = {
  title: string;
  author: string;
  dynasty: string;
  genre: string;
  tags: string[];
  theme: string;
  overview: string;
  translation: string;
  annotations: PoetryAnnotation[];
  creationBackground: string;
  historicalContext: string;
  structureAnalysis: string;
  literaryDevices: string;
  sensoryDetails: PoetrySensoryDetails;
  appreciation: string;
  timeAndPlace: string;
  emotionalArc: string;
  coreImagery: string[];
  lineReadings: PoetryLineReading[];
  allusions: PoetryAllusion[];
  uncertainties: string[];
};
type PoetryProject = {
  id: number;
  seriesId: number;
  title: string;
  poemText: string;
  sceneCount: number;
  imageSize: string;
  promptSupplement: string;
  analysis: PoetryAnalysis | null;
  styleGuide: string;
  characterBible: string;
  continuityGuide: string;
  scenes: PoetryScene[];
  createdAt?: string;
  updatedAt?: string;
};
type PoetryCollection = { name: string; series: SeriesRecord; nodesByOrder: Map<number, SeriesNode> };

const SIZES = [
  { value: "1024x1024", name: "正方形", detail: "1:1" },
  { value: "1536x864", name: "电脑横屏", detail: "16:9" },
  { value: "864x1536", name: "手机竖屏", detail: "9:16" }
];

const MAX_REFERENCE_IMAGES = 10;
const STORYBOARD_STYLE_PREFIX = "写实、现实质感的东方志怪电影摄影风格，古代中国环境，可信的人物比例和材质，统一角色外貌、服装、时代与光影，不要卡通、插画或现代物品。";
const DEFAULT_POETRY_STYLE_GUIDE = "整体采用唐代长安旧都的历史氛围，统一为黄昏到入夜前的冷暖交替色调，人物为同一位中年文士，青色圆领长袍、黑色幞头、浅灰旧氅衣，始终以电影感写实水墨风呈现，强调高城、渭水、荒苑、秋叶、风雨与远眺的连续空间关系。";
const DEFAULT_POETRY_CHARACTER_BIBLE = "固定主角：同一位中年男性文士，面容清瘦、眉骨分明、肤色偏白、黑色长发束于黑色幞头，体型修长。固定服装：青色圆领长袍，外罩浅灰旧氅衣，深色腰带与布靴；固定配饰与道具：木簪、旧竹简和木栏，不可改变年龄、脸型、发型、服装颜色材质款式、配饰、道具和唐代身份。";
const DEFAULT_POETRY_CONTINUITY_GUIDE = "连续性锁定：所有分镜使用同一位中年文士、同一套青色圆领长袍与浅灰旧氅衣、黑色幞头、同一时代和写实电影感水墨摄影。后续只允许风雨、光线、姿态和场景位置随诗句推进而变化，禁止换衣服、换发型、改变年龄体型、替换固定道具或切换画风、色彩和镜头质感。";
const DEFAULT_POETRY_ANALYSIS: PoetryAnalysis = {
  title: "咸阳城东楼",
  author: "许浑",
  dynasty: "唐",
  genre: "七言律诗",
  tags: ["写景", "怀古", "抒情"],
  theme: "登临怀古，在风雨将至的自然景象中感叹故国兴亡与身世漂泊。",
  overview: "诗人登上咸阳城东楼远眺，从蒹葭杨柳、溪云落日写到满楼风雨，再由秦苑、汉宫的荒凉秋景转入怀古。全诗把眼前天气变化、旧都遗迹与个人愁绪合为一体，最后以东流渭水收束，历史盛衰终归无言。",
  translation: "诗人一登上高城便涌起万里愁绪，眼前的芦苇杨柳仿佛江南水边的汀洲。溪谷云气刚刚升起，落日沉入楼阁之后，山雨将至，急风已经吹满高楼。黄昏时飞鸟落入秦苑荒草，秋蝉在汉宫黄叶间鸣叫。过路人不必追问当年的旧事，故国旁的渭水仍向东流。",
  annotations: [
    { term: "汀洲", explanation: "水中或水边的平地，这里写芦苇杨柳相连的水岸，也带有江南水乡的联想。" },
    { term: "秦苑、汉宫", explanation: "秦汉旧日宫苑遗址，以昔日帝都的繁华反衬眼前荒凉。" }
  ],
  creationBackground: "许浑登临咸阳城东楼，面对秦汉旧都遗迹和秋日风雨，将眼前景象与历史兴亡联系起来。具体创作年份缺乏统一定论，分析时不把传说当作确证。",
  historicalContext: "咸阳与长安一带曾是秦汉及后世王朝的政治中心，秦苑、汉宫的旧迹构成怀古背景。",
  structureAnalysis: "首联登高触景生愁；颔联由云、日转入风雨将至；颈联以秦苑、汉宫的秋景写盛衰；尾联以渭水东流收束，把个人愁绪推向历史长流。",
  literaryDevices: "借景抒情、虚实相生、对比和象征并用；以沉日、风雨、荒草、黄叶和东流渭水把抽象的愁绪与兴亡感转化为可见景物。",
  sensoryDetails: { visual: "高城、蒹葭杨柳、溪云落日、荒苑残墙、黄叶与渭水，色调由冷青灰过渡到暗金和深青。", auditory: "风满楼、鸟下、蝉鸣和水流声形成由静到动、再归于寂静的听觉层次。", spatial: "视线从高城近景推向城外水岸、秦苑汉宫遗址，最后沿渭水向东方延伸。", temporal: "深秋黄昏，云起日沉，风雨将至，暮色逐步加深。" },
  appreciation: "全诗把登楼所见的秋日晚景、风雨预兆与秦汉故国的历史遗迹融为一体，前六句以写景层层推进，尾联由眼前流水转入对历史无常的沉思，情景交融而含蓄有力。",
  timeAndPlace: "深秋黄昏，咸阳城东楼及城外渭水、秦苑与汉宫旧址；视线由高楼远眺逐渐移向荒苑和东流水。",
  emotionalArc: "登高即生万里愁，继而因暮云、落日和骤风感到压迫不安；看到秦汉故苑的鸟、蝉与黄叶后转为历史苍凉，最终沉入不问往事的克制与无奈。",
  coreImagery: ["高城", "蒹葭", "杨柳", "溪云", "落日", "满楼风", "秦苑", "黄叶", "汉宫", "渭水"],
  lineReadings: [
    { sourceLine: "一上高城万里愁，蒹葭杨柳似汀洲", meaning: "诗人一登高楼便愁绪满怀，城外芦苇杨柳连着水岸，恍如遥远的江南汀洲。", emotion: "登临触景，乡愁与漂泊感骤然涌起。", visualFocus: "高楼上的独行文士、远处芦苇杨柳与水岸。" },
    { sourceLine: "溪云初起日沉阁，山雨欲来风满楼", meaning: "溪谷云气刚刚升起，落日沉到楼阁之后；山雨尚未落下，急风已经灌满整座城楼。", emotion: "暮色迅速转沉，压迫感与风雨将至的不安加深。", visualFocus: "云气、沉日、楼阁剪影、翻动的帘幕和人物衣袍。" },
    { sourceLine: "鸟下绿芜秦苑夕，蝉鸣黄叶汉宫秋", meaning: "黄昏飞鸟落入秦苑荒草，秋蝉在汉宫旧址的黄叶间鸣叫，昔日繁华只余寂寥。", emotion: "由眼前秋景转入怀古，感叹王朝遗迹的衰败。", visualFocus: "荒苑、归鸟、残墙、黄叶与暮色中的旧宫轮廓。" },
    { sourceLine: "行人莫问当年事，故国东来渭水流", meaning: "过客不必追问旧朝往事，只有渭水从故国旁向东流去，一如从不停驻的时间。", emotion: "怀古之愁归于沉默、克制与无可挽回。", visualFocus: "水边行人、旧都废墟与延伸至远方的渭水。" }
  ],
  allusions: [
    { sourceText: "秦苑、汉宫", explanation: "以秦汉宫苑旧迹并举，借昔日帝都与眼前荒凉形成盛衰对照。", confidence: "high" }
  ],
  uncertainties: ["“似汀洲”是否明确指向诗人的江南乡愁，历来可有不同解释；画面可保留水岸联想，不必指定确切故乡。"]
};
const DEFAULT_POETRY_SCENES: PoetryScene[] = [
  { sceneOrder: 1, title: "登城远愁", sourceLine: "一上高城万里愁", mood: "初登城楼，胸中先起的是辽阔而无法排遣的乡国之愁。", prompt: "唐代长安咸阳城东高城之上，一位中年文士刚登上城楼，身着青色圆领长袍、黑色幞头、浅灰旧氅衣，手扶木栏凭高远望，面容清瘦、眉宇紧锁。城楼砖石斑驳，檐角沉重，远处城郭层叠、道路细若游丝。暮色初临，天光尚未尽暗，风从高处掠过衣袖与衣带，空气里带着秋凉。镜头从背后中景推进到半身近景，突出人物孤身与辽阔空间的对比，色彩以灰蓝、土黄、暗青为主，渲染初上高楼便生出的万里愁思。" },
  { sceneOrder: 2, title: "汀洲蒹葭", sourceLine: "蒹葭杨柳似汀洲", mood: "眼前荒城外的芦苇杨柳，把人引向遥远水边的漂泊联想。", prompt: "城东楼外视野展开，低处是一片临水湿地，蒹葭成丛、杨柳低垂，秋风吹动芦穗与柳丝，远看如江汀洲渚。前景仍可见文士倚栏的侧影，目光越过城墙望向城外河岸。地面有浅浅水洼，倒映残霞与草木，层次由近处城楼砖石过渡到中景芦苇，再到远处平静水面和模糊天际。夕阳余晖压低，光线柔和而偏冷，画面静中含远，借芦苇与杨柳写出漂泊、故土与水岸记忆交织的情绪。" },
  { sceneOrder: 3, title: "云起日沉", sourceLine: "溪云初起日沉阁", mood: "云气升起、落日西沉，时间在迅速滑向更深的暮色。", prompt: "城楼侧面与远处溪谷同框，天边一轮夕日正缓缓沉入城阁后方，溪上薄云初起，沿着低处水道向城下漫开。文士仍立在楼上，半侧身回望天际，衣袍被风掀起一角。画面上方是被云层切开的残红与灰紫天空，中间是高阁剪影，下面是蜿蜒溪流、石岸与稀疏枯草，空间层次分明。镜头采用略仰拍广角，突出日沉阁后的压迫感与时光流逝感，光线由金红转为暗橙再到青灰，空气里有秋日将尽的凉意。" },
  { sceneOrder: 4, title: "山雨满楼", sourceLine: "山雨欲来风满楼", mood: "风势骤紧，暴雨未落而压抑已至，天地间充满不安的预兆。", prompt: "咸阳城东楼内部与檐外交错呈现，风猛烈灌入楼中，帘幕翻卷，木窗轻颤，桌上竹简与袖口被吹得微动。文士立于楼内近窗处，神情凝重，抬眼望向远处山色，天际乌云翻滚，山脊被阴影压低，雨脚尚未落下，却已让空气潮重。外景可见城外山峦暗沉、林木摇摆、飞尘与落叶卷起，楼檐下水气弥漫。镜头以室内中景带出外景广域，强调风从四面涌来的包围感，色调转为墨绿、深灰、铁青，营造山雨欲来的紧迫与时代风声。" },
  { sceneOrder: 5, title: "秦苑夕鸟", sourceLine: "鸟下绿芜秦苑夕", mood: "荒苑暮色中，飞鸟归下，昔日繁华只剩衰草与空旷。", prompt: "镜头转向城外旧秦苑遗址，暮色压在大片绿芜之上，荒草齐腰，断墙残阶隐没其间。几只飞鸟从低空掠下，落向枯木与荒台，画面中不见宫人，只见废苑空阔与风吹草动。远景里宫阙轮廓已模糊，前景是潮湿草叶与散乱石块，中景是残破台基与稀疏灌木，背景是渐暗天空。文士可在画面边缘远远驻足，像是在凭吊旧迹。镜头平视拉开，强调鸟下与荒芜相映的空寂感，光线为落日最后一点余辉与草地冷绿交错，呈现盛衰更替的历史苍凉。" },
  { sceneOrder: 6, title: "汉宫秋水", sourceLine: "蝉鸣黄叶汉宫秋 / 行人莫问当年事 / 故国东来渭水流", mood: "秋声、落叶与流水共同指向往昔帝业，感伤最终沉入无可挽回的历史长流。", prompt: "渭水岸边与汉宫旧址远远相连，深秋时节，梧桐与杨树黄叶纷落，几处残败宫墙在暮霭中若隐若现，空中有蝉鸣却更显寂寥。前景是一位路过的行人，与此前登楼的文士同为青色圆领长袍、黑色幞头，却神色更为怅惘，缓步停在水边，不发一言，只望着东来的渭水缓缓流过旧都。中景是斑驳宫阙、枯草与落叶，远景是河面反射最后一线暗金天光，水流向东延伸至画面尽头。镜头采用横向长景别，人物置于一侧，空出大面积河水与废墟，强调“莫问当年事”的沉默与“故国东来”的时间洪流感，整体色彩以黄褐、深青、灰黑为主，电影感写实，带淡淡水汽与历史沧桑。" }
];
const THEME_OPTIONS: Array<{ value: Theme; label: string; description: string }> = [
  { value: "light", label: "明亮工作台", description: "清晰、轻快的日常创作界面" },
  { value: "dark", label: "深色专业", description: "减少长时间看图的亮度干扰" },
  { value: "studio", label: "暖灰编辑室", description: "更适合判断图片色彩和质感" }
];
function getInitialTheme(): Theme {
  const savedTheme = window.localStorage.getItem("image-assistant-theme");
  if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "studio") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function mergePromptItems(incoming: PromptHotlistItem[], existing: PromptHotlistItem[]) {
  const seenPrompts = new Set<string>();
  return [...incoming, ...existing].filter((item) => {
    if (!item?.prompt || seenPrompts.has(item.prompt)) return false;
    seenPrompts.add(item.prompt);
    return true;
  }).slice(0, 120);
}

function getPoetryCollectionName(poem: string) {
  const titleLine = poem.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "诗词意境";
  const title = titleLine
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/[《》]/g, "")
    .replace(/[\d①-⑳⑴-⒇]+$/u, "")
    .trim();
  return title.slice(0, 120) || "诗词意境";
}

function getPoetrySceneRecommendation(poem: string, analysis: PoetryAnalysis | null) {
  const semanticCount = analysis?.lineReadings.length || poem.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && /[，。；！？、]$/u.test(line) && !/^作者|^朝代/u.test(line)).length;
  const count = semanticCount <= 4 ? 4 : semanticCount <= 6 ? 6 : Math.min(8, semanticCount);
  const reason = semanticCount <= 4
    ? "适合用 4 段呈现起承转合"
    : semanticCount <= 6
      ? "适合用 6 段展开意象和情绪转折"
      : "诗句较多，建议控制在 8 段以内";
  return { count, reason };
}

function hydratePoetryAnalysis(value: Partial<PoetryAnalysis> | null | undefined): PoetryAnalysis | null {
  if (!value) return null;
  return {
    ...DEFAULT_POETRY_ANALYSIS,
    ...value,
    tags: Array.isArray(value.tags) ? value.tags : [],
    annotations: Array.isArray(value.annotations) ? value.annotations : [],
    sensoryDetails: { ...DEFAULT_POETRY_ANALYSIS.sensoryDetails, ...(value.sensoryDetails || {}) },
    coreImagery: Array.isArray(value.coreImagery) ? value.coreImagery : [],
    lineReadings: Array.isArray(value.lineReadings) ? value.lineReadings : [],
    allusions: Array.isArray(value.allusions) ? value.allusions : [],
    uncertainties: Array.isArray(value.uncertainties) ? value.uncertainties : []
  };
}

async function readApiError(response: Response) {
  try {
    const data = await response.json();
    const message = data.error || "请求失败，请稍后重试。";
    return data.requestId ? `${message}（请求 ID：${data.requestId}）` : message;
  } catch {
    return "请求失败，请检查本地服务是否已启动。";
  }
}

function DownloadButton({ src, filename = "image-assistant.png" }: { src: string; filename?: string }) {
  return (
    <a className="icon-button" href={src} download={filename} title="下载图片" aria-label="下载图片">
      <Download size={17} />
    </a>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(SIZES[0].value);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [maskPreview, setMaskPreview] = useState("");
  const [current, setCurrent] = useState<Result | null>(null);
  const [history, setHistory] = useState<Result[]>([]);
  const [versionParent, setVersionParent] = useState<Result | null>(null);
  const [collapsedGalleryGroups, setCollapsedGalleryGroups] = useState<Set<string>>(() => new Set());
  const [collapsedGalleryNodes, setCollapsedGalleryNodes] = useState<Set<string>>(() => new Set());
  const [historyLoading, setHistoryLoading] = useState(true);
  const [preview, setPreview] = useState<Result | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [failedImageSources, setFailedImageSources] = useState<Set<string>>(() => new Set());
  const [imageRetries, setImageRetries] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [databaseConfigured, setDatabaseConfigured] = useState(false);
  const [executionStage, setExecutionStage] = useState<ExecutionStage>("idle");
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hotlistRefreshIndex, setHotlistRefreshIndex] = useState(0);
  const [extraPrompts, setExtraPrompts] = useState<PromptHotlistItem[]>([]);
  const [promptIdeasLoading, setPromptIdeasLoading] = useState(false);
  const [promptIdeasStatus, setPromptIdeasStatus] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [managerClosing, setManagerClosing] = useState<ManagerPanel | null>(null);
  const [libraryPrompts, setLibraryPrompts] = useState<LibraryPrompt[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryStatus, setLibraryStatus] = useState("");
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [poetryOpen, setPoetryOpen] = useState(false);
  const [poetryProjects, setPoetryProjects] = useState<PoetryProject[]>([]);
  const [activePoetryProjectId, setActivePoetryProjectId] = useState<number | null>(null);
  const [poetryProjectSaving, setPoetryProjectSaving] = useState(false);
  const [poetryProjectStatus, setPoetryProjectStatus] = useState("");
  const [styleWorkbenchOpen, setStyleWorkbenchOpen] = useState(false);
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [activeSeries, setActiveSeries] = useState<SeriesRecord | null>(null);
  const [seriesNodes, setSeriesNodes] = useState<SeriesNode[]>([]);
  const [activeNode, setActiveNode] = useState<SeriesNode | null>(null);
  const [seriesStatus, setSeriesStatus] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [storyText, setStoryText] = useState("");
  const [storyboardLoading, setStoryboardLoading] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [poemText, setPoemText] = useState("咸阳城东楼\n许浑\n一上高城万里愁，蒹葭杨柳似汀洲。\n溪云初起日沉阁，山雨欲来风满楼。\n鸟下绿芜秦苑夕，蝉鸣黄叶汉宫秋。\n行人莫问当年事，故国东来渭水流。");
  const [poetrySceneCount, setPoetrySceneCount] = useState(6);
  const [poetryScenes, setPoetryScenes] = useState<PoetryScene[]>(() => DEFAULT_POETRY_SCENES.map((scene) => ({ ...scene })));
  const [poetryStyleGuide, setPoetryStyleGuide] = useState(DEFAULT_POETRY_STYLE_GUIDE);
  const [poetryCharacterBible, setPoetryCharacterBible] = useState(DEFAULT_POETRY_CHARACTER_BIBLE);
  const [poetryContinuityGuide, setPoetryContinuityGuide] = useState(DEFAULT_POETRY_CONTINUITY_GUIDE);
  const [poetryPromptSupplement, setPoetryPromptSupplement] = useState("");
  const [poetryAnalysis, setPoetryAnalysis] = useState<PoetryAnalysis | null>(() => structuredClone(DEFAULT_POETRY_ANALYSIS));
  const [poetryLoadingAction, setPoetryLoadingAction] = useState<"analysis" | "storyboard" | null>(null);
  const [poetryFailedStage, setPoetryFailedStage] = useState<PoetryWorkflowStage | null>(null);
  const [poetryImageProgress, setPoetryImageProgress] = useState<PoetryImageProgress>({ status: "idle", completed: 0, total: 0, currentTitle: "" });
  const [poetrySceneGenerationStates, setPoetrySceneGenerationStates] = useState<Record<number, PoetrySceneGenerationState>>({});
  const [poetrySingleGenerating, setPoetrySingleGenerating] = useState(false);
  const [poetryBatchGenerating, setPoetryBatchGenerating] = useState(false);
  const [poetryStatus, setPoetryStatus] = useState("");
  const [poetryProgress, setPoetryProgress] = useState("");
  const [activityStatus, setActivityStatus] = useState("准备就绪，可以开始创作。");
  const [activityTone, setActivityTone] = useState<"idle" | "working" | "success" | "error">("idle");
  const poetryLoading = poetryLoadingAction !== null;
  const poetryWorkflowSteps = [
    {
      key: "analysis" as const,
      label: "意境分析",
      state: poetryLoadingAction === "analysis" ? "active" : poetryFailedStage === "analysis" ? "error" : poetryAnalysis ? "done" : "pending",
      detail: poetryLoadingAction === "analysis" ? "正在提取时空、意象和情绪" : poetryFailedStage === "analysis" ? "分析失败，请重试" : poetryAnalysis ? (poetryAnalysis.lineReadings || []).length + " 段理解已可编辑" : "等待分析诗词"
    },
    {
      key: "storyboard" as const,
      label: "分镜提示词",
      state: poetryLoadingAction === "storyboard" ? "active" : poetryFailedStage === "storyboard" ? "error" : poetryScenes.length ? "done" : "pending",
      detail: poetryLoadingAction === "storyboard" ? "正在组织 " + poetrySceneCount + " 个连续画面" : poetryFailedStage === "storyboard" ? "分镜生成失败，请重试" : poetryScenes.length ? poetryScenes.length + " 段提示词已生成" : "等待确认意境分析"
    },
    {
      key: "images" as const,
      label: "图片生成",
      state: poetryImageProgress.status === "running" ? "active" : poetryImageProgress.status === "error" ? "error" : poetryImageProgress.status === "done" ? "done" : "pending",
      detail: poetryImageProgress.status === "running" ? "正在处理 " + poetryImageProgress.currentTitle : poetryImageProgress.status === "error" ? "生成结束，部分或全部失败" : poetryImageProgress.status === "done" ? "已处理 " + poetryImageProgress.completed + " / " + poetryImageProgress.total + " 张" : "等待选择单张或批量生成"
    }
  ];
  const poetryImageProgressPercent = poetryImageProgress.total ? Math.round(poetryImageProgress.completed / poetryImageProgress.total * 100) : 0;
  const sourceInput = useRef<HTMLInputElement>(null);
  const maskInput = useRef<HTMLInputElement>(null);
  const inputLogged = useRef(false);
  const previewUrls = useRef(new Set<string>());
  const previewMediaRef = useRef<HTMLDivElement>(null);
  const previewDragRef = useRef<{ pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const galleryCollapseInitialized = useRef(false);
  const managerCloseTimer = useRef<number | null>(null);
  const poetryCollections = useRef(new Map<string, PoetryCollection>());
  const poetryProjectLoadStarted = useRef(false);
  const poetrySaveTimer = useRef<number | null>(null);

  function clearManagerCloseTimer() {
    if (managerCloseTimer.current !== null) {
      window.clearTimeout(managerCloseTimer.current);
      managerCloseTimer.current = null;
    }
  }

  function openManager(panel: ManagerPanel) {
    clearManagerCloseTimer();
    setManagerClosing(null);
    setPoetryOpen(false);
    if (panel === "library") {
      setSeriesOpen(false);
      setLibraryOpen(true);
      void loadLibraryPrompts();
    } else {
      setLibraryOpen(false);
      setSeriesOpen(true);
      void loadSeries();
    }
  }

  function openPoetryWorkbench() {
    clearManagerCloseTimer();
    setLibraryOpen(false);
    setSeriesOpen(false);
    setManagerClosing(null);
    setPoetryOpen(true);
    setPoetryStatus(poetryScenes.length ? "当前已有分段提示词，可直接检查和修改。" : "");
    setPoetryProgress("");
    if (!poetryProjectLoadStarted.current) void loadPoetryProjects(true);
  }

  function closePoetryWorkbench() {
    setPoetryOpen(false);
  }

  function applyPoetryProject(project: PoetryProject) {
    setActivePoetryProjectId(project.id);
    setPoemText(project.poemText || "");
    setPoetrySceneCount(project.sceneCount || 6);
    setSize(project.imageSize || SIZES[0].value);
    setPoetryPromptSupplement(project.promptSupplement || "");
    setPoetryAnalysis(hydratePoetryAnalysis(project.analysis));
    setPoetryStyleGuide(project.styleGuide || "");
    setPoetryCharacterBible(project.characterBible || DEFAULT_POETRY_CHARACTER_BIBLE);
    setPoetryContinuityGuide(project.continuityGuide || DEFAULT_POETRY_CONTINUITY_GUIDE);
    setPoetryScenes(Array.isArray(project.scenes) ? project.scenes : []);
    setPoetrySceneGenerationStates({});
    setPoetryImageProgress({ status: "idle", completed: 0, total: 0, currentTitle: "" });
    setPoetryStatus(project.analysis
      ? (project.scenes?.length ? "已恢复上次进度，可以继续编辑或生成。" : "已打开诗词项目，可以继续分析。")
      : project.scenes?.length
        ? "这是旧项目，尚未保存完整意境分析；请点击“重新分析诗词意境”补齐译文、背景和赏析栏目。"
        : "已打开诗词项目，可以继续分析。");
    setPoetryProgress("");
    setPoetryProjectStatus("已加载 · " + (project.updatedAt ? new Date(project.updatedAt).toLocaleString("zh-CN") : ""));
  }

  async function loadPoetryProjects(selectLatest = false) {
    poetryProjectLoadStarted.current = true;
    try {
      const response = await fetch("/api/poetry/projects");
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      const projects = Array.isArray(data.projects) ? data.projects as PoetryProject[] : [];
      setPoetryProjects(projects);
      if (selectLatest && projects.length) applyPoetryProject(projects[0]);
      else if (!projects.length) setPoetryProjectStatus(databaseConfigured ? "还没有保存的诗词项目" : "未连接数据库，项目不会跨刷新保存");
    } catch (caught) {
      setPoetryProjectStatus(caught instanceof Error ? caught.message : "读取诗词项目失败。");
    }
  }

  async function openSavedPoetryProject(projectId: number) {
    try {
      const response = await fetch("/api/poetry/projects/" + projectId);
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      if (data.project) applyPoetryProject(data.project as PoetryProject);
    } catch (caught) {
      setPoetryProjectStatus(caught instanceof Error ? caught.message : "读取诗词项目失败。");
    }
  }

  function poetryProjectPayload(overrides: Partial<Omit<PoetryProject, "id" | "seriesId" | "createdAt" | "updatedAt">> = {}): Omit<PoetryProject, "id" | "seriesId" | "createdAt" | "updatedAt"> {
    return {
      title: poetryAnalysis?.title || getPoetryCollectionName(poemText),
      poemText: poemText.trim(),
      sceneCount: poetrySceneCount,
      imageSize: size,
      promptSupplement: poetryPromptSupplement.trim(),
      analysis: poetryAnalysis,
      styleGuide: poetryStyleGuide,
      characterBible: poetryCharacterBible,
      continuityGuide: poetryContinuityGuide,
      scenes: poetryScenes,
      ...overrides
    };
  }

  async function savePoetryProject(options: { silent?: boolean; forceCreate?: boolean; overrides?: Partial<Omit<PoetryProject, "id" | "seriesId" | "createdAt" | "updatedAt">> } = {}) {
    const payload = poetryProjectPayload(options.overrides);
    if (!payload.poemText) return null;
    if (poetryProjectSaving) return activePoetryProjectId;
    setPoetryProjectSaving(true);
    try {
      const updating = activePoetryProjectId && !options.forceCreate;
      const response = await fetch(updating ? "/api/poetry/projects/" + activePoetryProjectId : "/api/poetry/projects", {
        method: updating ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      const project = data.project as PoetryProject;
      setActivePoetryProjectId(project.id);
      setPoetryProjects((projects) => [project, ...projects.filter((item) => item.id !== project.id)]);
      setPoetryProjectStatus("已保存 · " + new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      return project.id;
    } catch (caught) {
      if (!options.silent) setPoetryProjectStatus(caught instanceof Error ? caught.message : "保存诗词项目失败。");
      return null;
    } finally {
      setPoetryProjectSaving(false);
    }
  }

  function startNewPoetryProject() {
    setActivePoetryProjectId(null);
    setPoemText("");
    setPoetryAnalysis(null);
    setPoetryScenes([]);
    setPoetryStyleGuide("");
    setPoetryCharacterBible("");
    setPoetryContinuityGuide("");
    setPoetryPromptSupplement("");
    setPoetrySceneGenerationStates({});
    setPoetryImageProgress({ status: "idle", completed: 0, total: 0, currentTitle: "" });
    setPoetryStatus("请输入诗词原文，然后分析意境。");
    setPoetryProgress("");
    setPoetryProjectStatus("新建诗词项目");
  }

  function closeManager(panel: ManagerPanel) {
    clearManagerCloseTimer();
    setManagerClosing(panel);
    managerCloseTimer.current = window.setTimeout(() => {
      if (panel === "library") setLibraryOpen(false);
      else setSeriesOpen(false);
      setManagerClosing(null);
      managerCloseTimer.current = null;
    }, 320);
  }

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => {
        setApiReady(Boolean(data.configured));
        setDatabaseConfigured(Boolean(data.databaseConfigured));
      })
      .catch(() => {
        setApiReady(false);
        setDatabaseConfigured(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/prompts")
      .then(async (response) => response.ok ? response.json() : { prompts: [] })
      .then((data) => {
        if (Array.isArray(data.prompts)) setExtraPrompts((items) => mergePromptItems(data.prompts, items));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/library/images?limit=60")
      .then(async (response) => response.ok ? response.json() : { images: [] })
      .then((data) => {
        if (!Array.isArray(data.images)) return;
        const savedResults: Result[] = data.images.map((item: { id: number; image: string; fileName?: string; prompt?: string; kind?: string; seriesId?: number | null; seriesName?: string | null; nodeId?: number | null; nodeTitle?: string | null; nodeOrder?: number | null; createdAt?: string; versionId?: number | null; versionGroupId?: number | null; versionNumber?: number | null; parentVersionId?: number | null; isDelivery?: boolean }) => ({
          id: "db-" + item.id,
          src: item.image,
          imageRecordId: item.id,
          fileName: item.fileName,
          seriesId: item.seriesId,
          seriesName: item.seriesName,
          nodeId: item.nodeId,
          nodeTitle: item.nodeTitle,
          nodeOrder: item.nodeOrder,
          prompt: item.prompt || item.fileName || "已保存图片",
          kind: item.kind === "edit" ? "edit" : "generate",
          createdAt: new Date(item.createdAt || Date.now()),
          versionId: item.versionId,
          versionGroupId: item.versionGroupId,
          versionNumber: item.versionNumber,
          parentVersionId: item.parentVersionId,
          isDelivery: Boolean(item.isDelivery)
        }));
        setHistory((items) => {
          const merged = [...items, ...savedResults];
          const seen = new Set<string>();
          return merged.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          }).slice(0, 60);
        });
      })
      .catch(() => undefined)
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("image-assistant-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!preview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [preview]);

  useEffect(() => {
    const media = previewMediaRef.current;
    if (!preview || !media) return;
    media.addEventListener("wheel", handlePreviewWheel, { passive: false });
    return () => media.removeEventListener("wheel", handlePreviewWheel);
  }, [preview, previewZoom]);

  useEffect(() => {
    if (!themeMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setThemeMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [themeMenuOpen]);

  useEffect(() => {
    if (!apiSettingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeApiSettings();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [apiSettingsOpen]);

  useEffect(() => {
    if (!poetryOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePoetryWorkbench();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [poetryOpen]);

  useEffect(() => {
    if (!loading || !requestStartedAt) {
      setElapsedSeconds(0);
      return;
    }
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - requestStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [loading, requestStartedAt]);

  const selectedSize = useMemo(() => SIZES.find((item) => item.value === size)!, [size]);
  const poetrySceneRecommendation = useMemo(() => getPoetrySceneRecommendation(poemText, poetryAnalysis), [poemText, poetryAnalysis]);
  const dailyPrompts = useMemo(
    () => getDailyPromptHotlist(new Date(), 6, hotlistRefreshIndex, extraPrompts),
    [extraPrompts, hotlistRefreshIndex]
  );
  const hotlistDate = useMemo(
    () => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date()),
    []
  );
  const groupedHistory = useMemo(() => groupHistoryRecords(history), [history]);

  useEffect(() => {
    if (galleryCollapseInitialized.current || historyLoading || !groupedHistory.length) return;
    setCollapsedGalleryGroups(new Set(groupedHistory.map((group) => group.key)));
    galleryCollapseInitialized.current = true;
  }, [groupedHistory, historyLoading]);

  useEffect(() => {
    if (!activePoetryProjectId || !poetryOpen || poetryLoading || poetrySingleGenerating || poetryBatchGenerating || !poemText.trim()) return;
    if (poetrySaveTimer.current !== null) window.clearTimeout(poetrySaveTimer.current);
    poetrySaveTimer.current = window.setTimeout(() => {
      poetrySaveTimer.current = null;
      void savePoetryProject({ silent: true });
    }, 900);
    return () => {
      if (poetrySaveTimer.current !== null) {
        window.clearTimeout(poetrySaveTimer.current);
        poetrySaveTimer.current = null;
      }
    };
  }, [activePoetryProjectId, poetryOpen, poemText, poetrySceneCount, size, poetryPromptSupplement, poetryAnalysis, poetryStyleGuide, poetryCharacterBible, poetryContinuityGuide, poetryScenes, poetryLoading, poetrySingleGenerating, poetryBatchGenerating]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
  }

  function openApiSettings() {
    setApiSettingsOpen(true);
    setApiKeyInput("");
    setApiKeyVisible(false);
    setApiKeyError("");
    setApiKeyStatus(apiReady ? "已配置" : apiReady === false ? "未配置" : "正在读取");
    void fetch("/api/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json();
      })
      .then((data) => {
        const configured = Boolean(data.apiKeyConfigured);
        setApiReady(configured);
        setApiKeyStatus(configured ? "已配置" : "未配置");
      })
      .catch((requestError) => setApiKeyError(requestError instanceof Error ? requestError.message : "无法读取当前配置。"));
  }

  function closeApiSettings() {
    setApiSettingsOpen(false);
    setApiKeyInput("");
    setApiKeyVisible(false);
    setApiKeyError("");
    setApiKeyStatus("");
  }

  async function saveApiKeyConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const apiKey = apiKeyInput.trim();
    if (!apiKey || apiKeySaving) return;
    setApiKeySaving(true);
    setApiKeyError("");
    setApiKeyStatus("正在保存");
    try {
      const response = await fetch("/api/settings/api-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setApiReady(Boolean(data.configured));
      setApiKeyInput("");
      setApiKeyVisible(false);
      setApiKeyStatus("已保存");
      setActivityStatus("API Key 已保存，可以开始创作。");
      setActivityTone("success");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "保存 API Key 失败。";
      setApiKeyError(message);
      setApiKeyStatus("");
    } finally {
      setApiKeySaving(false);
    }
  }

  function logClientEvent(event: string, details: Record<string, unknown> = {}) {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, mode, ...details })
    }).catch(() => undefined);
  }

  function handlePromptChange(value: string) {
    setPrompt(value);
    if (value.trim() && !inputLogged.current) {
      inputLogged.current = true;
      logClientEvent("prompt_input_started", { promptChars: value.trim().length });
    }
    if (!value.trim()) inputLogged.current = false;
  }

  async function handleGeneratePromptIdeas() {
    if (promptIdeasLoading) return;
    setPromptIdeasLoading(true);
    setError("");
    setPromptIdeasStatus("正在请求文本模型生成 6 条新灵感...");
    setActivityStatus("已开始生成新灵感，正在请求文本模型...");
    setActivityTone("working");
    try {
      const response = await fetch("/api/prompts/generate", { method: "POST" });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      if (!Array.isArray(data.prompts) || !data.prompts.length) throw new Error("未获得可用的新灵感，请稍后重试。");
      // New entries lead the session list while cached entries remain available after reload.
      setExtraPrompts((items) => mergePromptItems(data.prompts, items));
      setHotlistRefreshIndex((value) => value + 1);
      setActivityStatus("新灵感生成成功，已保存并显示在提示词列表顶部。");
      setActivityTone("success");
      setPromptIdeasStatus(`已生成 ${data.prompts.length} 条新灵感，已显示在提示词列表顶部。`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "生成新灵感失败，请稍后重试。";
      setError(message);
      setActivityStatus("新灵感生成失败，请查看错误信息。");
      setActivityTone("error");
      setPromptIdeasStatus(`生成失败：${message}`);
    } finally {
      setPromptIdeasLoading(false);
    }
  }

  async function loadLibraryPrompts(search = librarySearch) {
    setLibraryStatus("正在读取提示词库...");
    try {
      const response = await fetch("/api/library/prompts?search=" + encodeURIComponent(search));
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setLibraryPrompts(Array.isArray(data.prompts) ? data.prompts : []);
      setLibraryStatus("已加载 " + (Array.isArray(data.prompts) ? data.prompts.length : 0) + " 条提示词。");
    } catch (caught) {
      setLibraryStatus(caught instanceof Error ? caught.message : "读取提示词库失败。");
    }
  }

  async function saveCurrentPrompt() {
    if (!prompt.trim()) {
      setLibraryStatus("当前没有可保存的提示词。");
      return;
    }
    setLibraryStatus("正在保存提示词...");
    try {
      const response = await fetch("/api/library/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: prompt.trim().slice(0, 12), category: "未分类", content: prompt.trim(), source: "manual" })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      await loadLibraryPrompts();
      setLibraryStatus("提示词已保存到 MySQL。");
    } catch (caught) {
      setLibraryStatus(caught instanceof Error ? caught.message : "保存提示词失败。");
    }
  }

  async function removeLibraryPrompt(id: number) {
    try {
      const response = await fetch("/api/library/prompts/" + id, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response));
      setLibraryPrompts((items) => items.filter((item) => item.id !== id));
      setLibraryStatus("提示词已删除。");
    } catch (caught) {
      setLibraryStatus(caught instanceof Error ? caught.message : "删除提示词失败。");
    }
  }

  async function loadSeries() {
    setSeriesStatus("正在读取系列...");
    try {
      const response = await fetch("/api/series");
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesList(Array.isArray(data.series) ? data.series : []);
      setSeriesStatus("已加载 " + (Array.isArray(data.series) ? data.series.length : 0) + " 个系列。");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "读取系列失败。");
    }
  }

  async function createNewSeries() {
    if (!newSeriesName.trim()) {
      setSeriesStatus("请输入系列名称。");
      return;
    }
    setSeriesStatus("正在创建系列...");
    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSeriesName.trim() })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesList((items) => [data.series, ...items]);
      setActiveSeries(data.series);
      setNewSeriesName("");
      setSeriesNodes([]);
      setSeriesStatus("系列已创建。");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "创建系列失败。");
    }
  }

  async function selectSeries(series: SeriesRecord) {
    setActiveSeries(series);
    setSeriesStatus("正在读取故事节点...");
    try {
      const response = await fetch("/api/series/" + series.id + "/nodes");
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesNodes(Array.isArray(data.nodes) ? data.nodes : []);
      setActiveNode(null);
      setSeriesStatus("系列已选中。");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "读取故事节点失败。");
    }
  }

  async function createNewNode() {
    if (!activeSeries) {
      setSeriesStatus("请先选择一个系列。");
      return;
    }
    if (!newNodeTitle.trim()) {
      setSeriesStatus("请输入节点名称。");
      return;
    }
    setSeriesStatus("正在创建故事节点...");
    try {
      const response = await fetch("/api/series/" + activeSeries.id + "/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeOrder: seriesNodes.length + 1,
          title: newNodeTitle.trim(),
          prompt: prompt.trim() || null
        })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesNodes((items) => [...items, data.node]);
      setActiveNode(data.node);
      setNewNodeTitle("");
      setSeriesStatus("故事节点已创建。");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "创建故事节点失败。");
    }
  }

  async function createStoryboard() {
    if (!activeSeries) {
      setSeriesStatus("请先创建并选择一个系列。");
      return;
    }
    if (!storyText.trim()) {
      setSeriesStatus("请输入故事原文或故事梗概。");
      return;
    }
    setStoryboardLoading(true);
    setSeriesStatus("正在使用文本模型拆分故事节点...");
    setActivityStatus("已开始拆分故事，正在请求文本模型...");
    setActivityTone("working");
    try {
      const response = await fetch("/api/series/" + activeSeries.id + "/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: storyText.trim() })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setSeriesNodes(Array.isArray(data.nodes) ? data.nodes : []);
      setActiveNode(null);
      setSeriesStatus("故事已拆分为 " + (Array.isArray(data.nodes) ? data.nodes.length : 0) + " 个连续节点。");
      setActivityStatus("故事拆分成功，已生成 " + (Array.isArray(data.nodes) ? data.nodes.length : 0) + " 个节点。");
      setActivityTone("success");
    } catch (caught) {
      setSeriesStatus(caught instanceof Error ? caught.message : "自动拆分故事失败。");
      setActivityStatus("故事拆分失败，请查看错误信息。");
      setActivityTone("error");
    } finally {
      setStoryboardLoading(false);
    }
  }

  async function generateStoryboardImages() {
    if (!activeSeries || !seriesNodes.length || batchGenerating) {
      setBatchProgress(activeSeries ? "请先生成故事节点。" : "请先选择一个系列。");
      setActivityStatus(activeSeries ? "未开始：请先自动拆分故事生成节点。" : "未开始：请先选择一个系列。");
      setActivityTone("error");
      return;
    }
    setBatchGenerating(true);
    setBatchProgress("正在准备批量生成...");
    setActivityStatus("批量任务已开始，正在准备第 1 张图片...");
    setActivityTone("working");
    const generated: Result[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];
    let previousImage: { blob: Blob; fileName: string } | null = null;
    let previousVersion: Result | null = null;
    try {
      for (let index = 0; index < seriesNodes.length; index += 1) {
        const node = seriesNodes[index];
        const nodePrompt = STORYBOARD_STYLE_PREFIX + " " + (node.prompt || node.story_text || node.title);
        setBatchProgress("正在生成第 " + (index + 1) + " / " + seriesNodes.length + " 张：" + node.title + (previousImage ? "，正在引用上一节点图片。" : ""));
        setActivityStatus("批量生成中：第 " + (index + 1) + " / " + seriesNodes.length + " 张，" + node.title + (previousImage ? "（已引用上一节点图片）" : ""));
        try {
          let response: Response;
          const operation: Mode = previousImage ? "edit" : "generate";
          if (previousImage) {
            const form = new FormData();
            form.append("prompt", nodePrompt);
            form.append("size", size);
            form.append("title", node.title);
            form.append("seriesName", activeSeries.name);
            form.append("seriesId", String(activeSeries.id));
            form.append("nodeId", String(node.id));
            form.append("nodeOrder", String(node.node_order));
            if (previousVersion?.versionGroupId) form.append("versionGroupId", String(previousVersion.versionGroupId));
            if (previousVersion?.versionId) form.append("parentVersionId", String(previousVersion.versionId));
            if (previousVersion?.imageRecordId) form.append("sourceImageRecordId", String(previousVersion.imageRecordId));
            form.append("image[]", previousImage.blob, previousImage.fileName);
            response = await fetch("/api/images/edit", { method: "POST", body: form });
          } else {
            response = await fetch("/api/images/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: nodePrompt,
                size,
                title: node.title,
                seriesName: activeSeries.name,
                seriesId: activeSeries.id,
                nodeId: node.id,
                nodeOrder: node.node_order
              })
            });
          }
          if (!response.ok) throw new Error(await readApiError(response));
          const data = await response.json();
          const generatedResult: Result = {
            id: data.databaseId ? "db-" + data.databaseId : crypto.randomUUID(),
            src: data.image,
            imageRecordId: data.databaseId || null,
            fileName: data.fileName,
            seriesId: activeSeries.id,
            seriesName: activeSeries.name,
            nodeId: node.id,
            nodeTitle: node.title,
            nodeOrder: node.node_order,
            prompt: data.revisedPrompt || nodePrompt,
            kind: operation,
            createdAt: new Date(),
            versionId: data.versionId || null,
            versionGroupId: data.versionGroupId || null,
            versionNumber: data.versionNumber || null,
            parentVersionId: data.parentVersionId || null,
            isDelivery: Boolean(data.isDelivery)
          };
          const versionedResult: Result = data.versionId ? generatedResult : enrichSessionVersion(generatedResult, operation === "edit" ? previousVersion : null);
          generated.push(versionedResult);
          previousVersion = versionedResult;
          const imageResponse = await fetch(data.image);
          if (imageResponse.ok) {
            previousImage = { blob: await imageResponse.blob(), fileName: data.fileName || ("node-" + node.node_order + ".png") };
          } else {
            previousImage = null;
            warnings.push(node.title + "：无法读取图片作为下一节点参考图，下一张将按普通生成处理");
          }
        } catch (caught) {
          failures.push(node.title + "：" + (caught instanceof Error ? caught.message : "请求失败"));
        }
      }
      if (generated.length) {
        setCurrent(generated.at(-1) || null);
        setHistory((items) => [...generated.reverse(), ...items].slice(0, 60));
      }
      const nodesResponse = await fetch("/api/series/" + activeSeries.id + "/nodes");
      if (nodesResponse.ok) {
        const nodesData = await nodesResponse.json();
        if (Array.isArray(nodesData.nodes)) setSeriesNodes(nodesData.nodes);
      }
      setBatchProgress("批量生成完成：成功 " + generated.length + " 张，失败 " + failures.length + " 张。" + (failures.length ? " 失败节点：" + failures.join("；") : "") + (warnings.length ? " 提示：" + warnings.join("；") : ""));
      setActivityStatus("批量生成完成：成功 " + generated.length + " 张，失败 " + failures.length + " 张。");
      setActivityTone(failures.length ? "error" : "success");
    } catch (caught) {
      setBatchProgress("批量生成已停止：" + (caught instanceof Error ? caught.message : "请求失败。"));
      setActivityStatus("批量生成异常终止，请查看错误信息。");
      setActivityTone("error");
    } finally {
      setBatchGenerating(false);
    }
  }

  function createPreview(file: File) {
    const preview = URL.createObjectURL(file);
    previewUrls.current.add(preview);
    return preview;
  }

  function releasePreview(preview: string) {
    URL.revokeObjectURL(preview);
    previewUrls.current.delete(preview);
  }

  function selectReferenceImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (files.some((file) => !file.type.startsWith("image/"))) {
      setError("请上传 PNG、JPG、WebP 等图片文件。");
      return;
    }

    const remaining = MAX_REFERENCE_IMAGES - referenceImages.length;
    const accepted = files.slice(0, remaining);
    if (!accepted.length) {
      setError(`最多可添加 ${MAX_REFERENCE_IMAGES} 张参考图。`);
      return;
    }

    const additions = accepted.map((file) => ({ file, preview: createPreview(file) }));
    setReferenceImages((images) => [...images, ...additions]);
    event.target.value = "";
    logClientEvent("reference_images_selected", {
      referenceCount: referenceImages.length + additions.length,
      file: { mimeType: additions.map((image) => image.file.type).join(","), bytes: additions.reduce((sum, image) => sum + image.file.size, 0) }
    });
    setError(files.length > remaining ? `最多可添加 ${MAX_REFERENCE_IMAGES} 张参考图，已添加前 ${accepted.length} 张。` : "");
  }

  function selectMask(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请上传 PNG、JPG、WebP 等图片文件。");
      return;
    }
    if (maskPreview) releasePreview(maskPreview);
    setMaskFile(file);
    setMaskPreview(createPreview(file));
    event.target.value = "";
    logClientEvent("mask_selected", { file: { mimeType: file.type, bytes: file.size } });
    setError("");
  }

  function clearReferenceImage(index: number) {
    const cancelingHistoryEdit = referenceImages.length === 1 && Boolean(versionParent);
    setReferenceImages((images) => {
      const removed = images[index];
      if (removed) releasePreview(removed.preview);
      return images.filter((_, imageIndex) => imageIndex !== index);
    });
    if (cancelingHistoryEdit) {
      handlePromptChange("");
      setVersionParent(null);
      setActivityStatus("已取消历史图片编辑，可以重新上传图片。 ");
      setActivityTone("idle");
    }
    logClientEvent("reference_image_removed", { referenceCount: Math.max(referenceImages.length - 1, 0) });
  }

  async function analyzePoem() {
    if (poetryLoading || poetrySingleGenerating || poetryBatchGenerating) return;
    if (!poemText.trim()) {
      setPoetryStatus("请输入诗词原文，可以粘贴多句或整首诗词。");
      return;
    }
    setPoetryLoadingAction("analysis");
    setPoetryFailedStage(null);
    setPoetryImageProgress({ status: "idle", completed: 0, total: 0, currentTitle: "" });
    setPoetrySceneGenerationStates({});
    setPoetryAnalysis(null);
    setPoetryScenes([]);
    setPoetryStyleGuide("");
    setPoetryCharacterBible("");
    setPoetryContinuityGuide("");
    setPoetryProgress("");
    setPoetryStatus("正在分析诗词的时空、意象、典故和情绪变化...");
    setActivityStatus("正在理解诗词意境，完成后可先检查和修改分析结果。");
    setActivityTone("working");
    try {
      const response = await fetch("/api/poetry/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poem: poemText.trim() })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      if (!data.analysis || !Array.isArray(data.analysis.lineReadings)) throw new Error("没有得到完整的诗词意境分析。");
      setPoetryAnalysis(hydratePoetryAnalysis(data.analysis));
      await savePoetryProject({ forceCreate: !activePoetryProjectId, overrides: { analysis: data.analysis, scenes: [], styleGuide: "", characterBible: "", continuityGuide: "" } });
      setPoetryStatus("意境分析已完成。请检查和修改内容，确认后再生成分镜提示词。");
      setActivityStatus("诗词意境分析完成，等待确认后生成分镜。");
      setActivityTone("success");
    } catch (caught) {
      setPoetryFailedStage("analysis");
      const message = caught instanceof Error ? caught.message : "诗词意境解析失败。";
      setPoetryStatus(message);
      setActivityStatus("诗词意境解析失败，请检查文本模型配置。");
      setActivityTone("error");
    } finally {
      setPoetryLoadingAction(null);
    }
  }

  function handlePoemTextChange(value: string) {
    setPoemText(value);
    setPoetryAnalysis(null);
    setPoetryScenes([]);
    setPoetryStyleGuide("");
    setPoetryCharacterBible("");
    setPoetryContinuityGuide("");
    setPoetryProgress("");
    setPoetryFailedStage(null);
    setPoetryImageProgress({ status: "idle", completed: 0, total: 0, currentTitle: "" });
    setPoetrySceneGenerationStates({});
    setPoetryStatus(value.trim() ? "诗词原文已修改，请重新分析意境。" : "");
  }

  async function generatePoetryStoryboard() {
    if (poetryLoading || poetrySingleGenerating || poetryBatchGenerating) return;
    if (!poetryAnalysis) {
      setPoetryStatus("请先分析诗词意境，再根据确认后的内容生成分镜。");
      return;
    }
    setPoetryLoadingAction("storyboard");
    setPoetryFailedStage(null);
    setPoetryImageProgress({ status: "idle", completed: 0, total: 0, currentTitle: "" });
    setPoetrySceneGenerationStates({});
    setPoetryScenes([]);
    setPoetryStyleGuide("");
    setPoetryCharacterBible("");
    setPoetryContinuityGuide("");
    setPoetryProgress("");
    setPoetryStatus("正在根据确认后的意境分析生成分镜提示词...");
    setActivityStatus("正在把确认后的诗意分析转换为连续画面提示词。");
    setActivityTone("working");
    try {
      const response = await fetch("/api/poetry/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poem: poemText.trim(), sceneCount: poetrySceneCount, analysis: poetryAnalysis })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      if (!Array.isArray(data.scenes) || !data.scenes.length) throw new Error("没有得到可用的诗词画面段落。");
      setPoetryScenes(data.scenes);
      setPoetryStyleGuide(typeof data.styleGuide === "string" ? data.styleGuide : "");
      const characterBible = typeof data.characterBible === "string" && data.characterBible.trim() ? data.characterBible : DEFAULT_POETRY_CHARACTER_BIBLE;
      const continuityGuide = typeof data.continuityGuide === "string" && data.continuityGuide.trim() ? data.continuityGuide : DEFAULT_POETRY_CONTINUITY_GUIDE;
      setPoetryCharacterBible(characterBible);
      setPoetryContinuityGuide(continuityGuide);
      await savePoetryProject({ overrides: { analysis: poetryAnalysis, scenes: data.scenes, styleGuide: typeof data.styleGuide === "string" ? data.styleGuide : "", characterBible, continuityGuide } });
      setPoetryStatus("已生成 " + data.scenes.length + " 段画面提示词，可以编辑后逐段或批量出图。");
      setActivityStatus("诗词分镜提示词已生成并可继续编辑。");
      setActivityTone("success");
    } catch (caught) {
      setPoetryFailedStage("storyboard");
      const message = caught instanceof Error ? caught.message : "诗词分镜生成失败。";
      setPoetryStatus(message);
      setActivityStatus("诗词分镜生成失败，请检查文本模型配置。 ");
      setActivityTone("error");
    } finally {
      setPoetryLoadingAction(null);
    }
  }

  async function ensurePoetryCollection() {
    await savePoetryProject({ silent: true });
    const collectionKey = poemText.trim();
    let collection = poetryCollections.current.get(collectionKey);

    if (!collection) {
      const name = getPoetryCollectionName(poemText);
      const seriesResponse = await fetch("/api/series");
      if (!seriesResponse.ok) throw new Error(await readApiError(seriesResponse));
      const seriesData = await seriesResponse.json();
      const existingSeries = Array.isArray(seriesData.series) ? seriesData.series.find((item: SeriesRecord) => item.name === name) : null;
      let series: SeriesRecord | null = existingSeries;

      if (!series) {
        const createSeriesResponse = await fetch("/api/series", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description: "诗词意境创作合集" })
        });
        if (!createSeriesResponse.ok) throw new Error(await readApiError(createSeriesResponse));
        const createdSeriesData = await createSeriesResponse.json();
        series = createdSeriesData.series;
      }

      if (!series) throw new Error("无法创建诗词合集。");
      const nodesResponse = await fetch("/api/series/" + series.id + "/nodes");
      if (!nodesResponse.ok) throw new Error(await readApiError(nodesResponse));
      const nodesData = await nodesResponse.json();
      collection = {
        name,
        series,
        nodesByOrder: new Map<number, SeriesNode>((Array.isArray(nodesData.nodes) ? nodesData.nodes : []).map((node: SeriesNode) => [node.node_order, node]))
      };
      poetryCollections.current.set(collectionKey, collection);
    }

    for (const scene of poetryScenes) {
      if (collection.nodesByOrder.has(scene.sceneOrder)) continue;
      const createNodeResponse = await fetch("/api/series/" + collection.series.id + "/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeOrder: scene.sceneOrder, title: scene.title, storyText: scene.sourceLine, prompt: scene.prompt })
      });
      if (!createNodeResponse.ok) throw new Error(await readApiError(createNodeResponse));
      const createdNodeData = await createNodeResponse.json();
      collection.nodesByOrder.set(scene.sceneOrder, createdNodeData.node);
    }

    return collection;
  }

  function buildPoetryScenePrompt(scene: PoetryScene) {
    const previousScenes = poetryScenes
      .filter((item) => item.sceneOrder < scene.sceneOrder)
      .sort((a, b) => a.sceneOrder - b.sceneOrder);
    const previousPrompt = previousScenes.length
      ? "前序分镜提示词（必须继承其中的人物外貌、服装、发型、道具、时代、画风和空间关系，只允许按当前诗句推进动作、天气与光线）：\n" + previousScenes.map((item) => "第" + item.sceneOrder + "段《" + item.title + "》：" + item.prompt.slice(0, 3600)).join("\n")
      : "这是首段画面，请建立并固定角色与视觉锚点，供后续分镜继承。";
    return [
      poetryStyleGuide,
      poetryCharacterBible,
      poetryContinuityGuide,
      poetryPromptSupplement.trim(),
      previousPrompt,
      "当前分镜提示词：" + scene.prompt
    ].filter(Boolean).join("\n");
  }

  async function generatePoetrySceneImage(scene: PoetryScene, collection: PoetryCollection) {
    const promptText = buildPoetryScenePrompt(scene);
    const node = collection.nodesByOrder.get(scene.sceneOrder);
    if (!node) throw new Error("诗词画面节点未创建，请重试。");
    const response = await fetch("/api/images/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText, size, title: scene.title, seriesName: collection.name, seriesId: collection.series.id, nodeId: node.id, nodeOrder: node.node_order })
    });
    if (!response.ok) throw new ImageRequestError(response.status, await readApiError(response));
    const data = await response.json();
    const result: Result = {
      id: data.databaseId ? "db-" + data.databaseId : crypto.randomUUID(),
      src: data.image,
      imageRecordId: data.databaseId || null,
      fileName: data.fileName,
      seriesId: collection.series.id,
      seriesName: collection.name,
      nodeId: node.id,
      nodeTitle: node.title,
      nodeOrder: node.node_order,
      prompt: data.revisedPrompt || promptText,
      kind: "generate",
      createdAt: new Date(),
      versionId: data.versionId || null,
      versionGroupId: data.versionGroupId || null,
      versionNumber: data.versionNumber || null,
      parentVersionId: data.parentVersionId || null,
      isDelivery: Boolean(data.isDelivery)
    };
    return data.versionId ? result : enrichSessionVersion(result, null);
  }

  async function generatePoetrySceneImageWithRetry(scene: PoetryScene, collection: PoetryCollection, batchPosition?: { current: number; total: number }) {
    return retryPoetryImageRequest(
      () => generatePoetrySceneImage(scene, collection),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        onRetry: (retry: { nextAttempt: number; maxAttempts: number; error: Error }) => {
          const retryMessage = "临时错误，正在自动重试 " + retry.nextAttempt + " / " + retry.maxAttempts + "：" + retry.error.message;
          setPoetrySceneGenerationStates((states) => ({ ...states, [scene.sceneOrder]: { status: "running", message: retryMessage, attempt: retry.nextAttempt } }));
          setPoetryProgress(batchPosition
            ? "第 " + batchPosition.current + " / " + batchPosition.total + " 段自动重试：" + scene.title + "（" + retry.nextAttempt + " / " + retry.maxAttempts + "）"
            : scene.title + "自动重试中（" + retry.nextAttempt + " / " + retry.maxAttempts + "）");
        }
      }
    );
  }

  async function generateOnePoetryScene(scene: PoetryScene) {
    if (poetryBatchGenerating || poetrySingleGenerating || poetryLoading) return;
    setPoetrySingleGenerating(true);
    setPoetryFailedStage(null);
    setPoetryImageProgress({ status: "running", completed: 0, total: 1, currentTitle: scene.title });
    setPoetrySceneGenerationStates((states) => ({ ...states, [scene.sceneOrder]: { status: "running", message: "正在提交图片生成请求...", attempt: 1 } }));
    setPoetryProgress("正在生成：" + scene.title);
    setActivityStatus("正在根据“" + scene.title + "”生成图片...");
    setActivityTone("working");
    try {
      const collection = await ensurePoetryCollection();
      const result = await generatePoetrySceneImageWithRetry(scene, collection);
      setCurrent(result);
      setHistory((items) => [result, ...items].slice(0, 60));
      setPoetrySceneGenerationStates((states) => ({ ...states, [scene.sceneOrder]: { status: "success", message: "图片已生成并保存，可再次生成", attempt: states[scene.sceneOrder]?.attempt || 1 } }));
      setPoetryProgress("已生成：" + scene.title);
      setPoetryImageProgress({ status: "done", completed: 1, total: 1, currentTitle: scene.title });
      setPoetryStatus("单段图片已生成，可以继续调整其他段落。");
      setActivityStatus("“" + scene.title + "”生成成功，图片已保存到桌面文件夹。");
      setActivityTone("success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "图片生成失败。";
      setPoetryFailedStage("images");
      setPoetryImageProgress({ status: "error", completed: 0, total: 1, currentTitle: scene.title });
      setPoetrySceneGenerationStates((states) => ({ ...states, [scene.sceneOrder]: { status: "error", message, attempt: states[scene.sceneOrder]?.attempt || 1 } }));
      setPoetryProgress("生成失败：" + scene.title + "，" + message);
      setActivityStatus("诗词画面生成失败，请查看错误信息。");
      setActivityTone("error");
    } finally {
      setPoetrySingleGenerating(false);
    }
  }

  async function generateAllPoetryScenes() {
    if (!poetryScenes.length || poetryBatchGenerating || poetrySingleGenerating || poetryLoading) {
      setPoetryStatus("请先解析诗词，生成画面提示词。");
      return;
    }
    setPoetryBatchGenerating(true);
    setPoetryFailedStage(null);
    setPoetryImageProgress({ status: "running", completed: 0, total: poetryScenes.length, currentTitle: "正在准备合集" });
    setPoetrySceneGenerationStates(Object.fromEntries(poetryScenes.map((scene) => [scene.sceneOrder, { status: "waiting", message: "等待生成", attempt: 0 }])) as Record<number, PoetrySceneGenerationState>);
    setPoetryProgress("正在准备批量生成...");
    setActivityStatus("诗词画面批量生成已开始。");
    setActivityTone("working");
    const generated: Result[] = [];
    const failures: string[] = [];
    try {
      const collection = await ensurePoetryCollection();
      for (const [index, scene] of poetryScenes.entries()) {
        setPoetryImageProgress({ status: "running", completed: index, total: poetryScenes.length, currentTitle: scene.title });
        setPoetrySceneGenerationStates((states) => ({ ...states, [scene.sceneOrder]: { status: "running", message: "正在生成第 " + (index + 1) + " 张...", attempt: 1 } }));
        setPoetryProgress("正在生成第 " + scene.sceneOrder + " / " + poetryScenes.length + " 段：" + scene.title);
        try {
          generated.push(await generatePoetrySceneImageWithRetry(scene, collection, { current: index + 1, total: poetryScenes.length }));
          setPoetrySceneGenerationStates((states) => ({ ...states, [scene.sceneOrder]: { status: "success", message: "图片已生成并保存", attempt: states[scene.sceneOrder]?.attempt || 1 } }));
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "请求失败";
          failures.push(scene.title + "：" + message);
          setPoetrySceneGenerationStates((states) => ({ ...states, [scene.sceneOrder]: { status: "error", message, attempt: states[scene.sceneOrder]?.attempt || 1 } }));
        }
        setPoetryImageProgress({ status: "running", completed: index + 1, total: poetryScenes.length, currentTitle: scene.title });
      }
      if (generated.length) {
        setCurrent(generated.at(-1) || null);
        setHistory((items) => [...generated.slice().reverse(), ...items].slice(0, 60));
      }
      setPoetryProgress("批量生成完成：成功 " + generated.length + " 段，失败 " + failures.length + " 段。" + (failures.length ? " 失败项已在对应分镜标出，可单独重新生成。" : ""));
      setPoetryStatus("批量生成完成，可以在下方图库查看所有图片。");
      setPoetryFailedStage(failures.length ? "images" : null);
      setPoetryImageProgress({ status: failures.length ? "error" : "done", completed: poetryScenes.length, total: poetryScenes.length, currentTitle: "" });
      setActivityStatus("诗词画面批量生成完成：成功 " + generated.length + " 段，失败 " + failures.length + " 段。");
      setActivityTone(failures.length ? "error" : "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "批量生成准备失败。";
      setPoetryFailedStage("images");
      setPoetryImageProgress({ status: "error", completed: generated.length + failures.length, total: poetryScenes.length, currentTitle: "" });
      setPoetryProgress("批量生成中断：" + message);
      setPoetryStatus("图片生成未能继续，请检查提示信息后重试。");
      setActivityStatus("诗词画面批量生成中断，请查看错误信息。");
      setActivityTone("error");
    } finally {
      setPoetryBatchGenerating(false);
    }
  }

  function clearMask() {
    if (maskPreview) releasePreview(maskPreview);
    setMaskFile(null);
    setMaskPreview("");
    if (maskInput.current) maskInput.current.value = "";
  }

  function openPreview(result: Result) {
    setPreview(result);
    setPreviewZoom(1);
  }

  function closePreview() {
    setPreview(null);
    setPreviewZoom(1);
  }

  function changePreviewZoom(delta: number) {
    setPreviewZoom((currentZoom) => Math.min(3, Math.max(0.5, Number((currentZoom + delta).toFixed(2)))));
  }

  function handlePreviewWheel(event: WheelEvent) {
    if (!event.ctrlKey || !preview) return;
    event.preventDefault();
    event.stopPropagation();
    const media = previewMediaRef.current;
    if (!media) return;
    const previousZoom = previewZoom;
    const nextZoom = Math.min(3, Math.max(0.5, Number((previousZoom + (event.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))));
    if (nextZoom === previousZoom) return;
    const mediaRect = media.getBoundingClientRect();
    const anchorX = event.clientX - mediaRect.left;
    const anchorY = event.clientY - mediaRect.top;
    const zoomRatio = nextZoom / previousZoom;
    setPreviewZoom(nextZoom);
    window.requestAnimationFrame(() => {
      media.scrollLeft = Math.max(0, (media.scrollLeft + anchorX) * zoomRatio - anchorX);
      media.scrollTop = Math.max(0, (media.scrollTop + anchorY) * zoomRatio - anchorY);
    });
  }

  function handlePreviewPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || previewZoom <= 1) return;
    const media = previewMediaRef.current;
    if (!media) return;
    previewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: media.scrollLeft,
      scrollTop: media.scrollTop
    };
    media.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePreviewPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = previewDragRef.current;
    const media = previewMediaRef.current;
    if (!drag || !media || drag.pointerId !== event.pointerId) return;
    media.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
    media.scrollTop = drag.scrollTop - (event.clientY - drag.startY);
  }

  function handlePreviewPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const media = previewMediaRef.current;
    if (media && previewDragRef.current?.pointerId === event.pointerId && media.hasPointerCapture(event.pointerId)) {
      media.releasePointerCapture(event.pointerId);
    }
    previewDragRef.current = null;
  }

  async function continueEditing(result: Result) {
    setError("");
    setActivityStatus("正在准备历史图片编辑...");
    setActivityTone("working");
    try {
      const response = await fetch(result.src);
      if (!response.ok) throw new Error("无法读取这张历史图片。");
      const blob = await response.blob();
      const file = new File([blob], result.fileName || "history-image.png", { type: blob.type || "image/png" });
      referenceImages.forEach((image) => releasePreview(image.preview));
      const preview = createPreview(file);
      setReferenceImages([{ file, preview }]);
      setVersionParent(result);
      setPrompt(result.prompt);
      setMode("edit");
      setCurrent(result);
      setActivityStatus("已载入历史图片，可继续编辑并生成新版本。");
      setActivityTone("idle");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "载入历史图片失败。";
      setError(message);
      setActivityStatus(message);
      setActivityTone("error");
    }
  }

  async function setDeliveryVersion(result: Result) {
    if (!result.versionId) {
      setError("这张图片暂时没有可确认的版本信息。");
      return;
    }
    try {
      if (typeof result.versionId === "number") {
        const response = await fetch("/api/library/images/versions/" + result.versionId + "/deliver", { method: "POST" });
        if (!response.ok) throw new Error(await readApiError(response));
      }
      setHistory((items) => markSessionDelivery(items, result.versionId!));
      setCurrent((item) => item && String(item.versionGroupId) === String(result.versionGroupId) ? { ...item, isDelivery: item.versionId === result.versionId } : item);
      setPreview((item) => item && String(item.versionGroupId) === String(result.versionGroupId) ? { ...item, isDelivery: item.versionId === result.versionId } : item);
      setActivityStatus("已将该版本设为当前交付版本。");
      setActivityTone("success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "设置交付版本失败。";
      setError(message);
      setActivityStatus(message);
      setActivityTone("error");
    }
  }

  function toggleGalleryNode(key: string) {
    setCollapsedGalleryNodes((collapsed) => {
      const next = new Set(collapsed);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGalleryGroup(key: string) {
    setCollapsedGalleryGroups((collapsed) => {
      const next = new Set(collapsed);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    const source = event.currentTarget.dataset.imageSource;
    if (source) setFailedImageSources((sources) => new Set(sources).add(source));
  }

  function retryImage(source: string) {
    setFailedImageSources((sources) => {
      const nextSources = new Set(sources);
      nextSources.delete(source);
      return nextSources;
    });
    setImageRetries((retries) => ({ ...retries, [source]: (retries[source] || 0) + 1 }));
  }

  function getImageSource(source: string) {
    const retry = imageRetries[source];
    if (!retry || source.startsWith("data:")) return source;
    return `${source}${source.includes("?") ? "&" : "?"}previewRetry=${retry}`;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) {
      setError(mode === "generate" ? "先描述你想要生成的图片。" : "描述希望如何编辑图片。" );
      setActivityStatus("未开始：请先填写提示词。");
      setActivityTone("error");
      logClientEvent("client_validation_failed", { promptChars: 0 });
      return;
    }
    if (mode === "edit" && !referenceImages.length) {
      setError("图片编辑需要至少上传一张原图。" );
      setActivityStatus("未开始：编辑模式至少需要一张图片。");
      setActivityTone("error");
      logClientEvent("client_validation_failed", { promptChars: prompt.trim().length });
      return;
    }

    setLoading(true);
    setError("");
    setActivityStatus("已开始生成，正在校验请求...");
    setActivityTone("working");
    setExecutionStage("validating");
    setRequestStartedAt(Date.now());
    const operation: Mode = referenceImages.length ? "edit" : "generate";
    logClientEvent("generate_clicked", {
      promptChars: prompt.trim().length,
      referenceCount: referenceImages.length,
      file: referenceImages.length
        ? { mimeType: referenceImages.map((image) => image.file.type).join(","), bytes: referenceImages.reduce((sum, image) => sum + image.file.size, 0) }
        : undefined
    });
    try {
      let response: Response;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      setExecutionStage("sending");
      setActivityStatus(operation === "edit" ? "已开始上传参考图，正在发送请求..." : "已开始发送提示词，正在连接图片服务...");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      if (operation === "generate") {
        const request = fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            size,
            title: versionParent?.nodeTitle || activeNode?.title || undefined,
            seriesName: versionParent?.seriesName || activeSeries?.name || undefined,
            seriesId: versionParent?.seriesId ?? activeSeries?.id ?? undefined,
            nodeId: versionParent?.nodeId ?? activeNode?.id ?? undefined,
            nodeOrder: versionParent?.nodeOrder ?? activeNode?.node_order ?? undefined,
            versionGroupId: versionParent?.versionGroupId || undefined,
            parentVersionId: versionParent?.versionId || undefined,
            sourceImageRecordId: versionParent?.imageRecordId || undefined
          })
        });
        setExecutionStage("processing");
        setActivityStatus("图片模型正在生成，请稍候...");
        response = await request;
      } else {
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("size", size);
        if (versionParent?.nodeTitle || activeNode?.title) form.append("title", versionParent?.nodeTitle || activeNode?.title || "");
        if (versionParent?.seriesName || activeSeries?.name) form.append("seriesName", versionParent?.seriesName || activeSeries?.name || "");
        if (versionParent?.seriesId ?? activeSeries?.id) form.append("seriesId", String(versionParent?.seriesId ?? activeSeries?.id));
        if (versionParent?.nodeId ?? activeNode?.id) form.append("nodeId", String(versionParent?.nodeId ?? activeNode?.id));
        if (versionParent?.nodeOrder ?? activeNode?.node_order) form.append("nodeOrder", String(versionParent?.nodeOrder ?? activeNode?.node_order));
        if (versionParent?.versionGroupId) form.append("versionGroupId", String(versionParent.versionGroupId));
        if (versionParent?.versionId) form.append("parentVersionId", String(versionParent.versionId));
        if (versionParent?.imageRecordId) form.append("sourceImageRecordId", String(versionParent.imageRecordId));
        referenceImages.forEach((image) => form.append("image[]", image.file));
        if (maskFile) form.append("mask", maskFile);
        const request = fetch("/api/images/edit", { method: "POST", body: form });
        setExecutionStage("processing");
        setActivityStatus("图片模型正在根据参考图生成，请稍候...");
        response = await request;
      }

      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      const result: Result = {
        id: data.databaseId ? "db-" + data.databaseId : crypto.randomUUID(),
        src: data.image,
        imageRecordId: data.databaseId || null,
        fileName: data.fileName,
        seriesId: versionParent?.seriesId ?? activeSeries?.id,
        seriesName: versionParent?.seriesName ?? activeSeries?.name,
        nodeId: versionParent?.nodeId ?? activeNode?.id,
        nodeTitle: versionParent?.nodeTitle ?? activeNode?.title,
        nodeOrder: versionParent?.nodeOrder ?? activeNode?.node_order,
        prompt: data.revisedPrompt || prompt,
        kind: operation,
        createdAt: new Date(),
        versionId: data.versionId || null,
        versionGroupId: data.versionGroupId || null,
        versionNumber: data.versionNumber || null,
        parentVersionId: data.parentVersionId || null,
        isDelivery: Boolean(data.isDelivery)
      };
      const versionedResult = data.versionId ? result : enrichSessionVersion(result, operation === "edit" ? versionParent : null);
      setCurrent(versionedResult);
      setHistory((items) => [versionedResult, ...items].slice(0, 60));
      setVersionParent(null);
      setApiReady(true);
      setExecutionStage("completed");
      setActivityStatus("生成成功，图片已保存到桌面文件夹。");
      setActivityTone("success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "图片请求失败，请稍后重试。" );
      setExecutionStage("failed");
      setActivityStatus("生成失败，请查看错误信息和终端日志。");
      setActivityTone("error");
    } finally {
      setLoading(false);
    }
  }

  function renderHistoryItem(item: Result) {
    return (
      <article className="history-item" key={item.id}>
        <button type="button" onClick={() => { setCurrent(item); openPreview(item); }} aria-label={"预览生成记录：" + item.prompt}>
          {failedImageSources.has(item.src)
            ? <span className="history-image-error">图片加载失败</span>
            : <img key={item.id + "-" + (imageRetries[item.src] || 0)} src={getImageSource(item.src)} data-image-source={item.src} alt={item.prompt} onError={handleImageError} />}
        </button>
        <div className="history-item-meta"><span><Clock3 size={13} /> {formatTime(item.createdAt)}</span><DownloadButton src={item.src} filename={item.fileName || "image-assistant.png"} /></div>
        {(item.versionNumber || item.isDelivery) && (
          <div className="version-meta">
            <span className="version-label">V{item.versionNumber || 1}</span>
            {item.isDelivery && <span className="delivery-badge"><CheckCircle2 size={12} /> 当前交付</span>}
          </div>
        )}
        <p className="history-prompt" title={item.prompt}>{item.prompt}</p>
        <div className="history-actions">
          <button className="history-edit-button" type="button" onClick={() => void continueEditing(item)}>
            <Eraser size={13} /> 继续编辑
          </button>
          {item.versionId && !item.isDelivery && (
            <button className="history-delivery-button" type="button" onClick={() => void setDeliveryVersion(item)}>
              <CheckCircle2 size={13} /> 设为交付版本
            </button>
          )}
        </div>
      </article>
    );
  }

  const sourceTitle = mode === "generate" ? "添加参考图（可选）" : "上传待编辑图片";
  const emptyTitle = referenceImages.length
    ? "参考图已就绪，描述希望保留或修改的部分"
    : mode === "generate" ? "准备好把想法变成图像" : "上传图片后开始编辑";
  const actionLabel = referenceImages.length ? "按参考图生成" : mode === "generate" ? "生成图片" : "生成编辑结果";
  const executionSteps = [
    { id: "validating", label: "校验提示词和请求参数" },
    { id: "sending", label: referenceImages.length ? `上传 ${referenceImages.length} 张参考图到本地代理` : "发送提示词到本地代理" },
    { id: "processing", label: "等待 gpt-image-2 返回图片" }
  ] as const;
  const activeStep = executionStage === "validating" ? 0 : executionStage === "sending" ? 1 : 2;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Image Assistant 首页">
          <span className="brand-mark"><WandSparkles size={19} /></span>
          <span>Image Assistant</span>
        </a>
        <div className="topbar-actions">
          <div className="theme-picker">
            <button
              className="icon-button theme-toggle"
              type="button"
              onClick={() => setThemeMenuOpen((open) => !open)}
              title="切换界面主题"
              aria-label="切换界面主题"
              aria-expanded={themeMenuOpen}
              aria-haspopup="menu"
            >
              {theme === "light" ? <Sun size={17} /> : theme === "dark" ? <Moon size={17} /> : <Palette size={17} />}
            </button>
            {themeMenuOpen && (
              <div className="theme-menu" role="menu" aria-label="界面主题">
                {THEME_OPTIONS.map((option) => (
                  <button
                    className={theme === option.value ? "active" : ""}
                    type="button"
                    role="menuitemradio"
                    aria-checked={theme === option.value}
                    key={option.value}
                    onClick={() => { setTheme(option.value); setThemeMenuOpen(false); }}
                  >
                    <span className={"theme-swatch " + option.value} />
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    {theme === option.value && <CheckCircle2 size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <a href="https://sudocode.chat/docs/image-api" target="_blank" rel="noreferrer" className="docs-link">
            API 文档 <ArrowUpRight size={14} />
          </a>
          <span className={`connection ${apiReady ? "online" : apiReady === false ? "offline" : "checking"}`}>
            <span className="status-dot" />
            {apiReady ? "API 已就绪" : apiReady === false ? "等待配置" : "检查连接"}
          </span>
        </div>
      </header>
      <div className={"activity-banner " + activityTone} role="status" aria-live="polite">
        {(loading || promptIdeasLoading || storyboardLoading || batchGenerating || poetryLoading || poetrySingleGenerating || poetryBatchGenerating) && <LoaderCircle className="spin" size={15} />}
        {!(loading || promptIdeasLoading || storyboardLoading || batchGenerating || poetryLoading || poetrySingleGenerating || poetryBatchGenerating) && activityTone === "success" && <CheckCircle2 size={15} />}
        <span>{activityStatus}</span>
      </div>

      <section className="workspace" aria-label="图片生成工作台">
        <aside className="control-panel">
          <div className="mode-switch" role="tablist" aria-label="工作模式">
            <button className={mode === "generate" ? "active" : ""} onClick={() => switchMode("generate")} role="tab" aria-selected={mode === "generate"}>
              <Sparkles size={16} /> 生成
            </button>
            <button className={mode === "edit" ? "active" : ""} onClick={() => switchMode("edit")} role="tab" aria-selected={mode === "edit"}>
              <Eraser size={16} /> 编辑
            </button>
          </div>

          <form onSubmit={submit} className="prompt-form">
            <div className="upload-stack">
                <input ref={sourceInput} type="file" accept="image/*" multiple onChange={selectReferenceImages} hidden />
                {referenceImages.length ? (
                  <div className="reference-previews">
                    {referenceImages.map((image, index) => (
                      <div className="file-preview" key={image.preview}>
                        <img src={image.preview} alt={`参考图片 ${index + 1} 预览`} />
                        <div><strong>参考图 {index + 1}：{image.file.name}</strong><span>{Math.ceil(image.file.size / 1024)} KB</span></div>
                        <button type="button" className="icon-button small" onClick={() => clearReferenceImage(index)} title={`移除参考图 ${index + 1}`} aria-label={`移除参考图 ${index + 1}`}><X size={15} /></button>
                      </div>
                    ))}
                    {referenceImages.length < MAX_REFERENCE_IMAGES && <button type="button" className="add-reference" onClick={() => sourceInput.current?.click()}><Plus size={15} /> 再添加参考图（{referenceImages.length} / {MAX_REFERENCE_IMAGES}）</button>}
                  </div>
                ) : (
                  <button type="button" className="upload-zone" onClick={() => sourceInput.current?.click()}>
                    <ImagePlus size={19} />
                    <span>{sourceTitle}</span>
                    <small>可一次选择多张，最多 {MAX_REFERENCE_IMAGES} 张，每张最大 20 MB，总计最大 50 MB</small>
                  </button>
                )}
                {mode === "generate" && referenceImages.length > 0 && <p className="reference-note">已启用 {referenceImages.length} 张参考图，会通过图片编辑接口生成结果。</p>}

                <input ref={maskInput} type="file" accept="image/*" onChange={selectMask} hidden />
                {maskPreview ? (
                  <div className="file-preview muted-preview">
                    <img src={maskPreview} alt="遮罩图片预览" />
                    <div><strong>遮罩：{maskFile?.name}</strong><span>白色区域将被编辑</span></div>
                    <button type="button" className="icon-button small" onClick={clearMask} title="移除遮罩" aria-label="移除遮罩"><X size={15} /></button>
                  </div>
                ) : (
                  <button type="button" className="mask-link" onClick={() => maskInput.current?.click()}>
                    <Plus size={15} /> 添加可选编辑遮罩
                  </button>
                )}
            </div>

            <div className="field-label-row">
              <label className="field-label" htmlFor="prompt">提示词</label>
              <div className="prompt-label-actions">
                <button className="save-prompt-button" type="button" onClick={saveCurrentPrompt} title="保存到提示词库"><Plus size={13} /> 保存</button>
              </div>
            </div>
            <div className="prompt-box">
              <textarea id="prompt" value={prompt} onChange={(event) => handlePromptChange(event.target.value)} placeholder={referenceImages.length || mode === "edit" ? "描述希望保留或修改什么，例如：把天空换成黄昏..." : "描述你想生成的画面、风格和细节..."} rows={7} />
              <span>{prompt.length} / 4000</span>
            </div>

            <div className="settings-block">
              <label className="field-label" htmlFor="size">画幅</label>
              <div className="select-wrap">
                <select id="size" value={size} onChange={(event) => setSize(event.target.value)}>
                  {SIZES.map((option) => <option key={option.value} value={option.value}>{option.name} - {option.detail}</option>)}
                </select>
                <ChevronDown size={16} />
              </div>
              <div className={`ratio-preview ratio-${selectedSize.value.replace("x", "-")}`} aria-label={`当前画幅：${selectedSize.name}`} />
            </div>
            {referenceImages.length > 0 && <p className="reference-note canvas-note">参考图仅提供内容和风格参考，输出将按所选画幅生成。</p>}

            {error && <p className="form-error" role="alert">{error}</p>}
            {!apiReady && <p className="setup-note"><KeyRound size={15} /> <button className="setup-link" type="button" onClick={openApiSettings}>配置 API Key</button></p>}

            <button className="generate-button" type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
              {loading ? "正在生成..." : actionLabel}
            </button>
          </form>

          <section className="prompt-hotlist" aria-label="今日提示词热榜">
            <div className="hotlist-heading">
              <span>今日提示词热榜</span>
              <div className="hotlist-meta">
                <small>{hotlistDate}</small>
                <button
                  className="hotlist-refresh"
                  type="button"
                  onClick={() => {
                    setHotlistRefreshIndex((value) => value + 1);
                    setPromptIdeasStatus("已刷新今日提示词。");
                  }}
                  title="刷新今日提示词"
                  aria-label="刷新今日提示词"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  className="hotlist-generate"
                  type="button"
                  onClick={handleGeneratePromptIdeas}
                  disabled={promptIdeasLoading}
                >
                  {promptIdeasLoading ? <LoaderCircle className="spin" size={13} /> : <WandSparkles size={13} />}
                  {promptIdeasLoading ? "正在生成" : "生成新灵感"}
                </button>
              </div>
            </div>
            {promptIdeasStatus && <p className={`hotlist-status ${promptIdeasLoading ? "is-loading" : ""}`} role="status" aria-live="polite">{promptIdeasStatus}</p>}
            <div className="hotlist-list">
              {dailyPrompts.map((item, index) => (
                <button key={item.id} type="button" className="hotlist-item" onClick={() => setPrompt(item.prompt)}>
                  <span className="hotlist-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="hotlist-copy"><strong>{item.title}</strong><small>{item.category} · {SIZES.find((option) => option.value === item.size)?.detail}</small><em>{item.prompt}</em></span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-heading">
            <div><span className="eyebrow">输出</span><h1>{current ? "最新生成结果" : "创作画布"}</h1></div>
            {current && <DownloadButton src={current.src} filename={current.fileName || "image-assistant.png"} />}
          </div>
          <div className={`canvas ${current ? "has-result" : ""}`}>
            {loading ? (
              <div className="loading-state">
                <span className="loader-ring"><Sparkles size={23} /></span>
                <strong>{executionStage === "processing" ? "正在等待图片服务响应" : "正在准备图片请求"}</strong>
                <p>已等待 {elapsedSeconds} 秒。终端中可用同次请求的日志查看详细状态。</p>
                <ol className="progress-list">
                  {executionSteps.map((step, index) => <li key={step.id} className={index < activeStep ? "done" : index === activeStep ? "active" : ""}>{step.label}</li>)}
                </ol>
              </div>
              ) : current ? (
                <figure className="result-frame">
                  {failedImageSources.has(current.src) ? (
                    <div className="image-load-error" role="alert"><strong>图片加载失败</strong><button type="button" onClick={() => retryImage(current.src)}><RefreshCw size={14} /> 重新加载</button></div>
                  ) : (
                    <button className="result-preview-trigger" type="button" onClick={() => openPreview(current)} aria-label="预览生成图片">
                      <img key={`${current.id}-${imageRetries[current.src] || 0}`} src={getImageSource(current.src)} data-image-source={current.src} alt={current.prompt} onError={handleImageError} />
                    </button>
                  )}
                  <figcaption><span>{current.kind === "generate" ? "生成" : "编辑"} · {formatTime(current.createdAt)}</span><p>{current.prompt}</p></figcaption>
                </figure>
            ) : (
              <div className="empty-state"><span className="empty-icon"><Sparkles size={26} /></span><strong>{emptyTitle}</strong><p>填写提示词，然后在这里查看生成结果。</p></div>
            )}
          </div>

          <section className="history-section">
            <div className="history-heading"><div><span className="eyebrow">本地图库</span><h2>图片合集</h2></div>{historyLoading ? <span>正在读取</span> : history.length > 0 && <span>{history.length} 张图片</span>}</div>
              {history.length ? (
                <div className="gallery-groups">
                  {groupedHistory.map((group) => (
                    <section className="gallery-group" key={group.key}>
                      {(() => {
                        const groupCollapsed = collapsedGalleryGroups.has(group.key);
                        return (
                          <>
                            <div className="gallery-group-heading">
                              <button className="gallery-group-toggle" type="button" onClick={() => toggleGalleryGroup(group.key)} aria-expanded={!groupCollapsed}>
                                <ChevronDown size={16} className={groupCollapsed ? "is-collapsed" : ""} />
                                <strong>{group.title}</strong>
                              </button>
                              <span>{group.nodes.reduce((total, node) => total + node.items.length, 0)} 张</span>
                            </div>
                            {!groupCollapsed && <div className="gallery-node-groups">
                              {group.nodes.map((node) => (
                                <section className="gallery-node-group" key={node.key}>
                                  {(() => {
                                    const nodeStateKey = `${group.key}:${node.key}`;
                                    const nodeCollapsed = collapsedGalleryNodes.has(nodeStateKey);
                                    return (
                                      <>
                                        <div className="gallery-node-heading">
                                          <button className="gallery-node-toggle" type="button" onClick={() => toggleGalleryNode(nodeStateKey)} aria-expanded={!nodeCollapsed}>
                                            <ChevronDown size={14} className={nodeCollapsed ? "is-collapsed" : ""} />
                                            <strong>{node.nodeOrder === null ? node.title : `${String(node.nodeOrder).padStart(2, "0")} · ${node.title}`}</strong>
                                          </button>
                                          <span>{node.items.length} 张</span>
                                        </div>
                                        {!nodeCollapsed && <div className="history-grid">{node.items.map(renderHistoryItem)}</div>}
                                      </>
                                    );
                                  })()}
                                </section>
                              ))}
                            </div>}
                          </>
                        );
                      })()}
                    </section>
                  ))}
                </div>
            ) : (
              <div className="history-empty"><Clock3 size={18} /> 还没有已保存的图片。</div>
            )}
          </section>
          <footer><span>Powered by gpt-image-2</span><span>图片已保存到桌面 Image-Assisant 文件夹</span></footer>
        </section>
        <aside className="extension-rail" aria-label="扩展功能">
          <button className="extension-tool active" type="button" onClick={() => setStyleWorkbenchOpen(true)} title="从图片提取风格" aria-label="从图片提取风格" data-label="从图片提取风格">
            <WandSparkles size={20} />
            <span className="extension-tool-label">提取风格</span>
          </button>
          <button className="extension-tool" type="button" onClick={() => openManager("library")} title="提示词库" aria-label="打开提示词库" data-label="提示词库">
            <Search size={20} />
            <span className="extension-tool-label">提示词库</span>
          </button>
          <button className="extension-tool" type="button" onClick={() => openManager("series")} title="系列创作" aria-label="打开系列创作" data-label="系列创作">
            <FolderKanban size={20} />
            <span className="extension-tool-label">系列创作</span>
          </button>
          <button className="extension-tool" type="button" onClick={openPoetryWorkbench} title="诗词意境" aria-label="打开诗词意境工作台" data-label="诗词意境">
            <BookOpen size={20} />
            <span className="extension-tool-label">诗词意境</span>
          </button>
          <button className="extension-tool" type="button" onClick={openApiSettings} title="配置 API" aria-label="打开 API 配置" data-label="API 配置">
            <KeyRound size={20} />
            <span className="extension-tool-label">API 配置</span>
          </button>
          <button className="extension-tool planned" type="button" disabled title="反推提示词（规划中）" aria-label="反推提示词，规划中" data-label="反推提示词（规划中）">
            <Search size={20} />
            <span className="extension-tool-label">反推提示</span>
          </button>
          <button className="extension-tool planned" type="button" disabled title="画面变体（规划中）" aria-label="画面变体，规划中" data-label="画面变体（规划中）">
            <Palette size={20} />
            <span className="extension-tool-label">画面变体</span>
          </button>
          <button className="extension-tool planned" type="button" disabled title="更多扩展（规划中）" aria-label="更多扩展，规划中" data-label="更多扩展（规划中）">
            <Plus size={20} />
            <span className="extension-tool-label">更多</span>
          </button>
        </aside>
      </section>
      {poetryOpen && (
        <div className="poetry-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePoetryWorkbench(); }}>
          <section className="poetry-dialog" role="dialog" aria-modal="true" aria-label="诗词意境工作台">
            <div className="poetry-toolbar">
              <div><strong>诗词意境</strong><small>把诗句转换成连续画面，再按段生成图片</small></div>
              <button className="icon-button" type="button" onClick={closePoetryWorkbench} title="关闭诗词意境" aria-label="关闭诗词意境"><X size={18} /></button>
            </div>
            <div className="poetry-body">
              <section className="poetry-projects" aria-label="已保存诗词">
                <div className="poetry-projects-heading"><div><strong>已保存诗词</strong><small>{poetryProjects.length ? "选择后继续上次的分析、分镜和出图" : "每次分析或生成后会保存到数据库"}</small></div><button type="button" onClick={startNewPoetryProject}><Plus size={13} />新建</button></div>
                {poetryProjects.length > 0 && <div className="poetry-project-list">
                  {poetryProjects.slice(0, 8).map((project) => <button type="button" className={"poetry-project-item" + (activePoetryProjectId === project.id ? " active" : "")} key={project.id} onClick={() => void openSavedPoetryProject(project.id)}><span><strong>{project.title}</strong><small>{project.scenes?.length || 0} 段分镜 · {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString("zh-CN") : "已保存"}</small></span><ChevronDown size={14} /></button>)}
                </div>}
                <p className="poetry-project-status" role="status">{poetryProjectSaving ? "正在保存项目..." : poetryProjectStatus}</p>
              </section>
              <div className="poetry-input-section">
                <label htmlFor="poem-input">诗词原文</label>
                <textarea id="poem-input" value={poemText} onChange={(event) => handlePoemTextChange(event.target.value)} placeholder="粘贴整首诗词或多句诗文，例如：春江潮水连海平，海上明月共潮生……" rows={5} />
                <p className="poetry-collection-note"><FolderKanban size={14} />图片合集：{getPoetryCollectionName(poemText)}</p>
                <label htmlFor="poetry-prompt-supplement">整体提示词补充</label>
                <textarea id="poetry-prompt-supplement" value={poetryPromptSupplement} onChange={(event) => setPoetryPromptSupplement(event.target.value)} placeholder="例如：真实感手机，90年代摄像机真实拍摄效果，35mm复古胶片实拍质感" rows={3} />
                <div className="poetry-actions">
                  <label htmlFor="poetry-scene-count">画面段数</label>
                  <select id="poetry-scene-count" value={poetrySceneCount} onChange={(event) => setPoetrySceneCount(Number(event.target.value))}>
                    {[3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} 段{count === 6 ? "（默认）" : ""}</option>)}
                  </select>
                  <span className="poetry-scene-recommendation" role="status">推荐 {poetrySceneRecommendation.count} 段：{poetrySceneRecommendation.reason}</span>
                  {poetrySceneCount !== poetrySceneRecommendation.count && <button type="button" className="poetry-recommendation-button" onClick={() => setPoetrySceneCount(poetrySceneRecommendation.count)} title="采用推荐的分段数量"><CheckCircle2 size={13} />采用推荐</button>}
                  <label htmlFor="poetry-image-size">图片比例</label>
                  <select id="poetry-image-size" value={size} onChange={(event) => setSize(event.target.value)}>
                    {SIZES.map((option) => <option key={option.value} value={option.value}>{option.name} · {option.detail}</option>)}
                  </select>
                  <button type="button" onClick={() => void analyzePoem()} disabled={poetryLoading || poetrySingleGenerating || poetryBatchGenerating}>{poetryLoadingAction === "analysis" ? <LoaderCircle className="spin" size={14} /> : <BookOpen size={14} />}{poetryLoadingAction === "analysis" ? "正在分析" : poetryAnalysis ? "重新分析诗词意境" : "分析诗词意境"}</button>
                  <button type="button" className="primary" onClick={() => void generatePoetryStoryboard()} disabled={!poetryAnalysis || poetryLoading || poetrySingleGenerating || poetryBatchGenerating}>{poetryLoadingAction === "storyboard" ? <LoaderCircle className="spin" size={14} /> : <WandSparkles size={14} />}{poetryLoadingAction === "storyboard" ? "正在生成分镜" : "生成分镜提示词"}</button>
                  <button type="button" onClick={() => void generateAllPoetryScenes()} disabled={!poetryScenes.length || poetryLoading || poetrySingleGenerating || poetryBatchGenerating}>{poetryBatchGenerating ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}{poetryBatchGenerating ? "正在批量生成" : "批量生成全部"}</button>
                </div>
              </div>
              <section className="poetry-workflow" aria-label="诗词创作进度" aria-live="polite">
                <div className="poetry-workflow-steps">
                  {poetryWorkflowSteps.map((step, index) => (
                    <div className={"poetry-workflow-step " + step.state} key={step.key}>
                      <span className="poetry-workflow-indicator" aria-hidden="true">
                        {step.state === "active" && <LoaderCircle className="spin" size={14} />}
                        {step.state === "done" && <CheckCircle2 size={14} />}
                        {step.state === "error" && <CircleAlert size={14} />}
                        {step.state === "pending" && index + 1}
                      </span>
                      <div><strong>{step.label}</strong><small>{step.detail}</small></div>
                    </div>
                  ))}
                </div>
                {poetryImageProgress.status !== "idle" && poetryImageProgress.total > 0 && (
                  <div className="poetry-image-progress">
                    <div className="poetry-image-progress-heading"><span>图片处理进度</span><strong>{poetryImageProgress.completed} / {poetryImageProgress.total}</strong></div>
                    <div className="poetry-image-progress-track" role="progressbar" aria-label="图片处理进度" aria-valuemin={0} aria-valuemax={poetryImageProgress.total} aria-valuenow={poetryImageProgress.completed}><span style={{ width: poetryImageProgressPercent + "%" }} /></div>
                  </div>
                )}
                {(poetryStatus || poetryProgress) && <div className="poetry-workflow-message">
                  {poetryStatus && <p>{poetryStatus}</p>}
                  {poetryProgress && <small>{poetryProgress}</small>}
                </div>}
              </section>
              {poetryAnalysis && (
                <section className="poetry-analysis" aria-labelledby="poetry-analysis-heading">
                  <div className="poetry-analysis-heading">
                    <div><strong id="poetry-analysis-heading">意境分析</strong><small>可直接修改，分镜会以这里确认的内容为准</small></div>
                    <span>{(poetryAnalysis.lineReadings || []).length} 段逐句理解</span>
                  </div>
                  <div className="poetry-analysis-meta">
                    <label>题目<input value={poetryAnalysis.title} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, title: event.target.value } : analysis)} /></label>
                    <label>作者<input value={poetryAnalysis.author} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, author: event.target.value } : analysis)} /></label>
                    <label>朝代<input value={poetryAnalysis.dynasty} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, dynasty: event.target.value } : analysis)} /></label>
                  </div>
                  <div className="poetry-analysis-grid">
                    <label className="poetry-analysis-field">体裁<input value={poetryAnalysis.genre} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, genre: event.target.value } : analysis)} placeholder="如：七言律诗、词" /></label>
                    <label className="poetry-analysis-field wide">标签<input value={(poetryAnalysis.tags || []).join("，")} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, tags: event.target.value.split(/[,，、]/u).map((item) => item.trim()).filter(Boolean) } : analysis)} placeholder="用逗号分隔，如：写景、怀古、抒情" /></label>
                    <label className="poetry-analysis-field">主题<textarea value={poetryAnalysis.theme} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, theme: event.target.value } : analysis)} rows={2} /></label>
                    <label className="poetry-analysis-field wide">整体解读<textarea value={poetryAnalysis.overview} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, overview: event.target.value } : analysis)} rows={4} /></label>
                    <label className="poetry-analysis-field wide">译文<textarea value={poetryAnalysis.translation} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, translation: event.target.value } : analysis)} rows={4} /></label>
                    <label className="poetry-analysis-field wide">创作背景<textarea value={poetryAnalysis.creationBackground} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, creationBackground: event.target.value } : analysis)} rows={3} /></label>
                    <label className="poetry-analysis-field wide">历史语境<textarea value={poetryAnalysis.historicalContext} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, historicalContext: event.target.value } : analysis)} rows={3} /></label>
                    <label className="poetry-analysis-field">时空背景<textarea value={poetryAnalysis.timeAndPlace} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, timeAndPlace: event.target.value } : analysis)} rows={3} /></label>
                    <label className="poetry-analysis-field">情绪变化<textarea value={poetryAnalysis.emotionalArc} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, emotionalArc: event.target.value } : analysis)} rows={3} /></label>
                    <label className="poetry-analysis-field wide">结构分析<textarea value={poetryAnalysis.structureAnalysis} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, structureAnalysis: event.target.value } : analysis)} rows={3} /></label>
                    <label className="poetry-analysis-field wide">表现手法<textarea value={poetryAnalysis.literaryDevices} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, literaryDevices: event.target.value } : analysis)} rows={3} /></label>
                    <label className="poetry-analysis-field wide">整体赏析<textarea value={poetryAnalysis.appreciation} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, appreciation: event.target.value } : analysis)} rows={4} /></label>
                    <label className="poetry-analysis-field wide">核心意象<input value={(poetryAnalysis.coreImagery || []).join("，")} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, coreImagery: event.target.value.split(/[,，、]/u).map((item) => item.trim()).filter(Boolean) } : analysis)} placeholder="用逗号分隔" /></label>
                  </div>
                  <div className="poetry-sensory-analysis">
                    <strong>感官与镜头线索</strong>
                    <label>视觉<textarea value={poetryAnalysis.sensoryDetails?.visual || ""} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, sensoryDetails: { ...DEFAULT_POETRY_ANALYSIS.sensoryDetails, ...(analysis.sensoryDetails || {}), visual: event.target.value } } : analysis)} rows={2} /></label>
                    <label>听觉<textarea value={poetryAnalysis.sensoryDetails?.auditory || ""} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, sensoryDetails: { ...DEFAULT_POETRY_ANALYSIS.sensoryDetails, ...(analysis.sensoryDetails || {}), auditory: event.target.value } } : analysis)} rows={2} /></label>
                    <label>空间<textarea value={poetryAnalysis.sensoryDetails?.spatial || ""} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, sensoryDetails: { ...DEFAULT_POETRY_ANALYSIS.sensoryDetails, ...(analysis.sensoryDetails || {}), spatial: event.target.value } } : analysis)} rows={2} /></label>
                    <label>时间与光线<textarea value={poetryAnalysis.sensoryDetails?.temporal || ""} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, sensoryDetails: { ...DEFAULT_POETRY_ANALYSIS.sensoryDetails, ...(analysis.sensoryDetails || {}), temporal: event.target.value } } : analysis)} rows={2} /></label>
                  </div>
                  <div className="poetry-annotations">
                    <strong>重点注释</strong>
                    {(poetryAnalysis.annotations || []).map((annotation, index) => <div className="poetry-annotation" key={index}><input aria-label={"注释词语 " + (index + 1)} value={annotation.term} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, annotations: (analysis.annotations || []).map((item, itemIndex) => itemIndex === index ? { ...item, term: event.target.value } : item) } : analysis)} /><textarea aria-label={annotation.term + "注释"} value={annotation.explanation} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, annotations: (analysis.annotations || []).map((item, itemIndex) => itemIndex === index ? { ...item, explanation: event.target.value } : item) } : analysis)} rows={2} /></div>)}
                  </div>
                  <div className="poetry-line-readings">
                    <strong>逐句理解</strong>
                    {(poetryAnalysis.lineReadings || []).map((reading, index) => (
                      <div className="poetry-line-reading" key={index}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <label>原句<input value={reading.sourceLine} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, lineReadings: analysis.lineReadings.map((item, itemIndex) => itemIndex === index ? { ...item, sourceLine: event.target.value } : item) } : analysis)} /></label>
                        <label>释义<textarea value={reading.meaning} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, lineReadings: analysis.lineReadings.map((item, itemIndex) => itemIndex === index ? { ...item, meaning: event.target.value } : item) } : analysis)} rows={2} /></label>
                        <label>情绪<textarea value={reading.emotion} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, lineReadings: analysis.lineReadings.map((item, itemIndex) => itemIndex === index ? { ...item, emotion: event.target.value } : item) } : analysis)} rows={2} /></label>
                        <label>视觉重点<textarea value={reading.visualFocus} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, lineReadings: analysis.lineReadings.map((item, itemIndex) => itemIndex === index ? { ...item, visualFocus: event.target.value } : item) } : analysis)} rows={2} /></label>
                      </div>
                    ))}
                  </div>
                  <div className="poetry-analysis-notes">
                    <strong>典故与存疑</strong>
                    {(poetryAnalysis.allusions || []).map((allusion, index) => (
                      <div className="poetry-allusion" key={index}>
                        <input aria-label={"典故 " + (index + 1)} value={allusion.sourceText} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, allusions: analysis.allusions.map((item, itemIndex) => itemIndex === index ? { ...item, sourceText: event.target.value } : item) } : analysis)} />
                        <textarea aria-label={allusion.sourceText + "解释"} value={allusion.explanation} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, allusions: analysis.allusions.map((item, itemIndex) => itemIndex === index ? { ...item, explanation: event.target.value } : item) } : analysis)} rows={2} />
                        <select aria-label={allusion.sourceText + "可信度"} value={allusion.confidence} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, allusions: analysis.allusions.map((item, itemIndex) => itemIndex === index ? { ...item, confidence: event.target.value as PoetryAllusion["confidence"] } : item) } : analysis)}><option value="high">高可信</option><option value="medium">中可信</option><option value="low">低可信</option></select>
                      </div>
                    ))}
                    <label>存疑点<textarea value={(poetryAnalysis.uncertainties || []).join("\n")} onChange={(event) => setPoetryAnalysis((analysis) => analysis ? { ...analysis, uncertainties: event.target.value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) } : analysis)} rows={3} /></label>
                  </div>
                </section>
              )}
              {(poetryStyleGuide || poetryCharacterBible || poetryContinuityGuide) && <div className="poetry-continuity-panel">
                <div className="poetry-style-guide"><strong>统一视觉：</strong>{poetryStyleGuide || "未设置"}</div>
                <label><span>角色设定锁</span><textarea aria-label="角色设定锁" value={poetryCharacterBible} onChange={(event) => setPoetryCharacterBible(event.target.value)} rows={3} placeholder="固定人物外貌、服装、发型、配饰和道具" /></label>
                <label><span>连续性规则</span><textarea aria-label="连续性规则" value={poetryContinuityGuide} onChange={(event) => setPoetryContinuityGuide(event.target.value)} rows={3} placeholder="规定后续画面必须继承的设定" /></label>
              </div>}
              {poetryScenes.length > 0 && <div className="poetry-scene-list">
                {poetryScenes.map((scene, index) => {
                  const generationState = poetrySceneGenerationStates[scene.sceneOrder];
                  return (
                    <article className={"poetry-scene" + (generationState ? " generation-" + generationState.status : "")} key={scene.sceneOrder + "-" + scene.title}>
                      <div className="poetry-scene-heading"><span>{String(scene.sceneOrder).padStart(2, "0")}</span><strong>{scene.title}</strong><button type="button" onClick={() => void generateOnePoetryScene(scene)} disabled={poetryLoading || poetrySingleGenerating || poetryBatchGenerating} title={(generationState?.status === "error" ? "重新生成" : "生成") + scene.title} aria-label={(generationState?.status === "error" ? "重新生成" : "生成") + scene.title}>{generationState?.status === "running" ? <LoaderCircle className="spin" size={14} /> : generationState?.status === "error" ? <RotateCcw size={14} /> : <Sparkles size={14} />}</button></div>
                      <p className="poetry-source">{scene.sourceLine}</p>
                      <p className="poetry-mood">{scene.mood}</p>
                      <textarea aria-label={scene.title + "画面提示词"} value={scene.prompt} onChange={(event) => setPoetryScenes((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} rows={4} />
                      {generationState && <div className={"poetry-scene-generation-status " + generationState.status}>
                        {generationState.status === "running" && <LoaderCircle className="spin" size={13} />}
                        {generationState.status === "success" && <CheckCircle2 size={13} />}
                        {generationState.status === "error" && <CircleAlert size={13} />}
                        {generationState.status === "waiting" && <Clock3 size={13} />}
                        <span>{generationState.message}</span>
                        {generationState.status === "error" && <button type="button" onClick={() => void generateOnePoetryScene(scene)} disabled={poetryLoading || poetrySingleGenerating || poetryBatchGenerating}><RotateCcw size={12} />重新生成</button>}
                      </div>}
                    </article>
                  );
                })}
              </div>}
              {!poetryAnalysis && !poetryLoading && <p className="poetry-empty">输入诗词后点击“分析诗词意境”。</p>}
              {!poetryAnalysis && poetryScenes.length > 0 && !poetryLoading && <p className="poetry-legacy-analysis-note">当前项目只有旧版分镜提示词。点击“分析诗词意境”后，会补齐译文、注释、创作背景、结构分析、表现手法和赏析等栏目。</p>}
              {poetryAnalysis && !poetryScenes.length && !poetryLoading && <p className="poetry-empty">检查上方分析内容，确认后点击“生成分镜提示词”。</p>}
            </div>
          </section>
        </div>
      )}
      {apiSettingsOpen && (
        <div className="api-settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeApiSettings(); }}>
          <section className="api-settings-dialog" role="dialog" aria-modal="true" aria-label="API 配置">
            <div className="api-settings-toolbar">
              <div><strong>API 配置</strong><span role="status">{apiKeyStatus}</span></div>
              <button className="icon-button" type="button" onClick={closeApiSettings} title="关闭 API 配置" aria-label="关闭 API 配置"><X size={18} /></button>
            </div>
            <form className="api-settings-form" onSubmit={(event) => void saveApiKeyConfiguration(event)}>
              <label htmlFor="api-key-input">访问密钥</label>
              <div className="api-key-input-wrap">
                <input id="api-key-input" type={apiKeyVisible ? "text" : "password"} value={apiKeyInput} onChange={(event) => setApiKeyInput(event.target.value)} placeholder="粘贴 API Key" autoComplete="off" autoFocus spellCheck={false} />
                <button className="icon-button" type="button" onClick={() => setApiKeyVisible((visible) => !visible)} title={apiKeyVisible ? "隐藏密钥" : "显示密钥"} aria-label={apiKeyVisible ? "隐藏密钥" : "显示密钥"}>{apiKeyVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
              {apiKeyError && <p className="api-settings-error" role="alert">{apiKeyError}</p>}
              <button className="api-settings-save" type="submit" disabled={!apiKeyInput.trim() || apiKeySaving}>{apiKeySaving ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}{apiKeySaving ? "正在保存" : "保存并启用"}</button>
            </form>
          </section>
        </div>
      )}
      {(libraryOpen || managerClosing === "library") && (
        <div className={`manager-backdrop${managerClosing === "library" ? " closing" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeManager("library"); }}>
          <section className="manager-dialog" role="dialog" aria-modal="true" aria-label="提示词库">
            <div className="manager-toolbar"><strong>提示词库</strong><button className="icon-button" type="button" onClick={() => closeManager("library")} title="关闭提示词库" aria-label="关闭提示词库"><X size={18} /></button></div>
            <div className="manager-body">
              <div className="manager-search"><Search size={15} /><input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadLibraryPrompts(); }} placeholder="搜索标题、分类或内容" /><button type="button" onClick={() => void loadLibraryPrompts()}>搜索</button></div>
              <div className="manager-actions"><button type="button" onClick={saveCurrentPrompt}><Plus size={14} /> 保存当前提示词</button><span role="status">{libraryStatus}</span></div>
              <div className="library-list">
                {libraryPrompts.map((item) => <article className="library-item" key={item.id}><button type="button" className="library-content" onClick={() => { setPrompt(item.content); closeManager("library"); }}><strong>{item.title}</strong><small>{item.category}</small><p>{item.content}</p></button><button type="button" className="icon-button small" onClick={() => void removeLibraryPrompt(item.id)} title="删除提示词" aria-label={"删除提示词：" + item.title}><Trash2 size={14} /></button></article>)}
                {!libraryPrompts.length && <p className="manager-empty">暂无已保存提示词。可以先保存当前提示词。</p>}
              </div>
            </div>
          </section>
        </div>
      )}
      {(seriesOpen || managerClosing === "series") && (
        <div className={`manager-backdrop${managerClosing === "series" ? " closing" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeManager("series"); }}>
          <section className="manager-dialog" role="dialog" aria-modal="true" aria-label="系列创作">
            <div className="manager-toolbar"><strong>系列创作</strong><button className="icon-button" type="button" onClick={() => closeManager("series")} title="关闭系列创作" aria-label="关闭系列创作"><X size={18} /></button></div>
            <div className="manager-body series-manager">
              <div className="manager-search"><input value={newSeriesName} onChange={(event) => setNewSeriesName(event.target.value)} placeholder="新系列名称" /><button type="button" onClick={() => void createNewSeries()}><Plus size={14} /> 创建系列</button></div>
              {activeSeries && <div className="storyboard-form"><textarea value={storyText} onChange={(event) => setStoryText(event.target.value)} placeholder="粘贴志怪故事原文或故事梗概，程序会自动拆分成连续画面节点。" rows={5} /><div><button type="button" onClick={() => void createStoryboard()} disabled={storyboardLoading || seriesNodes.length > 0}>{storyboardLoading ? <LoaderCircle className="spin" size={14} /> : <WandSparkles size={14} />}{storyboardLoading ? "正在拆分" : "自动拆分故事"}</button><button type="button" onClick={() => void generateStoryboardImages()} disabled={batchGenerating || !seriesNodes.length}>{batchGenerating ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}{batchGenerating ? "正在批量生成" : "批量生成图片"}</button></div></div>}
              <div className="series-layout">
                <div className="series-list">{seriesList.map((series) => <button type="button" key={series.id} className={activeSeries?.id === series.id ? "series-entry active" : "series-entry"} onClick={() => void selectSeries(series)}><strong>{series.name}</strong><small>系列 #{series.id}</small></button>)}{!seriesList.length && <p className="manager-empty">暂无系列。</p>}</div>
                <div className="node-panel">
                  <div className="node-panel-heading"><strong>{activeSeries?.name || "请选择系列"}</strong>{activeSeries && <span>{seriesNodes.length} 个节点</span>}</div>
                  {activeSeries && <div className="manager-search"><input value={newNodeTitle} onChange={(event) => setNewNodeTitle(event.target.value)} placeholder="新故事节点名称" /><button type="button" onClick={() => void createNewNode()}><Plus size={14} /> 添加节点</button></div>}
                  <div className="node-list">{seriesNodes.map((node) => <button type="button" key={node.id} className={activeNode?.id === node.id ? "node-entry active" : "node-entry"} onClick={() => { setActiveNode(node); if (node.prompt) setPrompt(node.prompt); closeManager("series"); }}><span>{String(node.node_order).padStart(2, "0")}</span><strong>{node.title}</strong><small>{node.status}</small></button>)}</div>
                </div>
              </div>
              {seriesStatus && <p className="manager-status" role="status">{seriesStatus}</p>}
              {batchProgress && <p className="manager-status" role="status">{batchProgress}</p>}
            </div>
          </section>
        </div>
      )}
      <StyleWorkbench
        open={styleWorkbenchOpen}
        databaseConfigured={databaseConfigured}
        onClose={() => setStyleWorkbenchOpen(false)}
        onApplyPrompt={(nextPrompt) => {
          handlePromptChange(nextPrompt);
          setStyleWorkbenchOpen(false);
          setActivityStatus("风格提示词已应用，可以继续调整画幅或生成图片。");
          setActivityTone("success");
        }}
      />
      {preview && (
        <div className="image-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
          <section className="image-preview-dialog" role="dialog" aria-modal="true" aria-label="图片预览">
            <div className="image-preview-toolbar">
              <span>{preview.kind === "generate" ? "生成图片预览" : "编辑图片预览"}</span>
              <div className="image-preview-controls" aria-label="图片缩放控制">
                <button className="icon-button" type="button" onClick={() => changePreviewZoom(-0.25)} disabled={previewZoom <= 0.5} title="缩小图片" aria-label="缩小图片"><ZoomOut size={17} /></button>
                <span className="image-preview-zoom" aria-live="polite">{Math.round(previewZoom * 100)}%</span>
                <button className="icon-button" type="button" onClick={() => changePreviewZoom(0.25)} disabled={previewZoom >= 3} title="放大图片" aria-label="放大图片"><ZoomIn size={17} /></button>
                <button className="icon-button" type="button" onClick={() => setPreviewZoom(1)} disabled={previewZoom === 1} title="重置图片大小" aria-label="重置图片大小"><RotateCcw size={16} /></button>
                <button className="icon-button" type="button" onClick={closePreview} title="关闭预览" aria-label="关闭预览"><X size={18} /></button>
              </div>
            </div>
            <div
              ref={previewMediaRef}
              className={`image-preview-media${previewZoom > 1 ? " is-zoomed" : ""}`}
              onPointerDown={handlePreviewPointerDown}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={handlePreviewPointerUp}
              onPointerCancel={handlePreviewPointerUp}
            >
              {failedImageSources.has(preview.src) ? (
                <div className="image-load-error" role="alert"><strong>图片加载失败</strong><button type="button" onClick={() => retryImage(preview.src)}><RefreshCw size={14} /> 重新加载</button></div>
              ) : (
                <img key={`${preview.id}-${imageRetries[preview.src] || 0}`} src={getImageSource(preview.src)} data-image-source={preview.src} alt={preview.prompt} draggable={false} style={{ transform: `scale(${previewZoom})` }} onError={handleImageError} />
              )}
            </div>
            <p>{preview.prompt}</p>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
