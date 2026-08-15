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
  public globalOptions: Partial<SubtitleParser.SubtitleOptions> = {};
  public format: SubtitleFormat = ".tst";
  public fileName = "subtitles.tst";
  public selectedUid: number = null;
  public dirty = false;
  public timelineVisible = true;
  public followPlayback = true;

  private nextUid = 1;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private savedSnapshot = "";
  private previewTimer: ReturnType<typeof setTimeout> = null;
  private snapshotTimer: ReturnType<typeof setTimeout> = null;

  public static isMobile() {
    return !toxenapi.isDesktop() && window.innerWidth <= 768;
  }

  public async start(song: Song) {
    this.song = song;
    this.cues = [];
    this.globalOptions = {};
    this.format = ".tst";
    this.fileName = "subtitles.tst";
    this.selectedUid = null;
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

  public selectCue(uid: number | null) {
    if (this.selectedUid === uid) return;
    this.selectedUid = uid;
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
    this.selectedUid = cue.uid;
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
    if (this.selectedUid === uid) this.selectedUid = null;
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

  public setCueOption(uid: number, key: keyof SubtitleParser.SubtitleOptions, value: string) {
    const cue = this.getCue(uid);
    if (!cue) return;
    if (value) cue.options[key] = value;
    else delete cue.options[key];
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

  private markDirty() {
    this.dirty = true;
    this.schedulePreview();
    this.notify();
  }

  private serialize() {
    return JSON.stringify({ cues: this.cues, globalOptions: this.globalOptions });
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
    const data = JSON.parse(snap) as { cues: EditorCue[], globalOptions: Partial<SubtitleParser.SubtitleOptions> };
    this.cues = data.cues;
    this.globalOptions = data.globalOptions;
    this.nextUid = this.cues.reduce((max, c) => Math.max(max, c.uid), 0) + 1;
    if (this.selectedUid !== null && !this.getCue(this.selectedUid)) this.selectedUid = null;
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
    return Object.keys(this.globalOptions).length > 0 || this.cues.some(c => Object.keys(c.options).length > 0);
  }

  public needsLossyWarning() {
    return this.format !== ".tst" && this.hasAnyOptions();
  }

  public toSubtitleArray() {
    const arr = new SubtitleParser.SubtitleArray();
    arr.type = this.format.slice(1);
    arr.options = { ...this.globalOptions };
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
