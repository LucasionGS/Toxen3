import React, { useEffect, useRef } from "react";
import { Toxen } from "../../ToxenApp";
import Time from "../../toxen/Time";
import SubtitleEditorController from "./SubtitleEditorController";

interface SubtitleTimelineProps {
  controller: SubtitleEditorController;
}

const CANVAS_W = 1920;
const CANVAS_H = 160;
const BASE_PX_PER_MS = 0.05;
const EDGE_SIZE = 10;
const RULER_H = 22;
const LANE_TOP = 36;
const LANE_BOTTOM = CANVAS_H - 16;
const MIN_CUE_DURATION = 100;
const DRAG_THRESHOLD = 4;

interface CueLayout {
  uid: number;
  x1: number;
  x2: number;
}

type DragState =
  | { mode: "scrub" }
  | { mode: "pan", lastX: number }
  | { mode: "select", anchorX: number, currentX: number, additive: boolean, baseSelection: number[], moved: boolean }
  | { mode: "move", anchorT: number, origin: { uid: number, start: number, end: number }[], moved: boolean }
  | { mode: "start" | "end", uid: number, moved: boolean }
  | { mode: "styleMove", uid: number, moved: boolean };

const STYLE_MARKER_Y = (RULER_H + LANE_TOP) / 2;
const STYLE_MARKER_HIT = 7;

function formatTick(ms: number, step: number) {
  const format = step < 1000 ? Time.FORMATS.STANDARD_WITH_MS : Time.FORMATS.STANDARD;
  return new Time(ms).toTimestamp(format);
}

