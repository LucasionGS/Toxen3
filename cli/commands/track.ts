import { Command } from "commander";
import path from "node:path";
import { readSettings } from "../src/settings.ts";
import { readSession } from "../src/session.ts";
import { remoteFetchSongs, DEFAULT_SERVER } from "../src/remote.ts";
import { outputJson, c } from "../src/output.ts";
import type { ISong } from "../src/types.ts";

const ASSET_KEYS = ["audio", "background", "subtitles", "storyboard"] as const;
type AssetKey = typeof ASSET_KEYS[number];

const ASSET_PATH_MAP: Record<AssetKey, keyof ISong["paths"]> = {
  audio:      "media",
  background: "background",
  subtitles:  "subtitles",
  storyboard: "storyboard",
};

async function findSongLocally(uid: string, libraryDir: string): Promise<ISong | null> {
  const file = Bun.file(path.join(libraryDir, uid, "data.json"));
  if (!(await file.exists())) return null;
  try {
    return await file.json() as ISong;
  } catch {
    return null;
  }
}

async function findSongRemotely(
  uid: string,
  token: string,
  server: string
): Promise<ISong | null> {
  const songs = await remoteFetchSongs(token, server);
  return songs.find((s) => s.uid === uid) ?? null;
}

export function registerTrackCommand(program: Command): void {
  program
    .command("track <uid> [asset]")
    .description(
      "Resolve the path or URL for a track asset.\n" +
      `Assets: ${ASSET_KEYS.join(", ")} (default: audio)\n` +
      "Outputs a local filesystem path by default, or a remote URL with --remote."
    )
    .option("--remote", "Output a remote URL (with auth token) instead of a local path")
    .option("--token <token>", "Auth token for remote (overrides saved session)")
    .option("--server <url>", "Remote server URL (overrides saved session)")
    .option("--library <path>", "Override local library directory")
    .option("--json", "Output result as JSON")
    .action(async (uid: string, assetArg: string | undefined, opts: {
      remote?: boolean;
      token?: string;
      server?: string;
      library?: string;
      json?: boolean;
    }) => {
      const asset: AssetKey = (assetArg as AssetKey) ?? "audio";

      if (!ASSET_KEYS.includes(asset)) {
        console.error(
          `${c.yellow}Unknown asset "${asset}".${c.reset} ` +
          `Valid assets: ${ASSET_KEYS.join(", ")}`
        );
        process.exit(1);
      }

      const pathKey = ASSET_PATH_MAP[asset];

      // ── Resolve song metadata ──────────────────────────────────────────────
      let song: ISong | null = null;

      if (opts.remote) {
        // For remote, prefer fetching from the server so we always have
        // the canonical filename even if the local library is absent.
        const session = await readSession();
        const token = opts.token ?? session?.token;
        const settings = await readSettings().catch(() => null);
        const server = opts.server ?? session?.server ?? settings?.remoteServer ?? DEFAULT_SERVER;

        if (!token) {
          console.error(
            `${c.yellow}Not logged in.${c.reset} Run \`toxen login\` first, or pass --token <token>.`
          );
          process.exit(1);
        }

        // Try local first (faster), fall back to remote fetch
        const settings2 = await readSettings().catch(() => null);
        const libraryDir = opts.library ?? settings2?.libraryDirectory;
        if (libraryDir) song = await findSongLocally(uid, libraryDir);
        if (!song) song = await findSongRemotely(uid, token, server);

        if (!song) {
          console.error(`${c.yellow}Song "${uid}" not found.${c.reset}`);
          process.exit(1);
        }

        const filename = song.paths?.[pathKey];
        if (!filename) {
          console.error(
            `${c.yellow}Song "${uid}" has no ${asset} asset.${c.reset}`
          );
          process.exit(1);
        }

        const url = `${server}/track/${uid}/${filename}?token=${token}`;

        if (opts.json) outputJson({ uid, asset, url, filename });
        process.stdout.write(url + "\n");

      } else {
        // ── Local mode ──────────────────────────────────────────────────────
        const settings = await readSettings();
        const libraryDir = opts.library ?? settings.libraryDirectory;

        if (!libraryDir) {
          console.error(
            `${c.yellow}No library directory configured.${c.reset} Run Toxen once, or pass --library <path>.`
          );
          process.exit(1);
        }

        song = await findSongLocally(uid, libraryDir);
        if (!song) {
          console.error(`${c.yellow}Song "${uid}" not found in local library.${c.reset}`);
          process.exit(1);
        }

        const filename = song.paths?.[pathKey];
        if (!filename) {
          console.error(
            `${c.yellow}Song "${uid}" has no ${asset} asset.${c.reset}`
          );
          process.exit(1);
        }

        const localPath = path.join(libraryDir, uid, filename);

        if (opts.json) outputJson({ uid, asset, path: localPath, filename });
        process.stdout.write(localPath + "\n");
      }
    });
}
