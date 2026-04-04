import { Alert, Autocomplete, Button, Checkbox, Group, Image, Modal, Progress, TextInput, Card, Text, Badge, ActionIcon, Stack, Divider, Loader, Tooltip, Select } from '@mantine/core';
import { updateNotification } from '@mantine/notifications';
import { IconDownload, IconExternalLink, IconMusic, IconAlertTriangle, IconCheck, IconClock, IconLanguage, IconList } from '@tabler/icons-react';
import React from 'react'
import System, { ToxenFile } from '../../../../toxen/System';
import { Toxen } from '../../../../ToxenApp';
import { VideoInfo } from '../../../../toxen/desktop/Ytdlp';
import Settings from '../../../../toxen/Settings';
import Playlist from '../../../../toxen/Playlist';
import ExternalUrl from '../../../ExternalUrl/ExternalUrl';
import './ImportPanel.scss';
import type DesktopController from '../../../../../ToxenControllers/DesktopController';

type ImportStatus = 'pending' | 'importing' | 'done' | 'error';

interface PlaylistVideoEntry {
  video: VideoInfo;
  selected: boolean;
  title: string;
  artist: string;
  status: ImportStatus;
}

function isPlaylistUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be'))
      && u.searchParams.has('list')
    );
  } catch {
    return false;
  }
}

function parseYouTubeTitle(raw: string): { title: string; artist: string | null } {
  const sep = raw.includes(' - ') ? ' - ' : raw.includes(' \u2013 ') ? ' \u2013 ' : null;
  if (sep) {
    const idx = raw.indexOf(sep);
    return { artist: raw.slice(0, idx).trim(), title: raw.slice(idx + sep.length).trim() };
  }
  return { title: raw, artist: null };
}

function buildEntries(videos: VideoInfo[]): PlaylistVideoEntry[] {
  const existingUrls = new Set((Toxen.songList ?? []).map(s => s.url).filter(Boolean));
  return videos.map(video => {
    const parsed = parseYouTubeTitle(video.title);
    const title = video.track || parsed.title;
    const artist = video.artist || video.creator || parsed.artist || video.uploader || '';
    const alreadyImported = existingUrls.has(video.original_url);
    return { video, selected: !alreadyImported, title, artist, status: 'pending' };
  });
}

export default function ImportPanel() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="import-panel">
      <h1>Import music</h1>
      <Button
        leftSection={<IconMusic size={16} />}
        variant="light"
        onClick={() => {
          if (toxenapi.isDesktop() && !Settings.isRemote()) {
            let paths = toxenapi.remote.dialog.showOpenDialogSync(toxenapi.remote.getCurrentWindow(), {
              properties: [
                "multiSelections",
                "openFile"
              ],
              filters: [
                {
                  name: "Media & Song Packages",
                  extensions: [...Toxen.getSupportedMediaFiles().map(ext => ext.replace(".", "")), "txz"]
                },
              ],
            });

            if (!paths || paths.length == 0)
              return;

            const promisedFiles: ToxenFile[] = paths.map(p => ({
              name: (toxenapi as DesktopController).path.basename(p),
              path: p
            }));
            Promise.all(promisedFiles).then(files => {
              System.handleImportedFiles(files);
            });
          }
          else {
            // Web / remote: use HTML file picker
            fileInputRef.current?.click();
          }
        }}
      >Import Files</Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={Toxen.getSupportedMediaFiles().join(",")}
        style={{ display: "none" }}
        onChange={(e) => {
          const fileList = e.target.files;
          if (!fileList || fileList.length === 0) return;
          System.handleImportedFiles(fileList);
          // Reset so the same files can be selected again
          e.target.value = "";
        }}
      />
      
      <Divider my="md" />
      
      <ImportOnlineMedia />
    </div>
  );
}

