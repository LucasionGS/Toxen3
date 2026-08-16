import Controller from "../../toxen/controllers/Controller";
import SubtitleParser from "../../toxen/SubtitleParser";
import Song from "../../toxen/Song";
import Time from "../../toxen/Time";
import { Toxen } from "../../ToxenApp";

export interface EditorCue {
  uid: number;
  start: number;
  end: number;
  text: string;
  options: Partial<SubtitleParser.SubtitleOptions>;
}

export interface EditorStyleEvent {
  uid: number;
  time: number;
  options: Partial<SubtitleParser.SubtitleOptions>;
  reset: boolean;
}

export type SubtitleFormat = ".tst" | ".srt" | ".vtt" | ".lrc";

const DEFAULT_CUE_DURATION = 2000;
const MIN_CUE_DURATION = 100;
const MAX_HISTORY = 50;

/**
 * Controller for the fullscreen subtitle editor. Owns the working copy of the
 * subtitles as plain data, undo/redo history, and the live preview pipeline.
 */
export default class SubtitleEditorController extends Controller {
  public started = false;
  public song: Song = null;
  public cues: EditorCue[] = [];
  public styleEvents: EditorStyleEvent[] = [];
  public globalOptions: Partial<SubtitleParser.SubtitleOptions> = {};
  public format: SubtitleFormat = ".tst";
  public fileName = "subtitles.tst";
  public selectedUids: number[] = [];
  public dirty = false;
  public timelineVisible = true;
  public followPlayback = true;

  private nextUid = 1;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private savedSnapshot = "";
  private clipboard: { startOffset: number, duration: number, text: string, options: Partial<SubtitleParser.SubtitleOptions> }[] = [];
  private previewTimer: ReturnType<typeof setTimeout> = null;
  private snapshotTimer: ReturnType<typeof setTimeout> = null;

  public static isMobile() {
    return !toxenapi.isDesktop() && window.innerWidth <= 768;
  }

  public async start(song: Song) {
    this.song = song;
    this.cues = [];
    this.styleEvents = [];
    this.globalOptions = {};
    this.format = ".tst";
    this.fileName = "subtitles.tst";
    this.selectedUids = [];
    this.dirty = false;
    this.nextUid = 1;
    this.timelineVisible = !SubtitleEditorController.isMobile();
    this.followPlayback = true;

    const subFile = song.subtitleFile();
    if (subFile) {
      const ext = toxenapi.getFileExtension(subFile);
      if (Toxen.getSupportedSubtitleFiles().includes(ext)) {
        const data = await song.readSubtitleFile();
        if (data) {
          try {
            const parsed = SubtitleParser.parseByExtension(data, ext);
            this.cues = Array.from(parsed).map(item => ({
              uid: this.nextUid++,
              start: item.start.valueOf(),
              end: item.end.valueOf(),
              text: item.text ? item.text.replace(/<br\s*\/?>/g, "\n") : "",
              options: { ...item.options },
            }));
            this.styleEvents = (parsed.styleEvents ?? []).map(event => ({
              uid: this.nextUid++,
              time: event.time.valueOf(),
              options: { ...event.options },
              reset: !!event.reset,
            }));
            this.globalOptions = { ...parsed.options };
            this.format = ext as SubtitleFormat;
            this.fileName = song.paths.subtitles;
          } catch (error) {
            Toxen.error(`Failed to parse subtitles: ${error}`);
          }
        }
      }
    }

    this.sortCues();
    this.undoStack = [];
    this.redoStack = [];
    this.savedSnapshot = this.serialize();
    this.undoStack.push(this.savedSnapshot);
    this.started = true;
    document.body.classList.add("subtitle-editing");
    this.applyPreview();
    this.notify();
  }

  public stop() {
    if (!this.started) return;
    this.started = false;
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    document.body.classList.remove("subtitle-editing");
    Toxen.musicPlayer?.setPlaybackRate(1);
    this.song?.applySubtitles();
    this.notify();
  }

  public playheadMs() {
    return Math.round((Toxen.musicPlayer?.media?.currentTime ?? 0) * 1000);
  }