export default function SubtitleTimeline(props: SubtitleTimelineProps) {
  const { controller } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef(1);
  const viewStartRef = useRef<number>(null);
  const followRef = useRef(true);
  const layoutRef = useRef<CueLayout[]>([]);
  const styleLayoutRef = useRef<{ uid: number, x: number }[]>([]);
  const dragRef = useRef<DragState>(null);
  const themeRef = useRef({
    accent: "#ff4081",
    accentRgb: "255, 64, 129",
    text: "rgba(255, 255, 255, 0.9)",
    muted: "rgba(255, 255, 255, 0.5)",
  });

  const pxPerMs = () => BASE_PX_PER_MS * zoomRef.current;
  const timeAtX = (x: number) => (viewStartRef.current ?? 0) + x / pxPerMs();
  const xAtTime = (ms: number) => (ms - (viewStartRef.current ?? 0)) * pxPerMs();

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
      const playheadMs = controller.playheadMs();

      if (viewStartRef.current === null) {
        viewStartRef.current = playheadMs - (w * 0.25) / scale;
      }
      const playheadX = xAtTime(playheadMs);
      if (followRef.current && (playheadX < 0 || playheadX > w * 0.95)) {
        viewStartRef.current = playheadMs - (w * 0.25) / scale;
      }

      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = "rgba(128, 128, 128, 0.08)";
      ctx.fillRect(0, 0, w, RULER_H);

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
        ctx.fillRect(x, RULER_H - 4, 1, h - RULER_H + 4);
        ctx.fillStyle = theme.muted;
        ctx.fillText(formatTick(t, step), x + 4, 5);
      }

      const overlapping = controller.getOverlappingUids();
      const activeUid = controller.getCueAtTime(playheadMs)?.uid ?? null;
      layoutRef.current = [];
      for (const cue of controller.cues) {
        const x1 = xAtTime(cue.start);
        const x2 = xAtTime(cue.end);
        if (x2 < -50 || x1 > w + 50) continue;
        layoutRef.current.push({ uid: cue.uid, x1, x2 });
        const selected = controller.isSelected(cue.uid);
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

      styleLayoutRef.current = [];
      for (const event of controller.styleEvents) {
        const x = xAtTime(event.time);
        if (x < -20 || x > w + 20) continue;
        styleLayoutRef.current.push({ uid: event.uid, x });
        ctx.strokeStyle = `rgba(${theme.accentRgb}, 0.5)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, RULER_H);
        ctx.lineTo(x, LANE_BOTTOM);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.moveTo(x, STYLE_MARKER_Y - 5);
        ctx.lineTo(x + 5, STYLE_MARKER_Y);
        ctx.lineTo(x, STYLE_MARKER_Y + 5);
        ctx.lineTo(x - 5, STYLE_MARKER_Y);
        ctx.closePath();
        ctx.fill();
      }

      const drag = dragRef.current;
      if (drag && drag.mode === "select" && drag.moved) {
        const x1 = Math.min(drag.anchorX, drag.currentX);
        const x2 = Math.max(drag.anchorX, drag.currentX);
        ctx.fillStyle = `rgba(${theme.accentRgb}, 0.12)`;
        ctx.fillRect(x1, LANE_TOP - 6, x2 - x1, LANE_BOTTOM - LANE_TOP + 12);
        ctx.strokeStyle = `rgba(${theme.accentRgb}, 0.8)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x1, LANE_TOP - 6, x2 - x1, LANE_BOTTOM - LANE_TOP + 12);
        ctx.setLineDash([]);
      }

      const px = xAtTime(playheadMs);
      ctx.fillStyle = theme.accent;
      ctx.fillRect(px - 1, 0, 2, h);
      ctx.beginPath();
      ctx.moveTo(px, 14);
      ctx.lineTo(px - 6, 2);
      ctx.lineTo(px + 6, 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.muted;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.fillText(
        `Scroll: Pan · Ctrl+Scroll: Zoom · Drag: Select · Ruler: Seek · ${Math.round(zoomRef.current * 100)}%`,
        w - 8, h - 4
      );
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
      if (e.ctrlKey || e.metaKey) {
        const { x } = canvasPoint(e);
        const anchorTime = timeAtX(x);
        const factor = e.deltaY > 0 ? 0.85 : 1.18;
        zoomRef.current = Math.max(0.1, Math.min(12, zoomRef.current * factor));
        viewStartRef.current = anchorTime - x / pxPerMs();
        const playheadX = xAtTime(controller.playheadMs());
        if (playheadX < 0 || playheadX > canvas.width) followRef.current = false;
      }
      else {
        const deltaPx = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        viewStartRef.current = (viewStartRef.current ?? 0) + deltaPx / pxPerMs();
        followRef.current = false;
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [controller]);

  useEffect(() => {
    const media = Toxen.musicPlayer?.media;
    if (!media) return;
    const onSeeked = () => { followRef.current = true; };
    media.addEventListener("seeked", onSeeked);
    return () => media.removeEventListener("seeked", onSeeked);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = canvasPoint(e);

    if (e.button === 1) {
      e.preventDefault();
      dragRef.current = { mode: "pan", lastX: x };
      return;
    }

    if (y < RULER_H) {
      dragRef.current = { mode: "scrub" };
      followRef.current = true;
      seekTo(timeAtX(x));
      return;
    }

    if (y < LANE_TOP) {
      const marker = styleLayoutRef.current.find(m => Math.abs(x - m.x) <= STYLE_MARKER_HIT);
      if (marker) {
        Toxen.musicPlayer?.pause();
        dragRef.current = { mode: "styleMove", uid: marker.uid, moved: false };
        return;
      }
    }

    const hit = layoutRef.current.find(l => x >= l.x1 - EDGE_SIZE && x <= l.x2 + EDGE_SIZE);
    if (hit) {
      const cue = controller.getCue(hit.uid);
      if (!cue) return;
      const additive = e.ctrlKey || e.metaKey;
      if (Math.abs(x - hit.x1) <= EDGE_SIZE) {
        controller.selectCue(hit.uid);
        Toxen.musicPlayer?.pause();
        dragRef.current = { mode: "start", uid: hit.uid, moved: false };
        return;
      }
      if (Math.abs(x - hit.x2) <= EDGE_SIZE) {
        controller.selectCue(hit.uid);
        Toxen.musicPlayer?.pause();
        dragRef.current = { mode: "end", uid: hit.uid, moved: false };
        return;
      }
      if (!controller.isSelected(hit.uid) || additive) {
        controller.selectCue(hit.uid, additive);
      }
      if (!controller.isSelected(hit.uid)) return;
      Toxen.musicPlayer?.pause();
      const origin = controller.cues
        .filter(c => controller.isSelected(c.uid))
        .map(c => ({ uid: c.uid, start: c.start, end: c.end }));
      dragRef.current = { mode: "move", anchorT: timeAtX(x), origin, moved: false };
    }
    else {
      dragRef.current = {
        mode: "select",
        anchorX: x,
        currentX: x,
        additive: e.ctrlKey || e.metaKey,
        baseSelection: (e.ctrlKey || e.metaKey) ? [...controller.selectedUids] : [],
        moved: false,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const { x, y } = canvasPoint(e);
    const drag = dragRef.current;
    if (!drag) {
      if (y < RULER_H) {
        canvas.style.cursor = "col-resize";
        return;
      }
      if (y < LANE_TOP && styleLayoutRef.current.some(m => Math.abs(x - m.x) <= STYLE_MARKER_HIT)) {
        canvas.style.cursor = "ew-resize";
        return;
      }
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
    switch (drag.mode) {
      case "scrub": {
        seekTo(timeAtX(x));
        break;
      }
      case "pan": {
        viewStartRef.current = (viewStartRef.current ?? 0) - (x - drag.lastX) / pxPerMs();
        drag.lastX = x;
        followRef.current = false;
        break;
      }
      case "select": {
        drag.currentX = x;
        if (!drag.moved && Math.abs(x - drag.anchorX) > DRAG_THRESHOLD) drag.moved = true;
        if (drag.moved) {
          const t1 = timeAtX(Math.min(drag.anchorX, drag.currentX));
          const t2 = timeAtX(Math.max(drag.anchorX, drag.currentX));
          const inRange = controller.cues.filter(c => c.start < t2 && c.end > t1).map(c => c.uid);
          const target = drag.additive ? [...new Set([...drag.baseSelection, ...inRange])] : inRange;
          controller.selectMany(target);
        }
        break;
      }
      case "move": {
        drag.moved = true;
        const minStart = Math.min(...drag.origin.map(o => o.start));
        const delta = Math.max(Math.round(timeAtX(x) - drag.anchorT), -minStart);
        controller.setCueTimes(drag.origin.map(o => ({ uid: o.uid, start: o.start + delta, end: o.end + delta })));
        break;
      }
      case "start": {
        drag.moved = true;
        const cue = controller.getCue(drag.uid);
        if (!cue) return;
        const start = Math.max(0, Math.min(Math.round(timeAtX(x)), cue.end - MIN_CUE_DURATION));
        controller.updateCue(drag.uid, { start });
        break;
      }
      case "end": {
        drag.moved = true;
        const cue = controller.getCue(drag.uid);
        if (!cue) return;
        const end = Math.max(Math.round(timeAtX(x)), cue.start + MIN_CUE_DURATION);
        controller.updateCue(drag.uid, { end });
        break;
      }
      case "styleMove": {
        drag.moved = true;
        controller.updateStyleEvent(drag.uid, { time: Math.max(0, Math.round(timeAtX(x))) });
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.mode === "select" && !drag.moved) {
      if (!drag.additive) controller.clearSelection();
      followRef.current = true;
      seekTo(timeAtX(drag.currentX));
      return;
    }
    if ((drag.mode === "move" || drag.mode === "start" || drag.mode === "end" || drag.mode === "styleMove") && drag.moved) {
      controller.snapshot();
    }
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
        onAuxClick={e => e.preventDefault()}
      />
    </div>
  );
}