function ImportOnlineMedia() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [url, setUrl] = React.useState<string>("");
  const [importing, setImporting] = React.useState<boolean>(false);
  const [videos, setVideos] = React.useState<VideoInfo[]>([]);
  const [playlistEntries, setPlaylistEntries] = React.useState<PlaylistVideoEntry[] | null>(null);
  const [playlistTitle, setPlaylistTitle] = React.useState<string>("");
  const [acceptedResponsibility, setAcceptedResponsibility] = React.useState<boolean>(() => Settings.get("acceptedResponsibility"));

  React.useEffect(() => {
    Settings.set("acceptedResponsibility", acceptedResponsibility);
    Settings.save({ suppressNotification: true });
  }, [acceptedResponsibility]);

  const Ytdlp = React.useMemo(() => toxenapi.isDesktop() ? toxenapi.getYtdlp() : null, []);

  if (!toxenapi.isDesktop()) {
    return null;
  }
  
  return (
    <>
      <Button
        leftSection={<IconDownload size={16} />}
        variant="filled"
        color="blue"
        onClick={() => setModalOpen(true)}
        fullWidth
      >
        Media Downloader
      </Button>
      
      {acceptedResponsibility ? (
        <Modal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Media Downloader"
          size="lg"
          className="media-downloader-modal"
        >
          <Stack gap="md">
            <Alert color="orange" title="Usage Guidelines" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm">
                Please ensure you have the right to download and use this content.
                Respect copyright laws and platform terms of service.
              </Text>
            </Alert>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!url) return;
              
              setImporting(true);
              setVideos([]);
              setPlaylistEntries(null);
              
              try {
                if (isPlaylistUrl(url)) {
                  const vids = await Ytdlp.getPlaylistVideos(url);
                  if (vids.length === 0) {
                    Toxen.error("No videos found in playlist", 3000);
                  } else {
                    setPlaylistTitle(vids[0]?.playlist_title || "YouTube Playlist");
                    setPlaylistEntries(buildEntries(vids));
                  }
                } else {
                  const videoInfos = await Ytdlp.getVideoInfo(url);
                  setVideos(videoInfos);
                }
              } catch (error) {
                Toxen.error("Failed to load video information", 3000);
              }
              setImporting(false);
            }}>
              <Group gap="sm">
                <TextInput
                  placeholder="https://youtube.com/watch?v=... or https://soundcloud.com/..."
                  value={url}
                  onChange={e => setUrl(e.currentTarget.value)}
                  style={{ flex: 1 }}
                  disabled={importing}
                  leftSection={<IconExternalLink size={16} />}
                />
                <Button
                  type="submit"
                  loading={importing}
                  disabled={importing || !url.trim()}
                  leftSection={!importing ? <IconDownload size={16} /> : undefined}
                >
                  {importing ? "Loading..." : "Load"}
                </Button>
              </Group>
            </form>

            <div className={`video-results ${importing ? 'loading' : ''}`}>
              {importing && <Loader size="md" />}
              {playlistEntries !== null ? (
                <PlaylistImportView
                  entries={playlistEntries}
                  setEntries={setPlaylistEntries}
                  playlistTitle={playlistTitle}
                />
              ) : (
                videos.map(v => (
                  <VideoCard key={v.original_url} video={v} />
                ))
              )}
            </div>
          </Stack>
        </Modal>
      ) : (
        <Modal 
          opened={modalOpen} 
          onClose={() => setModalOpen(false)}
          title="Media Downloader - Terms & Conditions"
          size="lg"
        >
          <Stack gap="md">
            <Alert color="red" title="Important Notice" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={500}>
                By using this feature, you agree that you are responsible for the content you import.
              </Text>
            </Alert>
            
            <Stack gap="xs">
              <Text size="sm">• Importing content from these providers may be illegal in your country</Text>
              <Text size="sm">• Do not import content you do not have the rights to</Text>
              <Text size="sm">• Do not import content that is illegal in your country</Text>
              <Text size="sm">• Do not import content that violates platform Terms of Service</Text>
              <Text size="sm">• Toxen is not responsible for any content you import</Text>
            </Stack>
            
            <Divider />
            
            <Text size="sm">
              This feature downloads <ExternalUrl href="https://github.com/yt-dlp/yt-dlp">
                <Badge variant="light" size="sm">yt-dlp</Badge>
              </ExternalUrl> and <ExternalUrl href="https://ffmpeg.org/">
                <Badge variant="light" size="sm">ffmpeg</Badge>
              </ExternalUrl> to download and convert media files.
            </Text>
            
            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                color="green" 
                onClick={() => setAcceptedResponsibility(true)}
                leftSection={<IconDownload size={16} />}
              >
                I Understand
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  )
}

