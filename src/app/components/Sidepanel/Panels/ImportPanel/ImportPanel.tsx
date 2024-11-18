import { Button, Group, Image, Modal, Progress, TextInput } from '@mantine/core';
import React from 'react'
import System, { ToxenFile } from '../../../../toxen/System';
import { Toxen } from '../../../../ToxenApp';
import { VideoInfo } from '../../../../toxen/desktop/Ytdlp';
import Settings from '../../../../toxen/Settings';
import ExternalUrl from '../../../ExternalUrl/ExternalUrl';

export default function ImportPanel() {
  return (
    <div>
      <h1>Import music</h1>
      <Button
        leftSection={<i className="fas fa-file-import"></i>}
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
      >Import song from Files</Button>
      <br />
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
        leftSection={<i className="fas fa-file-import"></i>}
        onClick={() => {
          setModalOpen(true);
        }}
      >Import from YouTube/Soundcloud</Button>
      {
        acceptedResponsibility ? (
          <Modal size={"80vw"} opened={modalOpen} onClose={() => setModalOpen(false)}>
            <div>
              <h1>Import from YouTube/Soundcloud</h1>
              <p>Enter a YouTube or Soundcloud URL to import a song.</p>
              <TextInput disabled={importing} placeholder="https://youtube.com/watch?v=..." value={url} onChange={e => setUrl(e.currentTarget.value)} />

              <Button loading={importing} onClick={async () => {
                setImporting(true);
                const videos = await Ytdlp.getVideoInfo(url);
                console.log(videos);
                setImporting(false);
                setVideos(videos);
              }}>
                {importing ? "Loading..." : "Load"}
              </Button>

              <div style={{
                maxHeight: 500,
                overflowY: "auto",
              }}>
                {videos.map(v => (
                  <Video key={v.original_url} video={v} />
                ))}
              </div>
            </div>
          </Modal>
        ) : (
          <Modal size={"80vw"} opened={modalOpen} onClose={() => setModalOpen(false)}>
            <div>
              <h1>Importing using the Media Downloader</h1>
              <p>By using this feature, you agree that you are responsible for the content you import.</p>
              <p>Importing content from these providers may be illegal in your country.</p>
              <p>Do not import content you do not have the rights to.</p>
              <p>Do not import content that is illegal in your country.</p>
              <p>Do not import content that is against the used provider's Terms of Service.</p>
              <p>Toxen is not responsible for any content you import.</p>
              <br />
              <p>Using this feature will download a program called <ExternalUrl href="https://github.com/yt-dlp/yt-dlp"><code>yt-dlp</code></ExternalUrl> and <ExternalUrl href="https://ffmpeg.org/"><code>ffmpeg</code></ExternalUrl> to your system.</p>
              <p>These programs are used to download and convert the content you import so Toxen can play it.</p>
              <p>By clicking "I understand", you agree to the above.</p>
              <Button color="green" onClick={() => setAcceptedResponsibility(true)}>I understand</Button>
              <Button color="red" onClick={() => setModalOpen(false)}>Cancel</Button>
            </div>
          </Modal>
        )
      }
    </>
  )
}

function Video(props: { video: VideoInfo }) {
  const { video } = props;
  const [importing, setImporting] = React.useState<boolean>(false);
  const [progress, setProgress] = React.useState<number>(0);
  const [imported, setImported] = React.useState<boolean>(false);

  const Ytdlp = React.useMemo(() => toxenapi.isDesktop() ? toxenapi.getYtdlp() : null, []);
  
  if (!toxenapi.isDesktop()) {
    return null;
  }
  
  return (
    <div>
      <hr />
      <div style={{
        height: 100,
        backgroundImage: `url(${video.thumbnail})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}>
        <h3 style={{
          color: "white",
          display: "block",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          padding: 10,
          margin: 0,
          borderRadius: 5,
          overflow: "hidden",
        }}>{video.title}</h3>
      </div>
      <Button fullWidth variant="subtle" color="green" onClick={async () => {
        setImporting(true);
        Toxen.log("Importing video: " + video.title, 2000);
        console.log(video);
        await Ytdlp.importAudio(video, p => {
          setProgress(p.percent);
          console.log(
            `\n${p.percent}% Downloaded\n`
          );

        });
        setImporting(false);
        setImported(true);
      }} loading={importing} disabled={importing || imported} >
        {progress === 100 && !imported ? "Converting..." : importing ? "Importing..." : imported ? "Imported" : "Import"}
      </Button>
      {
        progress > 0 && progress < 100 ?
          <Progress value={progress} size="xs" style={{ width: "100%" }} />
          : null
      }
    </div>
  )
}