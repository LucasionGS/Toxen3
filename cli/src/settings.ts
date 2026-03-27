import { SETTINGS_FILE } from "./config.ts";
import type { ISettings } from "./types.ts";

/**
 * Reads and parses Toxen's `settings.json`.
 * Throws a descriptive error if the file is missing or malformed.
 */
export async function readSettings(overridePath?: string): Promise<ISettings> {
  const filePath = overridePath ?? SETTINGS_FILE;

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(
      `Settings file not found at: ${filePath}\n` +
        `Is Toxen installed and has it been run at least once?`
    );
  }

  try {
    return await file.json() as ISettings;
  } catch {
    throw new Error(`Failed to parse settings file at: ${filePath}`);
  }
}
