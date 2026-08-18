import React, { useEffect, useReducer, useState } from 'react';
import {
  IconArrowsShuffle,
  IconChevronDown,
  IconChevronsLeft,
  IconChevronsRight,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
} from '@tabler/icons-react';
import Settings from '../../toxen/Settings';
import Song from '../../toxen/Song';
import { VolumeSlider } from '../MusicControls';
import { Toxen } from '../../ToxenApp';
import MusicControlsController from '../../toxen/controllers/MusicControlsController';
import { useController } from '../../lib/useController';
import "./MobileUI.scss";

interface MobilePlayerProps {
  /** Shared with the desktop MusicControls so both views track the same playback state. */
  controller: MusicControlsController;
}

/**
 * Mobile web playback UI: a mini-player docked above the bottom tab bar, and a
 * full-screen "hero" player that expands from it. The hero overlay is mostly
 * transparent so the fullscreen background/visualizer stays the centerpiece.
 * Only visible at phone widths (see MobileUI.scss).
 */
export default function MobilePlayer(props: MobilePlayerProps) {
  const controller = useController(props.controller);
  const [expanded, setExpanded] = useState(false);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const song = Song.getCurrent();
  // Editors (storyboard/subtitles/theme) take over the screen; stay out of the way.
  const inPlayerMode = Toxen.isMode("Player");
  const heroOpen = expanded && !!song && inPlayerMode;

  // Fades out the nav bar and mini-player (see MobileUI.scss) while the hero
  // player is up, so only the background/visualizer shows behind it.
  useEffect(() => {
    document.body.classList.toggle("mobile-hero-open", heroOpen);
    return () => document.body.classList.remove("mobile-hero-open");
  }, [heroOpen]);

  // The controller only notifies on time ticks, so mirror play/pause straight
  // from the media element to keep the toggle icons in sync.
  useEffect(() => {
    const media = Toxen.musicPlayer?.media;
    if (!media) return;
    media.addEventListener("play", forceUpdate);
    media.addEventListener("pause", forceUpdate);
    return () => {
      media.removeEventListener("play", forceUpdate);
      media.removeEventListener("pause", forceUpdate);
    };
  }, []);

  const paused = Toxen.musicPlayer?.media?.paused ?? true;
  const artist = song ? ((song.artist ?? song.coArtists?.[0]) ?? "Unknown Artist") : "";
  const title = song ? (song.title ?? "Unknown Title") : "";
  const format = Settings.get("progressBarShowMs") ? "hh?:mm:ss:ms" : "hh?:mm:ss";

  const currentSeconds = controller.currentTime.toSeconds();
  const durationSeconds = controller.duration.toSeconds();
  const progress = durationSeconds > 0 ? Math.min(currentSeconds / durationSeconds, 1) : 0;

  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const duration = Toxen.musicPlayer?.media?.duration;
    if (!duration || isNaN(duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    Toxen.musicPlayer.setPosition(ratio * duration);
  };

  return (
    <>
      <div
        className={
          "mobile-mini-player"
          + (song && inPlayerMode ? "" : " hidden")
          + (paused ? " paused" : "")
        }
        onClick={() => {
          if (!song) return;
          // The hero player is the "now playing" screen: close any open panel
          // so the fullscreen background/visualizer shows behind it.
          Toxen.sidePanel?.show(false);
          setExpanded(true);
        }}
      >
        <div className="mobile-mini-player-eq">
          <span /><span /><span />
        </div>
        <div className="mobile-mini-player-info">
          <div className="mobile-mini-player-title">{title}</div>
          <div className="mobile-mini-player-artist">{artist}</div>
          <div className="mobile-mini-player-progress">
            <div style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <div className="mobile-mini-player-btn" onClick={e => {
          e.stopPropagation();
          Toxen.musicPlayer.toggle();
        }}>
          {paused ? <IconPlayerPlay size="1em" /> : <IconPlayerPause size="1em" />}
        </div>
        <div className="mobile-mini-player-btn" onClick={e => {
          e.stopPropagation();
          Toxen.musicPlayer.playNext();
        }}>
          <IconChevronsRight size="1em" />
        </div>
      </div>

      <div className={"mobile-hero-player" + (heroOpen ? " open" : "")}>
        <div className="mobile-hero-player-top">
          <div className="mobile-hero-player-close" onClick={() => setExpanded(false)}>
            <IconChevronDown size="1em" />
          </div>
          {Toxen.playlist && (
            <div className="mobile-hero-player-playlist">{Toxen.playlist.name}</div>
          )}
        </div>
        <div className="mobile-hero-player-bottom">
          <div className="mobile-hero-player-artist">{artist}</div>
          <div className="mobile-hero-player-title">{title}</div>
          <div
            className="mobile-hero-player-seekbar"
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId);
              seekFromPointer(e);
            }}
            onPointerMove={e => {
              if (e.buttons > 0) seekFromPointer(e);
            }}
          >
            <div className="mobile-hero-player-seekbar-fill" style={{ width: `${progress * 100}%` }} />
            <div className="mobile-hero-player-seekbar-knob" style={{ left: `${progress * 100}%` }} />
          </div>
          <div className="mobile-hero-player-times">
            <span>{controller.currentTime.toTimestamp(format)}</span>
            <span>{controller.duration.toTimestamp(format)}</span>
          </div>
          <div className="mobile-hero-player-controls">
            <div
              className={"mobile-hero-player-ctrl small" + (Settings.get("shuffle") ? " enabled" : "")}
              onClick={() => {
                Settings.set("shuffle", !Settings.get("shuffle"));
                Settings.save({ suppressNotification: true });
                forceUpdate();
              }}
            >
              <IconArrowsShuffle size="1em" />
            </div>
            <div className="mobile-hero-player-ctrl" onClick={() => Toxen.musicPlayer.playPrev()}>
              <IconChevronsLeft size="1em" />
            </div>
            <div className="mobile-hero-player-play" onClick={() => Toxen.musicPlayer.toggle()}>
              {paused ? <IconPlayerPlay size="1em" /> : <IconPlayerPause size="1em" />}
            </div>
            <div className="mobile-hero-player-ctrl" onClick={() => Toxen.musicPlayer.playNext()}>
              <IconChevronsRight size="1em" />
            </div>
            <div
              className={"mobile-hero-player-ctrl small" + (Settings.get("repeat") ? " enabled" : "")}
              onClick={() => {
                Settings.set("repeat", !Settings.get("repeat"));
                Settings.save({ suppressNotification: true });
                forceUpdate();
              }}
            >
              <IconRefresh size="1em" />
            </div>
          </div>
          <div className="mobile-hero-player-volume">
            <VolumeSlider controller={controller} />
          </div>
        </div>
      </div>
    </>
  );
}
