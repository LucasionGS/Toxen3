import React, { useMemo, useState } from "react";
import { useModals } from "@mantine/modals";
import type { ModalsContextProps, ModalSettings } from "../../../types/mantine-modals";
import { Checkbox, RangeSlider, Button, Progress, Stack } from "@mantine/core";
import { Toxen } from "../../ToxenApp";
import Song from "../../toxen/Song";
import Settings from "../../toxen/Settings";
import Converter from "../../toxen/Converter";
import { PlayQueue } from "../../toxen/PlayQueue";
import { SongSettingsClipboard } from "../../toxen/SongSettingsClipboard";
import { StorageSelector } from "../../toxen/storage/StorageSelector";
import PlaylistManager from "../PlaylistManager/PlaylistManager";
import { downloadable, removable, uploadable, makeAvailableOffline, removeDownload, uploadToCloud } from "../Sync/songSyncActions";
import { openDeleteSongDialog } from "./DeleteSongDialog";

/**
 * Open the context menu for a song. If several songs are selected and this one is one of them, the menu
 * acts on the whole selection instead.
 */
export function openSongContextMenu(song: Song, modals: ModalsContextProps) {
  const selectedSongs = Song.getSelected();

  const isSelected = song.selected;

  let modalId: string;
  const close = () => modals.closeModal(modalId);

  // If none are selected
  // or if only one is selected and it's this one
  // or if more than one are selected and this one is not selected
  // Show the single song context menu
  if (selectedSongs.length == 0 || (selectedSongs.length == 1) || (selectedSongs.length > 1 && !isSelected)) {
    modalId = modals.openModal({
      title: song.getDisplayName(),
      children: (
        <Stack>
          <p>
            {song.getDisplayName()}
          </p>
          <Button onClick={() => {
            close();
            if (!Toxen.isMode("Player")) return Toxen.sendModeError(Toxen.getMode());
            Toxen.editSong(song);
          }}>
            Edit info
          </Button>
          <Button onClick={() => {
            close();
            modals.openModal(createManagePlaylists(song));
          }}>
            Manage playlists
          </Button>
          <Button onClick={() => { close(); SongSettingsClipboard.copySettingsToClipboard(song); }}>
            Copy settings
          </Button>
          {Toxen.playlist && (
            <Button onClick={() => { close(); SongSettingsClipboard.copyPlaylistSettingsToClipboard(song, Toxen.playlist.name); }}>
              Copy playlist settings
            </Button>
          )}
          <Button onClick={() => {
            close();
            modals.openConfirmModal({
              title: "Paste settings",
              children: `Overwrite settings for "${song.getDisplayName()}" with the copied settings?`,
              labels: { confirm: "Paste", cancel: "Cancel" },
              onConfirm: () => SongSettingsClipboard.pasteSettingsFromClipboard([song]),
            });
          }}>
            Paste settings
          </Button>
          {Toxen.playlist && (
            <Button onClick={() => {
              close();
              modals.openConfirmModal({
                title: "Paste playlist settings",
                children: `Overwrite playlist settings for "${song.getDisplayName()}" (playlist: ${Toxen.playlist.name})?`,
                labels: { confirm: "Paste", cancel: "Cancel" },
                onConfirm: () => SongSettingsClipboard.pastePlaylistSettingsFromClipboard([song], Toxen.playlist.name),
              });
            }}>
              Paste playlist settings
            </Button>
          )}
          <Button onClick={() => {
            close();
            if (song.inQueue) PlayQueue.removeFromQueue(song);
            else PlayQueue.addToQueue(song);
          }}>
            {song.inQueue ? "Remove from queue" : "Add to queue"}
          </Button>
          <CloudActions songs={[song]} close={close} />
          <Button color="red" variant="light" onClick={() => {
            close();
            openDeleteSongDialog([song]);
          }}>
            Delete…
          </Button>
          {StorageSelector.isLocal(song) && (
            <Button onClick={() => {
              close();
              modals.openModal(createTrimSongModal(song));
            }}>
              Trim
            </Button>
          )}
          {Settings.isAdvanced<React.JSX.Element>(
            <>
              <Button onClick={() => {
                close();
                song.copyUID();
              }}>
                Copy UID
              </Button>
              {toxenapi.isDesktop() && (
                <Button onClick={() => {
                  close();
                  toxenapi.remote.shell.openPath(song.dirname());
                }}>
                  Open in file explorer
                </Button>
              )}
            </>
          )}
        </Stack>
      )
    });
  }
  // If more than one are selected and this one is selected
  // Show the multi song context menu
  else {
    modalId = modals.openModal({
      title: "Manage playlists",
      children: (
        <Stack>
          <p>
            Manage playlists for the {selectedSongs.length} selected songs.
          </p>
          <Button onClick={() => {
            close();
            Song.deselectAll();
          }}>
            Deselect all
          </Button>
          <Button onClick={() => {
            close();
            modals.openModal(createManageMultiSongsPlaylists(selectedSongs));
          }}>
            Manage playlists
          </Button>
          <Button onClick={() => {
            close();
            modals.openConfirmModal({
              title: "Paste settings",
              children: `Overwrite settings for ${selectedSongs.length} selected song${selectedSongs.length !== 1 ? "s" : ""} with the copied settings?`,
              labels: { confirm: "Paste", cancel: "Cancel" },
              onConfirm: () => SongSettingsClipboard.pasteSettingsFromClipboard(selectedSongs),
            });
          }}>
            Paste settings to selected
          </Button>
          {Toxen.playlist && (
            <Button onClick={() => {
              close();
              modals.openConfirmModal({
                title: "Paste playlist settings",
                children: `Overwrite playlist settings for ${selectedSongs.length} selected song${selectedSongs.length !== 1 ? "s" : ""} (playlist: ${Toxen.playlist.name})?`,
                labels: { confirm: "Paste", cancel: "Cancel" },
                onConfirm: () => SongSettingsClipboard.pastePlaylistSettingsFromClipboard(selectedSongs, Toxen.playlist.name),
              });
            }}>
              Paste playlist settings to selected
            </Button>
          )}
          <Button onClick={() => {
            close();
            PlayQueue.clearQueue();
            selectedSongs.forEach(s => PlayQueue.addToQueue(s));
          }}>
            Add all to queue
          </Button>
          <Button onClick={() => {
            close();
            selectedSongs.forEach(s => PlayQueue.removeFromQueue(s));
          }}>
            Remove all from queue
          </Button>
          <CloudActions songs={selectedSongs} close={close} />
          <Button color="red" variant="light" onClick={() => {
            close();
            openDeleteSongDialog(selectedSongs);
          }}>
            Delete all…
          </Button>
        </Stack>
      )
    });
  }
}