  public getCue(uid: number) {
    return this.cues.find(c => c.uid === uid) ?? null;
  }

  public getCueAtTime(ms: number) {
    return this.cues.find(c => c.start <= ms && c.end > ms) ?? null;
  }

  /**
   * Uids of cues whose time range overlaps another cue. Only one cue can render at a time.
   */
  public getOverlappingUids() {
    const overlapping = new Set<number>();
    let maxEnd = -1;
    let maxEndUid: number = null;
    for (const cue of this.cues) {
      if (cue.start < maxEnd) {
        overlapping.add(cue.uid);
        overlapping.add(maxEndUid);
      }
      if (cue.end > maxEnd) {
        maxEnd = cue.end;
        maxEndUid = cue.uid;
      }
    }
    return overlapping;
  }

  public get primarySelectedUid() {
    return this.selectedUids.length > 0 ? this.selectedUids[this.selectedUids.length - 1] : null;
  }

  public isSelected(uid: number) {
    return this.selectedUids.includes(uid);
  }

  public selectCue(uid: number | null, additive = false) {
    if (uid === null) {
      this.clearSelection();
      return;
    }
    if (!this.getCue(uid)) return;
    if (additive) {
      if (this.selectedUids.includes(uid)) this.selectedUids = this.selectedUids.filter(u => u !== uid);
      else this.selectedUids = [...this.selectedUids, uid];
    }
    else {
      if (this.selectedUids.length === 1 && this.selectedUids[0] === uid) return;
      this.selectedUids = [uid];
    }
    this.notify();
  }

  public selectMany(uids: number[]) {
    if (uids.length === this.selectedUids.length && uids.every((u, i) => this.selectedUids[i] === u)) return;
    this.selectedUids = uids;
    this.notify();
  }

  public selectAll() {
    this.selectMany(this.cues.map(c => c.uid));
  }

  public clearSelection() {
    if (this.selectedUids.length === 0) return;
    this.selectedUids = [];
    this.notify();
  }

  public setFollowPlayback(value: boolean) {
    this.followPlayback = value;
    this.notify();
  }

  public toggleTimeline() {
    this.timelineVisible = !this.timelineVisible;
    this.notify();
  }

  public addCueAtPlayhead() {
    const start = this.playheadMs();
    return this.addCue(start, start + DEFAULT_CUE_DURATION);
  }

  public addCue(start: number, end: number) {
    const cue: EditorCue = { uid: this.nextUid++, start, end, text: "", options: {} };
    this.cues.push(cue);
    this.sortCues();
    this.selectedUids = [cue.uid];
    this.markDirty();
    this.snapshot();
    return cue;
  }

  public insertAfter(uid: number) {
    const cue = this.getCue(uid);
    if (!cue) return;
    return this.addCue(cue.end, cue.end + DEFAULT_CUE_DURATION);
  }

  public removeCue(uid: number) {
    const index = this.cues.findIndex(c => c.uid === uid);
    if (index === -1) return;
    this.cues.splice(index, 1);
    this.selectedUids = this.selectedUids.filter(u => u !== uid);
    this.markDirty();
    this.snapshot();
  }

  public removeSelectedCues() {
    if (this.selectedUids.length === 0) return;
    const selected = new Set(this.selectedUids);
    this.cues = this.cues.filter(c => !selected.has(c.uid));
    this.selectedUids = [];
    this.markDirty();
    this.snapshot();
  }

  public updateCue(uid: number, patch: Partial<Pick<EditorCue, "start" | "end" | "text">>, commit = false) {
    const cue = this.getCue(uid);
    if (!cue) return;
    Object.assign(cue, patch);
    if (patch.start !== undefined || patch.end !== undefined) this.sortCues();
    this.markDirty();
    if (commit) this.snapshot();
    else this.scheduleSnapshot();
  }

