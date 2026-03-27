import path from "node:path";
import { readdir } from "node:fs/promises";
import type { ISong } from "./types.ts";

/**
 * Reads all songs from a Toxen library directory.
 * Each song lives in `{libraryDirectory}/{uid}/data.json`.
 */
export async function readLibrary(libraryDirectory: string): Promise<ISong[]> {
  let entries: string[];
  try {
    entries = await readdir(libraryDirectory);
  } catch {
    throw new Error(`Cannot read library directory: ${libraryDirectory}`);
  }

  const songs: ISong[] = [];

  await Promise.all(
    entries.map(async (entry) => {
      const dataFile = path.join(libraryDirectory, entry, "data.json");
      const file = Bun.file(dataFile);
      if (!(await file.exists())) return;

      try {
        const song = await file.json() as ISong;
        songs.push(song);
      } catch {
        // Silently skip malformed song data files
      }
    })
  );

  // Sort alphabetically by artist then title for a predictable default order
  songs.sort((a, b) => {
    const artistA = (a.artist ?? "").toLowerCase();
    const artistB = (b.artist ?? "").toLowerCase();
    if (artistA !== artistB) return artistA.localeCompare(artistB);
    return (a.title ?? "").toLowerCase().localeCompare((b.title ?? "").toLowerCase());
  });

  return songs;
}

/** Formats a duration (milliseconds) as `m:ss` or `h:mm:ss`. */
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
