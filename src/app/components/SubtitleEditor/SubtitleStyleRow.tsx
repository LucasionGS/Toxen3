import React from "react";
import { ActionIcon, Checkbox, Tooltip } from "@mantine/core";
import { IconClock, IconPalette, IconTrash } from "@tabler/icons-react";
import SubtitleEditorController, { EditorStyleEvent } from "./SubtitleEditorController";
import SubtitleOptionsForm from "./SubtitleOptionsForm";
import SubtitleTimestampInput from "./SubtitleTimestampInput";

interface SubtitleStyleRowProps {
  controller: SubtitleEditorController;
  event: EditorStyleEvent;
}

export default function SubtitleStyleRow(props: SubtitleStyleRowProps) {
  const { controller, event } = props;
  return (
    <div className="subtitle-editor-style-row">
      <div className="subtitle-editor-style-header">
        <IconPalette size="1em" className="subtitle-editor-style-icon" />
        <span className="subtitle-editor-style-label">Style change</span>
        <SubtitleTimestampInput valueMs={event.time} onCommit={ms => controller.updateStyleEvent(event.uid, { time: ms }, true)} />
        <Tooltip label="Set to playhead">
          <ActionIcon size="sm" variant="subtle" onClick={() => controller.updateStyleEvent(event.uid, { time: controller.playheadMs() }, true)}>
            <IconClock size="1em" />
          </ActionIcon>
        </Tooltip>
        <Checkbox
          size="xs"
          label="Reset previous style changes"
          checked={event.reset}
          onChange={e => controller.updateStyleEvent(event.uid, { reset: e.currentTarget.checked }, true)}
        />
        <div className="subtitle-editor-style-actions">
          <Tooltip label="Delete style change">
            <ActionIcon size="sm" variant="subtle" color="red" onClick={() => controller.removeStyleEvent(event.uid)}>
              <IconTrash size="1em" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
      <SubtitleOptionsForm
        compact
        options={event.options}
        onChange={(key, value) => controller.setStyleEventOption(event.uid, key, value)}
      />
    </div>
  );
}
