import StoryboardParser from "../../toxen/StoryboardParser";

/**
 * Lightweight undo/redo history manager for storyboard event arrays.
 * Uses JSON serialization to snapshot storyboard state.
 */
export class StoryboardHistory {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private config: StoryboardParser.StoryboardConfig | null = null;
  private maxSize = 50;
  private onRestore: (() => void) | null = null;

  setConfig(config: StoryboardParser.StoryboardConfig, onRestore?: () => void) {
    this.config = config;
    this.onRestore = onRestore ?? null;
    this.undoStack = [];
    this.redoStack = [];
    this.snapshot();
  }

  snapshot() {
    if (!this.config) return;
    const snap = JSON.stringify(this.config.storyboard.map(e => ({
      start: e.startTime,
      end: e.endTime,
      component: e.component,
      data: e.data,
      once: e.once,
    })));
    // Don't push if identical to last snapshot
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snap) {
      return;
    }
    this.undoStack.push(snap);
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): boolean {
    if (this.undoStack.length <= 1 || !this.config) return false;
    this.redoStack.push(this.undoStack.pop()!);
    const prev = this.undoStack[this.undoStack.length - 1];
    this.restoreFromSnapshot(prev);
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0 || !this.config) return false;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    this.restoreFromSnapshot(next);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private restoreFromSnapshot(snap: string) {
    if (!this.config) return;
    const events = JSON.parse(snap) as any[];
    this.config.storyboard = events.map(e =>
      StoryboardParser.SBEvent.fromConfig(e, {}, null, false)
    );
    StoryboardParser.setStoryboard(this.config);
    this.onRestore?.();
  }
}

// Shared instance used by both canvas editor and side panel
export const storyboardHistory = new StoryboardHistory();