function PlaylistEntryRow({ entry, disabled, onChange }: {
  entry: PlaylistVideoEntry;
  disabled: boolean;
  onChange: (patch: Partial<PlaylistVideoEntry>) => void;
}) {
  const statusBadge = () => {
    switch (entry.status) {
      case 'importing': return <Badge size="xs" color="blue" variant="light"><IconClock size={10} style={{ marginRight: 3 }} />Importing</Badge>;
      case 'done':      return <Badge size="xs" color="green" variant="light"><IconCheck size={10} style={{ marginRight: 3 }} />Done</Badge>;
      case 'error':     return <Badge size="xs" color="red" variant="light"><IconAlertTriangle size={10} style={{ marginRight: 3 }} />Error</Badge>;
      default:          return <Badge size="xs" color="gray" variant="light">Pending</Badge>;
    }
  };

  return (
    <div className="playlist-entry-row">
      <Checkbox
        checked={entry.selected}
        onChange={(e) => onChange({ selected: e.currentTarget.checked })}
        disabled={disabled || entry.status === 'done'}
      />
      {entry.video.thumbnail ? (
        <img src={entry.video.thumbnail} alt="" className="playlist-entry-thumbnail" />
      ) : (
        <div className="playlist-entry-thumbnail playlist-entry-thumbnail--empty" />
      )}
      <TextInput
        value={entry.title}
        onChange={(e) => onChange({ title: e.currentTarget.value })}
        placeholder="Title"
        disabled={disabled || entry.status === 'done'}
        size="xs"
        style={{ flex: 2, minWidth: 0 }}
      />
      <TextInput
        value={entry.artist}
        onChange={(e) => onChange({ artist: e.currentTarget.value })}
        placeholder="Artist"
        disabled={disabled || entry.status === 'done'}
        size="xs"
        style={{ flex: 1, minWidth: 0 }}
      />
      <div style={{ flexShrink: 0 }}>{statusBadge()}</div>
    </div>
  );
}

