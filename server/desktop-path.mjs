import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const executeFile = promisify(execFile);

export async function getDesktopAppDirectory({
  executeFileImpl = executeFile,
  platform = process.platform,
  homeDirectory = os.homedir()
} = {}) {
  let desktopDirectory = path.join(homeDirectory, "Desktop");

  if (platform === "win32") {
    // Windows known folders also support redirected or OneDrive-managed desktops.
    const result = await executeFileImpl("powershell.exe", [
      "-NoProfile",
      "-Command",
      "[Environment]::GetFolderPath('Desktop')"
    ]);
    desktopDirectory = result.stdout.trim() || desktopDirectory;
  }

  const directory = path.join(desktopDirectory, "Image-Assisant");
  await mkdir(directory, { recursive: true });
  return directory;
}
