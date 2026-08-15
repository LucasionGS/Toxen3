import React, { useEffect, useRef } from "react";
import { Toxen } from "../../ToxenApp";
import Time from "../../toxen/Time";
import SubtitleEditorController from "./SubtitleEditorController";

interface SubtitleTimelineProps {
  controller: SubtitleEditorController;
}

const CANVAS_W = 1920;
const CANVAS_H = 160;
const PLAYHEAD_X = CANVAS_W * 0.25;
const BASE_PX_PER_MS = 0.05;
const EDGE_SIZE = 10;
const LANE_TOP = 36;
const LANE_BOTTOM = CANVAS_H - 16;
const MIN_CUE_DURATION = 100;

interface CueLayout {
  uid: number;
  x1: number;
  x2: number;
}

type DragState =
  | { mode: "scrub", moved: boolean }
  | { mode: "move", uid: number, grabOffsetMs: number, durationMs: number, moved: boolean }
  | { mode: "start" | "end", uid: number, moved: boolean };

function formatTick(ms: number, step: number) {
  const format = step < 1000 ? Time.FORMATS.STANDARD_WITH_MS : Time.FORMATS.STANDARD;
  return new Time(ms).toTimestamp(format);
}

export default function SubtitleTimeline(props: SubtitleTimelineProps) {
  const { controller } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef(1);
  const layoutRef = useRef<CueLayout[]>([]);
  const dragRef = useRef<DragState>(null);
  const themeRef = useRef({
    accent: "#ff4081",
    accentRgb: "255, 64, 129",
    text: "rgba(255, 255, 255, 0.9)",
    muted: "rgba(255, 255, 255, 0.5)",
  });

  const pxPerMs = () => BASE_PX_PER_MS * zoomRef.current;
  const timeAtX = (x: number) => controller.playheadMs() + (x - PLAYHEAD_X) / pxPerMs();
  const xAtTime = (ms: number) => PLAYHEAD_X + (ms - controller.playheadMs()) * pxPerMs();

  const canvasPoint = (e: { clientX: number, clientY: number }) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * canvas.width,
      y: (e.clientY - rect.top) / rect.height * canvas.height,
    };
  };

  const seekTo = (ms: number) => {
    const duration = Toxen.musicPlayer?.media?.duration;
    const maxMs = isFinite(duration) ? duration * 1000 : ms;
    Toxen.musicPlayer?.setPosition(Math.max(0, Math.min(ms, maxMs)) / 1000);
  };

  const refreshTheme = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const style = getComputedStyle(canvas);
    const accent = style.getPropertyValue("--accent-color").trim();
    const accentRgb = style.getPropertyValue("--accent-color-rgb").trim();
    const text = style.getPropertyValue("--text-primary").trim();
    if (accent) themeRef.current.accent = accent;
    if (accentRgb) themeRef.current.accentRgb = accentRgb;
    if (text) themeRef.current.text = text;
  };

  useEffect(() => {
    let raf: number;
    let frame = 0;
    refreshTheme();

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width, h = canvas.height;
      const theme = themeRef.current;
      const scale = pxPerMs();
      ctx.clearRect(0, 0, w, h);

      const viewStart = timeAtX(0);
      const viewEnd = timeAtX(w);
      const tickSteps = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];
      const step = tickSteps.find(s => s * scale >= 90) ?? 60000;
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      for (let t = Math.max(0, Math.floor(viewStart / step) * step); t <= viewEnd; t += step) {
        const x = xAtTime(t);
        ctx.fillStyle = "rgba(128, 128, 128, 0.3)";
        ctx.fillRect(x, 18, 1, h - 18);
        ctx.fillStyle = theme.muted;
        ctx.fillText(formatTick(t, step), x + 4, 4);
      }

      const overlapping = controller.getOverlappingUids();
      const activeUid = controller.getCueAtTime(controller.playheadMs())?.uid ?? null;
      layoutRef.current = [];
      for (const cue of controller.cues) {
        const x1 = xAtTime(cue.start);
        const x2 = xAtTime(cue.end);
        if (x2 < -50 || x1 > w + 50) continue;
        layoutRef.current.push({ uid: cue.uid, x1, x2 });
        const selected = cue.uid === controller.selectedUid;
        const isActive = cue.uid === activeUid;
        const width = Math.max(6, x2 - x1);

        ctx.beginPath();
        ctx.roundRect(x1, LANE_TOP, width, LANE_BOTTOM - LANE_TOP, 6);
        ctx.fillStyle = `rgba(${theme.accentRgb}, ${isActive ? 0.55 : selected ? 0.4 : 0.25})`;
        ctx.fill();
        ctx.lineWidth = selected ? 2.5 : 1;
        ctx.strokeStyle = overlapping.has(cue.uid)
          ? "rgba(255, 180, 0, 0.9)"
          : `rgba(${theme.accentRgb}, ${selected ? 1 : 0.55})`;
        ctx.stroke();

        if (width > 40) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x1 + 6, LANE_TOP, width - 12, LANE_BOTTOM - LANE_TOP);
          ctx.clip();
          ctx.fillStyle = theme.text;
          ctx.font = "500 13px system-ui, sans-serif";
          ctx.textBaseline = "middle";
          ctx.fillText((cue.text || "").split("\n")[0], x1 + 8, (LANE_TOP + LANE_BOTTOM) / 2);
          ctx.restore();
        }
      }

      ctx.fillStyle = theme.accent;
      ctx.fillRect(PLAYHEAD_X - 1, 0, 2, h);
      ctx.beginPath();
      ctx.moveTo(PLAYHEAD_X, 14);
      ctx.lineTo(PLAYHEAD_X - 6, 2);
      ctx.lineTo(PLAYHEAD_X + 6, 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.muted;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.fillText(`${Math.round(zoomRef.current * 100)}%`, w - 8, 4);
      ctx.textAlign = "left";
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (++frame % 120 === 0) refreshTheme();
      draw();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [controller]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const delta = (e.deltaY > 0 ? 1 : -1) * 500 / zoomRef.current;
        seekTo(controller.playheadMs() + delta);
      }
      else {
        const factor = e.deltaY > 0 ? 0.85 : 1.18;
        zoomRef.current = Math.max(0.1, Math.min(12, zoomRef.current * factor));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [controller]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    const { x } = canvasPoint(e);
    const hit = layoutRef.current.find(l => x >= l.x1 - EDGE_SIZE && x <= l.x2 + EDGE_SIZE);
    if (hit) {
      const cue = controller.getCue(hit.uid);
      if (!cue) return;
      controller.selectCue(hit.uid);
      Toxen.musicPlayer?.pause();
      if (Math.abs(x - hit.x1) <= EDGE_SIZE) {
        dragRef.current = { mode: "start", uid: hit.uid, moved: false };
      }
      else if (Math.abs(x - hit.x2) <= EDGE_SIZE) {
        dragRef.current = { mode: "end", uid: hit.uid, moved: false };
      }
      else {
        dragRef.current = { mode: "move", uid: hit.uid, grabOffsetMs: timeAtX(x) - cue.start, durationMs: cue.end - cue.start, moved: false };
      }
    }
    else {
      dragRef.current = { mode: "scrub", moved: false };
      seekTo(timeAtX(x));
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const { x } = canvasPoint(e);
    const drag = dragRef.current;
    if (!drag) {
      const hit = layoutRef.current.find(l => x >= l.x1 - EDGE_SIZE && x <= l.x2 + EDGE_SIZE);
      if (hit && (Math.abs(x - hit.x1) <= EDGE_SIZE || Math.abs(x - hit.x2) <= EDGE_SIZE)) {
        canvas.style.cursor = "ew-resize";
      }
      else if (hit) {
        canvas.style.cursor = "grab";
      }
      else {
        canvas.style.cursor = "crosshair";
      }
      return;
    }
    drag.moved = true;
    switch (drag.mode) {
      case "scrub": {
        seekTo(timeAtX(x));
        break;
      }
      case "move": {
        const start = Math.max(0, Math.round(timeAtX(x) - drag.grabOffsetMs));
        controller.updateCue(drag.uid, { start, end: start + drag.durationMs });
        break;
      }
      case "start": {
        const cue = controller.getCue(drag.uid);
        if (!cue) return;
        const start = Math.max(0, Math.min(Math.round(timeAtX(x)), cue.end - MIN_CUE_DURATION));
        controller.updateCue(drag.uid, { start });
        break;
      }
      case "end": {
        const cue = controller.getCue(drag.uid);
        if (!cue) return;
        const end = Math.max(Math.round(timeAtX(x)), cue.start + MIN_CUE_DURATION);
        controller.updateCue(drag.uid, { end });
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && drag.moved && drag.mode !== "scrub") controller.snapshot();
  };

  return (
    <div className="subtitle-editor-timeline">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
}
