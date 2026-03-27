import { getToxenDataPath } from "./config.ts";

const SESSION_FILE = getToxenDataPath("cli-session.json");

export interface ICliSession {
  token: string;
  email: string;
  name: string;
  server: string;
  savedAt: string;
}

export async function readSession(overridePath?: string): Promise<ICliSession | null> {
  const file = Bun.file(overridePath ?? SESSION_FILE);
  if (!(await file.exists())) return null;
  try {
    return await file.json() as ICliSession;
  } catch {
    return null;
  }
}

export async function writeSession(session: ICliSession, overridePath?: string): Promise<void> {
  await Bun.write(overridePath ?? SESSION_FILE, JSON.stringify(session, null, 2) + "\n");
}

export async function clearSession(overridePath?: string): Promise<void> {
  const file = Bun.file(overridePath ?? SESSION_FILE);
  if (await file.exists()) {
    const { unlink } = await import("node:fs/promises");
    await unlink(overridePath ?? SESSION_FILE);
  }
}

export { SESSION_FILE };
