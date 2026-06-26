import React, { useEffect, useMemo, useRef } from 'react'
import { Toxen } from '../../ToxenApp';
import Song from '../../toxen/Song';
import { Button } from '@mantine/core';
import ViewController from '../../toxen/controllers/ViewController';
import { useController } from '../../lib/useController';

interface SongQueuePanelProps {
  controller?: ViewController;
  onReady?: (controller: ViewController) => void;
}

export default function SongQueuePanel(props: SongQueuePanelProps) {
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

  let songs = (Toxen.songQueue ?? []);
  if (songs.length === 0) return (<></>);
  // if (Toxen.songSearch) {
  //   let items = Toxen.songSearch.toLowerCase().replace(/_/g, " ").split(" ");
  //   songs = songs.filter(s => {
  //     let sortItems = [
  //       s.artist ?? "", // Artist
  //       s.title ?? "", // Title
  //       ...(s.coArtists ?? []), // Co-Artists
  //       s.source ?? "",
  //       ...(s.tags ?? []),
  //     ].join(" ").replace(/_/g, " ").trim().toLowerCase();
  //     return items.every(item => sortItems.includes(item));
  //   })
  // }
  return (
    <>
      <h2>Current Queue</h2>
      <Button title="Remove all songs from the queue." color="red" onClick={() => Song.clearQueue()}>Clear Queue</Button>
      {songs.map(s => s.Element())}
      <hr />
    </>
  )
}