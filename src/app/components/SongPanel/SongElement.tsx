import React, { useEffect, useMemo } from 'react';
import Song from '../../toxen/Song';
import "./SongElement.scss";
import RenderIfVisible from "react-render-if-visible";
import { useModals } from '@mantine/modals';
import Settings from '../../toxen/Settings';
import User from '../../toxen/User';
import Converter from '../../toxen/Converter';
import ImageCache from '../../toxen/ImageCache';
import SongElementController from '../../toxen/controllers/SongElementController';
import { useController } from '../../lib/useController';

function SongElementDiv(props: { controller: SongElementController }) {
  /// Observer object is cool and all but holy shit it makes this laggy
  // const [ref, observer] = useIntersection({
  //   root: Toxen.sidePanel?.containerRef?.current,
  //   threshold: 1,
  //   rootMargin: "-128px 256px 0px 256px",
  // });

  const { controller } = props;
  let song = controller.song;
  
  // Use cached thumbnail instead of full background image
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = React.useState(false);
  
  React.useEffect(() => {
    let isMounted = true;
    
    const loadThumbnail = async () => {
      if (!song.backgroundFile()) {
        setThumbnailUrl(null);
        setIsLoadingThumbnail(false);
        return;
      }
      
      // Check if thumbnail caching is enabled
      if (!Settings.get("enableThumbnailCache", true)) {
        setThumbnailUrl(null);
        setIsLoadingThumbnail(false);
        return;
      }
      
      setIsLoadingThumbnail(true);
      
      try {
        const bgFile = User.appendAuth(`${song.backgroundFile()}?h=${song.hash}`);
        const imageCache = ImageCache.getInstance();
        
        // Get thumbnail with appropriate size for song list items
        const thumbnail = await imageCache.getThumbnail(
          bgFile, 
          song.hash, 
          { width: 160, height: 90 } // Optimized size for song list
        );
        
        if (isMounted) {
          setThumbnailUrl(thumbnail);
          setIsLoadingThumbnail(false);
        }
      } catch (error) {
        console.warn('Failed to load thumbnail for song:', song.getDisplayName(), error);
        if (isMounted) {
          setThumbnailUrl(null);
          setIsLoadingThumbnail(false);
        }
      }
    };
    
    loadThumbnail();
    
    return () => {
      isMounted = false;
    };
  }, [song.backgroundFile(), song.hash]);
  
  let classes = ["song-element", controller.selected ? "selected" : null].filter(a => a);
  
  // Add loading class if thumbnail is being loaded
  if (isLoadingThumbnail) classes.push("loading-thumbnail");
  
  if (controller.playing) classes.push("playing");

  // const ContextMenu: typeof songElement.ContextMenu = songElement.ContextMenu.bind(songElement);
  // const contextMenuRef = React.createRef<HTMLDivElement>();
  // let setOpened: (opened: boolean) => void;
  const modals = useModals();

  // Resolve the background image (thumbnail when caching is enabled, else full file)
  const bgImageUrl = Settings.get("enableThumbnailCache", true)
    ? thumbnailUrl
    : (song.backgroundFile()
      ? User.appendAuth(`${song.backgroundFile().replace(/\\/g, "/")}?h=${song.hash}`)
      : null);

  const title = song.title || "Unknown Title";
  const artist = song.artist || (song.coArtists && song.coArtists[0]) || "Unknown Artist";
  const durationLabel = (song.duration && !isNaN(song.duration))
    ? Converter.numberToTime(song.duration).toTimestamp("hh?:mm:ss")
    : null;

  return (
    <div className="song-element-container">
      <div
        ref={ref => controller.divElement = ref}
        className={classes.join(" ")}
        onClick={e => {
          if (e.ctrlKey) return;
          controller.play();
        }}
        onContextMenu={e => {
          e.preventDefault();
          song.contextMenuModal(modals);
        }}
        onMouseDownCapture={e => {
          if (e.ctrlKey && e.buttons === 1) return controller.select();
        }}
        onMouseEnter={e => {
          if (e.ctrlKey && e.buttons === 1) return controller.select();
        }}
      >
        <div
          className="song-element-bg"
          style={bgImageUrl ? { backgroundImage: `url("${bgImageUrl}")` } : undefined}
        />
        <span className="song-element-accent" />
        <div className="song-element-content">
          <div className="song-element-info">
            <span className="song-element-title">{title}</span>
            <span className="song-element-artist">
              {artist}
              {song.album ? <span className="song-element-album"> · {song.album}</span> : null}
            </span>
          </div>
          <div className="song-element-meta">
            {controller.playing && (
              <div className="song-element-eq" aria-hidden="true">
                <span /><span /><span /><span />
              </div>
            )}
            {song.isVideo() && (
              <svg className="song-element-badge" viewBox="0 0 576 512" aria-hidden="true" focusable="false">
                <title>Video</title>
                <path fill="currentColor" d="M0 128C0 92.7 28.7 64 64 64H320c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM559.1 99.8c10.4 5.6 16.9 16.4 16.9 28.2V384c0 11.8-6.5 22.6-16.9 28.2s-23 5-32.9-1.6l-96-64L416 337.1V320 192 174.9l14.2-9.5 96-64c9.8-6.5 22.4-7.2 32.9-1.6z" />
              </svg>
            )}
            {durationLabel && <span className="song-element-duration">{durationLabel}</span>}
          </div>
        </div>
        <div
          className="song-element-progress"
          style={{ width: (controller.progressBar * 100) + "%" }}
        />
      </div>
    </div>
  )
}


interface SongElementProps {
  song: Song;
  playing?: boolean;
}

export default function SongElement(props: SongElementProps) {
  const controller = useMemo(
    () => new SongElementController(props.song, props.playing ?? false),
    // Controller identity is fixed for the lifetime of this element.
    []
  );
  useController(controller);

  // Register/unregister this element as the song's current element.
  useEffect(() => {
    props.song.currentElement = controller;
    return () => {
      if (props.song.currentElement === controller) {
        props.song.currentElement = null;
      }
    };
  }, [controller]);

  if (Settings.isRemote() || Settings.get("hideOffScreenSongElements")) {
    return (
      <div className="song-element-permadiv" ref={ref => controller.divPermanentElement = ref}>
        <RenderIfVisible defaultHeight={64} visibleOffset={500}>
          <SongElementDiv controller={controller} />
        </RenderIfVisible>
      </div>
    );
  }
  else {
    return (
      <div className="song-element-permadiv" ref={ref => controller.divPermanentElement = ref}>
        <SongElementDiv controller={controller} />
      </div>
    );
  }
}