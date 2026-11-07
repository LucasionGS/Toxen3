import type Song from "./Song";
import type Playlist from "./Playlist";
import Settings, { VisualizerStyle, visualizerStyleOptionsMap } from "./Settings";
import type { ISettings } from "./Settings";
import ExtensionManager from "./extensions/ExtensionManager";
import { DEFAULT_RAINFALL_COLOR } from "../components/Background/visualizers/particles/Rainfall";

/**
 * One settings resolver for everything that can be overridden per storyboard, playlist, song and globally (plan §5).
 * Replaces the 25 hand-written `Storyboard.get*` getters, `Song.getEffectiveSettings` lookups in render code and the
 * three background-precedence implementations.
 *
 * Order: storyboard -> playlist -> song -> global -> default. A level "has a value" when it is not `null` and not
 * `undefined` (`??` semantics, never `||`), so an explicit `false` or `0` on a song beats a global `true`, and a value
 * equal to the default is still a value.
 *
 * Extension point: add a key to `SettingsResolver.Values` and its entry to `DEFINITIONS`.
 * Extensions' visualizer options go through `resolveVisualizerOption`.
 */
export class SettingsResolver {
  private constructor() { }

  private static _env: SettingsResolver.Environment = {};

  /**
   * Hand the resolver the app state it must not import itself (current song, playlist, storyboard overrides and the
   * theme-based default colour). Called once by the wiring layer; until then only the global and default levels apply.
   */
  public static configure(env: SettingsResolver.Environment): void {
    SettingsResolver._env = env;
  }

  /**
   * Fallback visualizer colour when nothing sets one: the configured theme colour, else white.
   */
  public static getDefaultColor(): string {
    return SettingsResolver._env.defaultColor?.() ?? "#ffffff";
  }

  /**
   * Resolve one key for the given context. Default context is the current song, `Toxen.playlist` and the active storyboard.
   */
  public static resolve<K extends SettingsResolver.Key>(key: K, ctx?: SettingsResolver.Context): SettingsResolver.Values[K] {
    return SettingsResolver.explain(key, ctx).value;
  }

  /**
   * Like `resolve`, also saying which level the value came from (settings UI "inherited from…" hints, debugging).
   */
  public static explain<K extends SettingsResolver.Key>(key: K, ctx?: SettingsResolver.Context): SettingsResolver.Resolved<K> {
    const def = SettingsResolver.DEFINITIONS[key] as SettingsResolver.Definition<SettingsResolver.Values[K]> | undefined;
    if (!def) throw new Error(`Unknown setting "${key}". Add it to SettingsResolver.DEFINITIONS.`);

    const { storyboard, song, overrides } = SettingsResolver._levels(ctx);
    const candidates: [SettingsResolver.Level, unknown][] = [
      [SettingsResolver.Level.Storyboard, def.storyboard && storyboard ? storyboard[def.storyboard] : undefined],
      [SettingsResolver.Level.Playlist, def.song && overrides ? SettingsResolver._read(overrides, def.song) : undefined],
      [SettingsResolver.Level.Song, def.song && song ? SettingsResolver._read(song, def.song) : undefined],
      [SettingsResolver.Level.Global, def.global ? Settings.get(def.global as keyof ISettings) : undefined],
    ];

    for (const [level, raw] of candidates) {
      const value = def.coerce ? def.coerce(raw, level) : (raw as SettingsResolver.Values[K] | null | undefined);
      if (value !== null && value !== undefined) return { value, level };
    }

    return {
      value: typeof def.default === "function" ? (def.default as () => SettingsResolver.Values[K])() : def.default,
      level: SettingsResolver.Level.Default,
    };
  }

  /**
   * Resolve every key once, for a whole frame (Visualizer render loop). Reuse the returned object between frames
   * when the context hasn't changed (plan P10).
   */
  public static snapshot(ctx?: SettingsResolver.Context): Readonly<SettingsResolver.Values> {
    const values: Record<string, unknown> = {};
    for (const key of Object.keys(SettingsResolver.DEFINITIONS) as SettingsResolver.Key[]) {
      values[key] = SettingsResolver.resolve(key, ctx);
    }
    return values as unknown as SettingsResolver.Values;
  }

