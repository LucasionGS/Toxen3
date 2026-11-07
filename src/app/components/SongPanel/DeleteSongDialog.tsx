import React, { useState } from "react";
import { Button, Group, Radio, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconTrash } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import type Song from "../../toxen/Song";
import { SongLibrary } from "../../toxen/SongLibrary";
import { canUseCloud } from "../Sync/songSyncActions";
import { getSongLocation } from "../Sync/useSync";
import "./DeleteSongDialog.scss";

type Scope = Exclude<SongLibrary.DeleteScope, "auto">;

interface ScopeOption {
  value: Scope;
  label: string;
  description: string;
}

export interface DeleteSongDialogProps {
  /** The songs to delete. */
  songs: Song[];
  onClose: () => void;
}

/**
 * Which delete options make sense for these songs, from where their copies live.
 */
function availableOptions(songs: Song[]): ScopeOption[] {
  const locations = songs.map(getSongLocation);
  const hasLocal = locations.some(location => location.local);
  const hasCloud = locations.some(location => location.cloud) && canUseCloud();
  const options: ScopeOption[] = [];
  if (hasLocal) {
    options.push({
      value: "device",
      label: "From this device",
      description: hasCloud ? "Removes the downloaded copy. Anything that's in the cloud stays there." : "Removes it from this device.",
    });
  }
  if (hasCloud) {
    options.push({
      value: "cloud",
      label: "From cloud",
      description: "Removes the cloud copy, so your other devices lose it too.",
    });
  }
  if (hasLocal && hasCloud) {
    options.push({
      value: "everywhere",
      label: "Everywhere",
      description: "Removes it from this device and the cloud. This can't be undone.",
    });
  }
  return options;
}

/**
 * The scope that does the right thing for one song when the user picked `scope` for the whole selection.
 * @returns `null` when the song has nothing to delete there.
 */
function scopeFor(song: Song, scope: Scope): Scope | null {
  const { local, cloud } = getSongLocation(song);
  if (scope === "device") return local ? "device" : null;
  if (scope === "cloud") return cloud ? "cloud" : null;
  if (local && cloud) return "everywhere";
  return local ? "device" : (cloud ? "cloud" : null);
}

/**
 * Ask where to delete songs from, then delete them.
 */
export default function DeleteSongDialog(props: DeleteSongDialogProps) {
  const { songs, onClose } = props;
  const options = availableOptions(songs);
  const [scope, setScope] = useState<Scope>(options[0]?.value ?? "device");
  const [deleting, setDeleting] = useState(false);
  const name = songs.length === 1 ? `"${songs[0].getDisplayName()}"` : `${songs.length} songs`;

  const confirm = async () => {
    setDeleting(true);
    let failed = 0;
    for (const song of songs) {
      const effective = scopeFor(song, scope);
      if (!effective) continue;
      try {
        await SongLibrary.delete(song, effective);
      } catch (error) {
        failed++;
        Toxen.error(`Couldn't delete ${song.getDisplayName()}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    onClose();
    if (failed < songs.length) Toxen.log(songs.length === 1 ? "Song deleted." : `Deleted ${songs.length - failed} songs.`, 3000);
  };

  if (options.length === 0) {
    return (
      <Stack align="flex-start">
        <Text>There is nothing to delete for {name}.</Text>
        <Button onClick={onClose}>Close</Button>
      </Stack>
    );
  }

  return (
    <Stack className="delete-song-dialog">
      <Text>Where do you want to delete {name} from?</Text>
      <Radio.Group value={scope} onChange={value => setScope(value as Scope)}>
        <Stack gap="xs">
          {options.map(option => (
            <Radio.Card
              key={option.value}
              value={option.value}
              className={`delete-song-dialog__option${option.value === "everywhere" ? " delete-song-dialog__option--danger" : ""}`}
            >
              <Group wrap="nowrap" align="flex-start" gap="sm">
                <Radio.Indicator />
                <div>
                  <Text fw={600} size="sm">{option.label}</Text>
                  <Text size="xs" c="dimmed">{option.description}</Text>
                </div>
              </Group>
            </Radio.Card>
          ))}
        </Stack>
      </Radio.Group>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={deleting}>Cancel</Button>
        <Button color="red" leftSection={<IconTrash size="1em" />} loading={deleting} onClick={confirm}>Delete</Button>
      </Group>
    </Stack>
  );
}

/**
 * Open the delete dialog for one or more songs.
 */
export function openDeleteSongDialog(songs: Song[]): void {
  const id = modals.open({
    title: songs.length === 1 ? "Delete song" : "Delete songs",
    children: <DeleteSongDialog songs={songs} onClose={() => modals.close(id)} />,
  });
}
