import { Alert, Button, Group, Image, Modal, Progress, TextInput, Card, Text, Badge, ActionIcon, Stack, Divider, Loader, Tooltip, Select } from '@mantine/core';
import { IconDownload, IconExternalLink, IconMusic, IconPhoto, IconAlertTriangle, IconCheck, IconClock, IconLanguage } from '@tabler/icons-react';
import React from 'react'
import System, { ToxenFile } from '../../../../toxen/System';
import { Toxen } from '../../../../ToxenApp';
import { VideoInfo } from '../../../../toxen/desktop/Ytdlp';
import Settings from '../../../../toxen/Settings';
import ExternalUrl from '../../../ExternalUrl/ExternalUrl';
import './ImportPanel.scss';

export default function ImportPanel() {
  if (Settings.isRemote()) {
    return (
      <div>
        <Alert color="red">Importing music is only available locally.</Alert>
      </div>
    );
  }
  
  return (
    <div className="import-panel">
      <h1>Import music</h1>
      <Button
        leftSection={<IconMusic size={16} />}
        variant="light"
        onClick={() => {
          if (toxenapi.isDesktop()) {
            let paths = toxenapi.remote.dialog.showOpenDialogSync(toxenapi.remote.getCurrentWindow(), {
              properties: [
                "multiSelections",
                "openFile"
              ],
              filters: [
                {
                  name: "Media files",
                  extensions: Toxen.getSupportedMediaFiles().map(ext => ext.replace(".", ""))
                },
              ],
            });

            if (!paths || paths.length == 0)
              return;

            const promisedFiles: ToxenFile[] = paths.map(p => ({
              name: toxenapi.path.basename(p),
              path: p
            }));
            Promise.all(promisedFiles).then(files => {
              System.handleImportedFiles(files);
            });
          }
          else {
            toxenapi.throwDesktopOnly("Import local files not yet implemented");
          }
        }}
      >Import Files</Button>
      
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
              
              try {
                const videoInfos = await Ytdlp.getVideoInfo(url);
                setVideos(videoInfos);
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
              {videos.map(v => (
                <VideoCard key={v.original_url} video={v} />
              ))}
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