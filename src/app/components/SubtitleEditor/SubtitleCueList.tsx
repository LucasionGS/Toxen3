import React, { useEffect, useRef, useState } from "react";
import RenderIfVisible from "react-render-if-visible";
import { Button, Checkbox } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import { useController } from "../../lib/useController";
import SubtitleEditorController, { EditorCue, EditorStyleEvent } from "./SubtitleEditorController";
import SubtitleCueRow from "./SubtitleCueRow";
import SubtitleStyleRow from "./SubtitleStyleRow";

interface SubtitleCueListProps {
  controller: SubtitleEditorController;
}

function useActiveCueUid(controller: SubtitleEditorController) {
  const [activeUid, setActiveUid] = useState<number>(null);
  useEffect(() => {
    if (!controller.started) {
      setActiveUid(null);
      return;
    }
    let raf: number;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const uid = controller.getCueAtTime(controller.playheadMs())?.uid ?? null;
      setActiveUid(prev => (prev === uid ? prev : uid));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [controller, controller.started]);
  return activeUid;
}

export default function SubtitleCueList(props: SubtitleCueListProps) {
  const { controller } = props;
  useController(controller);
  const listRef = useRef<HTMLDivElement>(null);
  const activeUid = useActiveCueUid(controller);

  const scrollToCue = (uid: number, smooth: boolean) => {
    listRef.current
      ?.querySelector(`[data-cue-uid="${uid}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (!controller.followPlayback || activeUid === null) return;
    if (Toxen.musicPlayer?.paused) return;
    const list = listRef.current;
    if (list && list.contains(document.activeElement) && document.activeElement !== list) return;
    scrollToCue(activeUid, true);
  }, [activeUid]);

  useEffect(() => {
    if (controller.primarySelectedUid !== null) scrollToCue(controller.primarySelectedUid, false);
  }, [controller.primarySelectedUid]);

  const overlapping = controller.getOverlappingUids();

  type ListEntry =
    | { kind: "cue", time: number, cue: EditorCue }
    | { kind: "style", time: number, event: EditorStyleEvent };
  const entries: ListEntry[] = [
    ...controller.cues.map(cue => ({ kind: "cue" as const, time: cue.start, cue })),
    ...controller.styleEvents.map(event => ({ kind: "style" as const, time: event.time, event })),
  ].sort((a, b) => a.time - b.time || (a.kind === b.kind ? 0 : a.kind === "style" ? -1 : 1));

  return (
    <div className="subtitle-editor-cue-list" ref={listRef}>
      <div className="subtitle-editor-cue-list-header">
        <span>{controller.cues.length} {controller.cues.length === 1 ? "cue" : "cues"}</span>
        <Checkbox
          size="xs"
          label="Follow playback"
          checked={controller.followPlayback}
          onChange={e => controller.setFollowPlayback(e.currentTarget.checked)}
        />
      </div>
      {entries.length === 0 ? (
        <div className="subtitle-editor-empty">
          <p>No subtitles yet.</p>
          <p>Seek to where the first line starts and add a cue.</p>
          <Button size="xs" leftSection={<IconPlus size="1em" />} onClick={() => controller.addCueAtPlayhead()}>
            Add first cue
          </Button>
        </div>
      ) : entries.map(entry => entry.kind === "cue" ? (
        <div key={entry.cue.uid} data-cue-uid={entry.cue.uid}>
          <RenderIfVisible defaultHeight={112} visibleOffset={600}>
            <SubtitleCueRow
              controller={controller}
              cue={entry.cue}
              active={entry.cue.uid === activeUid}
              selected={controller.isSelected(entry.cue.uid)}
              overlapping={overlapping.has(entry.cue.uid)}
            />
          </RenderIfVisible>
        </div>
      ) : (
        <div key={entry.event.uid} data-style-uid={entry.event.uid}>
          <RenderIfVisible defaultHeight={120} visibleOffset={600}>
            <SubtitleStyleRow controller={controller} event={entry.event} />
          </RenderIfVisible>
        </div>
      ))}
    </div>
  );
}
