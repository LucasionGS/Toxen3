import { Button, Checkbox, Group, Menu, Stack, TextInput } from '@mantine/core';
import { useModals } from '@mantine/modals';
import { IconCheck, IconCheckbox, IconCircle, IconCircleX, IconSelect } from '@tabler/icons-react';
import React, { Component, useState } from 'react'
import Playlist from '../../toxen/Playlist';
import { Toxen } from '../../ToxenApp';
import SidepanelSectionHeader from '../Sidepanel/SidepanelSectionHeader';
import "./PlaylistPanel.scss";
import { ModalsContextProps } from '@mantine/modals/lib/context';
import Path from 'path';
import fs from 'fs';

interface PlaylistPanelProps { }

interface PlaylistPanelState {
  playlistForm: boolean;
}

export default class PlaylistPanel extends Component<PlaylistPanelProps, PlaylistPanelState> {
  constructor(props: PlaylistPanelProps) {
    super(props);

    this.state = {
      playlistForm: false,
    };
  }

  public update() {
    this.setState({});
  }

  public submit(playlistName: string) {
    if (!playlistName) {
      Toxen.error("Playlist name cannot be empty", 3000);
      return;
    }
    // if (playlistName.length > 20) {
    //   Toxen.error("Playlist name cannot be longer than 20 characters", 3000);
    //   return;
    // }
    if (Toxen.playlists.find(p => p.name === playlistName)) {
      Toxen.error("Playlist name already exists", 3000);
      return;
    }

    const pl = Playlist.create({
      name: playlistName,
      
      songList: []
    });

    this.addPlaylist(pl);
  }

  public addPlaylist(playlist: Playlist) {
    Toxen.playlists.push(playlist);
    Playlist.save();
    this.closePlaylistForm();
    Toxen.log(<>
      Added playlist: <code>{playlist.name}</code>
    </>, 3000);
  }

  public showPlaylistForm() {
    this.setState({ playlistForm: true });
  }

  public closePlaylistForm() {
    this.setState({ playlistForm: false });
  }

  render() {
    const playlists = Toxen.playlists;
    const playlistsItems = playlists.map((pl, i) => <PlaylistItem key={pl.name} playlist={pl} playlistPanel={this} />);
    playlistsItems.unshift(<PlaylistItem key="<none>" playlist={null} playlistPanel={this} />);
    return (
      <>
        <SidepanelSectionHeader>
          <h1>Playlist Manager</h1>
        </SidepanelSectionHeader>
        {
          this.state.playlistForm ?
            <PlaylistForm playlistPanel={this} />
            :
            <>
              <Button color="green" onClick={() => Toxen.sidePanel.setSectionId("songPanel")}>To music panel</Button>
              <Button onClick={() => this.showPlaylistForm()}>Add playlist</Button>
            </>
        }
        <div className="playlist-list">
          {playlistsItems}
        </div>
      </>
    )
  }
}

interface PlaylistItemProps { playlist: Playlist, playlistPanel: PlaylistPanel }

interface PlaylistItemState { }