  /**
   * The background to show, as one result. Order: storyboard -> the song's settings for this playlist -> the playlist's
   * own background (when it applies one) -> the song's own background -> none.
   * `url` is the full path or URL exactly once and never carries the auth token, so callers add it with `User.appendAuth`.
   * `value` is the song-relative file name for song folder sources and the playlist background's URL otherwise;
   * it is stable between frames, so it can be used to detect changes.
   */
  public static resolveBackground(ctx?: SettingsResolver.Context): SettingsResolver.BackgroundResult {
    const resolved = SettingsResolver.explain("background", ctx);
    const { song, playlist } = SettingsResolver._levels(ctx);

    let level = resolved.level;
    if (level !== SettingsResolver.Level.Storyboard && level !== SettingsResolver.Level.Playlist && playlist) {
      // Without auth: the caller appends it once (getBackgroundPath would add it here as well).
      const playlistUrl = playlist.getBackgroundLocation();
      if (playlistUrl) return { value: playlistUrl, url: playlistUrl, level: SettingsResolver.Level.Playlist };
    }

    if (!resolved.value) return { value: null, url: null, level };
    return { value: resolved.value, url: song ? song.dirname(resolved.value) ?? null : null, level };
  }

  /**
   * A visualizer style option: playlist -> song -> global -> built-in or extension default
   * (`visualizerStyleOptionsMap`, `ExtensionManager.getVisualizerOptions`).
   */
  public static resolveVisualizerOption(style: VisualizerStyle | string, key: string, ctx?: SettingsResolver.Context): unknown {
    return SettingsResolver.explainVisualizerOption(style, key, ctx).value;
  }

  /**
   * Like `resolveVisualizerOption`, also saying which level the value came from. `Level.Default` means nothing was
   * set explicitly and `value` is the option's declared default (`undefined` when it declares none).
   */
  public static explainVisualizerOption(style: VisualizerStyle | string, key: string, ctx?: SettingsResolver.Context): SettingsResolver.ResolvedValue {
    const { song, overrides } = SettingsResolver._levels(ctx);
    const candidates: [SettingsResolver.Level, unknown][] = [
      [SettingsResolver.Level.Playlist, overrides?.visualizerStyleOptions?.[style]?.[key]],
      [SettingsResolver.Level.Song, song?.visualizerStyleOptions?.[style]?.[key]],
      [SettingsResolver.Level.Global, Settings.get("visualizerStyleOptions", {})?.[style]?.[key]],
    ];

    for (const [level, value] of candidates) {
      if (value !== null && value !== undefined) return { value, level };
    }

    const builtIn = visualizerStyleOptionsMap?.[style]?.[key];
    const defaultValue = builtIn
      ? builtIn.defaultValue
      : ExtensionManager.getVisualizerOptions(style)?.find(o => o.key === key)?.defaultValue;
    return { value: defaultValue, level: SettingsResolver.Level.Default };
  }

  /**
   * The key of `song.playlistSettings` for a playlist. Playlist settings are still stored under the playlist name
   * (`Song.getEffectiveSettings`, EditSong), so this returns the name until the one-time migration of name keys to
   * ids (plan §5) lands; then it returns `playlist.id`. The only place that knows this.
   */
  public static playlistKey(playlist: Playlist): string {
    return playlist.name;
  }

  //#region Internals
  private static _levels(ctx?: SettingsResolver.Context) {
    const base = SettingsResolver._env.context?.() ?? {};
    // Omitted members come from the app state, `null` skips the level.
    const song = (ctx?.song !== undefined ? ctx.song : base.song) ?? null;
    const playlist = (ctx?.playlist !== undefined ? ctx.playlist : base.playlist) ?? null;
    const storyboard = (ctx?.storyboard !== undefined ? ctx.storyboard : base.storyboard) ?? null;
    const overrides = song && playlist ? song.getPlaylistSettings(SettingsResolver.playlistKey(playlist)) ?? null : null;
    return { song, playlist, storyboard, overrides };
  }

  private static _read(source: object, path: string): unknown {
    let value: any = source;
    for (const part of path.split(".")) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }
    return value;
  }
  //#endregion
}

export namespace SettingsResolver {
  export enum Level {
    Storyboard = "storyboard",
    Playlist = "playlist",
    Song = "song",
    Global = "global",
    Default = "default",
  }

