import React, { useEffect, useMemo, useRef } from 'react'
import System from '../../toxen/System';
import { Toxen } from '../../ToxenApp';
import MusicPlayer from '../MusicPlayer';
import MusicPlayerController from '../../toxen/controllers/MusicPlayerController';
import BackgroundController from '../../toxen/controllers/BackgroundController';
import "./Background.scss";
import Storyboard from './Storyboard/Storyboard';
import Visualizer from './Visualizer';
//@ts-expect-error 
import ToxenMax from "../../../icons/skull_max.png";
import Settings from '../../toxen/Settings';
import Subtitles from '../Subtitles/Subtitles';
import AudioEffects from '../../toxen/AudioEffects';
import { useController } from '../../lib/useController';

interface BackgroundProps {
  controller?: BackgroundController;
  onReady?: (controller: BackgroundController) => void;
}

export default function Background(props: BackgroundProps) {
  const controller = useMemo(
    () => props.controller ?? new BackgroundController(),
    []
  );
  useController(controller);

  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;
  useEffect(() => {
    onReadyRef.current?.(controller);
  }, [controller]);

  return (
      <div className="toxen-background"
        onClick={() => Settings.get("pauseWithClick") ? Toxen.musicPlayer.toggle() : null}
        // onDoubleClick={() => {
        //   Toxen.toggleFullscreen();
        // }}
        onContextMenu={async () => {
          // Toxen.showCurrentSong();
          // Toxen.editSong(Song.getCurrent())
          if (!Toxen.sidePanel.isShowing()) Toxen.sidePanel.show();
        }}
        // Background will also act as a dropzone
        onDrop={e => {
          e.preventDefault();
          System.handleImportedFiles(e.dataTransfer.files);
        }}
        onDragOver={e => e.preventDefault()}
        onDragEnter={e => e.preventDefault()}
        onDragLeave={e => e.preventDefault()}
      >
        <BackgroundImage ToxenMax={ToxenMax}  backgroundObject={controller} />
        {
          (() => {
            let musicPlayer: { current: MusicPlayerController } = { current: null };
            return (<>
              <MusicPlayer onReady={mpController => {
                Toxen.musicPlayer = musicPlayer.current = mpController;
                controller.musicPlayer = mpController;
                // Initialize audio effects when music player is ready
                if (!Toxen.audioEffects) {
                  Toxen.audioEffects = new AudioEffects();
                }
                // Initialize audio effects with the media element
                setTimeout(() => {
                  if (mpController.media) {
                    Toxen.audioEffects.initialize(mpController.media);
                  }
                }, 100);
              }} />
              <Subtitles onReady={controller => Toxen.subtitles = controller} musicPlayer={musicPlayer} />
              <Storyboard ref={ref => controller.storyboard = ref} />
              <Visualizer ref={ref => controller.visualizer = ref} />
            </>)
          })()
        }
      </div >
  )
}

function BackgroundImage(props: { ToxenMax: string, backgroundObject: BackgroundController }) {
  const { ToxenMax, backgroundObject } = props;

  const imageRef = React.useRef<HTMLImageElement>(null);
  const lastScale = React.useRef(1);

  // The visualizer calls this every frame. Writing the transform directly keeps it out of React,
  // which would otherwise reconcile this component 60 times a second.
  backgroundObject.updateDimScale = (dimScale: number) => {
    const scale = dimScale > 0 ? 1 + (dimScale / 4) : 1;
    if (scale === lastScale.current) return;
    lastScale.current = scale;
    if (imageRef.current) imageRef.current.style.transform = `scale(${scale})`;
  };

  return (<img // hidden={this.state.image ? false : true}
    ref={imageRef}
    className="toxen-background-image" src={backgroundObject.getBackground() || ToxenMax} alt="background" />);
}