function PlaylistItem(props: PlaylistItemProps) {
  const { playlist, playlistPanel } = props;
  const currentPlaylist = Playlist.getCurrent();
  const modals = useModals();

  const update = () => {
    // You can use a state if needed for re-rendering
    // const [state, setState] = useState({});
    // setState({});
  };

  async function deletePlaylist(force = false) {

    if (currentPlaylist?.songBackground) {
      const imageNames = Object.values(currentPlaylist.songBackground);
      for (const imageName of imageNames) {
        const imagePath = Path.join(Playlist.getPlaylistBackgroundsDir(), imageName);
        try {
          fs.unlinkSync(imagePath);
        } catch (error) {
          Toxen.error(error.message, 3000);
        }
      }
    }

    if (currentPlaylist?.background) {
      const imagePath = Path.join(Playlist.getPlaylistBackgroundsDir(), currentPlaylist.background);
      try {
        fs.unlinkSync(imagePath);
      } catch (error) {
        Toxen.error(error.message, 3000);
      }
    }
    
    if (currentPlaylist === playlist) {
      Toxen.playlist = null;
    }
    Toxen.playlists = Toxen.playlists.filter(p => p.name !== playlist.name);

    Playlist.save();
    Toxen.log(
      <>
        Removed playlist: <code>{playlist.name}</code>
      </>,
      3000
    );

    playlistPanel.update();
  }

  function EditPlaylistName({ playlist, onClose }: { playlist: Playlist; onClose: () => void; }) {
    const [playlistName, setPlaylistName] = useState(playlist?.name || "");

    const confirm = () => {
      playlist.name = playlistName.trim();
      setPlaylistName(playlist.name);
      Playlist.save();
      playlistPanel.update();
      onClose();
    };

    return (
      <div>
        <TextInput
          label="Playlist name"
          value={playlistName}
          onChange={(e) => {
            setPlaylistName(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            }
          }} />
        <Group>
          <Button color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button color="green" onClick={confirm}>
            Save
          </Button>
        </Group>
      </div>
    );
  }

  const contextMenuModal = (modals: ModalsContextProps) => {
    const close = () => modals.closeModal(modalId);

    const modalId = modals.openModal({
      title: "Playlist options",
      children: (
        <Stack>
          <Button
            onClick={() => {
              const closeEditModel = () => modals.closeModal(editModel);
              const editModel = modals.openModal({
                title: `Edit playlist "${playlist?.name}"`,
                children: (
                  <div>
                    <EditPlaylistName playlist={playlist} onClose={closeEditModel} />
                  </div>
                ),
              });
              close();
            }}
          >
            Change name
          </Button>
          <Button
            onClick={() => {
              playlist.promptSetBackground(modals);
              close();
            }}
          >
            Set background
          </Button>
          {playlist.background && (
            <Checkbox
              label="Apply background"
              defaultChecked={playlist.applyBackground}
              onChange={() => {
                playlist.applyBackground = !playlist.applyBackground;
                Playlist.save();
                update();
              }}
            >
              Show playlist background
            </Checkbox>
          )}
          <Button
            color="red"
            onClick={() => {
              modals.openConfirmModal({
                title: `Delete playlist "${playlist?.name}"`,
                children: (
                  <>
                    <p>
                      Are you sure you want to delete the playlist <code>{playlist?.name}</code>?
                    </p>
                    <p>This action cannot be undone.</p>
                  </>
                ),
                onConfirm: () => {
                  deletePlaylist();
                },
                labels: {
                  confirm: "Delete",
                  cancel: "Cancel",
                },
                confirmProps: {
                  color: "red",
                },
              });
              close();
            }}
          >
            Delete
          </Button>
        </Stack>
      ),
      onClose: close,
    });
  };

  const plBackground = playlist?.getBackgroundPath(true, true);
  
  return (
    <div
      className={[
        "playlist-item",
        currentPlaylist === playlist ? "playlist-item-current" : "",
      ].join(" ")}
      onClick={() => {
        Toxen.playlist = playlist;
        playlistPanel.update();
      }}
      onContextMenu={(e) => {
        e.preventDefault();

        // Unless its the default playlist, show the context menu
        if (playlist) contextMenuModal(modals);
      }}
    >
      <div
        className="playlist-item-background"
        style={{
          ...(
            plBackground ? {
              backgroundImage: `url("${plBackground}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            } : {}
          ),
        }}
      ></div>
      <div className="playlist-item-title">
        <h3>{playlist?.name || "No playlist"}</h3>
      </div>
    </div>
  );
}


function PlaylistForm(props: { playlistPanel: PlaylistPanel }) {
  const nameRef = React.useRef<HTMLInputElement>();
  return (
    <div>
      <label>Playlist name</label>
      <br />
      <input ref={nameRef} className="tx-form-field" />
      <br />
      <Button color="red" onClick={() => props.playlistPanel.closePlaylistForm()}>Cancel</Button>
      <Button color="green" onClick={() => props.playlistPanel.submit(nameRef.current.value)}>Create</Button>
    </div>
  )
}

