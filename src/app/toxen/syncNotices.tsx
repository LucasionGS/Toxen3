import React from "react";
import { Button, Group } from "@mantine/core";
import { hideNotification } from "@mantine/notifications";
import { Toxen } from "../ToxenApp";
import type { Merge } from "./sync/Merge";
import { SyncEngine } from "./sync/SyncEngine";
import { openSyncConflictModal } from "../components/SyncConflicts/SyncConflictModal";

/**
 * "2 sync conflicts in 'Song name' — Review" (plan §2.9). The review opens the conflict modal for that song.
 */
export function showConflictNotice(record: Merge.ConflictRecord): void {
  const count = record.items.reduce((sum, item) => sum + (item.type === "info" ? item.fields.length : 1), 0);
  const nId = Toxen.notify({
    title: count === 1 ? "1 sync conflict" : `${count} sync conflicts`,
    content: <div>
      <p>"{record.songName}" was changed here and on another device. The newest change was kept, and the other one was saved as a copy.</p>
      <Group>
        <Button color="blue" onClick={() => {
          hideNotification(nId);
          try {
            openSyncConflictModal(record.uid);
          } catch (error) {
            Toxen.error(`Unable to open the conflict review: ${error?.message ?? error}`);
          }
        }}>Review</Button>
        <Button color="gray" onClick={() => hideNotification(nId)}>Later</Button>
      </Group>
    </div>,
    type: "warning",
  });
}

/**
 * Synced songs went missing from the library folder: ask before sync deletes them from the cloud.
 */
export function showMissingSongsNotice(message: string): void {
  const nId = Toxen.notify({
    title: "Songs missing from your library",
    content: <div>
      <p>{message}</p>
      <Group>
        <Button color="red" onClick={() => {
          hideNotification(nId);
          SyncEngine.confirmMissingDeletes();
        }}>Delete them from the cloud</Button>
        <Button color="gray" onClick={() => hideNotification(nId)}>Keep them</Button>
      </Group>
    </div>,
    type: "warning",
  });
}
