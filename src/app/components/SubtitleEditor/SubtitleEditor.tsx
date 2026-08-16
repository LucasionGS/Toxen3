import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./SubtitleEditor.scss";
import { ActionIcon, Button, Group, Popover, Select, Tooltip } from "@mantine/core";
import {
  IconArrowBackUp, IconArrowForwardUp, IconClipboard, IconCopy, IconDeviceFloppy, IconDoorExit,
  IconPalette, IconPlayerPause, IconPlayerPlay, IconPlayerSkipBack, IconPlus, IconScissors,
  IconSettings, IconTimeline
} from "@tabler/icons-react";
import { useModals } from "@mantine/modals";
import { Toxen } from "../../ToxenApp";
import Time from "../../toxen/Time";
import { useController } from "../../lib/useController";
import SubtitleEditorController, { SubtitleFormat } from "./SubtitleEditorController";
import SubtitleCueList from "./SubtitleCueList";
import SubtitleTimeline from "./SubtitleTimeline";
import SubtitleOptionsForm from "./SubtitleOptionsForm";

interface SubtitleEditorProps {
  onReady?: (controller: SubtitleEditorController) => void;
}

const FORMAT_OPTIONS = [
  { value: ".tst", label: ".tst (Toxen, full styling)" },
  { value: ".srt", label: ".srt (SubRip)" },
  { value: ".vtt", label: ".vtt (WebVTT)" },
  { value: ".lrc", label: ".lrc (Lyrics)" },
];

const RATE_OPTIONS = ["0.25", "0.5", "0.75", "1"].map(v => ({ value: v, label: `${v}x` }));

function usePlaybackState(active: boolean) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!active) return;
    const media = Toxen.musicPlayer?.media;
    if (!media) return;
    const update = () => setPlaying(!media.paused);
    update();
    media.addEventListener("play", update);
    media.addEventListener("pause", update);
    return () => {
      media.removeEventListener("play", update);
      media.removeEventListener("pause", update);
    };
  }, [active]);
  return playing;
}

