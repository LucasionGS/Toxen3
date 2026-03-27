import type { ISong } from "./types.ts";

const DEFAULT_SERVER = "https://stream.toxen.net/api";

export interface ILoginResult {
  token: string;
  name: string;
  email: string;
  id: number;
  premium: boolean;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

/** Authenticate with the Toxen server and return user info including token. */
export async function remoteLogin(
  email: string,
  password: string,
  server = DEFAULT_SERVER
): Promise<ILoginResult> {
  const res = await fetch(`${server}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    const msg = (body?.["error"] as string) ?? `Login failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return body as unknown as ILoginResult;
}

/** Fetch the authenticated user's info from the server. */
export async function remoteWhoAmI(
  token: string,
  server = DEFAULT_SERVER
): Promise<ILoginResult> {
  const res = await fetch(`${server}/authenticated`, {
    headers: authHeaders(token),
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired. Please run `toxen login` again.");
    throw new Error((body?.["error"] as string) ?? `Request failed (HTTP ${res.status})`);
  }

  return body as unknown as ILoginResult;
}

/** Fetch the full song list from the remote server. */
export async function remoteFetchSongs(
  token: string,
  server = DEFAULT_SERVER
): Promise<ISong[]> {
  const res = await fetch(`${server}/track`, {
    headers: authHeaders(token),
  });

  const body = await res.json().catch(() => null) as unknown;

  if (!res.ok) {
    const errorMsg = (body as Record<string, unknown>)?.["error"] as string | undefined;
    if (res.status === 401) throw new Error("Session expired. Please run `toxen login` again.");
    if (res.status === 403) throw new Error("A premium subscription is required to access the remote library.");
    throw new Error(errorMsg ?? `Failed to fetch tracks (HTTP ${res.status})`);
  }

  return body as ISong[];
}

export { DEFAULT_SERVER };
