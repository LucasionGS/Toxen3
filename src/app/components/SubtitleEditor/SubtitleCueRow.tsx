import React, { useState } from "react";
import { ActionIcon, Textarea, Tooltip } from "@mantine/core";
import {
  IconAlertTriangle, IconBracketsContainEnd, IconBracketsContainStart, IconPalette,
  IconPlayerPlay, IconRowInsertBottom, IconTrash
} from "@tabler/icons-react";
import SubtitleEditorController, { EditorCue } from "./SubtitleEditorController";
import SubtitleOptionsForm from "./SubtitleOptionsForm";
import SubtitleTimestampInput from "./SubtitleTimestampInput";

interface SubtitleCueRowProps {
  controller: SubtitleEditorController;
  cue: EditorCue;
  active: boolean;
  selected: boolean;
  overlapping: boolean;
}

export default function SubtitleCueRow(props: SubtitleCueRowProps) {
  const { controller, cue } = props;
  const hasOptions = Object.keys(cue.options).length > 0;
  const [showOptions, setShowOptions] = useState(hasOptions);

  const classes = [
    "subtitle-editor-cue",
    props.active && "active",
    props.selected && "selected",
  ].filter(Boolean).join(" ");

  return (
    <div className={classes} onClick={e => controller.selectCue(cue.uid, e.ctrlKey || e.metaKey)}>
      <div className="subtitle-editor-cue-times">
        <SubtitleTimestampInput valueMs={cue.start} onCommit={ms => controller.updateCue(cue.uid, { start: ms }, true)} />
        <Tooltip label="Set start to playhead ( [ )">
          <ActionIcon size="sm" variant="subtle" onClick={() => controller.setStartToPlayhead(cue.uid)}>
            <IconBracketsContainStart size="1em" />
          </ActionIcon>
        </Tooltip>
        <span className="subtitle-editor-cue-sep">-</span>
        <SubtitleTimestampInput valueMs={cue.end} onCommit={ms => controller.updateCue(cue.uid, { end: ms }, true)} />
        <Tooltip label="Set end to playhead ( ] )">
          <ActionIcon size="sm" variant="subtle" onClick={() => controller.setEndToPlayhead(cue.uid)}>
            <IconBracketsContainEnd size="1em" />
          </ActionIcon>
        </Tooltip>
        {props.overlapping && (
          <Tooltip label="Overlaps another cue. Only one cue is shown at a time.">
            <IconAlertTriangle size="1em" className="subtitle-editor-cue-warning" />
          </Tooltip>
        )}
        <div className="subtitle-editor-cue-actions">
          <Tooltip label="Play from here">
            <ActionIcon size="sm" variant="subtle" onClick={() => controller.seekToCue(cue.uid)}>
              <IconPlayerPlay size="1em" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Style options">
            <ActionIcon size="sm" variant={showOptions || hasOptions ? "light" : "subtle"} onClick={() => setShowOptions(v => !v)}>
              <IconPalette size="1em" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Insert cue after">
            <ActionIcon size="sm" variant="subtle" onClick={() => controller.insertAfter(cue.uid)}>
              <IconRowInsertBottom size="1em" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete cue">
            <ActionIcon size="sm" variant="subtle" color="red" onClick={() => controller.removeCue(cue.uid)}>
              <IconTrash size="1em" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
      <Textarea
        autosize
        minRows={1}
        maxRows={6}
        placeholder="Subtitle text"
        value={cue.text}
        onFocus={() => controller.selectCue(cue.uid)}
        onChange={e => controller.updateCue(cue.uid, { text: e.currentTarget.value })}
      />
      {showOptions && (
        <div className="subtitle-editor-cue-options">
          <SubtitleOptionsForm
            compact
            options={cue.options}
            onChange={(key, value) => controller.setCueOption(cue.uid, key, value)}
          />
        </div>
      )}
    </div>
  );
}
