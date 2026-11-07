import React from "react";
import { modals } from "@mantine/modals";
import { Toxen } from "../../ToxenApp";
import type Song from "../../toxen/Song";
import { SongLibrary } from "../../toxen/SongLibrary";
import SyncEngine from "../../toxen/sync/SyncEngine";
import User from "../../toxen/User";
import { getSongLocation } from "./useSync";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Whether the user could use the cloud at all.
 */
export function canUseCloud(): boolean {
  return Boolean(User.getCurrentUser());
}

/**
 * Songs that are only in the cloud and can be downloaded.
 */
export function downloadable(songs: Song[]): Song[] {
  return toxenapi.isDesktop() ? songs.filter(song => !getSongLocation(song).local && getSongLocation(song).cloud) : [];
}

/**
 * Songs with a download that can be removed while the cloud copy stays.
 */
export function removable(songs: Song[]): Song[] {
  return toxenapi.isDesktop() ? songs.filter(song => getSongLocation(song).local && getSongLocation(song).cloud) : [];
}

/**
 * Songs that exist only on this device and can be uploaded.
 */
export function uploadable(songs: Song[]): Song[] {
  return canUseCloud() ? songs.filter(song => getSongLocation(song).local && !getSongLocation(song).cloud) : [];
}

/**
 * Run an action for several songs, then report what happened in one message.
 */
async function runForSongs(songs: Song[], action: (song: Song) => Promise<void>, verb: string): Promise<void> {
  let failed = 0;
  let lastError = "";
  for (const song of songs) {
    try {
      await action(song);
    } catch (error) {
      failed++;
      lastError = describeError(error);
      console.error(error);
    }
  }
  if (failed === 0) return;
  if (songs.length === 1) return Toxen.error(`Couldn't ${verb} ${songs[0].getDisplayName()}: ${lastError}`);
  Toxen.error(`Couldn't ${verb} ${failed} of ${songs.length} songs: ${lastError}`);
}

/**
 * Download cloud-only songs and keep them on this device ("Make available offline").
 */
export async function makeAvailableOffline(songs: Song[]): Promise<void> {
  const targets = downloadable(songs);
  if (targets.length === 0) return;
  Toxen.log(targets.length === 1 ? `Downloading ${targets[0].getDisplayName()}…` : `Downloading ${targets.length} songs…`, 2500);
  await runForSongs(targets, song => SyncEngine.makeAvailableOffline(song), "download");
}

/**
 * Upload songs that are only on this device.
 */
export async function uploadToCloud(songs: Song[]): Promise<void> {
  const targets = uploadable(songs);
  if (targets.length === 0) return;
  Toxen.log(targets.length === 1 ? `Uploading ${targets[0].getDisplayName()}…` : `Uploading ${targets.length} songs…`, 2500);
  await runForSongs(targets, song => SyncEngine.uploadToCloud(song), "upload");
}

/**
 * Whether a song has changes the cloud doesn't have yet, according to the engine.
 */
function hasUnsyncedChanges(song: Song): boolean {
  try {
    const { status } = SyncEngine.getSongStatus(song.uid);
    return status !== SyncEngine.Status.Synced && status !== SyncEngine.Status.CloudOnly;
  } catch {
    return false;
  }
}

/**
 * Delete the downloaded copy and keep the cloud copy. Songs with changes that haven't been uploaded yet ask first,
 * since removing the download would lose those changes.
 */
export async function removeDownload(songs: Song[]): Promise<void> {
  const targets = removable(songs);
  if (targets.length === 0) return;

  const unsynced = targets.filter(hasUnsyncedChanges);
  const safe = targets.filter(song => !unsynced.includes(song));
  await runForSongs(safe, song => SyncEngine.removeDownload(song), "remove the download of");
  if (unsynced.length === 0) return;

  modals.openConfirmModal({
    title: "Remove download?",
    children: (
      <p>
        {unsynced.length === 1 ? `"${unsynced[0].getDisplayName()}" has` : `${unsynced.length} songs have`} changes
        that haven't been uploaded yet. Removing the download now will lose those changes.
      </p>
    ),
    labels: { confirm: "Remove anyway", cancel: "Cancel" },
    confirmProps: { className: "sync-danger-button" },
    onConfirm: () => runForSongs(unsynced, song => SongLibrary.delete(song, "device"), "remove the download of"),
  });
}
