import React, { useMemo, useState } from "react";
import { useModals } from "@mantine/modals";
import type { ModalsContextProps, ModalSettings } from "../../../types/mantine-modals";
import { Checkbox, RangeSlider, Button, Progress, Stack } from "@mantine/core";
import { Toxen } from "../../ToxenApp";
import Song from "../../toxen/Song";
import Settings from "../../toxen/Settings";
import User from "../../toxen/User";
import Converter from "../../toxen/Converter";
import { PlayQueue } from "../../toxen/PlayQueue";
import { SongSettingsClipboard } from "../../toxen/SongSettingsClipboard";
import { SongLibrary } from "../../toxen/SongLibrary";
import { StorageSelector } from "../../toxen/storage/StorageSelector";
import PlaylistManager from "../PlaylistManager/PlaylistManager";

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
          <Button onClick={() => {
            close();
            modals.openConfirmModal({
              title: "Delete song",
              children: `Are you sure you want to delete "${song.title}"?`,
              onConfirm: async () => {
                try {
                  await SongLibrary.delete(song);
                } catch (error) {
                  Toxen.error(error);
                }
              },
              labels: {
                confirm: "Delete",
                cancel: "Cancel"
              },
              confirmProps: {
                color: "red"
              }
            });
          }}>
            Delete
          </Button>
          {StorageSelector.isLocal(song) && (
            <Button onClick={() => {
              close();
              modals.openModal(createTrimSongModal(song));
            }}>
              Trim
            </Button>
          )}
          {
            User.getCurrentUser()?.premium && !Settings.isRemote() && (
              <Button onClick={() => {
                close();
                song.sync();
              }}>
                Sync with remote
              </Button>
            )
          }
          {
            User.getCurrentUser()?.premium && Settings.isRemote() && toxenapi.isDesktop() && (
              <Button onClick={async () => {
                close();
                // Create the song on local with the info, then sync it

                // Check if sone already exists locally
                const localSongs = await Song.loadLocalSongs();

                const existingSong = localSongs.find(s => s.uid === song.uid);

                // Create the song locally
                const localDir = existingSong
                  ? existingSong.dirnameLocal()
                  : toxenapi.path.resolve(Settings.get("libraryDirectory"), song.uid);

                const download = () => song.downloadRemoteToLocal(localDir).then(() => {
                  Toxen.log("Song downloaded to local.", 2000);
                }).catch(error => {
                  Toxen.error("Failed to download song to local: " + error.message);
                });

                if ((await toxenapi.fs.promises.stat(localDir).catch(() => false))) {
                  const id = modals.openConfirmModal({
                    title: "Song already exists locally",
                    children: (
                      <Stack>
                        <p>
                          If you continue, the existing song will be deleted and replaced with the remote version. All unsynced local changes will be lost.
                          <br />
                          If you meant to sync the song differences, change to local mode and sync the song.
                        </p>
                      </Stack>
                    ),
                    labels: {
                      confirm: "Delete and redownload song",
                      cancel: "Cancel"
                    },
                    confirmProps: {
                      color: "red"
                    },
                    onConfirm: () => {
                      modals.closeModal(id);
                      download();
                    },
                    onCancel: () => {
                      modals.closeModal(id);
                    }
                  });
                }
                else {
                  download();
                }
              }}>
                Download to local
              </Button>
            )
          }
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
          <Button onClick={() => {
            close();
            modals.openConfirmModal({
              title: "Delete songs",
              children: `Are you sure you want to delete ${selectedSongs.length} songs?`,
              onConfirm: async () => {
                try {
                  await Promise.all(selectedSongs.map(s => SongLibrary.delete(s)));
                } catch (error) {
                  Toxen.error(error);
                }
              },
              labels: {
                confirm: "Delete",
                cancel: "Cancel"
              },
              confirmProps: {
                color: "red"
              }
            });
          }}>
            Delete all
          </Button>
          {
            User.getCurrentUser()?.premium && Settings.isRemote() && toxenapi.isDesktop() && (
              <Button onClick={() => {
                close();
                Song.downloadAllMissingRemoteToLocal(selectedSongs);
              }}>
                Download all missing to local
              </Button>
            )
          }
          {
            User.getCurrentUser()?.premium && !Settings.isRemote() && toxenapi.isDesktop() && (
              <Button onClick={() => {
                close();
                Toxen.syncSongs(selectedSongs);
              }}>
                Sync selected with remote
              </Button>
            )
          }
        </Stack>
      )
    });
  }
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
