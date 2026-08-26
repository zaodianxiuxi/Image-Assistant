import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const GENERATED_IMAGE_NAME = /^\d{8}-\d{6}-[a-z0-9-]+\.png$/i;

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("")
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function getImageBytes(item, fetchImpl) {
  if (typeof item?.b64_json === "string" && item.b64_json.trim()) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (typeof item?.url !== "string" || !item.url.trim()) {
    throw new Error("接口未返回可保存的图片数据。");
  }

  // The provider URL is converted immediately so browser previews never depend on expiry.
  const response = await fetchImpl(item.url);
  if (!response.ok) throw new Error(`下载上游图片失败（HTTP ${response.status}）。`);
  return Buffer.from(await response.arrayBuffer());
}

export function isSafeGeneratedImageFileName(fileName) {
  return typeof fileName === "string" && GENERATED_IMAGE_NAME.test(fileName);
}

export async function saveProviderImage({
  item,
  outputDirectory,
  fetchImpl = fetch,
  now = new Date(),
  randomUuid = randomUUID
}) {
  if (typeof outputDirectory !== "string" || !outputDirectory) {
    throw new Error("未配置本地图片保存目录。");
  }

  const imageBytes = await getImageBytes(item, fetchImpl);
  const fileName = `${formatTimestamp(now)}-${randomUuid()}.png`;
  await mkdir(outputDirectory, { recursive: true });
  // wx prevents a rare UUID collision from replacing an existing generated image.
  await writeFile(path.join(outputDirectory, fileName), imageBytes, { flag: "wx" });

  return { fileName, imageUrl: `/generated-images/${fileName}` };
}
