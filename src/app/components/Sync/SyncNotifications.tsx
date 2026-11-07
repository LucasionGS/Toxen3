import React, { useEffect } from "react";
import { Button, Group } from "@mantine/core";
import { hideNotification } from "@mantine/notifications";
import { Toxen } from "../../ToxenApp";
import SyncEngine from "../../toxen/sync/SyncEngine";
import type { Merge } from "../../toxen/sync/Merge";
import { openSyncConflictModal } from "../SyncConflicts/SyncConflictModal";
import { countConflictItems } from "./useSync";

/**
 * Shortest time between two notifications of the same kind. Unit is in ms.
 */
const REPEAT_MS = 5 * 60 * 1000;

const lastShown = new Map<string, number>();

/**
 * Whether a notification of this kind may be shown now, and if so remember that it was.
 */
function throttle(kind: string): boolean {
  const now = Date.now();
  const previous = lastShown.get(kind);
  if (previous !== undefined && now - previous < REPEAT_MS) return false;
  lastShown.set(kind, now);
  return true;
}

/**
 * Tell the user a conflict was auto-resolved, with a button that opens the review.
 */
export function notifyConflict(record: Merge.ConflictRecord): void {
  const count = countConflictItems(record);
  const id = Toxen.notify({
    title: "Sync conflict",
    type: "warning",
    expiresIn: 15000,
    content: (
      <div>
        <p>{count === 1 ? "1 sync conflict" : `${count} sync conflicts`} in '{record.songName}'</p>
        <Group>
          <Button size="xs" onClick={() => {
            hideNotification(id);
            openSyncConflictModal(record.uid);
          }}>
            Review
          </Button>
        </Group>
      </div>
    ),
  });
}

/**
 * Tell the user that a deleted song came back because it was edited somewhere else. The engine calls this when the
 * edit beats the delete.
 */
export function notifyKeptEditedCopy(name: string): void {
  Toxen.notify({
    title: "Song kept",
    type: "normal",
    expiresIn: 8000,
    content: `Kept your edited copy of ${name}. It was deleted on another device after you changed it here.`,
  });
}

function onError(failure: SyncEngine.Failure): void {
  if (failure.code === "quota_exceeded") {
    if (!throttle("quota")) return;
    Toxen.notify({
      title: "Cloud storage is full",
      type: "warning",
      expiresIn: 10000,
      content: "Cloud storage is full — free up space or upgrade. Your songs are safe, and downloads still work.",
    });
  }
  else if (failure.code === "not_found" && failure.uid === null) {
    if (!throttle("server-old")) return;
    Toxen.notify({
      title: "Can't sync",
      type: "error",
      expiresIn: 10000,
      content: "Your server needs an update to sync.",
    });
  }
}

let subscribers = 0;
let detach: (() => void) | null = null;

/**
 * Turn engine events into notifications. Safe to call from several places: the events are listened to once, and
 * listening stops when every caller has stopped.
 * @returns A function that undoes this call.
 */
export function initSyncNotifications(): () => void {
  if (subscribers++ === 0) {
    SyncEngine.events.on("conflict", notifyConflict);
    SyncEngine.events.on("error", onError);
    detach = () => {
      SyncEngine.events.off("conflict", notifyConflict);
      SyncEngine.events.off("error", onError);
    };
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--subscribers === 0) {
      detach?.();
      detach = null;
    }
  };
}

/**
 * Renders nothing. Keeps the sync notifications connected while it is mounted.
 */
export function SyncNotifier(): null {
  useEffect(() => initSyncNotifications(), []);
  return null;
}
