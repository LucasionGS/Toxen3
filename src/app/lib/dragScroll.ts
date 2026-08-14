/**
 * Grab-and-drag scrolling with momentum for a scrollable element.
 *
 * Only reacts to a primary mouse press on empty space; anything that needs the
 * drag itself (inputs, sliders, colour pickers, canvases) is left alone, as is
 * ctrl-drag, which the song list uses for multi-select. Touch is skipped
 * entirely since it already scrolls with momentum natively.
 */

const DEFAULT_IGNORE = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "canvas",
  "[contenteditable]",
  "[draggable=true]",
  "[role=slider]",
  ".mantine-Slider-root",
  ".mantine-RangeSlider-root",
  ".mantine-ColorPicker-root",
  ".mantine-ColorInput-root",
  "[data-no-drag-scroll]",
].join(",");

interface DragScrollOptions {
  /** Presses landing inside anything matching this never start a drag. */
  ignoreSelector?: string;
  /** Return false to skip the drag entirely, checked on each press. */
  enabled?: () => boolean;
}

/** Pixels the pointer must travel before a press turns into a drag. */
const DRAG_THRESHOLD = 6;
/** Velocity retained per 60fps frame once released. */
const FRICTION = 0.94;
/** Below this (pixels per millisecond) the glide is over. */
const MIN_VELOCITY = 0.02;
/** A pointer held still for longer than this releases without any glide. */
const STALE_VELOCITY_MS = 80;

export function attachDragScroll(el: HTMLElement, options: DragScrollOptions = {}) {
  const ignoreSelector = options.ignoreSelector ?? DEFAULT_IGNORE;

  let pointerId: number = null;
  let startY = 0;
  let startX = 0;
  let startScroll = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let dragging = false;
  let didDrag = false;
  let momentumFrame: number = null;

  const stopMomentum = () => {
    if (momentumFrame !== null) {
      cancelAnimationFrame(momentumFrame);
      momentumFrame = null;
    }
  };

  const glide = () => {
    let previous = performance.now();
    const step = (now: number): void => {
      const dt = Math.min(now - previous, 32);
      previous = now;

      // Stopping on an unchanged scrollTop ends the glide at the list's edge.
      const before = el.scrollTop;
      el.scrollTop = before - velocity * dt;
      velocity *= Math.pow(FRICTION, dt / (1000 / 60));

      if (el.scrollTop === before || Math.abs(velocity) < MIN_VELOCITY) {
        momentumFrame = null;
        return;
      }
      momentumFrame = requestAnimationFrame(step);
    };
    momentumFrame = requestAnimationFrame(step);
  };

  const onPointerDown = (e: PointerEvent) => {
    stopMomentum();
    if (e.pointerType !== "mouse" || e.button !== 0 || e.ctrlKey) return;
    if (options.enabled && !options.enabled()) return;
    if (el.scrollHeight <= el.clientHeight) return;

    const target = e.target as HTMLElement;
    if (!target || (target.closest && target.closest(ignoreSelector))) return;
    // Presses on the native scrollbar already scroll on their own.
    if (e.clientX - el.getBoundingClientRect().left >= el.clientWidth) return;

    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startScroll = el.scrollTop;
    lastY = e.clientY;
    lastTime = e.timeStamp;
    velocity = 0;
    dragging = false;
    didDrag = false;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (pointerId === null || e.pointerId !== pointerId) return;

    if (!dragging) {
      if (Math.abs(e.clientY - startY) < DRAG_THRESHOLD && Math.abs(e.clientX - startX) < DRAG_THRESHOLD) return;
      dragging = true;
      didDrag = true;
      el.setPointerCapture(pointerId);
      el.classList.add("drag-scrolling");
      getSelection()?.removeAllRanges();
    }

    el.scrollTop = startScroll - (e.clientY - startY);

    const dt = e.timeStamp - lastTime;
    if (dt > 0) {
      velocity = velocity * 0.7 + ((e.clientY - lastY) / dt) * 0.3;
      lastY = e.clientY;
      lastTime = e.timeStamp;
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    pointerId = null;
    if (!dragging) return;

    dragging = false;
    el.classList.remove("drag-scrolling");
    if (e.timeStamp - lastTime > STALE_VELOCITY_MS) velocity = 0;
    if (Math.abs(velocity) > MIN_VELOCITY) glide();
  };

  // Swallow the click that ends a drag so it never plays a song or opens a panel.
  const onClickCapture = (e: MouseEvent) => {
    if (!didDrag) return;
    didDrag = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragStart = (e: DragEvent) => {
    if (dragging) e.preventDefault();
  };

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerUp);
  el.addEventListener("click", onClickCapture, true);
  el.addEventListener("dragstart", onDragStart);
  el.addEventListener("wheel", stopMomentum, { passive: true });

  return function detachDragScroll() {
    stopMomentum();
    el.classList.remove("drag-scrolling");
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointercancel", onPointerUp);
    el.removeEventListener("click", onClickCapture, true);
    el.removeEventListener("dragstart", onDragStart);
    el.removeEventListener("wheel", stopMomentum);
  };
}
