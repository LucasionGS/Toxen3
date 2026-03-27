import path from "node:path";
import os from "node:os";

/** Returns the platform-specific path to the `.toxenData3` directory. */
export function getToxenDataPath(): string;
export function getToxenDataPath(relativeFile: string): string;
export function getToxenDataPath(relativeFile?: string): string {
  let base: string;

  if (process.platform === "win32") {
    base = path.resolve(process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming"));
  } else if (process.platform === "darwin") {
    base = path.resolve(os.homedir(), "Library", "Preferences");
  } else {
    base = path.resolve(os.homedir(), ".local", "share");
  }

  const parts = [base, ".toxenData3"];
  if (relativeFile) parts.push(relativeFile);
  return path.join(...parts);
}

export const SETTINGS_FILE = getToxenDataPath("settings.json");
