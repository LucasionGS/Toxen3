import { useSyncExternalStore } from "react";
import type Song from "../../toxen/Song";
import Settings from "../../toxen/Settings";
import { getSongLocation } from "./useSync";

/**
 * Which songs the library list shows: all, the ones with a copy on this device, or the ones with a copy in the cloud.
 * Saved as the `libraryFilter` setting.
 */
export type LibraryFilter = "all" | "local" | "cloud";

const listeners = new Set<() => void>();

function readFilter(): LibraryFilter {
  return Settings.get("libraryFilter") ?? "all";
}

/**
 * Change the filter for every list that uses {@link useLibraryFilter}.
 */
export function setLibraryFilter(filter: LibraryFilter): void {
  if (filter === readFilter()) return;
  Settings.apply({ libraryFilter: filter }, true).catch(error => console.error("Unable to save the library filter:", error));
  listeners.forEach(listener => listener());
}

/**
 * The current filter, re-rendering the component when it changes.
 */
export function useLibraryFilter(): LibraryFilter {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    readFilter,
  );
}

/**
 * Whether a song passes the filter. "On this device" is every song with a local copy, "In the cloud" every song with a
 * cloud copy, so a synced song is in both.
 */
export function matchesLibraryFilter(song: Song, filter: LibraryFilter): boolean {
  if (filter === "all") return true;
  const location = getSongLocation(song);
  return filter === "local" ? location.local : location.cloud;
}
