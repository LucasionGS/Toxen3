import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Group, Loader, SegmentedControl, Stack, Text, ActionIcon, Table } from "@mantine/core";
import { IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import type Song from "../../toxen/Song";
import type { Merge } from "../../toxen/sync/Merge";
import { formatBytes, formatDateTime, formatDuration } from "../Sync/format";
import LineDiff from "./lineDiff";

//#region Choices

export type ChoiceMap = Record<string, Merge.ConflictChoice>;

/**
 * Key of the choice for an item or field inside a {@link ChoiceMap}.
 */
export function choiceKey(choice: Merge.ConflictChoice): string {
  return choice.type === "info" ? `info:${choice.field}` : `file:${choice.path}`;
}

/**
 * The outcome the engine already applied: keep the winner of every item.
 */
export function defaultChoices(record: Merge.ConflictRecord): ChoiceMap {
  const choices: ChoiceMap = {};
  for (const item of record.items) {
    if (item.type === "info") {
      for (const field of item.fields) {
        const choice: Merge.ConflictChoice = { type: "info", field: field.field, keep: field.winner };
        choices[choiceKey(choice)] = choice;
      }
    }
    else {
      const choice: Merge.ConflictChoice = { type: "file", path: item.path, keep: item.winner };
      choices[choiceKey(choice)] = choice;
    }
  }
  return choices;
}

//#endregion

export interface ConflictSectionProps<T extends Merge.ConflictItem = Merge.ConflictItem> {
  record: Merge.ConflictRecord;
  item: T;
  /** The current choice for every item and field of the record. */
  choices: ChoiceMap;
  onChoose: (choice: Merge.ConflictChoice) => void;
}

/**
 * One conflicting item of a record: the info table, or a file with the diff that fits its kind.
 */
export default function ConflictSection(props: ConflictSectionProps) {
  const { item } = props;
  if (item.type === "info") return <InfoSection {...props} item={item} />;
  return <FileSection {...props} item={item} />;
}

//#region Info fields

const SIDE_LABEL: Record<Merge.Side, string> = { local: "This device", remote: "Cloud" };

/**
 * Readable one-line form of an info value. An absent key is not the same as `null`.
 */
export function formatInfoValue(value: unknown, present: boolean): React.ReactNode {
  if (!present) return <span className="sync-conflict__absent">not set</span>;
  if (value === null) return <span className="sync-conflict__absent">empty</span>;
  if (typeof value === "string") return value === "" ? <span className="sync-conflict__absent">empty text</span> : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const json = JSON.stringify(value);
  return json.length > 140 ? `${json.slice(0, 140)}…` : json;
}

function InfoSection(props: ConflictSectionProps<Merge.InfoConflict>) {
  const { item, choices, onChoose } = props;
  return (
    <div className="sync-conflict__section">
      <Text fw={600} size="sm">Song settings</Text>
      <Table className="sync-conflict__table" verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Setting</Table.Th>
            <Table.Th>This device</Table.Th>
            <Table.Th>Cloud</Table.Th>
            <Table.Th>Keep</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {item.fields.map(field => {
            const choice = choices[`info:${field.field}`];
            const keep = choice?.type === "info" ? choice.keep : field.winner;
            return (
              <Table.Tr key={field.field}>
                <Table.Td><code>{field.field}</code></Table.Td>
                <Table.Td className={field.winner === "local" ? "sync-conflict__winner" : undefined}>
                  {formatInfoValue(field.local, field.local !== undefined)}
                </Table.Td>
                <Table.Td className={field.winner === "remote" ? "sync-conflict__winner" : undefined}>
                  {formatInfoValue(field.remote, field.remote !== undefined)}
                </Table.Td>
                <Table.Td>
                  <SegmentedControl
                    size="xs"
                    value={keep}
                    onChange={value => onChoose({ type: "info", field: field.field, keep: value as Merge.Side })}
                    data={[
                      { value: "local", label: SIDE_LABEL.local },
                      { value: "remote", label: SIDE_LABEL.remote },
                    ]}
                  />
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </div>
  );
}

//#endregion

//#region Files

function findSong(uid: string): Song | undefined {
  return Toxen.songList?.find(song => song.uid === uid);
}

/**
 * Where each side's version lives inside the song: the winner stays at `path`, the loser is kept at `copyPath`.
 */
function versionPaths(item: Merge.FileConflict): Record<Merge.Side, string> {
  return {
    local: item.winner === "local" ? item.path : item.copyPath,
    remote: item.winner === "remote" ? item.path : item.copyPath,
  };
}

function FileSection(props: ConflictSectionProps<Merge.FileConflict>) {
  const { record, item, choices, onChoose } = props;
  const song = useMemo(() => findSong(record.uid), [record.uid]);
  const paths = versionPaths(item);
  const choice = choices[`file:${item.path}`];
  const keep = choice?.type === "file" ? choice.keep : item.winner;

  return (
    <div className="sync-conflict__section">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="xs" wrap="nowrap" className="sync-conflict__file-name">
          <Text fw={600} size="sm" truncate>{item.path}</Text>
          <Badge variant="light" size="xs">{item.kind === "other" ? "file" : item.kind}</Badge>
        </Group>
        <SegmentedControl
          size="xs"
          value={keep}
          onChange={value => onChoose({ type: "file", path: item.path, keep: value as Merge.Side | "both" })}
          data={[
            { value: "local", label: "Keep this device" },
            { value: "remote", label: "Keep cloud" },
            { value: "both", label: "Keep both" },
          ]}
        />
      </Group>
      {item.kind === "text" && <TextDiff song={song} item={item} paths={paths} />}
      {item.kind === "image" && <ImageCompare song={song} item={item} paths={paths} />}
      {item.kind === "media" && <MediaCompare song={song} item={item} paths={paths} />}
      {item.kind === "other" && <VersionFacts item={item} />}
    </div>
  );
}

interface FileViewProps {
  song: Song | undefined;
  item: Merge.FileConflict;
  paths: Record<Merge.Side, string>;
}

function VersionFacts({ item }: { item: Merge.FileConflict }) {
  return (
    <div className="sync-conflict__sides">
      {(["local", "remote"] as const).map(side => (
        <div key={side} className={`sync-conflict__side${item.winner === side ? " sync-conflict__side--winner" : ""}`}>
          <Text size="xs" c="dimmed">{SIDE_LABEL[side]}{item.winner === side ? " (kept)" : ""}</Text>
          <Text size="sm">{formatBytes(item[side].size)}</Text>
          <Text size="xs" c="dimmed">{formatDateTime(item[side].mtimeMs)}</Text>
        </div>
      ))}
    </div>
  );
}

/**
 * Hover and layout wrapper for one side of an image or media comparison.
 */
function SideCard(props: { side: Merge.Side; item: Merge.FileConflict; children: React.ReactNode }) {
  const { side, item, children } = props;
  const version = item[side];
  return (
    <div className={`sync-conflict__side${item.winner === side ? " sync-conflict__side--winner" : ""}`}>
      <Group justify="space-between" gap="xs">
        <Text size="xs" c="dimmed">{SIDE_LABEL[side]}{item.winner === side ? " (kept)" : ""}</Text>
        <Text size="xs" c="dimmed">{formatBytes(version.size)} · {formatDateTime(version.mtimeMs)}</Text>
      </Group>
      {children}
    </div>
  );
}

//#endregion

//#region Text

/**
 * Largest text file shown as a diff. Unit is in characters.
 */
const MAX_DIFF_CHARS = 400_000;

interface TextState {
  loading: boolean;
  left: string[];
  right: string[];
  error: string | null;
}

function useTextVersions(song: Song | undefined, paths: Record<Merge.Side, string>): TextState {
  const [state, setState] = useState<TextState>({ loading: true, left: [], right: [], error: null });
  useEffect(() => {
    let active = true;
    if (!song) {
      setState({ loading: false, left: [], right: [], error: "This song isn't in your library, so its files can't be previewed." });
      return;
    }
    setState({ loading: true, left: [], right: [], error: null });
    Promise.all([song.storage.readText(song, paths.local), song.storage.readText(song, paths.remote)])
      .then(([local, remote]) => {
        if (!active) return;
        if ((local?.length ?? 0) > MAX_DIFF_CHARS || (remote?.length ?? 0) > MAX_DIFF_CHARS) {
          setState({ loading: false, left: [], right: [], error: "This file is too large to compare here." });
          return;
        }
        setState({ loading: false, left: LineDiff.splitLines(local ?? ""), right: LineDiff.splitLines(remote ?? ""), error: null });
      })
      .catch((error: Error) => {
        if (active) setState({ loading: false, left: [], right: [], error: `Couldn't read the files: ${error.message}` });
      });
    return () => { active = false; };
  }, [song, paths.local, paths.remote]);
  return state;
}

function TextDiff({ song, item, paths }: FileViewProps) {
  const { loading, left, right, error } = useTextVersions(song, paths);
  const rows = useMemo(() => LineDiff.diffLines(left, right), [left, right]);

  if (loading) return <Loader size="sm" />;
  if (error) return <Text size="sm" c="dimmed">{error}</Text>;
  if (rows.length === 0) return <Text size="sm" c="dimmed">Both versions are empty.</Text>;

  return (
    <div className="sync-conflict__diff">
      <div className="sync-conflict__diff-head">
        <span>{SIDE_LABEL.local}{item.winner === "local" ? " (kept)" : ""}</span>
        <span>{SIDE_LABEL.remote}{item.winner === "remote" ? " (kept)" : ""}</span>
      </div>
      <div className="sync-conflict__diff-body">
        {rows.map((row, i) => (
          <div key={i} className={`sync-conflict__diff-row sync-conflict__diff-row--${row.type}`}>
            <span className="sync-conflict__diff-num">{row.leftLine ?? ""}</span>
            <span className={`sync-conflict__diff-text${row.left === null ? " sync-conflict__diff-text--empty" : ""}`}>{row.left}</span>
            <span className="sync-conflict__diff-num">{row.rightLine ?? ""}</span>
            <span className={`sync-conflict__diff-text${row.right === null ? " sync-conflict__diff-text--empty" : ""}`}>{row.right}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

//#endregion

//#region Images

function ImageCompare({ song, item, paths }: FileViewProps) {
  return (
    <div className="sync-conflict__sides">
      {(["local", "remote"] as const).map(side => (
        <SideCard key={side} side={side} item={item}>
          {song
            ? <img className="sync-conflict__image" src={song.storage.fileUrl(song, paths[side])} alt={`${SIDE_LABEL[side]} version`} />
            : <Text size="sm" c="dimmed">No preview.</Text>}
        </SideCard>
      ))}
    </div>
  );
}

//#endregion

//#region Media

/**
 * Plays one side of the comparison at a time, and stops when the section goes away.
 */
function useMediaPreview() {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [playing, setPlaying] = useState<Merge.Side | null>(null);

  const stop = () => {
    mediaRef.current?.pause();
    mediaRef.current = null;
    setPlaying(null);
  };

  useEffect(() => () => { mediaRef.current?.pause(); }, []);

  const toggle = (side: Merge.Side, url: string) => {
    const wasPlaying = playing === side;
    stop();
    if (wasPlaying) return;
    // The main player would otherwise talk over the preview
    Toxen.musicPlayer?.pause();
    const media = new Audio(url);
    media.onended = () => { if (mediaRef.current === media) stop(); };
    media.onerror = () => { if (mediaRef.current === media) stop(); };
    mediaRef.current = media;
    setPlaying(side);
    media.play().catch(() => { if (mediaRef.current === media) stop(); });
  };

  return { playing, toggle };
}

/**
 * Length of a media file, read from its metadata. `null` until known or when it can't be read.
 */
function useMediaDuration(url: string | null): number | null {
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => {
    setDuration(null);
    if (!url) return;
    const media = new Audio();
    media.preload = "metadata";
    media.onloadedmetadata = () => setDuration(Number.isFinite(media.duration) ? media.duration : null);
    media.src = url;
    return () => {
      media.onloadedmetadata = null;
      media.removeAttribute("src");
      media.load();
    };
  }, [url]);
  return duration;
}

function MediaSide(props: { side: Merge.Side; item: Merge.FileConflict; song: Song | undefined; path: string; playing: boolean; onToggle: (url: string) => void }) {
  const { side, item, song, path, playing, onToggle } = props;
  const url = song ? song.storage.fileUrl(song, path) : null;
  const duration = useMediaDuration(url);
  const name = path.split("/").pop() ?? path;
  return (
    <SideCard side={side} item={item}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Stack gap={0} className="sync-conflict__media-info">
          <Text size="sm" truncate title={name}>{name}</Text>
          <Text size="xs" c="dimmed">{duration === null ? "Duration unknown" : formatDuration(duration)}</Text>
        </Stack>
        <ActionIcon
          variant="light"
          disabled={!url}
          onClick={() => url && onToggle(url)}
          title={playing ? "Stop preview" : "Preview"}
          aria-label={playing ? "Stop preview" : "Preview"}
        >
          {playing ? <IconPlayerStop size="1em" /> : <IconPlayerPlay size="1em" />}
        </ActionIcon>
      </Group>
    </SideCard>
  );
}

function MediaCompare({ song, item, paths }: FileViewProps) {
  const { playing, toggle } = useMediaPreview();
  return (
    <div className="sync-conflict__sides">
      {(["local", "remote"] as const).map(side => (
        <MediaSide
          key={side}
          side={side}
          item={item}
          song={song}
          path={paths[side]}
          playing={playing === side}
          onToggle={url => toggle(side, url)}
        />
      ))}
    </div>
  );
}

//#endregion
