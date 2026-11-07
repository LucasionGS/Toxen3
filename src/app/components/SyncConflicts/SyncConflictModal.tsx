import React from "react";
import type { Merge } from "../../toxen/sync/Merge";

// Phase 4. The conflict review (diff view) from plan §2.9. Opened through Mantine `modals.open` by
// `openSyncConflictModal`, from the conflict notification, the alert dot on a song row, or Settings > Sync.
// One section per item: info fields as a table (this device / cloud / winner highlighted), text files as a
// side-by-side LCS line diff (no new dependency), images as two thumbnails, media with size/duration/date and preview.
// Styles go in SyncConflictModal.scss using Toxen theme variables only.

export interface SyncConflictModalProps {
  /**
   * Show only this song's conflicts. Default is every open conflict.
   */
  uid?: string;
  onClose: () => void;
}

/**
 * Review auto-resolved sync conflicts and change the outcome. Applies choices with `SyncEngine.resolveConflict`.
 */
export default function SyncConflictModal(props: SyncConflictModalProps) {
  const { uid, onClose } = props;
  // TODO(builder): read SyncEngine.getConflicts(uid), subscribe to SyncEngine.events "conflict", render sections.
  return <div className="sync-conflict-modal" />;
}

/**
 * Open the modal.
 */
export function openSyncConflictModal(uid?: string): void {
  throw new Error("Not implemented.");
}

/**
 * Props of one section.
 */
export interface ConflictSectionProps {
  record: Merge.ConflictRecord;
  item: Merge.ConflictItem;
  onChoose: (choice: Merge.ConflictChoice) => void;
}
