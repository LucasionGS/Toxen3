import React, { useMemo, useState } from "react";
import { Button, Group, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconCheck } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import type { Merge } from "../../toxen/sync/Merge";
import SyncEngine from "../../toxen/sync/SyncEngine";
import { useSyncConflicts } from "../Sync/useSync";
import { formatAgo } from "../Sync/format";
import ConflictSection, { choiceKey, defaultChoices } from "./ConflictSections";
import type { ChoiceMap } from "./ConflictSections";
import "./SyncConflictModal.scss";

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
  const records = useSyncConflicts(uid);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const open = records.filter(record => !done.has(record.id));

  if (open.length === 0) {
    return (
      <Stack align="flex-start" className="sync-conflict-modal">
        <Text>There are no sync conflicts to review.</Text>
        <Button onClick={onClose}>Close</Button>
      </Stack>
    );
  }

  return (
    <Stack className="sync-conflict-modal" gap="lg">
      <Text size="sm" c="dimmed">
        Both this device and the cloud changed these at the same time. Toxen kept the newest version of each and saved
        the other as a copy. Change what to keep, or leave it as it is.
      </Text>
      {open.map(record => (
        <ConflictRecordCard
          key={record.id}
          record={record}
          onResolved={() => setDone(previous => new Set(previous).add(record.id))}
        />
      ))}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>Close</Button>
      </Group>
    </Stack>
  );
}

/**
 * Open the modal.
 */
export function openSyncConflictModal(uid?: string): void {
  const id = modals.open({
    title: "Review sync conflicts",
    size: "xl",
    children: <SyncConflictModal uid={uid} onClose={() => modals.close(id)} />,
  });
}

interface ConflictRecordCardProps {
  record: Merge.ConflictRecord;
  onResolved: () => void;
}

function ConflictRecordCard(props: ConflictRecordCardProps) {
  const { record, onResolved } = props;
  const [choices, setChoices] = useState<ChoiceMap>(() => defaultChoices(record));
  const [applying, setApplying] = useState(false);
  const changed = useMemo(() => {
    const defaults = defaultChoices(record);
    return Object.values(choices).some(choice => JSON.stringify(choice) !== JSON.stringify(defaults[choiceKey(choice)]));
  }, [choices, record]);

  const apply = async () => {
    setApplying(true);
    try {
      await SyncEngine.resolveConflict(record.id, Object.values(choices));
      onResolved();
      Toxen.log(changed ? `Applied your choices for ${record.songName}.` : `Marked ${record.songName} as reviewed.`, 3000);
    } catch (error) {
      setApplying(false);
      Toxen.error(`Couldn't apply your choices for ${record.songName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="sync-conflict">
      <Group justify="space-between" align="baseline" wrap="nowrap">
        <Text fw={700} truncate>{record.songName}</Text>
        <Text size="xs" c="dimmed">{formatAgo(record.createdAt)}</Text>
      </Group>
      <Stack gap="md" mt="sm">
        {record.items.map((item, i) => (
          <ConflictSection
            key={item.type === "info" ? "info" : `${item.path}-${i}`}
            record={record}
            item={item}
            choices={choices}
            onChoose={choice => setChoices(previous => ({ ...previous, [choiceKey(choice)]: choice }))}
          />
        ))}
      </Stack>
      <Group justify="flex-end" mt="md">
        <Button leftSection={<IconCheck size="1em" />} loading={applying} onClick={apply}>
          {changed ? "Apply my choices" : "Looks good"}
        </Button>
      </Group>
    </div>
  );
}