interface CloudActionsProps {
  songs: Song[];
  close: () => void;
}

/**
 * Cloud buttons for the songs the menu acts on. Only the ones that apply to at least one song are shown.
 */
function CloudActions({ songs, close }: CloudActionsProps) {
  const toDownload = downloadable(songs);
  const toRemove = removable(songs);
  const toUpload = uploadable(songs);
  const suffix = (list: Song[]) => songs.length > 1 ? ` (${list.length})` : "";
  return (
    <>
      {toDownload.length > 0 && (
        <Button onClick={() => { close(); makeAvailableOffline(toDownload); }}>
          Make available offline{suffix(toDownload)}
        </Button>
      )}
      {toRemove.length > 0 && (
        <Button onClick={() => { close(); removeDownload(toRemove); }}>
          Remove download{suffix(toRemove)}
        </Button>
      )}
      {toUpload.length > 0 && (
        <Button onClick={() => { close(); uploadToCloud(toUpload); }}>
          Upload to cloud{suffix(toUpload)}
        </Button>
      )}
    </>
  );
}

/**
 * Modal settings for managing the playlists of a single song.
 */
export function createManagePlaylists(song: Song): ModalSettings {
  return {
    title: "Manage playlists",
    size: "lg",
    children: (
      <PlaylistManager
        songs={[song]}
      />
    )
  };
}

/**
 * Modal settings for managing the playlists of several songs at once.
 */
export function createManageMultiSongsPlaylists(songs: Song[]): ModalSettings {
  return {
    title: "Manage playlists",
    size: "lg",
    children: (
      <PlaylistManager
        songs={songs}
      />
    )
  };
}

/**
 * Modal settings for trimming a song to a start and end time. Desktop only.
 */
export function createTrimSongModal(song: Song): ModalSettings {
  return {
    title: "Trim Song",
    children: <TrimSong song={song} />,
    id: "trim-song-modal"
  };
}

interface TrimSongProps {
  song: Song;
}

function TrimSong(props: TrimSongProps) {
  const { song } = props;
  if (!toxenapi.isDesktop()) {
    toxenapi.throwDesktopOnly();
  }
  const _currentTime = Toxen.musicPlayer.media.currentTime;
  const _duration = Toxen.musicPlayer.media.duration;
  const _overHalfWay = _currentTime > _duration / 2;

  const [start, setStart] = useState<number>(_overHalfWay ? 0 : Toxen.musicPlayer.media.currentTime * 1000);
  const [end, setEnd] = useState<number>(_overHalfWay ? Toxen.musicPlayer.media.currentTime * 1000 : _duration * 1000);
  const [loading, setLoading] = useState(false);
  const [showMilliseconds, setShowMilliseconds] = useState(false);
  const [progress, setProgress] = useState(0);
  const modals = useModals();
  const browser = useMemo(() => toxenapi.remote.getCurrentWindow(), []);

  let attempts = 0;

  const startTrim = async () => {
    attempts++;
    setLoading(true);
    const result = await toxenapi.ffmpeg.installFFmpeg();
    if (!result)
      return Toxen.error("FFmpeg could not be installed.");
    try {
      await toxenapi.ffmpeg.trimSong(song, start / 1000, end / 1000, p => {
        browser.setProgressBar(p.percent / 100);
        setProgress(p.percent);
      });
      browser.setProgressBar(0);
    }
    catch {
      setLoading(false);
      if (attempts <= 3) {
        setTimeout(() => {
          startTrim();
        }, 1000);
      }
      else {
        attempts = 0;
        Toxen.error("Something went wrong trimming the song. Please try again", 5000);
      }
      browser.setProgressBar(0);
      return;
    }
    attempts = 0;
    setLoading(false);
    modals.closeModal("trim-song-modal");
    Toxen.log("Trimmed song: " + song.getDisplayName(), 2000);
  };

  return (<div className="trim-song-panel">
    <h2>Trimming {song.getDisplayName()}</h2>
    <p>Pick the start and end times of the song.</p>
    <RangeSlider
      min={0}
      max={Toxen.musicPlayer.media.duration * 1000}
      value={[start, end]}
      onChange={([start, end]) => {
        setStart(start);
        setEnd(end);
      }}
      label={v => Converter.numberToTime(v).toTimestamp(showMilliseconds ? "hh?:mm:ss:ms" : "hh?:mm:ss")}
      labelAlwaysOn
    />
    <br />
    <Checkbox label="Show milliseconds" checked={showMilliseconds} onChange={e => setShowMilliseconds(e.currentTarget.checked)} />
    <br />
    {
      progress > 0 ? (
        <>
          <Progress value={progress} animated color="green" />
          <br />
        </>
      ) : null
    }
    <Button loading={loading} onClick={startTrim}>
      Trim
    </Button>
  </div>);
}