function PlaylistImportView({ entries, setEntries, playlistTitle }: {
  entries: PlaylistVideoEntry[];
  setEntries: React.Dispatch<React.SetStateAction<PlaylistVideoEntry[] | null>>;
  playlistTitle: string;
}) {
  const [targetPlaylist, setTargetPlaylist] = React.useState<string>('');
  const [isImporting, setIsImporting] = React.useState<boolean>(false);
  const ytdlp = React.useMemo(() => toxenapi.isDesktop() ? toxenapi.getYtdlp() : null, []);

  const updateEntry = (index: number, patch: Partial<PlaylistVideoEntry>) => {
    setEntries(prev => prev?.map((e, i) => i === index ? { ...e, ...patch } : e) ?? prev);
  };

  const pendingSelected = entries.filter(e => e.selected && e.status === 'pending');
  const selectedCount = pendingSelected.length;

  const handleImport = async () => {
    const toImport = entries.map((e, i) => ({ ...e, idx: i })).filter(e => e.selected && e.status === 'pending');
    if (toImport.length === 0 || !ytdlp) return;

    setIsImporting(true);
    const notifId = Toxen.notify({
      title: `Importing ${toImport.length} song${toImport.length !== 1 ? 's' : ''}`,
      content: `0 / ${toImport.length}`,
    });

    const importedSongs: any[] = [];

    for (let i = 0; i < toImport.length; i++) {
      const item = toImport[i];
      updateEntry(item.idx, { status: 'importing' });
      updateNotification({
        id: notifId,
        title: `Importing ${i + 1} / ${toImport.length}`,
        message: item.title,
        autoClose: false,
      });

      try {
        const song = await ytdlp.importAudio(item.video, () => {}, null);
        if (song) {
          const needsUpdate = song.title !== item.title || (song.artist || '') !== item.artist;
          if (needsUpdate) {
            song.title = item.title;
            song.artist = item.artist || undefined;
            await song.saveInfo();
          }
          importedSongs.push(song);
        }
        updateEntry(item.idx, { status: 'done' });
      } catch (err) {
        console.error('Failed to import:', item.title, err);
        updateEntry(item.idx, { status: 'error' });
      }
    }

    // Assign to Toxen playlist if specified
    const playlistName = targetPlaylist.trim();
    if (playlistName && importedSongs.length > 0) {
      let pl = Toxen.playlists?.find(p => p.name === playlistName);
      if (!pl) {
        pl = Playlist.create({ name: playlistName, songList: [] });
        Playlist.addPlaylist(pl);
      }
      await pl.addSong(...importedSongs);
      await Playlist.save();
      Toxen.playlistPanel?.update();
    }

    updateNotification({
      id: notifId,
      title: 'Import complete',
      message: `Imported ${importedSongs.length} of ${toImport.length} songs`,
      autoClose: 4000,
      color: 'green',
    });

    Toxen.updateSongPanels();
    setIsImporting(false);
  };

  return (
    <Stack gap="sm" className="playlist-import-view">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconList size={16} />
          <Text fw={500} size="sm" lineClamp={1}>{playlistTitle}</Text>
        </Group>
        <Badge variant="light">{entries.length} videos</Badge>
      </Group>

      <Autocomplete
        label="Add to Toxen Playlist (optional)"
        placeholder="Select or type a playlist name..."
        data={(Toxen.playlists ?? []).map(p => p.name)}
        value={targetPlaylist}
        onChange={setTargetPlaylist}
        disabled={isImporting}
        size="sm"
      />

      <Group gap="xs" justify="space-between">
        <Group gap="xs">
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setEntries(prev => prev?.map(e => ({ ...e, selected: true })) ?? prev)}
            disabled={isImporting}
          >
            Select All
          </Button>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setEntries(prev => prev?.map(e => ({ ...e, selected: false })) ?? prev)}
            disabled={isImporting}
          >
            Deselect All
          </Button>
        </Group>
        <Text size="xs" c="dimmed">{selectedCount} selected</Text>
      </Group>

      <div className="playlist-entry-list">
        {entries.map((entry, i) => (
          <PlaylistEntryRow
            key={entry.video.original_url + i}
            entry={entry}
            disabled={isImporting}
            onChange={(patch) => updateEntry(i, patch)}
          />
        ))}
      </div>

      <Button
        fullWidth
        disabled={selectedCount === 0 || isImporting}
        loading={isImporting}
        leftSection={<IconDownload size={16} />}
        onClick={handleImport}
      >
        Import {selectedCount} selected song{selectedCount !== 1 ? 's' : ''}
      </Button>
    </Stack>
  );
}

