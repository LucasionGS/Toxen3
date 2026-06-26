import React, { useEffect, useMemo, useRef } from 'react';
import { Toxen } from '../ToxenApp';
import Settings from '../toxen/Settings';
import MusicPlayerController from '../toxen/controllers/MusicPlayerController';
import { useController } from '../lib/useController';

export type { MediaSourceInfo, MusicPlayerSourceOptions } from '../toxen/controllers/MusicPlayerController';

interface MusicPlayerProps {
  /** Optional externally-owned controller. If omitted, one is created internally. */
  controller?: MusicPlayerController;
  /** Invoked once on mount with the controller, so parents can register it (e.g. `Toxen.musicPlayer`). */
  onReady?: (controller: MusicPlayerController) => void;
  useSubtitleEditorMode?: boolean;
}

export default function MusicPlayer(props: MusicPlayerProps) {
  const controller = useMemo(
    () => props.controller ?? new MusicPlayerController({ subtitleEditorMode: !!props.useSubtitleEditorMode }),
    // Controller identity is fixed for the lifetime of this component.
    []
  );
  useController(controller);

  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;

  // Start/stop the playback interval and notify the parent on mount.
  useEffect(() => {
    controller.start();
    onReadyRef.current?.(controller);
    return () => controller.dispose();
  }, [controller]);

  // Keep volume in sync (mirrors the old componentDidUpdate behaviour).
  useEffect(() => {
    controller.setVolume(props.useSubtitleEditorMode ? 50 : Settings.get("volume"));
  });

  // Run any pending source callback once the new src/crossOrigin are committed.
  useEffect(() => {
    controller.flushSourceCallback();
  }, [controller, controller.src, controller.crossOrigin]);

  const isVideo = controller.isVideo(controller.src);
  const hidden = props.useSubtitleEditorMode || !isVideo;

  return (
    <video
      onCanPlay={() => Toxen.musicControls.setMax(controller.media.duration)}
      ref={el => controller.attachMedia(el)}
      hidden={hidden}
      crossOrigin={controller.crossOrigin}
      src={controller.src ?? undefined}
      onEnded={() => controller.handleEnded()}
      onSeeking={() => controller.handleSeeking()}
      onSeeked={() => controller.handleSeeked()}
    />
  );
}