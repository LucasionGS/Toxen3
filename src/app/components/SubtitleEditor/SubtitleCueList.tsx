import React, { useEffect, useRef, useState } from "react";
import RenderIfVisible from "react-render-if-visible";
import { Button, Checkbox } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { Toxen } from "../../ToxenApp";
import { useController } from "../../lib/useController";
import SubtitleEditorController from "./SubtitleEditorController";
import SubtitleCueRow from "./SubtitleCueRow";

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
    if (controller.selectedUid !== null) scrollToCue(controller.selectedUid, false);
  }, [controller.selectedUid]);

  const overlapping = controller.getOverlappingUids();

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
      {controller.cues.length === 0 ? (
        <div className="subtitle-editor-empty">
          <p>No subtitles yet.</p>
          <p>Seek to where the first line starts and add a cue.</p>
          <Button size="xs" leftSection={<IconPlus size="1em" />} onClick={() => controller.addCueAtPlayhead()}>
            Add first cue
          </Button>
        </div>
      ) : controller.cues.map(cue => (
        <div key={cue.uid} data-cue-uid={cue.uid}>
          <RenderIfVisible defaultHeight={112} visibleOffset={600}>
            <SubtitleCueRow
              controller={controller}
              cue={cue}
              active={cue.uid === activeUid}
              selected={cue.uid === controller.selectedUid}
              overlapping={overlapping.has(cue.uid)}
            />
          </RenderIfVisible>
        </div>
      ))}
    </div>
  );
}