  /**
   * Resolved types of every key. Names follow the global setting where the song field differs
   * (`visualizerRainbowMode` <- song `visualizerForceRainbowMode`).
   */
  export interface Values {
    visualizerColor: string;
    visualizerRainbowMode: boolean;
    visualizerStyle: VisualizerStyle | string;
    visualizerIntensity: number;
    visualizerShuffle: boolean;
    visualizerNormalize: boolean;
    /**
     * Song stores `"pulse" | "pulse-off" | null`, coerced to a boolean.
     */
    visualizerPulseBackground: boolean;
    visualizerGlow: boolean;
    backgroundDim: number;
    backgroundDynamicLighting: boolean;
    /**
     * Background file relative to the song folder. Playlist level: song's playlist settings `paths.background`, then
     * the playlist's own background.
     */
    background: string | null;
    floatingTitle: boolean;
    floatingTitleText: string;
    floatingTitleUnderline: boolean;
    floatingTitleReactive: boolean;
    floatingTitleOverrideVisualizer: boolean;
    floatingTitlePosition: string;
    floatingTitleOutlineColor: string;
    useFloatingTitleSubtitles: boolean;
    starRushEffect: boolean;
    starRushIntensity: number;
    rainfallEffect: boolean;
    rainfallFrequency: number;
    rainfallSpeed: number;
    /**
     * Song level is relative to the song folder, global level is an absolute path.
     */
    rainfallImage: string | null;
    rainfallImageScale: number;
    rainfallColor: string;
    autogeneratedTheme: boolean;
  }

  export type Key = keyof Values;

  /**
   * Inputs for a resolution. Omitted members default to the current app state; pass `null` to skip a level.
   */
  export interface Context {
    song?: Song | null;
    playlist?: Playlist | null;
    /**
     * The active storyboard's overrides (`Storyboard.data`).
     */
    storyboard?: Readonly<Record<string, unknown>> | null;
  }

  export interface Resolved<K extends Key> {
    value: Values[K];
    level: Level;
  }

  export interface ResolvedValue {
    value: unknown;
    level: Level;
  }

  export interface BackgroundResult {
    /**
     * Identifies the background (song-relative file name, or the playlist background's URL). `null` = no background.
     */
    value: string | null;
    /**
     * Full path or URL without the auth token. `null` = no background, or the song folder is unknown.
     */
    url: string | null;
    level: Level;
  }

  /**
   * App state the resolver can't import. Set once with `SettingsResolver.configure`.
   */
  export interface Environment {
    /**
     * The current song, playlist and storyboard overrides. Called on every resolution, so keep it cheap.
     */
    context?: () => Context;
    /**
     * Fallback visualizer colour (derived from the active theme).
     */
    defaultColor?: () => string;
  }

  /**
   * How one key is read at each level. Omitted levels don't override this key.
   */
  export interface Definition<T> {
    /**
     * Key in the storyboard overrides.
     */
    storyboard?: string;
    /**
     * Field of `ISong` (also used inside `playlistSettings`).
     */
    song?: string;
    /**
     * Key of `ISettings`.
     */
    global?: string;
    default: T | (() => T);
    /**
     * Convert a stored value to the resolved type (e.g. `"pulse-off"` -> `false`). Return `null` for "inherit".
     */
    coerce?: (raw: unknown, level: Level) => T | null;
  }

  const truthy = <T>(raw: unknown) => (raw ? raw as T : null);
  const isNumber = (raw: unknown) => typeof raw === "number" ? raw : null;

