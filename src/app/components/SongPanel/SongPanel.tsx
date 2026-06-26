import React, { useEffect, useMemo, useRef } from 'react'
import { Toxen } from '../../ToxenApp';
import ViewController from '../../toxen/controllers/ViewController';
import { useController } from '../../lib/useController';
import './SongPanel.scss';

interface SongPanelProps {
  controller?: ViewController;
  onReady?: (controller: ViewController) => void;
}

export default function SongPanel(props: SongPanelProps) {
  const controller = useMemo(
    () => props.controller ?? new ViewController(),
    []
  );
  useController(controller);

  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;
  useEffect(() => {
    onReadyRef.current?.(controller);
  }, [controller]);

  let songList = Toxen.playlist && Toxen.playlist.songList ? Toxen.playlist.songList : Toxen.songList;
  let songs = (songList ?? []).map(s => s);
  if (Toxen.songQueue.length > 0)
    songs = songs.filter(s => !Toxen.songQueue.some(s2 => s2.uid === s.uid)); // Remove queued items from the main list

  if (Toxen.songSearch) {
    let items = Toxen.songSearch.toLowerCase().replace(/_/g, " ").split(" ");
    songs = songs.filter(s => {
      let sortItems = [
        s.artist ?? "", // Artist
        s.title ?? "", // Title
        s.language ?? "", // Language
        ...(s.coArtists ?? []), // Co-Artists
        s.source ?? "",
        s.genre ?? "",
        ...(s.tags ?? []),
      ].join(" ").replace(/_/g, " ").trim().toLowerCase();
      return items.every(item => sortItems.includes(item));
    })
  }

  Toxen.searchedSongList = songs;
  return (
    <div className="song-panel">
      {/* {Toxen.playlist ? <>Playlist: <code>{Toxen.playlist.name}</code><br /></> : ""} */}
      {songs.map(s => s.Element(s.dirname()))}
    </div>
  );
}