function VideoCard(props: { video: VideoInfo }) {
  const { video } = props;
  const [importing, setImporting] = React.useState<boolean>(false);
  const [progress, setProgress] = React.useState<number>(0);
  const [imported, setImported] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSubtitle, setSelectedSubtitle] = React.useState<string | null>(null);

  const Ytdlp = React.useMemo(() => toxenapi.isDesktop() ? toxenapi.getYtdlp() : null, []);
  
  if (!toxenapi.isDesktop()) {
    return null;
  }

  // Get available subtitle languages
  const availableSubtitles = React.useMemo(() => {
    if (!Ytdlp) return [];
    return Ytdlp.getAvailableSubtitleLanguages(video);
  }, [video, Ytdlp]);

  const subtitleOptions = React.useMemo(() => {
    const options = [{ value: '', label: 'None' }];
    availableSubtitles.forEach(sub => {
      options.push({
        value: sub.code,
        label: `${sub.name} (${sub.type === 'caption' ? 'Auto' : 'Manual'})`
      });
    });
    return options;
  }, [availableSubtitles]);

  const getStatusBadge = () => {
    if (error) {
      return (
        <Badge variant="light" color="red" size="sm">
          <IconAlertTriangle size={12} style={{ marginRight: 4 }} />
          Error
        </Badge>
      );
    }
    if (imported) {
      return (
        <Badge variant="light" color="green" size="sm">
          <IconCheck size={12} style={{ marginRight: 4 }} />
          Imported
        </Badge>
      );
    }
    if (importing) {
      return (
        <Badge variant="light" color="blue" size="sm">
          <IconClock size={12} style={{ marginRight: 4 }} />
          Importing
        </Badge>
      );
    }
    return (
      <Badge variant="light" size="sm">
        <IconMusic size={12} style={{ marginRight: 4 }} />
        Ready
      </Badge>
    );
  };
  
  return (
    <Card className="video-card" withBorder>
      <div className="video-thumbnail-container">
        <Image
          src={video.thumbnail}
          alt={video.title}
          className="video-thumbnail"
          fallbackSrc="/api/placeholder/320/180"
        />
        <div className="video-overlay">
          <Group justify="space-between" align="flex-start" className="video-info">
            <Stack gap={2} className="video-details">
              <Text fw={500} size="sm" lineClamp={2} className="video-title">
                {video.title}
              </Text>
              <Text size="xs" c="dimmed">
                by {video.uploader}
              </Text>
            </Stack>
            
            {getStatusBadge()}
          </Group>
        </div>
      </div>
      
      <Stack gap="sm" mt="sm">
        {/* Subtitle Selection */}
        {availableSubtitles.length > 0 && (
          <div className="subtitle-section">
            <div className="subtitle-header">
              <IconLanguage size={14} />
              <Text size="xs" fw={500}>Subtitles</Text>
              <Badge variant="dot" size="xs" color="blue">
                {availableSubtitles.length} available
              </Badge>
            </div>
            <Select
              size="xs"
              placeholder="Select subtitle language..."
              data={subtitleOptions}
              value={selectedSubtitle}
              onChange={setSelectedSubtitle}
              disabled={importing || imported}
              clearable={false}
              searchable
            />
          </div>
        )}
        
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Tooltip label="Open original video">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => window.open(video.original_url, '_blank')}
              >
                <IconExternalLink size={14} />
              </ActionIcon>
            </Tooltip>
            
            {error && (
              <Tooltip label={error}>
                <ActionIcon variant="subtle" size="sm" color="red">
                  <IconAlertTriangle size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
          
          <Button
            size="sm"
            variant={imported ? "light" : error ? "light" : "filled"}
            color={imported ? "green" : error ? "red" : "blue"}
            loading={importing}
            disabled={importing || imported}
            leftSection={
              imported ? <IconCheck size={14} /> : 
              error ? <IconAlertTriangle size={14} /> :
              selectedSubtitle ? <IconLanguage size={14} /> : <IconDownload size={14} />
            }
            onClick={async () => {
              setImporting(true);
              setError(null);
              setProgress(0);
              
              try {
                const subtitleLang = selectedSubtitle || null;
                const selectedSubtitleOption = subtitleOptions.find(opt => opt.value === subtitleLang);
                
                if (subtitleLang) {
                  Toxen.log(`Downloading subtitles (${selectedSubtitleOption?.label}) for: ${video.title}`, 2000);
                } else {
                  Toxen.log(`Importing video: ${video.title}`, 2000);
                }
                
                await Ytdlp.importAudio(video, p => {
                  setProgress(p.percent);
                }, subtitleLang);
                
                setImported(true);
                const successMessage = subtitleLang 
                  ? `Successfully imported with ${selectedSubtitleOption?.label} subtitles: ${video.title}`
                  : `Successfully imported: ${video.title}`;
                Toxen.log(successMessage, 3000);
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : "Failed to import video";
                setError(errorMsg);
                Toxen.error("Failed to import: " + video.title, 3000);
                console.error("Import error:", error);
              }
              
              setImporting(false);
            }}
          >
            {error ? "Retry" :
             progress === 100 && !imported ? "Converting..." : 
             importing ? "Importing..." : 
             imported ? "Imported" : "Import"}
          </Button>
        </Group>
      </Stack>
      
      {progress > 0 && progress < 100 && importing && (
        <Progress
          value={progress}
          size="xs"
          mt="xs"
          className="import-progress"
          color="blue"
          striped
          animated
        />
      )}
      
      {error && (
        <Alert color="red" mt="xs" variant="light">
          <Text size="xs">{error}</Text>
        </Alert>
      )}
    </Card>
  );
}