import { Menu } from '@mantine/core';
import { useModals } from '@mantine/modals';
import { remote } from 'electron';
import React, { Component } from 'react'
import Playlist from '../../toxen/Playlist';
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import Button from '../Button/Button';
import SidepanelSection from '../Sidepanel/SidepanelSection';
import SidepanelSectionHeader from '../Sidepanel/SidepanelSectionHeader';
import "./PlaylistPanel.scss";

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
    if (playlistName.length > 20) {
      Toxen.error("Playlist name cannot be longer than 20 characters", 3000);
      return;
    }
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
              <Button txStyle="action" onClick={() => Toxen.sidePanel.setSectionId("songPanel")}>To music panel</Button>
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

class PlaylistItem extends Component<PlaylistItemProps, PlaylistItemState> {
  constructor(props: PlaylistItemProps) {
    super(props);

    this.state = {};
  }

  update() {
    this.setState({});
  }

  public async deletePlaylist(force = false) {
    const pl = this.props.playlist;
    const currentPlaylist = Playlist.getCurrent();

    if (currentPlaylist === pl) {
      Toxen.playlist = null;
    }
    Toxen.playlists = Toxen.playlists.filter(p => p.name !== pl.name);
    Playlist.save();
    Toxen.log(<>
      Removed playlist: <code>{pl.name}</code>
    </>, 3000);

    this.props.playlistPanel.update();
  }

  private ContextMenu = (props: { playlist: Playlist }) => {

    // remote.Menu.buildFromTemplate([
    //   {
    //     label: "Manage " + this.props.playlist?.name,
    //     enabled: false
    //   },
    //   {
    //     type: "separator"
    //   },
    //   {
    //     label: "Delete",
    //     click: () => this.deletePlaylist(),
    //     // submenu: [
    //     //   {
    //     //     label: "Are you sure you want to delete " + this.props.playlist?.name + "?",
    //     //     submenu: [
    //     //       {
    //     //         label: "Confirm Deletion",
    //     //         click: () => this.deletePlaylist(true)
    //     //       }
    //     //     ]
    //     //   }
    //     // ]
    //   }
    // ]).popup();

    const pl = props.playlist;
    const modals = useModals();
    return (
      <Menu>
        <Menu.Item>
          Manage {pl?.name}
        </Menu.Item>
        <Menu.Item color="red" disabled={!pl} onClick={() => {
          modals.openConfirmModal({
            title: `Delete playlist "${pl?.name}"`,
            children: <>
              <p>Are you sure you want to delete the playlist <code>{pl?.name}</code>?</p>
              <p>This action cannot be undone.</p>
            </>,
            onConfirm: () => {
              this.deletePlaylist();
            },
            labels: {
              confirm: "Delete",
              cancel: "Cancel"
            },
            confirmProps: {
              color: "red"
            },
          });
        }}>
          Delete
        </Menu.Item>
      </Menu>
    );
  }

  render() {
    const pl = this.props.playlist;
    const currentPlaylist = Playlist.getCurrent();
    return (
      <>
        <div className="playlist-item" onClick={() => {
          Toxen.playlist = pl;
          this.props.playlistPanel.update();
        }}>
          <this.ContextMenu playlist={pl} />
          <span hidden={pl == currentPlaylist}><i className={"playlist-select far fa-circle"}></i></span>
          <span hidden={pl != currentPlaylist}><i className={"playlist-select fas fa-check-circle"}></i></span>
          <div className="playlist-item-title">
            <h3>{pl?.name || "No playlist"}</h3>
          </div>
        </div>
        <br />
      </>
    )
  }
}

function PlaylistForm(props: { playlistPanel: PlaylistPanel }) {
  const nameRef = React.useRef<HTMLInputElement>();
  return (
    <div>
      <label>Playlist name</label>
      <br />
      <input ref={nameRef} className="tx-form-field" />
      <br />
      <Button txStyle="cancel" onClick={() => props.playlistPanel.closePlaylistForm()}>Cancel</Button>
      <Button txStyle="action" onClick={() => props.playlistPanel.submit(nameRef.current.value)}>Create</Button>
    </div>
  )
}