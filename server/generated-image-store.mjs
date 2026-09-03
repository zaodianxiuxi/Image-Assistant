import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const GENERATED_IMAGE_NAME = /^(?!\.{1,2}$)[^<>:"/\\|?*\u0000-\u001f]{1,160}\.png$/iu;

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return String(date.getFullYear()) + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function sanitizeName(value, fallback = "未命名图片") {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "")
    .replace(/\s+/gu, " ")
    .replace(/[. ]+$/u, "")
    .trim();
  return (cleaned || fallback).slice(0, 12);
}

function promptTitle(prompt) {
  const compact = String(prompt || "")
    .replace(/[，。；：、,.!?！？;:()[\]{}"'“”‘’]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return sanitizeName(compact);
}

function encodePath(relativePath) {
  return relativePath.split(path.sep).map(encodeURIComponent).join("/");
}

async function getImageBytes(item, fetchImpl) {
  if (typeof item?.b64_json === "string" && item.b64_json.trim()) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (typeof item?.url !== "string" || !item.url.trim()) {
    throw new Error("接口未返回可保存的图片数据。");
  }
  const response = await fetchImpl(item.url);
  if (!response.ok) throw new Error("下载上游图片失败（HTTP " + response.status + "）。");
  return Buffer.from(await response.arrayBuffer());
}

export function isSafeGeneratedImageFileName(fileName) {
  return typeof fileName === "string" && GENERATED_IMAGE_NAME.test(fileName);
}

async function writeUniqueImage(directory, baseName, bytes, seriesNode = false) {
  const stem = sanitizeName(baseName);
  for (let index = 1; index < 10000; index += 1) {
    const suffix = index === 1 ? "" : seriesNode ? "-v" + index : "-" + index;
    const fileName = stem + suffix + ".png";
    try {
      await writeFile(path.join(directory, fileName), bytes, { flag: "wx" });
      return fileName;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  throw new Error("同名图片过多，无法生成新的文件名。");
}

const OUTPUT_DIMENSIONS = {
  "1024x1024": [1024, 1024],
  "1536x864": [1536, 864],
  "864x1536": [864, 1536]
};

async function normalizeImageSize(bytes, size) {
  const dimensions = OUTPUT_DIMENSIONS[size];
  if (!dimensions) return bytes;
  try {
    return await sharp(bytes)
      .resize(dimensions[0], dimensions[1], { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  } catch {
    // Preserve the upstream bytes for non-image fixtures or unsupported formats.
    return bytes;
  }
}

export async function saveProviderImage({
  item,
  outputDirectory,
  fetchImpl = fetch,
  now = new Date(),
  title,
  prompt,
  seriesName,
  nodeOrder,
  size
}) {
  if (typeof outputDirectory !== "string" || !outputDirectory) {
    throw new Error("未配置本地图片保存目录。");
  }

  const imageBytes = await normalizeImageSize(await getImageBytes(item, fetchImpl), size);
  const dateDirectoryName = formatDate(now);
  const dateDirectory = path.join(outputDirectory, dateDirectoryName);
  const seriesDirectoryName = seriesName ? sanitizeName(seriesName, "未命名系列") : "";
  const targetDirectory = seriesDirectoryName ? path.join(dateDirectory, seriesDirectoryName) : dateDirectory;
  await mkdir(targetDirectory, { recursive: true });

  const titlePart = sanitizeName(title || promptTitle(prompt));
  const baseName = seriesName && Number.isInteger(nodeOrder)
    ? String(nodeOrder).padStart(2, "0") + "-" + titlePart
    : titlePart;
  const fileName = await writeUniqueImage(targetDirectory, baseName, imageBytes, Boolean(seriesName && nodeOrder));
  const relativePath = path.join(dateDirectoryName, ...(seriesDirectoryName ? [seriesDirectoryName] : []), fileName);

  return {
    fileName,
    relativePath,
    imageUrl: "/generated-images/" + encodePath(relativePath)
  };
}
