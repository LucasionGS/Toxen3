import React, { Component } from "react";
import { Stack, Checkbox, Button, TextInput, Group, Text, Alert, Card, Divider } from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import Playlist from "../../toxen/Playlist";
import Song from "../../toxen/Song";
import "./PlaylistManager.scss";

interface PlaylistManagerProps {
  songs: Song[];
  onClose?: () => void;
}

interface PlaylistManagerState {
  searchQuery: string;
  showCreateForm: boolean;
  newPlaylistName: string;
}

export default class PlaylistManager extends Component<PlaylistManagerProps, PlaylistManagerState> {
  constructor(props: PlaylistManagerProps) {
    super(props);
    this.state = {
      searchQuery: '',
      showCreateForm: false,
      newPlaylistName: ''
    };
  }

  createPlaylist = async () => {
    const { songs, onClose } = this.props;
    const { newPlaylistName } = this.state;

    if (!newPlaylistName.trim()) {
      Toxen.error("Please enter a playlist name", 3000);
      return;
    }

    if (Toxen.playlists.some(p => p.name.toLowerCase() === newPlaylistName.trim().toLowerCase())) {
      Toxen.error("A playlist with that name already exists", 3000);
      return;
    }

    try {
      const playlist = Playlist.create({
        name: newPlaylistName.trim(),
        songList: []
      });
      
      await playlist.addSong(...songs);
      Toxen.playlists.push(playlist);
      await Playlist.save();
      
      Toxen.log(
        <>
          Created playlist "{playlist.name}" with {songs.length} song{songs.length !== 1 ? 's' : ''}
        </>,
        3000
      );
      
      this.setState({ showCreateForm: false, newPlaylistName: '' });
      if (onClose) onClose();
    } catch (error) {
      Toxen.error(`Failed to create playlist: ${error.message}`, 3000);
    }
  };

  togglePlaylistMembership = async (playlist: Playlist, checked: boolean) => {
    const { songs } = this.props;
    
    try {
      if (checked) {
        await playlist.addSong(...songs);
      } else {
        songs.forEach(song => playlist.removeSong(song));
      }
      await Playlist.save();
      
      // Force re-render to update checkbox states
      this.forceUpdate();
    } catch (error) {
      Toxen.error(`Failed to update playlist: ${error.message}`, 3000);
    }
  };

  isPlaylistSelected = (playlist: Playlist): boolean => {
    const { songs } = this.props;
    if (songs.length === 0) return false;
    
    // If all songs are in the playlist, return true
    // If some songs are in the playlist, return indeterminate (we'll handle this in render)
    return songs.every(song => playlist.songList.includes(song));
  };

  isPlaylistIndeterminate = (playlist: Playlist): boolean => {
    const { songs } = this.props;
    if (songs.length === 0) return false;
    
    const songsInPlaylist = songs.filter(song => playlist.songList.includes(song));
    return songsInPlaylist.length > 0 && songsInPlaylist.length < songs.length;
  };

  render() {
    const { songs } = this.props;
    const { searchQuery, showCreateForm, newPlaylistName } = this.state;
    
    const filteredPlaylists = Toxen.playlists.filter(playlist =>
      playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <Stack gap="md">
        <Alert color="blue" title="Playlist Management">
          Managing playlists for {songs.length} song{songs.length !== 1 ? 's' : ''}
        </Alert>

        <TextInput
          placeholder="Search playlists..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => this.setState({ searchQuery: e.currentTarget.value })}
        />

        <div className="playlist-manager-list">
          {filteredPlaylists.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {searchQuery ? 'No playlists match your search' : 'No playlists available'}
            </Text>
          ) : (
            <Stack gap="xs">
              {filteredPlaylists.map(playlist => {
                const isSelected = this.isPlaylistSelected(playlist);
                const isIndeterminate = this.isPlaylistIndeterminate(playlist);
                const backgroundPath = playlist.getBackgroundPath(true, true); // Get only global background, ignore applyBackground setting
                
                return (
                  <div key={playlist.name} className="playlist-manager-item">
                    <div className="playlist-manager-item-wrapper">
                      {backgroundPath && (
                        <div 
                          className="playlist-manager-item-background"
                          style={{
                            backgroundImage: `url("file://${backgroundPath}")`,
                          }}
                        />
                      )}
                      <div className="playlist-manager-item-overlay">
                        <Checkbox
                          size="md"
                          styles={{
                            input: backgroundPath ? {
                              backgroundColor: 'rgba(255, 255, 255, 0.9)',
                              borderColor: 'rgba(255, 255, 255, 0.9)',
                            } : {},
                            icon: backgroundPath ? {
                              color: 'var(--mantine-color-blue-6)',
                            } : {},
                          }}
                          label={
                            <div className="playlist-manager-item-content">
                              <Text fw={500} c={backgroundPath ? "white" : undefined}>
                                {playlist.name}
                              </Text>
                              <Text size="sm" c={backgroundPath ? "rgba(255, 255, 255, 0.8)" : "dimmed"}>
                                {playlist.songList.length} song{playlist.songList.length !== 1 ? 's' : ''}
                              </Text>
                            </div>
                          }
                          checked={isSelected}
                          indeterminate={isIndeterminate}
                          onChange={(e) => this.togglePlaylistMembership(playlist, e.currentTarget.checked)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </Stack>
          )}
        </div>

        <Divider />

        {showCreateForm ? (
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Text fw={500}>Create New Playlist</Text>
              <TextInput
                placeholder="Enter playlist name..."
                value={newPlaylistName}
                onChange={(e) => this.setState({ newPlaylistName: e.currentTarget.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    this.createPlaylist();
                  }
                  if (e.key === 'Escape') {
                    this.setState({ showCreateForm: false, newPlaylistName: '' });
                  }
                }}
                autoFocus
              />
              <Group justify="flex-end">
                <Button 
                  variant="subtle" 
                  onClick={() => this.setState({ showCreateForm: false, newPlaylistName: '' })}
                >
                  Cancel
                </Button>
                <Button onClick={this.createPlaylist}>
                  Create Playlist
                </Button>
              </Group>
            </Stack>
          </Card>
        ) : (
          <Button 
            leftSection={<IconPlus size={16} />}
            variant="light"
            onClick={() => this.setState({ showCreateForm: true })}
          >
            Create New Playlist
          </Button>
        )}
      </Stack>
    );
  }
}