  /**
   * The key table. Every key is read with `??` semantics: `null` and `undefined` inherit, `false`, `0` and values
   * equal to the default are real values. Keys with `coerce: truthy` additionally treat an empty string as unset.
   */
  export const DEFINITIONS: { [K in Key]?: Definition<Values[K]> } = {
    visualizerColor: {
      storyboard: "visualizerColor",
      song: "visualizerColor",
      global: "visualizerColor",
      default: () => SettingsResolver.getDefaultColor(),
      coerce: truthy,
    },
    visualizerRainbowMode: {
      storyboard: "visualizerForceRainbowMode",
      song: "visualizerForceRainbowMode",
      global: "visualizerRainbowMode",
      default: false,
      // The song and playlist checkbox can only force rainbow on: unchecked (`false`) means "follow the global setting".
      // A storyboard can still switch it off.
      coerce: (raw, level) => level === Level.Song || level === Level.Playlist
        ? (raw === true ? true : null)
        : (raw as boolean | null | undefined) ?? null,
    },
    visualizerStyle: {
      storyboard: "visualizerStyle",
      song: "visualizerStyle",
      global: "visualizerStyle",
      default: VisualizerStyle.ProgressBar,
      coerce: truthy,
    },
    visualizerIntensity: {
      storyboard: "visualizerIntensity",
      song: "visualizerIntensity",
      global: "visualizerIntensity",
      default: 1,
    },
    visualizerShuffle: {
      storyboard: "visualizerShuffle",
      song: "visualizerShuffle",
      global: "visualizerShuffle",
      default: false,
    },
    visualizerNormalize: {
      storyboard: "visualizerNormalize",
      song: "visualizerNormalize",
      global: "visualizerNormalize",
      default: false,
    },
    visualizerPulseBackground: {
      storyboard: "visualizerPulseBackground",
      song: "visualizerPulseBackground",
      global: "visualizerPulseBackground",
      default: false,
      // Song and playlist store "pulse" | "pulse-off", the storyboard and global setting store a boolean.
      coerce: raw => raw === "pulse" ? true : raw === "pulse-off" ? false : typeof raw === "boolean" ? raw : null,
    },
    visualizerGlow: {
      storyboard: "visualizerGlow",
      song: "visualizerGlow",
      global: "visualizerGlow",
      default: false,
    },
    backgroundDim: {
      storyboard: "backgroundDim",
      song: "backgroundDim",
      global: "backgroundDim",
      default: 0,
      coerce: isNumber,
    },
    backgroundDynamicLighting: {
      storyboard: "backgroundDynamicLighting",
      global: "backgroundDynamicLighting",
      default: false,
    },
    background: {
      storyboard: "background",
      song: "paths.background",
      default: null,
      coerce: truthy,
    },
    floatingTitle: {
      storyboard: "floatingTitle",
      song: "floatingTitle",
      default: false,
    },
    floatingTitleText: {
      storyboard: "floatingTitleText",
      song: "floatingTitleText",
      default: "",
      // A storyboard may blank the text on purpose, the song levels treat "" as unset.
      coerce: (raw, level) => level === Level.Storyboard ? (typeof raw === "string" ? raw : null) : truthy<string>(raw),
    },
    floatingTitleUnderline: {
      storyboard: "floatingTitleUnderline",
      song: "floatingTitleUnderline",
      default: false,
    },
    floatingTitleReactive: {
      storyboard: "floatingTitleReactive",
      song: "floatingTitleReactive",
      default: false,
    },
    floatingTitleOverrideVisualizer: {
      storyboard: "floatingTitleOverrideVisualizer",
      song: "floatingTitleOverrideVisualizer",
      default: false,
    },
    floatingTitlePosition: {
      storyboard: "floatingTitlePosition",
      song: "floatingTitlePosition",
      default: "center",
      coerce: truthy,
    },
    floatingTitleOutlineColor: {
      storyboard: "floatingTitleOutlineColor",
      song: "floatingTitleOutlineColor",
      default: "white",
      coerce: truthy,
    },
    useFloatingTitleSubtitles: {
      storyboard: "useFloatingTitleSubtitles",
      song: "useFloatingTitleSubtitles",
      default: false,
    },
    starRushEffect: {
      storyboard: "starRushEffect",
      song: "starRushEffect",
      global: "starRushEffect",
      default: false,
    },
    starRushIntensity: {
      storyboard: "starRushIntensity",
      song: "starRushIntensity",
      global: "starRushIntensity",
      default: 1,
    },
    rainfallEffect: {
      storyboard: "rainfallEffect",
      song: "rainfallEffect",
      global: "rainfallEffect",
      default: false,
    },
    rainfallFrequency: {
      storyboard: "rainfallFrequency",
      song: "rainfallFrequency",
      global: "rainfallFrequency",
      default: 1,
    },
    rainfallSpeed: {
      storyboard: "rainfallSpeed",
      song: "rainfallSpeed",
      global: "rainfallSpeed",
      default: 1,
    },
    rainfallImage: {
      storyboard: "rainfallImage",
      song: "rainfallImage",
      global: "rainfallImage",
      default: null,
      coerce: truthy,
    },
    rainfallImageScale: {
      storyboard: "rainfallImageScale",
      song: "rainfallImageScale",
      global: "rainfallImageScale",
      default: 1,
    },
    rainfallColor: {
      storyboard: "rainfallColor",
      song: "rainfallColor",
      global: "rainfallColor",
      default: DEFAULT_RAINFALL_COLOR,
      coerce: truthy,
    },
    autogeneratedTheme: {
      song: "autogeneratedTheme",
      global: "autogeneratedTheme",
      default: false,
    },
  };
}

export default SettingsResolver;
