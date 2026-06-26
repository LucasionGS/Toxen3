import React, { useEffect, useMemo } from 'react';
import Song from '../../toxen/Song';
import "./SongElement.scss";
import RenderIfVisible from "react-render-if-visible";
import { useModals } from '@mantine/modals';
import Settings from '../../toxen/Settings';
import User from '../../toxen/User';
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

  // Build background style with fallback
  const backgroundStyle = Settings.get("enableThumbnailCache", true) 
    ? (thumbnailUrl 
        ? `linear-gradient(to right, rgb(0, 0, 0), rgba(0, 0, 0, 0)) 0% 0% / cover, url("${thumbnailUrl}")`
        : isLoadingThumbnail 
        ? 'linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%), linear-gradient(to right, rgb(0, 0, 0), rgba(0, 0, 0, 0.6))'
        : undefined)
    : (song.backgroundFile() 
        ? `linear-gradient(to right, rgb(0, 0, 0), rgba(0, 0, 0, 0)) 0% 0% / cover, url("${User.appendAuth(`${song.backgroundFile().replace(/\\/g, "/")}?h=${song.hash}`)}")`
        : undefined);

  return (
      <div style={{
        position: "relative",
      }} className="song-element-container">
        <div ref={ref => controller.divElement = ref} className={classes.join(" ")} style={{
          background: backgroundStyle,

          /// Style if using Observer object
          // background: observer?.isIntersecting ? `linear-gradient(to right, rgb(0, 0, 0), rgba(0, 0, 0, 0)) 0% 0% / cover, url("${bgFile.replace(/\\/g, "/")}")`: null,
          // opacity: observer?.isIntersecting ? 1 : 0,
          // transition: "transform 0.2s ease-in-out, opacity 0.2 ease-in-out",
          // transform: `translateX(${observer?.isIntersecting ? "0" : "-64"}px)`,
        }}
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
          <div className="song-progress-bar" style={{ 
            width: (controller.progressBar * 100) + "%",
          }} />
          <p className="song-title" >
            {song.getDisplayName()}
          </p>
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