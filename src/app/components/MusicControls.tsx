import { Slider } from '@mantine/core';
import React, { useEffect, useMemo, useRef } from 'react';
import Settings from '../toxen/Settings';
import Time from '../toxen/Time';
import { Toxen } from '../ToxenApp';
import "./MusicControls.scss";
import ProgressBar from './ProgressBar';
import MusicControlsController from '../toxen/controllers/MusicControlsController';
import { useController } from '../lib/useController';

interface MusicControlsProps {
  /** Optional externally-owned controller. If omitted, one is created internally. */
  controller?: MusicControlsController;
  /** Invoked once on mount with the controller, so parents can register it (e.g. `Toxen.musicControls`). */
  onReady?: (controller: MusicControlsController) => void;
}

export default function MusicControls(props: MusicControlsProps) {
  const controller = useMemo(
    () => props.controller ?? new MusicControlsController(),
    []
  );
  useController(controller);

  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;
  useEffect(() => {
    onReadyRef.current?.(controller);
  }, [controller]);

  const format = Settings.get("progressBarShowMs") ? "hh?:mm:ss:ms" : "hh?:mm:ss";
  const styleForEnabled: React.CSSProperties = {
    // filter: "drop-shadow(0 0 20px green)",
    // outline: "3px solid green"
    filter: "drop-shadow(2px 2px 1px var(--accent-color, greenyellow)) drop-shadow(-2px 2px 1px var(--accent-color, greenyellow)) drop-shadow(2px -2px 1px var(--accent-color, greenyellow)) drop-shadow(-2px -2px 1px var(--accent-color, greenyellow))"
  };

  return (
      <div className="toxen-music-controls">
        <div className="toxen-music-controls-buttons hide-on-inactive">
          <div hidden={!Toxen.isMiniplayer()} className="ctrl-btn" onClick={() => {
            Toxen.toggleMiniplayer();
          }}>
            <span><i className="fas fa-window-maximize"></i></span>
          </div>
          <div className="ctrl-btn" onClick={() => {
            Settings.set("shuffle", !Settings.get("shuffle"));
            Settings.save({ suppressNotification: true });
          }}>
            <span hidden={!Settings.get("shuffle")}><i className="fas fa-random" style={styleForEnabled}></i></span>
            <span hidden={Settings.get("shuffle")}><i className="fas fa-random"></i></span>
          </div>
          <div className="ctrl-btn" onClick={() => Toxen.musicPlayer.playPrev()}>
            <i className="fas fa-angle-double-left"></i>
          </div>
          <div className="ctrl-btn" onClick={() => Toxen.musicPlayer.toggle()}>
            <span hidden={Toxen.musicPlayer && Toxen.musicPlayer.media && !Toxen.musicPlayer.media.paused}><i className="fas fa-play"></i></span>
            <span hidden={Toxen.musicPlayer && Toxen.musicPlayer.media && Toxen.musicPlayer.media.paused}><i className="fas fa-pause"></i></span>
          </div>
          <div className="ctrl-btn" onClick={() => {
            Toxen.musicPlayer.playNext();
          }}>
            <i className="fas fa-angle-double-right"></i>
          </div>
          <div className="ctrl-btn" onClick={() => {
            Settings.set("repeat", !Settings.get("repeat"));
            Settings.save({ suppressNotification: true });
          }}>
            <span hidden={!Settings.get("repeat")}><i className="fas fa-redo" style={styleForEnabled}></i></span>
            <span hidden={Settings.get("repeat")}><i className="fas fa-redo"></i></span>
          </div>
          <div hidden={!Toxen.isMiniplayer()} className="ctrl-btn window-draggable">
            <span><i className="fas fa-arrows-alt"></i></span>
          </div>
        </div>

        <span className="toxen-music-controls-progress-bar">
          <ProgressBar
            ref={ref => controller.attachProgressBar(ref)}
            fillColor={"greenyellow"}
            onClick={(e, v) => Toxen.musicPlayer.setPosition(v)}
            onDragging={(e, v) => Toxen.musicPlayer.setPosition(v)}
            onClickRelease={(e, v) => Toxen.discord?.setPresence()}
            toolTip={(v) => {
              const time = new Time(v * 1000);
              return time.toTimestamp(format);
            }}
          />
        </span>

        <div className="toxen-music-controls-time hide-on-inactive">
          <div className="toxen-music-controls-time-start">{controller.currentTime.toTimestamp(format)}</div>
          <div className="toxen-music-controls-volume">
            <VolumeSlider controller={controller} />
          </div>
          <div className="toxen-music-controls-time-end">{controller.duration.toTimestamp(format)}</div>
        </div>
      </div>
  )
}

function VolumeIcon(props: { level: number }) {
  const { level } = props;
  return (
    <svg
      className="toxen-volume-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3z" />
      {level <= 0 ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          d="M16 9l5 6M21 9l-5 6"
        />
      ) : (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M16 8.5a5 5 0 0 1 0 7"
          />
          {level >= 50 && (
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="M18.6 6a8.5 8.5 0 0 1 0 12"
            />
          )}
        </>
      )}
    </svg>
  );
}

function VolumeSlider(props: { controller: MusicControlsController }) {
  const { controller } = props;
  const [volume, setVolume] = React.useState(Settings.get("volume") ?? 50);

  controller.setVolumeSlider = (n) => setVolume(n);

  return (
    <div className="toxen-volume-slider">
      <VolumeIcon level={volume} />
      <Slider
        className="toxen-volume-slider-input"
        max={100}
        min={0}
        value={volume}
        onChange={(v) => {
          controller.setVolume(v);
          Settings.set("volume", v);
        }}
        onChangeEnd={(v) => {
          controller.setVolume(v);
          Settings.apply({
            volume: v,
          }, true);
        }}
        label={(v) => `${v}%`}
        size="md"
        styles={{
          bar: {
            background: "var(--accent-color)",
            boxShadow: "0 0 8px -2px var(--accent-color)",
          },
          thumb: {
            borderColor: "var(--accent-color)",
            background: "var(--accent-color)",
            boxShadow: "0 0 8px -1px var(--accent-color)",
          },
        }}
      />
    </div>
  )
}