function PlayheadTime(props: { active: boolean }) {
  const [text, setText] = useState("00:00.000");
  useEffect(() => {
    if (!props.active) return;
    let raf: number;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const ms = (Toxen.musicPlayer?.media?.currentTime ?? 0) * 1000;
      const next = new Time(ms).toTimestamp(Time.FORMATS.STANDARD_WITH_MS);
      setText(prev => (prev === next ? prev : next));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [props.active]);
  return <span className="subtitle-editor-time">{text}</span>;
}

export default function SubtitleEditor(props: SubtitleEditorProps) {
  const modals = useModals();
  const controller = useMemo(() => new SubtitleEditorController(), []);
  useController(controller);
  const playing = usePlaybackState(controller.started);
  const [rate, setRate] = useState("1");

  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;
  useEffect(() => {
    onReadyRef.current?.(controller);
  }, [controller]);

  useEffect(() => {
    if (controller.started) setRate("1");
  }, [controller.started]);

  const requestSave = useCallback(() => {
    const warnings: string[] = [];
    if (controller.needsLossyWarning()) {
      warnings.push(`The ${controller.format} format cannot store styling options. All styling will be dropped from the saved file.`);
    }
    if (controller.format === ".lrc") {
      warnings.push("The .lrc format only stores start times. End times are approximated when the file is loaded again.");
    }
    if (warnings.length > 0) {
      modals.openConfirmModal({
        title: "Save with limitations",
        children: <div>{warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div>,
        labels: { confirm: "Save anyway", cancel: "Cancel" },
        onConfirm: () => controller.save(),
      });
    }
    else {
      controller.save();
    }
  }, [controller, modals]);

  const copySelection = useCallback(() => {
    const count = controller.copySelection();
    if (count > 0) Toxen.log(`Copied ${count} ${count === 1 ? "cue" : "cues"}`, 1500);
  }, [controller]);

  const cutSelection = useCallback(() => {
    const count = controller.cutSelection();
    if (count > 0) Toxen.log(`Cut ${count} ${count === 1 ? "cue" : "cues"}`, 1500);
  }, [controller]);

  const requestExit = useCallback(() => {
    if (controller.dirty) {
      modals.openConfirmModal({
        title: "Discard changes?",
        children: <p>You have unsaved subtitle changes. Exit without saving?</p>,
        labels: { confirm: "Discard", cancel: "Keep editing" },
        confirmProps: { color: "red" },
        onConfirm: () => Toxen.setMode("Player"),
      });
    }
    else {
      Toxen.setMode("Player");
    }
  }, [controller, modals]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!controller.started) return;
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        requestSave();
        return;
      }
      if (inInput) return;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          Toxen.musicPlayer.toggle();
          break;
        case "KeyZ":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) controller.redo();
            else controller.undo();
          }
          break;
        case "KeyY":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            controller.redo();
          }
          break;
        case "KeyA":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) controller.selectAll();
          else controller.addCueAtPlayhead();
          break;
        case "KeyC":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            copySelection();
          }
          break;
        case "KeyX":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            cutSelection();
          }
          break;
        case "KeyV":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            controller.pasteAtPlayhead();
          }
          break;
        case "BracketLeft":
          if (controller.primarySelectedUid !== null) controller.setStartToPlayhead(controller.primarySelectedUid);
          break;
        case "BracketRight":
          if (controller.primarySelectedUid !== null) controller.setEndToPlayhead(controller.primarySelectedUid);
          break;
        case "Delete":
        case "Backspace":
          controller.removeSelectedCues();
          break;
        case "ArrowLeft":
          e.preventDefault();
          Toxen.musicPlayer.setPosition(Math.max(0, Toxen.musicPlayer.media.currentTime - (e.shiftKey ? 5 : 1)));
          break;
        case "ArrowRight":
          e.preventDefault();
          Toxen.musicPlayer.setPosition(Toxen.musicPlayer.media.currentTime + (e.shiftKey ? 5 : 1));
          break;
        case "Escape":
          e.preventDefault();
          if (controller.selectedUids.length > 0) controller.clearSelection();
          else requestExit();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [controller, requestSave, requestExit, copySelection, cutSelection]);

  return (
    <div className="subtitle-editor" style={{ display: controller.started ? "" : "none" }}>
      <div className="subtitle-editor-toolbar">
        <div className="subtitle-editor-title">
          <span className="subtitle-editor-song">{Toxen.editingSong?.getDisplayName()}</span>
          <span className="subtitle-editor-file">{controller.fileName}</span>
        </div>
        <Group gap="xs">
          <Button size="xs" leftSection={<IconDeviceFloppy size="1em" />} onClick={requestSave}>Save</Button>
          {controller.dirty && (
            <Tooltip label="Unsaved changes">
              <span className="subtitle-editor-dirty-dot" />
            </Tooltip>
          )}
          <Tooltip label="Undo (Ctrl+Z)">
            <ActionIcon variant="default" disabled={!controller.canUndo()} onClick={() => controller.undo()}>
              <IconArrowBackUp size="1em" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Redo (Ctrl+Y)">
            <ActionIcon variant="default" disabled={!controller.canRedo()} onClick={() => controller.redo()}>
              <IconArrowForwardUp size="1em" />
            </ActionIcon>
          </Tooltip>
          <Button size="xs" variant="light" leftSection={<IconPlus size="1em" />} onClick={() => controller.addCueAtPlayhead()}>
            Add cue
          </Button>
          <Tooltip label="Add a style change at the playhead. Applies to all following lines until the next style change (.tst only).">
            <Button size="xs" variant="light" leftSection={<IconPalette size="1em" />} onClick={() => controller.addStyleEventAtPlayhead()}>
              Add style
            </Button>
          </Tooltip>
          <Tooltip label="Copy selection (Ctrl+C)">
            <ActionIcon variant="default" disabled={controller.selectedUids.length === 0} onClick={copySelection}>
              <IconCopy size="1em" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Cut selection (Ctrl+X)">
            <ActionIcon variant="default" disabled={controller.selectedUids.length === 0} onClick={cutSelection}>
              <IconScissors size="1em" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Paste at playhead (Ctrl+V)">
            <ActionIcon variant="default" disabled={controller.clipboardSize === 0} onClick={() => controller.pasteAtPlayhead()}>
              <IconClipboard size="1em" />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Group gap="xs">
          <Select
            size="xs"
            w={200}
            data={FORMAT_OPTIONS}
            value={controller.format}
            allowDeselect={false}
            onChange={value => value && controller.setFormat(value as SubtitleFormat)}
          />
          <Popover position="bottom" withArrow trapFocus>
            <Popover.Target>
              <Button size="xs" variant="light" leftSection={<IconSettings size="1em" />}>Global style</Button>
            </Popover.Target>
            <Popover.Dropdown className="subtitle-editor-popover">
              <SubtitleOptionsForm
                options={controller.globalOptions}
                onChange={(key, value) => controller.setGlobalOption(key, value)}
              />
            </Popover.Dropdown>
          </Popover>
        </Group>
        <Group gap="xs">
          <Tooltip label="Go to start">
            <ActionIcon variant="default" onClick={() => Toxen.musicPlayer.setPosition(0)}>
              <IconPlayerSkipBack size="1em" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Play/Pause (Space)">
            <ActionIcon variant="filled" onClick={() => Toxen.musicPlayer.toggle()}>
              {playing ? <IconPlayerPause size="1em" /> : <IconPlayerPlay size="1em" />}
            </ActionIcon>
          </Tooltip>
          <Select
            size="xs"
            w={90}
            data={RATE_OPTIONS}
            value={rate}
            allowDeselect={false}
            onChange={value => {
              if (!value) return;
              setRate(value);
              Toxen.musicPlayer.setPlaybackRate(+value);
            }}
          />
          <PlayheadTime active={controller.started} />
        </Group>
        <Group gap="xs" className="subtitle-editor-toolbar-end">
          <Tooltip label="Toggle timeline">
            <ActionIcon variant={controller.timelineVisible ? "filled" : "default"} onClick={() => controller.toggleTimeline()}>
              <IconTimeline size="1em" />
            </ActionIcon>
          </Tooltip>
          <Button size="xs" color="red" variant="light" leftSection={<IconDoorExit size="1em" />} onClick={requestExit}>
            Exit
          </Button>
        </Group>
      </div>
      <div className="subtitle-editor-body">
        <SubtitleCueList controller={controller} />
        <div className="subtitle-editor-preview-space" />
      </div>
      {controller.started && controller.timelineVisible && <SubtitleTimeline controller={controller} />}
    </div>
  );
}
