import path from "node:path";
import { readdir, realpath, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const targetLabels = {
  jpg: "JPEG 图片",
  png: "PNG 图片",
  webp: "WebP 图片",
  avif: "AVIF 图片",
  bmp: "BMP 图片",
  tiff: "TIFF 图片",
  gif: "GIF 图片",
  ico: "ICO 图标",
  pdf: "PDF 文档",
  txt: "纯文本",
  md: "Markdown",
  docx: "Word 文档",
  xlsx: "Excel 表格",
  csv: "CSV 表格",
  pptx: "PowerPoint",
  odt: "OpenDocument 文档",
  ods: "OpenDocument 表格",
  odp: "OpenDocument 演示",
  rtf: "RTF 文档",
};
const aliases = { jpeg: "jpg", tif: "tiff", markdown: "md", text: "txt" };
const sourceFormats = new Set([
  ...Object.keys(targetLabels),
  "doc",
  "xls",
  "ppt",
  "heic",
  "heif",
]);
export function sourceFormat(name) {
  const ext = path.extname(name).slice(1).toLowerCase();
  const id = aliases[ext] || ext;
  return sourceFormats.has(id) ? id : null;
}
export function containedPath(directory, candidate) {
  const base = path.resolve(directory);
  const resolved = path.resolve(candidate);
  const relative = path.relative(base, resolved);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  )
    throw new Error("转换输出超出任务目录。");
  return resolved;
}
export function parseTargets(text) {
  const lines = text.split(/\r?\n/);
  const heading = lines.findIndex((line) => line.includes(" converts to:"));
  if (heading < 0)
    throw new Error("无法识别 Filee 的格式列表，请检查 CLI 版本。");
  const installed = [];
  for (const line of lines.slice(heading + 1)) {
    if (line.trim().startsWith("With optional engines")) break;
    for (const part of line.trim().split(/,\s*/)) {
      if (/^[a-z0-9]+$/.test(part) && targetLabels[part]) installed.push(part);
    }
  }
  return [...new Set(installed)];
}
export function parseConversion(text) {
  let report;
  try {
    report = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Filee 未返回有效的转换结果。");
  }
  const files = Array.isArray(report.files) ? report.files : [];
  const failures = files.filter(
    (f) => f.state === "failed" || f.state === "cancelled",
  );
  if (report.failed || failures.length)
    throw new Error(
      failures.map((f) => f.error || "转换失败").join("；") ||
        "Filee 转换失败。",
    );
  const outputs = files
    .flatMap((f) => (Array.isArray(f.outputs) ? f.outputs : []))
    .filter((p) => typeof p === "string");
  if (!outputs.length) throw new Error("转换未生成文件。");
  const warning = files
    .flatMap((f) => [
      f.notice,
      ...(Array.isArray(f.missingFonts) && f.missingFonts.length
        ? ["缺少字体：" + f.missingFonts.join("、")]
        : []),
    ])
    .filter(Boolean)
    .join("；");
  return { outputs, warning };
}
async function locateFilee() {
  if (process.env.FILEE_CLI_PATH) return process.env.FILEE_CLI_PATH;
  const tools = path.join(projectRoot, ".local", "tools", "filee");
  const names =
    process.platform === "win32"
      ? ["filee-cli.exe", "Filee.Cli.exe"]
      : ["filee-cli", "filee", "Filee.Cli"];
  async function visit(folder, depth) {
    try {
      const entries = await readdir(folder, { withFileTypes: true });
      for (const name of names) {
        const entry = entries.find(
          (e) => e.isFile() && e.name.toLowerCase() === name.toLowerCase(),
        );
        if (entry) return path.join(folder, entry.name);
      }
      if (depth > 0)
        for (const entry of entries.filter((e) => e.isDirectory())) {
          const found = await visit(path.join(folder, entry.name), depth - 1);
          if (found) return found;
        }
    } catch {}
    return null;
  }
  return (
    (await visit(tools, 3)) ||
    (process.platform === "win32" ? "filee-cli" : "filee")
  );
}
function run(binary, args, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "",
      failure;
    const timer = setTimeout(() => {
      failure = new Error("Filee 处理超时，请缩小文件或检查转换引擎。");
      child.kill();
    }, timeout);
    const collect = (kind, chunk) => {
      if (kind === "out") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
      if (stdout.length + stderr.length > 4 * 1024 * 1024) {
        failure = new Error("Filee 返回内容超出限制。");
        child.kill();
      }
    };
    child.stdout.on("data", (chunk) => collect("out", chunk));
    child.stderr.on("data", (chunk) => collect("err", chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else resolve({ code, stdout, stderr });
    });
  });
}
export class FileeAdapter {
  async status() {
    try {
      const binary = await locateFilee();
      const result = await run(binary, ["version"]);
      if (result.code !== 0 || !/^filee\s/i.test(result.stdout.trim()))
        throw new Error("CLI 无法运行");
      return {
        available: true,
        version: result.stdout.trim(),
        message: "本地转换引擎已就绪",
      };
    } catch {
      return {
        available: false,
        version: null,
        message:
          "尚未找到 Filee CLI。上传和阅读仍可使用；将便携版放入 .local/tools/filee，或设置 FILEE_CLI_PATH 后重启服务。",
      };
    }
  }
  async targets(name) {
    const format = sourceFormat(name);
    if (!format)
      return {
        targets: [],
        message: "此文件类型暂未接入转换，可保留原文件并下载。",
      };
    try {
      const binary = await locateFilee();
      const result = await run(binary, ["formats", format]);
      if (result.code !== 0)
        return {
          targets: [],
          message: "Filee 暂不支持此格式，或所需引擎不可用。",
        };
      const targets = parseTargets(result.stdout).map((id) => ({
        id,
        label: targetLabels[id],
      }));
      return {
        targets,
        message: targets.length
          ? "仅显示当前机器已安装引擎可用的格式。"
          : "当前没有可用转换目标。可在 Filee 中配置所需引擎后刷新。",
      };
    } catch (error) {
      if (error.code === "ENOENT")
        return { targets: [], message: "Filee CLI 尚未配置。" };
      throw error;
    }
  }
  async convert(input, output, target, quality = 85) {
    if (!targetLabels[target]) throw new Error("不支持的目标格式。");
    const binary = await locateFilee();
    const result = await run(
      binary,
      [
        "convert",
        input,
        "--to",
        target,
        "--output",
        output,
        "--quality",
        String(quality),
        "--json",
      ],
      10 * 60 * 1000,
    );
    if (result.code !== 0 && !result.stdout.trim())
      throw new Error(
        result.stderr.trim().slice(0, 1500) || "Filee 转换失败。",
      );
    const converted = parseConversion(result.stdout);
    if (result.code !== 0)
      throw new Error(
        result.stderr.trim().slice(0, 1500) || "Filee 未正常完成。",
      );
    const realOutput = await realpath(output);
    for (const candidate of converted.outputs) {
      containedPath(output, candidate);
      containedPath(realOutput, await realpath(candidate));
      if (!(await stat(candidate)).isFile())
        throw new Error("转换结果不是有效文件。");
    }
    return converted;
  }
}
