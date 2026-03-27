import { Command } from "commander";
import { readSettings } from "../src/settings.ts";
import { readLibrary, formatDuration } from "../src/library.ts";
import { outputJson, printTable, c } from "../src/output.ts";
import { readSession } from "../src/session.ts";
import { remoteFetchSongs } from "../src/remote.ts";
import type { ISong } from "../src/types.ts";

function applyFieldFilter(songs: ISong[], fields: string): unknown[] {
  if (!fields) return songs;
  const fieldList = fields.split(",").map((f) => f.trim()).filter(Boolean);
  return songs.map((song) => {
    const obj: Record<string, unknown> = {};
    for (const field of fieldList) {
      obj[field] = (song as unknown as Record<string, unknown>)[field];
    }
    return obj;
  });
}

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List all songs in the Toxen library (local or remote)")
    .option("--library <path>", "Override the library directory path (local only)")
    .option("--remote", "Fetch from the remote server instead of local library")
    .option("--token <token>", "Auth token to use for remote (overrides saved session)")
    .option("--server <url>", "Remote server URL (overrides saved session)")
    .option("--json", "Output raw JSON (suitable for piping to other tools)")
    .option("--fields <fields>", "Comma-separated fields to include in JSON output (e.g. uid,title,artist)", "")
    .action(async (opts: { library?: string; remote?: boolean; token?: string; server?: string; json?: boolean; fields?: string }) => {

      // ── Remote mode ───────────────────────────────────────────────────────
      if (opts.remote) {
        const session = await readSession();
        const token = opts.token ?? session?.token;
        const settings = await readSettings().catch(() => null);
        const server = opts.server ?? session?.server ?? settings?.remoteServer ?? undefined;

        if (!token) {
          console.error(`${c.yellow}Not logged in.${c.reset} Run \`toxen login\` first, or pass --token <token>.`);
          process.exit(1);
        }

        const songs = await remoteFetchSongs(token, server);

        // Sort same as local
        songs.sort((a, b) => {
          const artistA = (a.artist ?? "").toLowerCase();
          const artistB = (b.artist ?? "").toLowerCase();
          if (artistA !== artistB) return artistA.localeCompare(artistB);
          return (a.title ?? "").toLowerCase().localeCompare((b.title ?? "").toLowerCase());
        });

        if (opts.json) outputJson(applyFieldFilter(songs, opts.fields ?? ""));

        if (songs.length === 0) {
          console.log(`${c.yellow}No songs found on remote server.${c.reset}`);
          return;
        }

        console.log(`\n${c.bold}${c.cyan}Toxen Remote Library${c.reset}  ${c.gray}${server ?? "https://stream.toxen.net/api"}${c.reset}`);
        console.log(`${c.gray}${songs.length} song${songs.length === 1 ? "" : "s"}${c.reset}\n`);

        const rows = songs.map((song) => [
          song.artist || c.gray + "(unknown)" + c.reset,
          song.title || c.gray + "(untitled)" + c.reset,
          song.album || "",
          song.year ? String(song.year) : "",
          formatDuration(song.duration),
          (song.tags ?? []).join(", "),
        ]);

        printTable(["Artist", "Title", "Album", "Year", "Duration", "Tags"], rows);
        console.log();
        return;
      }

      // ── Local mode ────────────────────────────────────────────────────────
      const settings = await readSettings();
      const libraryDir = opts.library ?? settings.libraryDirectory;

      if (!libraryDir) {
        console.error(`${c.yellow}No library directory configured. Run Toxen at least once, or pass --library <path>.${c.reset}`);
        process.exit(1);
      }

      const songs = await readLibrary(libraryDir);

      if (opts.json) outputJson(applyFieldFilter(songs, opts.fields ?? ""));

      if (songs.length === 0) {
        console.log(`${c.yellow}No songs found in library: ${libraryDir}${c.reset}`);
        return;
      }

      console.log(`\n${c.bold}${c.cyan}Toxen Library${c.reset}  ${c.gray}${libraryDir}${c.reset}`);
      console.log(`${c.gray}${songs.length} song${songs.length === 1 ? "" : "s"}${c.reset}\n`);

      const rows = songs.map((song) => [
        song.artist || c.gray + "(unknown)" + c.reset,
        song.title || c.gray + "(untitled)" + c.reset,
        song.album || "",
        song.year ? String(song.year) : "",
        formatDuration(song.duration),
        (song.tags ?? []).join(", "),
      ]);

      printTable(["Artist", "Title", "Album", "Year", "Duration", "Tags"], rows);
      console.log();
    });
}

