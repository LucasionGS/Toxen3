import React, { useEffect, useMemo, useRef } from 'react'
import HTMLReactParser from 'html-react-parser';
import MusicPlayerController from '../../toxen/controllers/MusicPlayerController';
import "./Subtitles.scss";
import { Toxen } from '../../ToxenApp';
import SubtitlesController from '../../toxen/controllers/SubtitlesController';
import { useController } from '../../lib/useController';

interface SubtitlesProps {
  musicPlayer: { current: MusicPlayerController };
  controller?: SubtitlesController;
  onReady?: (controller: SubtitlesController) => void;
}

export default function Subtitles(props: SubtitlesProps) {
  const controller = useMemo(
    () => props.controller ?? new SubtitlesController(),
    []
  );
  useController(controller);

  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;
  useEffect(() => {
    onReadyRef.current?.(controller);
  }, [controller]);

  // Drive the subtitle update loop.
  useEffect(() => {
    let raf: number;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controller.tick(props.musicPlayer.current);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [controller]);

  const floatingTitleAsSubtitles = Toxen.background?.storyboard?.getFloatingSubtitles();
  return (
    <div className="subtitle-container">
      {(!floatingTitleAsSubtitles && controller.currentText) ? HTMLReactParser(controller.currentText) : null}
    </div>
  )
}