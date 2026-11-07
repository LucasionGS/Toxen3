import { useSyncExternalStore } from "react";
import type Song from "../../toxen/Song";
import { getSongLocation } from "./useSync";

/**
 * Which songs the library list shows.
 */
export type LibraryFilter = "all" | "device" | "cloud";

const STORAGE_KEY = "library-filter";
const FILTERS: readonly LibraryFilter[] = ["all", "device", "cloud"];

const listeners = new Set<() => void>();

function readStored(): LibraryFilter {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return FILTERS.find(filter => filter === stored) ?? "all";
}

let current: LibraryFilter = readStored();

/**
 * Change the filter for every list that uses {@link useLibraryFilter}.
 */
export function setLibraryFilter(filter: LibraryFilter): void {
  if (filter === current) return;
  current = filter;
  window.localStorage.setItem(STORAGE_KEY, filter);
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
    () => current,
  );
}

/**
 * Whether a song passes the filter. "On this device" is every song with a local copy, "Cloud only" the ones without.
 */
export function matchesLibraryFilter(song: Song, filter: LibraryFilter): boolean {
  if (filter === "all") return true;
  const location = getSongLocation(song);
  return filter === "device" ? location.local : !location.local;
}
