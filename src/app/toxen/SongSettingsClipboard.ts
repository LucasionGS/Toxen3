import { Toxen } from "../ToxenApp";
import { visualizerStyleOptionsMap } from "./Settings";
import type Song from "./Song";
import type { ISong, ISongPaths } from "./Song";

/**
 * Copy and paste a song's visual/audio settings (not its metadata) through the system clipboard.
 */
export class SongSettingsClipboard {
  private constructor() { }

  /**
   * The marker key embedded in clipboard JSON so we can confirm the data was
   * produced by Toxen and not pasted from arbitrary content.
   */
  private static readonly COPY_MARKER = "__toxenSettingsCopy";

  /**
   * Keys that are explicitly excluded when copying settings.
   * Metadata, identity, sync data and non-background media paths are excluded.
   */
  private static readonly EXCLUDED_KEYS: (keyof ISong)[] = [
    "uid", "artist", "title", "coArtists", "album", "genre",
    "source", "tags", "year", "language",
    "duration", "hash", "playlistSettings", "provider",
  ];

  /**
   * Build a plain settings object from an ISong (or a partial of it) ready to
   * be placed on the clipboard.  `paths` is stripped down to `background` only.
   */
  private static buildPayload(
    data: Partial<ISong>,
    sourceUid: string,
    type: "settings" | "playlistSettings",
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      [SongSettingsClipboard.COPY_MARKER]: true,
      __type: type,
      __sourceUid: sourceUid,
    };

    for (const key of Object.keys(data) as (keyof ISong)[]) {
      if ((SongSettingsClipboard.EXCLUDED_KEYS as string[]).includes(key)) continue;
      if (key === "paths") {
        // Only carry the background filename — not dirname/media/subtitles/storyboard
        const paths = data.paths as ISongPaths | undefined;
        payload["paths"] = paths?.background ? { background: paths.background } : null;
      }
      else {
        payload[key] = data[key];
      }
    }

