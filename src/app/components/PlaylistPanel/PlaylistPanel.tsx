import { 
  Button, 
  Checkbox, 
  Group, 
  Menu, 
  Stack, 
  TextInput, 
  ActionIcon, 
  Tooltip, 
  Card, 
  Badge,
  Image,
  Box,
  Text,
  Modal,
  FileInput,
  Switch,
  Divider,
  Alert
} from '@mantine/core';
import { useModals } from '@mantine/modals';
import { 
  IconCheck, 
  IconCheckbox, 
  IconCircle, 
  IconCircleX, 
  IconSelect,
  IconEdit,
  IconTrash,
  IconPhoto,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconMusic,
  IconUpload,
  IconX,
  IconSettings,
  IconPalette
} from '@tabler/icons-react';
import React, { Component, useState } from 'react'
import Playlist from '../../toxen/Playlist';
import { Toxen } from '../../ToxenApp';
import SidepanelSectionHeader from '../Sidepanel/SidepanelSectionHeader';
import "./PlaylistPanel.scss";
import { ModalsContextProps } from '@mantine/modals/lib/context';
// import Path from 'path';
// import fs from 'fs';
import Settings from '../../toxen/Settings';
import System from '../../toxen/System';

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
          <Group justify="space-between" w="100%">
            <h1>Playlist Manager</h1>
            <Badge variant="light" color="blue">{playlists.length}</Badge>
          </Group>
        </SidepanelSectionHeader>
        
        {this.state.playlistForm ? (
          <PlaylistForm playlistPanel={this} />
        ) : (
          <Stack gap="sm" mb="md">
            <Group grow>
              <Button 
                variant="light" 
                color="green" 
                leftSection={<IconMusic size={16} />}
                onClick={() => Toxen.sidePanel.setSectionId("songPanel")}
              >
                Music Panel
              </Button>
              <Button 
                variant="filled"
                leftSection={<IconPlus size={16} />}
                onClick={() => this.showPlaylistForm()}
              >
                Add Playlist
              </Button>
            </Group>
            
            {!Settings.isRemote() && Settings.getUser()?.premium && (
              <Button 
                variant="light" 
                color="blue"
                leftSection={<IconUpload size={16} />}
                onClick={() => Playlist.syncToRemote()}
              >
                Sync to Remote
              </Button>
            )}
          </Stack>
        )}
        
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
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);

  const update = () => {
    playlistPanel.update();
  };

  async function deletePlaylist(force = false) {
    if (toxenapi.isDesktop()) {
      if (playlist?.songBackground) {
        const imageNames = Object.values(playlist.songBackground);
        for (const imageName of imageNames) {
          const imagePath = toxenapi.joinPath(Playlist.getPlaylistBackgroundsDir(), imageName);
          try {
            toxenapi.fs.unlinkSync(imagePath);
          } catch (error) {
            Toxen.error(error.message, 3000);
          }
        }
      }
      
      if (playlist?.background) {
        const imagePath = toxenapi.joinPath(Playlist.getPlaylistBackgroundsDir(), playlist.background);
        try {
          toxenapi.fs.unlinkSync(imagePath);
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
    else {
      toxenapi.throwDesktopOnly("deletePlaylist");
    }
  }

  function BackgroundManager({ playlist, onClose }: { playlist: Playlist; onClose: () => void; }) {
    const [previewImage, setPreviewImage] = useState<string | null>(playlist?.getBackgroundPath(true, true));
    const [applyBackground, setApplyBackground] = useState(playlist?.applyBackground ?? false);

    const handleImageUpload = () => {
      if (toxenapi.isDesktop()) {
        let paths = toxenapi.remote.dialog.showOpenDialogSync(toxenapi.remote.getCurrentWindow(), {
          properties: ["openFile"],
          filters: [{
            name: "Image files",
            extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp"]
          }],
        });

        if (!paths || paths.length === 0) return;

        const playlistBackgroundsDir = Playlist.getPlaylistBackgroundsDir(true);
        let randomizedName: string;
        do {
          randomizedName = System.randomString(16) + toxenapi.path.extname(paths[0]);
        } while (toxenapi.fs.existsSync(toxenapi.path.join(playlistBackgroundsDir, randomizedName)));

        toxenapi.fs.copyFileSync(paths[0], toxenapi.path.join(playlistBackgroundsDir, randomizedName));

        if (playlist.background) {
          try {
            toxenapi.fs.unlinkSync(toxenapi.path.join(playlistBackgroundsDir, playlist.background));
          } catch (error) {
            console.warn('Failed to delete old background:', error);
          }
        }

        playlist.background = randomizedName;
        const newPath = playlist.getBackgroundPath(true, true);
        setPreviewImage(newPath);
        
        Playlist.save();
        update();
      }
    };

    const removeBackground = () => {
      if (playlist.background && toxenapi.isDesktop()) {
        try {
          toxenapi.fs.unlinkSync(toxenapi.path.join(Playlist.getPlaylistBackgroundsDir(), playlist.background));
        } catch (error) {
          console.warn('Failed to delete background file:', error);
        }
      }
      playlist.background = null;
      setPreviewImage(null);
      Playlist.save();
      update();
    };

    const handleApplyToggle = (checked: boolean) => {
      playlist.applyBackground = checked;
      setApplyBackground(checked);
      Playlist.save();
      update();
    };

    return (
      <Stack gap="md">
        <Alert color="blue" title="Background Settings">
          Customize the visual appearance of your playlist with a background image.
        </Alert>

        {previewImage && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Preview</Text>
            <Image
              src={previewImage}
              alt="Playlist background preview"
              radius="md"
              h={150}
              fit="cover"
              fallbackSrc="/api/placeholder/300/150"
            />
          </Box>
        )}

        <Group grow>
          <Button
            leftSection={<IconPhoto size={16} />}
            onClick={handleImageUpload}
            variant="light"
          >
            {previewImage ? "Change Background" : "Add Background"}
          </Button>
          
          {previewImage && (
            <Button
              leftSection={<IconTrash size={16} />}
              color="red"
              variant="light"
              onClick={removeBackground}
            >
              Remove
            </Button>
          )}
        </Group>

        {previewImage && (
          <Switch
            label="Apply background to playlist"
            description="Show background when this playlist is active"
            checked={applyBackground}
            onChange={(event) => handleApplyToggle(event.currentTarget.checked)}
          />
        )}

        <Divider />

        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Done
          </Button>
        </Group>
      </Stack>
    );
  }

  function EditPlaylistName({ playlist, onClose }: { playlist: Playlist; onClose: () => void; }) {
    const [playlistName, setPlaylistName] = useState(playlist?.name || "");

    const confirm = () => {
      if (!playlistName.trim()) {
        Toxen.error("Playlist name cannot be empty", 3000);
        return;
      }
      
      if (Toxen.playlists.find(p => p.name === playlistName.trim() && p !== playlist)) {
        Toxen.error("Playlist name already exists", 3000);
        return;
      }

      playlist.name = playlistName.trim();
      setPlaylistName(playlist.name);
      Playlist.save();
      playlistPanel.update();
      onClose();
    };

    return (
      <Stack gap="md">
        <TextInput
          label="Playlist name"
          placeholder="Enter playlist name"
          value={playlistName}
          onChange={(e) => setPlaylistName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
            }
          }}
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!playlistName.trim()}>
            Save
          </Button>
        </Group>
      </Stack>
    );
  }

  const contextMenuModal = (modals: ModalsContextProps) => {
    const close = () => modals.closeModal(modalId);

    const modalId = modals.openModal({
      title: `Playlist Options - ${playlist?.name}`,
      size: "lg",
      children: (
        <Stack gap="md">
          <Group grow>
            <Button
              leftSection={<IconEdit size={16} />}
              variant="light"
              onClick={() => {
                const closeEditModel = () => modals.closeModal(editModel);
                const editModel = modals.openModal({
                  title: `Edit Playlist`,
                  children: <EditPlaylistName playlist={playlist} onClose={closeEditModel} />,
                });
                close();
              }}
            >
              Rename
            </Button>
            <Button
              leftSection={<IconPalette size={16} />}
              variant="light"
              onClick={() => {
                const closeBackgroundModal = () => modals.closeModal(backgroundModal);
                const backgroundModal = modals.openModal({
                  title: `Background Settings`,
                  size: "lg",
                  children: <BackgroundManager playlist={playlist} onClose={closeBackgroundModal} />,
                });
                close();
              }}
            >
              Background
            </Button>
          </Group>

          <Divider />

          <Group grow>
            <Button
              leftSection={<IconTrash size={16} />}
              color="red"
              variant="light"
              onClick={() => {
                modals.openConfirmModal({
                  title: `Delete Playlist`,
                  children: (
                    <Stack gap="sm">
                      <Text>
                        Are you sure you want to delete the playlist <strong>{playlist?.name}</strong>?
                      </Text>
                      <Alert color="red" title="Warning">
                        This action cannot be undone. All background images will also be deleted.
                      </Alert>
                    </Stack>
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
          </Group>
        </Stack>
      ),
      onClose: close,
    });
  };

  const plBackground = playlist?.getBackgroundPath(true, true);
  const songCount = playlist?.songList?.length || 0;
  
  return (
    <Card
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
        if (playlist) contextMenuModal(modals);
      }}
      padding="md"
      radius="md"
      withBorder
    >
      <div
        className="playlist-item-background"
        style={{
          ...(plBackground ? {
            backgroundImage: `url("${plBackground}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.3,
          } : {}),
        }}
      />
      
      <Group justify="space-between" align="center" pos="relative" style={{ zIndex: 1 }}>
        <Box>
          <Text fw={500} size="md" className="playlist-item-title">
            {playlist?.name || "No playlist"}
          </Text>
          {playlist && (
            <Text size="xs" c="dimmed" mt={2}>
              {songCount} song{songCount !== 1 ? 's' : ''}
            </Text>
          )}
        </Box>
        
        <Group gap="xs">
          {playlist?.background && (
            <Tooltip label={playlist.applyBackground ? "Background enabled" : "Background disabled"}>
              <ActionIcon
                variant="subtle"
                size="sm"
                color={playlist.applyBackground ? "green" : "gray"}
              >
                {playlist.applyBackground ? <IconEye size={14} /> : <IconEyeOff size={14} />}
              </ActionIcon>
            </Tooltip>
          )}
          
          {currentPlaylist === playlist && (
            <Badge size="sm" variant="filled" color="blue">
              Active
            </Badge>
          )}
        </Group>
      </Group>
    </Card>
  );
}


function PlaylistForm(props: { playlistPanel: PlaylistPanel }) {
  const [playlistName, setPlaylistName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!playlistName.trim()) {
      Toxen.error("Playlist name cannot be empty", 3000);
      return;
    }

    setIsCreating(true);
    try {
      await props.playlistPanel.submit(playlistName.trim());
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card withBorder padding="md" radius="md" mb="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text fw={500} size="lg">Create New Playlist</Text>
          
          <TextInput
            label="Playlist name"
            placeholder="Enter playlist name..."
            value={playlistName}
            onChange={(e) => setPlaylistName(e.currentTarget.value)}
            required
            data-autofocus
            error={playlistName.trim() && Toxen.playlists.find(p => p.name === playlistName.trim()) ? "This name already exists" : undefined}
          />
          
          <Group justify="flex-end">
            <Button 
              variant="light" 
              onClick={() => props.playlistPanel.closePlaylistForm()}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              loading={isCreating}
              disabled={!playlistName.trim() || !!Toxen.playlists.find(p => p.name === playlistName.trim())}
            >
              Create Playlist
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}