  /**
   * Applies new times to several cues at once, e.g. when dragging a multi-selection on the timeline.
   */
  public setCueTimes(entries: { uid: number, start: number, end: number }[], commit = false) {
    let changed = false;
    for (const entry of entries) {
      const cue = this.getCue(entry.uid);
      if (!cue) continue;
      cue.start = entry.start;
      cue.end = entry.end;
      changed = true;
    }
    if (!changed) return;
    this.sortCues();
    this.markDirty();
    if (commit) this.snapshot();
  }

  public copySelection() {
    const cues = this.cues.filter(c => this.selectedUids.includes(c.uid));
    if (cues.length === 0) return 0;
    const base = Math.min(...cues.map(c => c.start));
    this.clipboard = cues.map(c => ({
      startOffset: c.start - base,
      duration: c.end - c.start,
      text: c.text,
      options: { ...c.options },
    }));
    this.notify();
    return this.clipboard.length;
  }

  public cutSelection() {
    const count = this.copySelection();
    if (count > 0) this.removeSelectedCues();
    return count;
  }

  public get clipboardSize() {
    return this.clipboard.length;
  }

  public pasteAtPlayhead() {
    if (this.clipboard.length === 0) return 0;
    const base = this.playheadMs();
    const pasted = this.clipboard.map(item => {
      const cue: EditorCue = {
        uid: this.nextUid++,
        start: base + item.startOffset,
        end: base + item.startOffset + item.duration,
        text: item.text,
        options: { ...item.options },
      };
      this.cues.push(cue);
      return cue;
    });
    this.sortCues();
    this.selectedUids = pasted.map(c => c.uid);
    this.markDirty();
    this.snapshot();
    return pasted.length;
  }

  public setCueOption(uid: number, key: keyof SubtitleParser.SubtitleOptions, value: string) {
    const cue = this.getCue(uid);
    if (!cue) return;
    if (value) cue.options[key] = value;
    else delete cue.options[key];
    this.markDirty();
    this.scheduleSnapshot();
  }

  public getStyleEvent(uid: number) {
    return this.styleEvents.find(e => e.uid === uid) ?? null;
  }

  public addStyleEventAtPlayhead() {
    const event: EditorStyleEvent = { uid: this.nextUid++, time: this.playheadMs(), options: {}, reset: false };
    this.styleEvents.push(event);
    this.sortStyleEvents();
    this.markDirty();
    this.snapshot();
    return event;
  }

  public removeStyleEvent(uid: number) {
    const index = this.styleEvents.findIndex(e => e.uid === uid);
    if (index === -1) return;
    this.styleEvents.splice(index, 1);
    this.markDirty();
    this.snapshot();
  }

  public updateStyleEvent(uid: number, patch: Partial<Pick<EditorStyleEvent, "time" | "reset">>, commit = false) {
    const event = this.getStyleEvent(uid);
    if (!event) return;
    Object.assign(event, patch);
    if (patch.time !== undefined) this.sortStyleEvents();
    this.markDirty();
    if (commit) this.snapshot();
    else this.scheduleSnapshot();
  }

  public setStyleEventOption(uid: number, key: keyof SubtitleParser.SubtitleOptions, value: string) {
    const event = this.getStyleEvent(uid);
    if (!event) return;
    if (value) event.options[key] = value;
    else delete event.options[key];
    this.markDirty();
    this.scheduleSnapshot();
  }

  public setGlobalOption(key: keyof SubtitleParser.SubtitleOptions, value: string) {
    if (value) this.globalOptions[key] = value;
    else delete this.globalOptions[key];
    this.markDirty();
    this.scheduleSnapshot();
  }

  public setFormat(format: SubtitleFormat) {
    if (this.format === format) return;
    this.format = format;
    this.fileName = this.fileName.replace(/\.[^.]+$/, "") + format;
    this.dirty = true;
    this.schedulePreview();
    this.notify();
  }

  public setStartToPlayhead(uid: number) {
    const cue = this.getCue(uid);
    if (!cue) return;
    const start = this.playheadMs();
    const end = cue.end > start ? cue.end : start + DEFAULT_CUE_DURATION;
    this.updateCue(uid, { start, end }, true);
  }

