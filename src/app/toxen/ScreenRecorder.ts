import { remote } from "electron";
import { Toxen } from "../ToxenApp";
import Song from "./Song";

const { desktopCapturer } = remote;

export default class ScreenRecorder {
  constructor() { }

  public async startRecording(song: Song = Song.getCurrent()) {
    if (!song) return Toxen.error("No song is currently playing.", 3000);
    Toxen.toggleFullscreen(true);
    song.play();
    Toxen.musicPlayer.pause();

    // Get own window source
    const sources = await desktopCapturer.getSources({ types: ["window", "screen"] });

    debugger;
    const pid = process.pid;
    // Get the Toxen window
    const toxenWindow = sources.find(source => source.name === document.title);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: toxenWindow.id,
            minWidth: window.screen.width,
            maxWidth: window.screen.width,
            minHeight: window.screen.height,
            maxHeight: window.screen.height
          }
        }
      } as any // TODO: Remove and get this shit to actually work
      )
    } catch (e) {
      // TODO: Handle error
    }
    // return
    Toxen.musicPlayer.play();
  }
}

