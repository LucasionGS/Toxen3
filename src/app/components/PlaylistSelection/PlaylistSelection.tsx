import React, { Component, useState } from 'react'
import Song from '../../toxen/Song';
import { Toxen } from '../../ToxenApp';
import "./PlaylistSelection.scss";
import { 
  Modal, 
  Stack, 
  Button, 
  Group, 
  Text, 
  Badge, 
  Card, 
  Checkbox,
  TextInput,
  ActionIcon,
  Tooltip,
  Alert,
  Divider
} from '@mantine/core';
import { 
  IconPlus, 
  IconCheck, 
  IconX, 
  IconSearch,
  IconMusic,
  IconPlaylist
} from '@tabler/icons-react';
import Playlist from '../../toxen/Playlist';

interface PlaylistSelectionProps {
  songs: Song[];
  opened: boolean;
  onClose: () => void;
  title?: string;
}

interface PlaylistSelectionState {
  searchQuery: string;
  selectedPlaylists: Set<string>;
  showCreateForm: boolean;
  newPlaylistName: string;
}

export default class PlaylistSelection extends Component<PlaylistSelectionProps, PlaylistSelectionState> {
  constructor(props: PlaylistSelectionProps) {
    super(props);

    this.state = {
      searchQuery: '',
      selectedPlaylists: new Set(),
      showCreateForm: false,
      newPlaylistName: ''
    }
  }

  addToPlaylists = async () => {
    const { songs } = this.props;
    const { selectedPlaylists } = this.state;
    
    if (selectedPlaylists.size === 0) {
      Toxen.error("Please select at least one playlist", 3000);
      return;
    }

    try {
      for (const playlistName of selectedPlaylists) {
        const playlist = Toxen.playlists.find(p => p.name === playlistName);
        if (playlist) {
          await playlist.addSong(...songs);
        }
      }
      
      await Playlist.save();
      
      const playlistNames = Array.from(selectedPlaylists).join(', ');
      Toxen.log(
        <>
          Added {songs.length} song{songs.length !== 1 ? 's' : ''} to: {playlistNames}
        </>,
        3000
      );
      
      this.props.onClose();
    } catch (error) {
      Toxen.error(`Failed to add songs: ${error.message}`, 3000);
    }
  };

  createPlaylist = async () => {
    const { newPlaylistName } = this.state;
    const { songs } = this.props;
    
    if (!newPlaylistName.trim()) {
      Toxen.error("Playlist name cannot be empty", 3000);
      return;
    }
    
    if (Toxen.playlists.find(p => p.name === newPlaylistName.trim())) {
      Toxen.error("Playlist name already exists", 3000);
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
      this.props.onClose();
    } catch (error) {
      Toxen.error(`Failed to create playlist: ${error.message}`, 3000);
    }
  };

  togglePlaylist = (playlistName: string) => {
    const { selectedPlaylists } = this.state;
    const newSelected = new Set(selectedPlaylists);
    
    if (newSelected.has(playlistName)) {
      newSelected.delete(playlistName);
    } else {
      newSelected.add(playlistName);
    }
    
    this.setState({ selectedPlaylists: newSelected });
  };
  
  render() {
    const { opened, onClose, songs, title } = this.props;
    const { searchQuery, selectedPlaylists, showCreateForm, newPlaylistName } = this.state;
    
    const filteredPlaylists = Toxen.playlists.filter(playlist =>
      playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title={title || `Add ${songs.length} Song${songs.length !== 1 ? 's' : ''} to Playlist`}
        size="lg"
      >
        <Stack gap="md">
          <Alert color="blue" title="Song Selection">
            Adding {songs.length} song{songs.length !== 1 ? 's' : ''} to selected playlist{selectedPlaylists.size !== 1 ? 's' : ''}
          </Alert>

          <TextInput
            placeholder="Search playlists..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => this.setState({ searchQuery: e.currentTarget.value })}
          />

          <div className="playlist-selection-list">
            {filteredPlaylists.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                {searchQuery ? 'No playlists match your search' : 'No playlists available'}
              </Text>
            ) : (
              filteredPlaylists.map(playlist => (
                <PlaylistSelectionItem
                  key={playlist.name}
                  playlist={playlist}
                  selected={selectedPlaylists.has(playlist.name)}
                  onToggle={() => this.togglePlaylist(playlist.name)}
                />
              ))
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
                  }}
                />
                <Group justify="flex-end">
                  <Button 
                    variant="light" 
                    onClick={() => this.setState({ showCreateForm: false, newPlaylistName: '' })}
                  >
                    Cancel
                  </Button>
                  <Button onClick={this.createPlaylist}>
                    Create & Add Songs
                  </Button>
                </Group>
              </Stack>
            </Card>
          ) : (
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => this.setState({ showCreateForm: true })}
            >
              Create New Playlist
            </Button>
          )}

          <Group justify="space-between">
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={this.addToPlaylists}
              disabled={selectedPlaylists.size === 0}
              leftSection={<IconCheck size={16} />}
            >
              Add to {selectedPlaylists.size} Playlist{selectedPlaylists.size !== 1 ? 's' : ''}
            </Button>
          </Group>
        </Stack>
      </Modal>
    )
  }
}

interface PlaylistSelectionItemProps {
  playlist: Playlist;
  selected: boolean;
  onToggle: () => void;
}

function PlaylistSelectionItem({ playlist, selected, onToggle }: PlaylistSelectionItemProps) {
  const backgroundPath = playlist.getBackgroundPath(true, true);
  const songCount = playlist.songList.length;

  return (
    <Card
      className={`playlist-selection-item ${selected ? 'selected' : ''}`}
      onClick={onToggle}
      withBorder
      padding="sm"
      style={{ cursor: 'pointer' }}
    >
      <Group justify="space-between" align="center">
        <Group>
          <Checkbox
            checked={selected}
            onChange={() => {}} // Handled by card click
            size="sm"
          />
          
          <div className="playlist-selection-info">
            <Text fw={500} size="sm">
              {playlist.name}
            </Text>
            <Text size="xs" c="dimmed">
              {songCount} song{songCount !== 1 ? 's' : ''}
            </Text>
          </div>
        </Group>

        <Group gap="xs">
          {backgroundPath && (
            <Tooltip label="Has background">
              <ActionIcon variant="subtle" size="sm">
                <IconPlaylist size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          
          <Badge size="sm" variant="light">
            {songCount}
          </Badge>
        </Group>
      </Group>
      
      {backgroundPath && (
        <div
          className="playlist-selection-background"
          style={{
            backgroundImage: `url("${backgroundPath}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
    </Card>
  );
}