    return payload;
  }

  /**
   * Copy an image file from one song's folder to another's, through each song's storage (the write records the change).
   * Returns the filename on success, or null if there is nothing to copy or the copy failed.
   */
  private static async copyImageFile(
    sourceSong: Song,
    filename: string,
    targetSong: Song,
  ): Promise<string | null> {
    if (!filename) return null;
    if (sourceSong.uid === targetSong.uid) return filename; // same song, nothing to do

    try {
      const blob = await sourceSong.storage.readBlob(sourceSong, filename);
      if (!blob) return null;
      await targetSong.storage.writeFile(targetSong, filename, blob);
      return filename;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Read the clipboard and parse it as copied Toxen settings of the given type.
   * Notifies the user and returns `null` if the clipboard doesn't hold that.
   */
  private static async readPayload(type: "settings" | "playlistSettings"): Promise<Record<string, unknown> | null> {
    let raw: string;
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      Toxen.error("Could not read clipboard.", 3000);
      return null;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw);
    } catch {
      Toxen.error("Clipboard does not contain valid settings data.", 3000);
      return null;
    }

    if (!payload || payload[SongSettingsClipboard.COPY_MARKER] !== true || payload.__type !== type) {
      Toxen.error(type === "settings" ? "Clipboard does not contain copied song settings." : "Clipboard does not contain copied playlist settings.", 3000);
      return null;
    }

    return payload;
  }

  /**
   * Copy a song's visual/audio settings (NOT metadata) to the clipboard.
   */
  public static async copySettingsToClipboard(song: Song): Promise<void> {
    const payload = SongSettingsClipboard.buildPayload(song.toISong(), song.uid, "settings");
    await navigator.clipboard.writeText(JSON.stringify(payload));
    Toxen.log("Settings copied.", 2000);
  }

  /**
   * Copy the playlist-specific settings for a given playlist id to the clipboard.
   * Shows a message if the song has no playlist settings for that playlist.
   */
  public static async copyPlaylistSettingsToClipboard(song: Song, playlistId: string): Promise<void> {
    const ps = song.getPlaylistSettings(playlistId);
    if (!ps) {
      Toxen.log("No playlist-specific settings to copy.", 2000);
      return;
    }
    const payload = SongSettingsClipboard.buildPayload(ps as Partial<ISong>, song.uid, "playlistSettings");
    await navigator.clipboard.writeText(JSON.stringify(payload));
    Toxen.log("Playlist settings copied.", 2000);
  }

  /**
   * Read the clipboard and apply the copied settings to each target song.
   * Shows a user-facing error if the clipboard doesn't contain valid Toxen settings.
   */
  public static async pasteSettingsFromClipboard(targets: Song[]): Promise<void> {
    const payload = await SongSettingsClipboard.readPayload("settings");
    if (!payload) return;

    const sourceUid = payload.__sourceUid as string | undefined;
    await SongSettingsClipboard.applyPayload(payload, sourceUid, targets, false, null);
    Toxen.log(`Settings pasted to ${targets.length} song${targets.length > 1 ? "s" : ""}.`, 2500);
  }

  /**
   * Read the clipboard and apply the copied playlist settings to each target song
   * for the given playlist.
   */
  public static async pastePlaylistSettingsFromClipboard(targets: Song[], playlistId: string): Promise<void> {
    const payload = await SongSettingsClipboard.readPayload("playlistSettings");
    if (!payload) return;

    const sourceUid = payload.__sourceUid as string | undefined;
    await SongSettingsClipboard.applyPayload(payload, sourceUid, targets, true, playlistId);
    Toxen.log(`Playlist settings pasted to ${targets.length} song${targets.length > 1 ? "s" : ""}.`, 2500);
  }

  /**
   * Apply a validated settings payload to target songs.
   */
  private static async applyPayload(
    payload: Record<string, unknown>,
    sourceUid: string | undefined,
    targets: Song[],
    playlistMode: boolean,
    playlistId: string | null,
  ): Promise<void> {
    // Extract just the settings keys (skip our internal marker fields)
    const SKIP = new Set([SongSettingsClipboard.COPY_MARKER, "__type", "__sourceUid"]);
    const sourceSong = sourceUid ? (Toxen.songList?.find(s => s.uid === sourceUid) ?? null) : null;

    for (const target of targets) {
      // Build settings object stripped of control keys
      const settings: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (SKIP.has(k)) continue;
        settings[k] = v;
      }

      // Copy image files
      if (sourceSong && sourceSong.uid !== target.uid) {
        // Background image
        const pathsPayload = payload["paths"] as { background?: string } | null;
        const bgFile = pathsPayload?.background;
        if (bgFile) {
          const copied = await SongSettingsClipboard.copyImageFile(sourceSong, bgFile, target);
          if (!copied && settings["paths"]) {
            // Clear the background reference if the file copy failed
            (settings["paths"] as { background?: string }).background = null;
          }
        }

        // visualizerStyleOptions is Record<VisualizerStyle, Record<optionKey, value>>
        // Iterate every style's sub-object and copy any option that has type="songImage"
        const vso = payload["visualizerStyleOptions"] as Record<string, Record<string, unknown>> | null;
        if (vso) {
          const settingsVso = (settings["visualizerStyleOptions"] ?? {}) as Record<string, Record<string, unknown>>;
          for (const styleKey of Object.keys(vso)) {
            const styleOpts = vso[styleKey];
            if (!styleOpts || typeof styleOpts !== "object") continue;
            const optionDefs = visualizerStyleOptionsMap[styleKey];
            if (!optionDefs) continue;
            for (const optKey of Object.keys(styleOpts)) {
              if (optionDefs[optKey]?.type !== "songImage") continue;
              const imgFile = styleOpts[optKey] as string | undefined;
              if (!imgFile) continue;
              const copied = await SongSettingsClipboard.copyImageFile(sourceSong, imgFile, target);
              if (!copied) {
                // File copy failed — clear the reference to avoid broken paths
                if (settingsVso[styleKey]) {
                  settingsVso[styleKey][optKey] = null;
                }
              }
            }
          }
          settings["visualizerStyleOptions"] = settingsVso;
        }
      }

      if (playlistMode && playlistId) {
        // Merge with existing playlist settings, full replace for each key
        const existing = target.getPlaylistSettings(playlistId) ?? {};
        target.setPlaylistSettings(playlistId, { ...existing, ...settings } as Parameters<Song["setPlaylistSettings"]>[1]);
      }
      else {
        // Apply to song directly
        for (const [k, v] of Object.entries(settings)) {
          if (k === "paths") {
            // Merge only the background sub-field
            if (!target.paths) target.paths = {} as ISongPaths;
            const incomingPaths = v as { background?: string } | null;
            if (incomingPaths?.background !== undefined) {
              target.paths.background = incomingPaths.background;
            }
          }
          else {
            (target as unknown as Record<string, unknown>)[k] = v;
          }
        }
      }

      await target.saveInfo();
    }
  }
}

export default SongSettingsClipboard;
