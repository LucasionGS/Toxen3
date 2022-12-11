import { Button, Group, Image, Modal, Progress, TextInput } from '@mantine/core';
import { remote } from 'electron';
import React from 'react'
import System, { ToxenFile } from '../../../../toxen/System';
import { Toxen } from '../../../../ToxenApp';
import Path from "path";
import Ytdlp from '../../../../toxen/Ytdlp';

export default function ImportPanel() {
  return (
    <div>
      <h1>Import music</h1>
      <Button
        leftIcon={<i className="fas fa-file-import"></i>}
        onClick={() => {
          let paths = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
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
            name: Path.basename(p),
            path: p
          }));
          Promise.all(promisedFiles).then(files => {
            System.handleImportedFiles(files);
          });
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
  const [videos, setVideos] = React.useState<Ytdlp.VideoInfo[]>([]);

  return (
    <>
      <Button
        leftIcon={<i className="fas fa-file-import"></i>}
        onClick={() => {
          setModalOpen(true);
        }}
      >Import from YouTube/Soundcloud</Button>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)}>
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
              <Video video={v} />
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}

function Video(props: { video: Ytdlp.VideoInfo }) {
  const { video } = props;
  const [importing, setImporting] = React.useState<boolean>(false);
  const [progress, setProgress] = React.useState<number>(0);
  const [imported, setImported] = React.useState<boolean>(false);

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
        {
          progress > 0 && progress < 100 ?
            <Progress value={progress} size="xs" style={{ width: "100%" }} />
            : null
        }
        {importing ? "Importing..." : imported ? "Imported" : "Import"}
      </Button>
    </div>
  )
}