  public setEndToPlayhead(uid: number) {
    const cue = this.getCue(uid);
    if (!cue) return;
    const end = Math.max(this.playheadMs(), cue.start + MIN_CUE_DURATION);
    this.updateCue(uid, { end }, true);
  }

  public seekToCue(uid: number) {
    const cue = this.getCue(uid);
    if (!cue) return;
    Toxen.musicPlayer?.setPosition(cue.start / 1000);
  }

  private sortCues() {
    this.cues.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  private sortStyleEvents() {
    this.styleEvents.sort((a, b) => a.time - b.time);
  }

  private markDirty() {
    this.dirty = true;
    this.schedulePreview();
    this.notify();
  }

  private serialize() {
    return JSON.stringify({ cues: this.cues, styleEvents: this.styleEvents, globalOptions: this.globalOptions });
  }

  public snapshot() {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    const snap = this.serialize();
    if (this.undoStack[this.undoStack.length - 1] === snap) return;
    this.undoStack.push(snap);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.notify();
  }

  private scheduleSnapshot() {
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      this.snapshot();
    }, 500);
  }

  private restore(snap: string) {
    const data = JSON.parse(snap) as {
      cues: EditorCue[],
      styleEvents: EditorStyleEvent[],
      globalOptions: Partial<SubtitleParser.SubtitleOptions>,
    };
    this.cues = data.cues;
    this.styleEvents = data.styleEvents ?? [];
    this.globalOptions = data.globalOptions;
    this.nextUid = [...this.cues, ...this.styleEvents].reduce((max, c) => Math.max(max, c.uid), 0) + 1;
    this.selectedUids = this.selectedUids.filter(uid => !!this.getCue(uid));
    this.dirty = snap !== this.savedSnapshot;
    this.schedulePreview();
    this.notify();
  }

  public canUndo() {
    return this.undoStack.length > 1;
  }

  public canRedo() {
    return this.redoStack.length > 0;
  }

  public undo() {
    this.snapshot();
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(this.undoStack.pop());
    this.restore(this.undoStack[this.undoStack.length - 1]);
  }

  public redo() {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.restore(next);
  }

  public hasAnyOptions() {
    return Object.keys(this.globalOptions).length > 0
      || this.styleEvents.length > 0
      || this.cues.some(c => Object.keys(c.options).length > 0);
  }

  public needsLossyWarning() {
    return this.format !== ".tst" && this.hasAnyOptions();
  }

  public toSubtitleArray() {
    const arr = new SubtitleParser.SubtitleArray();
    arr.type = this.format.slice(1);
    arr.options = { ...this.globalOptions };
    arr.styleEvents = [...this.styleEvents]
      .sort((a, b) => a.time - b.time)
      .map(event => ({ time: new Time(event.time), options: { ...event.options }, reset: event.reset }));
    arr.song = this.song;
    this.cues.forEach((cue, i) => {
      arr.push({
        id: i + 1,
        start: new Time(cue.start),
        end: new Time(cue.end),
        text: cue.text.split("\n").join("<br />"),
        options: { ...cue.options },
      });
    });
    return arr;
  }

  public applyPreview() {
    if (!this.started) return;
    Toxen.subtitles?.setSubtitles(this.toSubtitleArray());
  }

  private schedulePreview() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      this.applyPreview();
    }, 150);
  }

  public async save() {
    if (!this.song) return false;
    try {
      const content = SubtitleParser.exportByExtension(this.toSubtitleArray(), this.format);
      const previousFile = this.song.paths.subtitles;
      await this.song.writeSubtitleFile(content, this.fileName);
      if (previousFile && previousFile !== this.fileName) {
        Toxen.log(`Subtitles saved as ${this.fileName}. The old file ${previousFile} was kept.`, 5000);
      }
      else {
        Toxen.log("Subtitles saved.", 2000);
      }
      await this.song.applySubtitles();
      this.savedSnapshot = this.serialize();
      this.dirty = false;
      this.notify();
      return true;
    } catch (error) {
      Toxen.error(`Failed to save subtitles: ${error}`);
      return false;
    }
  }
}
