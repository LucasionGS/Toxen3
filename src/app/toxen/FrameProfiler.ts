import Settings from "./Settings";

export type FramePhase = "resolve" | "draw" | "title";

interface PhaseStats {
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface FrameReport {
  frames: number;
  seconds: number;
  fps: number;
  intervalMs: number;
  refreshHz: number;
  dropped: number;
  droppedPercent: number;
  total: PhaseStats;
  resolve: PhaseStats;
  draw: PhaseStats;
  title: PhaseStats;
  histogram: Record<string, number>;
}

const CAPACITY = 900;
const HISTOGRAM_EDGES = [0.5, 1, 2, 4, 8, 16, 33, 66];

/**
 * Rolling per-frame timing for the visualizer loop. Off by default and gated behind advanced
 * settings; every entry point is a single boolean test when disabled.
 *
 * Available as `window.__toxenFrameProfiler` for use from DevTools.
 */
export default class FrameProfiler {
  public static enabled = false;

  private static total = new Float64Array(CAPACITY);
  private static resolve = new Float64Array(CAPACITY);
  private static draw = new Float64Array(CAPACITY);
  private static title = new Float64Array(CAPACITY);
  private static interval = new Float64Array(CAPACITY);

  private static count = 0;
  private static cursor = 0;

  private static frameStart = 0;
  private static lastFrameStart = 0;
  private static lastMark = 0;
  private static pendingResolve = 0;
  private static pendingDraw = 0;
  private static pendingTitle = 0;

  public static start(): boolean {
    if (!Settings.isAdvanced()) {
      console.warn("FrameProfiler requires advanced settings to be enabled.");
      return false;
    }
    FrameProfiler.reset();
    FrameProfiler.enabled = true;
    return true;
  }

  public static stop() {
    FrameProfiler.enabled = false;
  }

  public static reset() {
    FrameProfiler.count = 0;
    FrameProfiler.cursor = 0;
    FrameProfiler.lastFrameStart = 0;
  }

  public static beginFrame(now: number) {
    if (!FrameProfiler.enabled) return;
    FrameProfiler.frameStart = performance.now();
    FrameProfiler.lastMark = FrameProfiler.frameStart;
    FrameProfiler.pendingResolve = 0;
    FrameProfiler.pendingDraw = 0;
    FrameProfiler.pendingTitle = 0;

    const previous = FrameProfiler.lastFrameStart;
    FrameProfiler.lastFrameStart = now;
    FrameProfiler.interval[FrameProfiler.cursor] = previous > 0 ? now - previous : 0;
  }

  public static mark(phase: FramePhase) {
    if (!FrameProfiler.enabled) return;
    const now = performance.now();
    const elapsed = now - FrameProfiler.lastMark;
    FrameProfiler.lastMark = now;

    if (phase === "resolve") FrameProfiler.pendingResolve = elapsed;
    else if (phase === "draw") FrameProfiler.pendingDraw = elapsed;
    else FrameProfiler.pendingTitle = elapsed;
  }

  public static endFrame() {
    if (!FrameProfiler.enabled) return;
    const i = FrameProfiler.cursor;
    FrameProfiler.total[i] = performance.now() - FrameProfiler.frameStart;
    FrameProfiler.resolve[i] = FrameProfiler.pendingResolve;
    FrameProfiler.draw[i] = FrameProfiler.pendingDraw;
    FrameProfiler.title[i] = FrameProfiler.pendingTitle;

    FrameProfiler.cursor = (i + 1) % CAPACITY;
    if (FrameProfiler.count < CAPACITY) FrameProfiler.count++;
  }

  public static report(): FrameReport | null {
    const frames = FrameProfiler.count;
    if (frames === 0) return null;

    const intervals = FrameProfiler.collect(FrameProfiler.interval).filter(v => v > 0).sort((a, b) => a - b);
    const intervalMs = intervals.length > 0 ? intervals[Math.floor(intervals.length / 2)] : 0;
    const dropped = intervalMs > 0 ? intervals.filter(v => v > intervalMs * 1.5).length : 0;
    const totals = FrameProfiler.collect(FrameProfiler.total);
    const seconds = intervals.reduce((sum, v) => sum + v, 0) / 1000;

    return {
      frames,
      seconds,
      fps: seconds > 0 ? intervals.length / seconds : 0,
      intervalMs,
      refreshHz: intervalMs > 0 ? Math.round(1000 / intervalMs) : 0,
      dropped,
      droppedPercent: intervals.length > 0 ? (dropped / intervals.length) * 100 : 0,
      total: FrameProfiler.stats(FrameProfiler.total),
      resolve: FrameProfiler.stats(FrameProfiler.resolve),
      draw: FrameProfiler.stats(FrameProfiler.draw),
      title: FrameProfiler.stats(FrameProfiler.title),
      histogram: FrameProfiler.histogram(totals),
    };
  }

  public static print() {
    const report = FrameProfiler.report();
    if (!report) {
      console.warn("FrameProfiler has no frames recorded.");
      return;
    }
    console.log(
      `${report.frames} frames over ${report.seconds.toFixed(1)}s, `
      + `${report.fps.toFixed(1)} fps, display ~${report.refreshHz}Hz, `
      + `${report.dropped} dropped (${report.droppedPercent.toFixed(1)}%)`
    );
    console.table({
      total: report.total,
      resolve: report.resolve,
      draw: report.draw,
      title: report.title,
    });
    console.table(report.histogram);
  }

  private static collect(source: Float64Array): number[] {
    const out: number[] = [];
    for (let i = 0; i < FrameProfiler.count; i++) out.push(source[i]);
    return out;
  }

  private static stats(source: Float64Array): PhaseStats {
    const sorted = FrameProfiler.collect(source).sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    return {
      p50: at(0.5),
      p95: at(0.95),
      p99: at(0.99),
      max: sorted[sorted.length - 1],
    };
  }

  private static histogram(values: number[]): Record<string, number> {
    const buckets: Record<string, number> = {};
    for (let i = 0; i < HISTOGRAM_EDGES.length; i++) {
      buckets[`<=${HISTOGRAM_EDGES[i]}ms`] = 0;
    }
    buckets[`>${HISTOGRAM_EDGES[HISTOGRAM_EDGES.length - 1]}ms`] = 0;

    for (const value of values) {
      const edge = HISTOGRAM_EDGES.find(e => value <= e);
      if (edge === undefined) buckets[`>${HISTOGRAM_EDGES[HISTOGRAM_EDGES.length - 1]}ms`]++;
      else buckets[`<=${edge}ms`]++;
    }
    return buckets;
  }
}

if (typeof window !== "undefined") {
  (window as any).__toxenFrameProfiler = FrameProfiler;
}
