import { hexToRgb, hexToRgbArray, rgbArrayToHex, rgbToHex } from "../components/Form/FormInputFields/FormInputColorPicker";
import { Toxen } from "../ToxenApp";
import Settings, { VisualizerStyle } from "./Settings";
import Time from "./Time";
import yaml from "js-yaml";
// import fsp from "fs/promises";
import User from "./User";
// import HueManager from "./philipshue/HueManager";
import MathX from "./MathX";
import Song from "./Song";

namespace StoryboardParser {
  export const version = 1;

  interface Action {
    [key: string]: any;
  }

  interface Component<Arguments extends ComponentArgument[]> {
    /**
     * Display name for the component.
     */
    name: string;
    arguments: Arguments;
    /**
     * This function will be executed BEFORE the background dim is applied.
     * 
     * To draw after the background dim, return another function from this function.
     * All actions in the returned function will be executed after the background dim.
     */
    action(
      args: { [Property in Arguments[number]as Property["identifier"]]: ComponentArgumentTypes[Property["type"]] },
      info: EventInfo,
      stateManager: StateManager,
      ctx: CanvasRenderingContext2D,
    ): void | (() => void);
  }

  export interface ComponentArgument {
    /**
     * Name display above the argument. Helps to describe what the argument is for.
     */
    name: string;
    /**
     * Identifies the argument when used in the action function.
     */
    identifier: string;
    /**
     * Type of the argument. Determinds how the argument is parsed and the type of input shown to the user.
     */
    type: keyof ComponentArgumentTypes;

    /**
     * Selectable options for the argument.
     * 
     * @for Select
     */
    selectData?: [string, string?][];

    /**
     * Placeholder text for the argument.
     */
    placeholder?: string;

    /**
     * Is this argument required?
     */
    required?: boolean;

    /**
     * Description of the argument.
     */
    description?: string;
  }

  export interface ComponentArgumentTypes {
    String: string;
    Number: number;
    Color: [number, number, number, number?];
    VisualizerStyle: VisualizerStyle;
    Boolean: boolean;
    Select: string;
    SelectImage: string;
  }

  /**
   * An object that contains all storyboard components that can be executed.
   */
  export const components: { [componentName: string]: Component<ComponentArgument[]> } = {};

  /**
   * Adds a component to be usable in the storyboard.
   * @param name Name of the component.
   * @param component The component object.
   */
  function addStoryboardComponent<Arguments extends ComponentArgument[]>(name: string, component: Component<Arguments>) {
    components[name] = component;
  }

  function getAsType<T extends keyof ComponentArgumentTypes>(value: any) { return value as ComponentArgumentTypes[T]; }

  export class SBEvent {
    constructor(
      // Time is in seconds. Can be decimal.
      public startTime: number,
      public endTime: number,
      public component: string,
      public data: { [key: string]: ComponentArgumentTypes[keyof ComponentArgumentTypes] },
      once: boolean = false) {
      this.once = once;
    }

    private state: any = null;
    public setState = (state: any) => { this.state = state; }
    public getState = <T = any>(): T => { return this.state; }

    /**
     * Used by React to determine if the event should be re-rendered in a list when editing.
     */
    public _key: string = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    /**
     * Whether the event should be executed once instead of every frame during it's duration.
     */
    public once = false;
    /**
     * Whether the event has been executed. Used for `once` events.
     */
    public done = false;

    public static fromConfig(config: SBEventConfig, variables?: { [key: string]: any }, debugIndex?: number, validateFields: boolean = true) {
      const throwError = (message: string) => {
        throw new Error(`${typeof debugIndex === "number" ? `Object Index #${debugIndex}: ` : ""}${message}`);
      }

      if (!config) throwError("Event config is undefined.");

      // Validate the component
      if (validateFields && !config.component) throwError(`Property "component" must be defined.`);
      if (validateFields && !components[config.component]) throwError(`Component "${config.component}" does not exist.`);

      // Validate the arguments
      const component = components[config.component];
      const args = config.data;

      // Parse the variables
      if (variables) {
        // Parse for properties
        for (const key in config) {
          type Key = keyof typeof config;
          const value = config[key as Key];
          if (typeof value === "string") {
            if (value.startsWith("$")) {
              const variableName = value.slice(1);
              if (variables[variableName] === undefined) throwError(`Variable "${variableName}" does not exist.`);
              (config[key as Key] as any) = variables[variableName];
            }
          }
        }

        // Parse for arguments
        if (component) {
          for (const arg of component.arguments) {
            const value = args[arg.identifier];
            if (value === "string") {
              if (value.startsWith("$")) {
                const variableName = value.substring(1);
                if (variables[variableName] === undefined) throwError(`Variable "${variableName}" is not defined.`);
                args[arg.identifier] = variables[variableName];
              }
            }

            // Parse the value
            if (validateFields && arg.required && value === undefined) throwError(`Argument "${arg.identifier}" is missing.`);
            if (arg.type === "Color" && typeof value === "string" && value.startsWith("#")) {
              args[arg.identifier] = hexToRgbArray(value as string); // Convert hex to rgb
            }
          }
        }
      }

      // Validate the timing
      const startTime = typeof config.start === "number" ? config.start : (Time.fromTimestamp(config.start).toMillseconds() / 1000);
      const endTime = typeof config.end === "number" ? config.end : (Time.fromTimestamp(config.end).toMillseconds() / 1000);
      if (validateFields && startTime < 0) throwError(`Property "start" must be defined and cannot be less than 0.`);
      if (validateFields && endTime < 0) throwError(`Property "end" must be defined and cannot be less than 0.`);


      return new SBEvent(startTime, endTime, config.component, config.data, config.once);
    }
  }

  export interface SBEventConfig {
    start: number | string;
    end: number | string;
    component: string;
    data: { [key: string]: ComponentArgumentTypes[keyof ComponentArgumentTypes] };
    once?: boolean;
  }

  export interface PreparseStoryboardConfig {
    bpm: number;
    bpmOffset: number;
    storyboard: SBEventConfig[];
    variables?: { [key: string]: any };
    version?: number;
    author?: string;
  }

  export interface StoryboardConfig {
    bpm: number;
    bpmOffset: number;
    storyboard: SBEvent[];
    version?: number;
    author?: string;
    variables?: { [key: string]: any };
  }

  export async function save(path: string, config: StoryboardConfig, song: Song) {
    const cData = {
      bpm: config.bpm,
      bpmOffset: config.bpmOffset,
      version: config.version,
      author: config.author,
      variables: config.variables,
      storyboard: config.storyboard.map(event => ({
        start: event.startTime,
        end: event.endTime,
        component: event.component,
        data: event.data,
        once: event.once
      }))
    } as PreparseStoryboardConfig;

    const data = yaml.dump(cData);

    let filetime = Date.now();
    const storyboardName = path.slice(song.dirname().length + 1);
    if (Settings.isRemote()) {
      const user = Settings.getUser();
      if (!user) throw new Error("Cannot save storyboard. User is not logged in.");
      console.log("Saving to", path);
      return Toxen.fetch(`${path}`, {
        method: "PUT",
        body: data,
        headers: {
          "Content-Type": "application/json"
        }
      }).then(res => {
        if (!res.ok) throw new Error(`Failed to save storyboard. Status: ${res.status} ${res.statusText}`);
        song.setFile(storyboardName, "u", filetime);
        song.saveInfo();
      });
    }
    else {
      if (toxenapi.isDesktop()) {
        await toxenapi.fs.promises.writeFile(path, data);
        song.setFile(storyboardName, "u", filetime);
        await song.saveInfo();
        return
      }
      else {
        toxenapi.throwDesktopOnly("saveStoryboard");
      }
    }
  }

  let eventIndex = 0;
  // `index` will be reset to 0 when the storyboard is finished.
  // `index` will be set to first event that intersects with the current time, when user skips to a different time.
  // `index` will be incremented by 1 every time a new event is added to `currentEvents`
  // `index` will be checked every frame to see if it needs to be incremented. Check if loadedStoryboard[index].endTime < currentTime
  let loadedStoryboard: StoryboardConfig = {
    bpm: 120,
    bpmOffset: 0,
    storyboard: [],
  };

  export function setStoryboard(config: StoryboardConfig, song?: Song) {
    if (config) {
      loadedStoryboard = config;
    }
    else {
      loadedStoryboard = { // Default storyboard
        bpm: 120,
        bpmOffset: 0,
        storyboard: [],
      };
    }
    if (loadedStoryboard) loadedStoryboard.storyboard.sort((a, b) => a.startTime - b.startTime);
    eventIndex = 0;

    Promise.resolve().then(() => {
      // Async preload all assets
      song ??= Song.getCurrent(); // Assume the song loaded is the current song, if not provided
      const isLoading: Record<string, boolean> = {};
      loadedStoryboard.storyboard.forEach(event => {
        const component = components[event.component];
        if (component) {
          component.arguments.forEach(arg => {
            const value = event.data[arg.identifier];
            if (arg.type === "SelectImage" && typeof value === "string") {
              const src = `${song.dirname(value)}?h=${song.hash}`;
              if (isLoading[src]) return;
              const img = new Image();
              img.src = src;
              isLoading[src] = true;
              img.onload = () => {
                console.log("Preloaded image: " + img.src);
              }
            }
          });
        }
      });
    });
    
    return loadedStoryboard;
  }

  export function parseStoryboard(storyboardYaml: string, validateFields: boolean = true): StoryboardConfig {
    const storyboardConfig = yaml.load(storyboardYaml) as PreparseStoryboardConfig;

    if (!storyboardConfig.storyboard) throw new Error("Storyboard is missing `storyboard` property.");
    if (typeof storyboardConfig.version === "number" && storyboardConfig.version !== version) throw new Error(`Storyboard version is not supported. Expected ${version}, got ${storyboardConfig.version}`);

    try {
      const events = storyboardConfig.storyboard.map((e, i) => SBEvent.fromConfig(e, storyboardConfig.variables, i, validateFields));
      return {
        bpm: storyboardConfig.bpm,
        bpmOffset: storyboardConfig.bpmOffset,
        storyboard: events,
        version: storyboardConfig.version,
        author: storyboardConfig.author,
      }
    } catch (error: any) {
      Toxen.notify({
        title: "Failed to parse storyboard",
        content: error.message ?? error.toString(),
        type: "error",
      });
      console.error(error);
    }
  }

  /**
   * Not implemented used ?
   */
  export function loadStoryboard(storyboard: string) {
    const timeline = parseStoryboard(storyboard);
    setStoryboard(timeline);
  }

  // These events are for debugging and testing purposes.
  // setloadedStoryboard([
  //   new SBEvent(0, 7, "backgroundDim", {
  //     dim: 100
  //   }),
  //   new SBEvent(0, 7, "dynamicLighting", {
  //     state: false
  //   }),
  //   new SBEvent(7, 150, "visualizerColorTransition", {
  //     fromColor: [0, 0, 0],
  //     toColor: [255, 0, 0],
  //     duration: 0.5
  //   }),
  //   new SBEvent(0, 150, "visualizerStyle", {
  //     style: VisualizerStyle.ProgressBar
  //   }),
  //   new SBEvent(0, 7, "visualizerIntensity", {
  //     intensity: 0
  //   }),
  //   new SBEvent(7, 150, "visualizerIntensityTransition", {
  //     fromIntensity: 0,
  //     toIntensity: 1,
  //     duration: 0.1
  //   }),
  //   new SBEvent(7, 140, "pulse", {
  //     color: [255, 255, 255],
  //     intensity: 0.5,
  //     bpm: 180 // Beats per minute
  //   }),
  // ]);

  // `currentEvents` will be iterated over every frame, and the events will be executed.
  // `currentEvents` will be cleared when the storyboard is finished.
  // `currentEvents` will be cleared when the user skips to a different time.
  // `currentEvents` will remove events that are finished (endTime < currentTime)
  const currentEvents: SBEvent[] = [];

  // On each frame
  export const onFrame = (ctx: CanvasRenderingContext2D, info: SongInfo) => {
    let tlEvent = loadedStoryboard.storyboard[eventIndex];
    const { currentSongTime: currentTime } = info;
    if (tlEvent) {
      do {
        if (currentTime > tlEvent.startTime) {
          if (currentTime < tlEvent.endTime) {
            currentEvents.push(tlEvent);
          }
          eventIndex++;
        }
      } while (currentTime > (tlEvent = loadedStoryboard.storyboard[eventIndex])?.startTime);
    }

    tlEvent = null;

    // Execute the current events
    return currentEvents.map(e => {
      // Execute the event
      const eventHandler = components[e.component];
      if (!e.once || (e.once && !e.done)) {
        // If the event is a one-time event, mark it as done
        if (e.once) {
          e.done = true;
        }

        const cb = eventHandler?.action(e.data, {
          ...info,
          eventStartTime: e.startTime,
          eventEndTime: e.endTime,
          bpm: loadedStoryboard.bpm,
        }, {
          getState: e.getState,
          setState: e.setState,
        }, ctx);

        if (e.endTime < currentTime) {
          // Remove the event from the currentEvents array
          currentEvents.splice(currentEvents.indexOf(e), 1);
        }

        return cb;
      }
    });
  };

  // Reset current events -> will be used when the user skips to a different time and song end.
  export const resetCurrentEvents = () => {
    // Reset the index
    eventIndex = 0;
    // Clear the current events
    currentEvents.length = 0;

    // Clean events
    if (loadedStoryboard) {
      loadedStoryboard.storyboard.sort((a, b) => a.startTime - b.startTime);
      loadedStoryboard.storyboard.forEach(tlEvent => {
        tlEvent.setState(null);
        if (tlEvent.once) {
          tlEvent.done = false;
        }
      });
    }
  };

  interface SongInfo {
    currentSongTime: number;
    songDuration: number;

    isPaused: boolean;
  }

  interface EventInfo extends SongInfo {
    eventStartTime: number;
    eventEndTime: number;
    bpm: number;
  }

  interface StateManager {
    /**
     * Sets the state of the component.
     * @param state The state to set.
     */
    setState: (state: any) => void;
    /**
     * Gets the state of the component.
     * 
     * !Warning! - The state will be reset when the user skips to a different time. Use states that are time-dependent for best results.
     * 
     * 
     * !Warning! - This function will return `null` if the state has not been set.
     * @returns The state of the component.
     */
    getState: <T = any>() => T;
  }

  export function drawStoryboard(ctx: CanvasRenderingContext2D, info: SongInfo) {
    // Draw the storyboard
    if (!loadedStoryboard) {
      // No storyboard loaded
      return [];
    }
    return onFrame(ctx, info).filter(e => e) as (() => void)[];
  }


  // Creating components

  addStoryboardComponent("visualizerColor", {
    name: "Visualizer Color",
    arguments: [
      {
        name: "Color",
        identifier: "color",
        type: "Color"
      }
    ],
    action: (args) => {
      let color = getAsType<"Color">(args.color) || [255, 255, 255];
      const hex = rgbArrayToHex(color);

      Toxen.background.storyboard.data.visualizerColor = hex;
    }
  });

  addStoryboardComponent("visualizerColorTransition", {
    name: "Visualizer Color Transition",
    arguments: [
      {
        name: "From Color",
        identifier: "fromColor",
        type: "Color"
      },
      {
        name: "To Color",
        identifier: "toColor",
        type: "Color"
      },
      {
        name: "Duration for transition in seconds",
        identifier: "duration",
        type: "Number"
      },
    ],
    action: (args, { currentSongTime, eventStartTime }, { setState, getState }) => {
      let state = getState<string>();
      if (state) {
        Toxen.background.storyboard.data.visualizerColor = state;
        return;
      }
      const fromColor = getAsType<"Color">(args.fromColor);
      const toColor = getAsType<"Color">(args.toColor);
      let color: [number, number, number, number?] = toColor;
      let duration = getAsType<"Number">(args.duration);
      if (duration > 0) {
        let fadeProgress = (currentSongTime - eventStartTime) / duration;
        if (fadeProgress >= 1) {
          fadeProgress = 1;
          setState(rgbArrayToHex(color));
        }
        if (fadeProgress < 1) {
          color = [
            fromColor[0] + (toColor[0] - fromColor[0]) * fadeProgress,
            fromColor[1] + (toColor[1] - fromColor[1]) * fadeProgress,
            fromColor[2] + (toColor[2] - fromColor[2]) * fadeProgress,
            (fromColor[3] ?? 255) + ((toColor[3] ?? 255) - (fromColor[3] ?? 255)) * fadeProgress,
          ];
        }
      }
      const hex = rgbArrayToHex(color);
      Toxen.background.storyboard.data.visualizerColor = hex;
    }
  });

  addStoryboardComponent("visualizerStyle", {
    name: "Visualizer Style",
    arguments: [
      {
        name: "Style",
        identifier: "style",
        type: "VisualizerStyle",
        required: true
      },
    ],
    action: (args) => {
      let style = getAsType<"VisualizerStyle">(args.style);
      Toxen.background.storyboard.data.visualizerStyle = style;
    }
  });

  addStoryboardComponent("visualizerIntensity", {
    name: "Visualizer Intensity",
    arguments: [
      {
        name: "Intensity",
        identifier: "intensity",
        type: "Number"
      },
    ],
    action: (args) => {
      let intensity = getAsType<"Number">(args.intensity);
      Toxen.background.storyboard.data.visualizerIntensity = intensity;
    }
  });

  addStoryboardComponent("visualizerIntensityTransition", {
    name: "Visualizer Intensity Transition",
    arguments: [
      {
        name: "From Intensity",
        identifier: "fromIntensity",
        type: "Number"
      },
      {
        name: "To Intensity",
        identifier: "toIntensity",
        type: "Number"
      },
      {
        name: "Duration for transition in seconds",
        identifier: "duration",
        type: "Number"
      },
    ],
    action: (args, { currentSongTime, eventStartTime }, { setState, getState }) => {
      let state = getState<number>();
      if (state) {
        Toxen.background.storyboard.data.visualizerIntensity = state;
        return;
      }
      let fromIntensity = getAsType<"Number">(args.fromIntensity);
      fromIntensity = Math.max(0.001, Math.min(2, fromIntensity)); // Clamp to 0.001 - 1, this is to prevent the visualizer from breaking when reaching 0
      let toIntensity = getAsType<"Number">(args.toIntensity);
      toIntensity = Math.max(0.001, Math.min(2, toIntensity));
      let intensity = toIntensity;
      let duration = getAsType<"Number">(args.duration);
      if (duration > 0) {
        let fadeProgress = (currentSongTime - eventStartTime) / duration;
        if (fadeProgress >= 1) {
          fadeProgress = 1;
          setState(toIntensity);
        }
        if (fadeProgress < 1) {
          intensity = fromIntensity + (toIntensity - fromIntensity) * fadeProgress;
        }
      }
      Toxen.background.storyboard.data.visualizerIntensity = intensity;
    }
  });

  addStoryboardComponent("visualizerGlow", {
    name: "Visualizer Glow",
    arguments: [
      {
        name: "Glow",
        identifier: "glow",
        type: "Boolean"
      },
    ],
    action: (args) => {
      let glow = getAsType<"Boolean">(args.glow);
      Toxen.background.storyboard.data.visualizerGlow = glow;
    }
  });

  addStoryboardComponent("starRushEffect", {
    name: "Star Rush Effect",
    arguments: [
      {
        name: "Enabled",
        identifier: "enabled",
        type: "Boolean"
      },
    ],
    action: (args) => {
      let enabled = getAsType<"Boolean">(args.enabled);
      Toxen.background.storyboard.data.starRushEffect = enabled;
    }
  });

  addStoryboardComponent("starRushIntensity", {
    name: "Star Rush Intensity",
    arguments: [
      {
        name: "Intensity",
        identifier: "intensity",
        type: "Number"
      },
    ],
    action: (args) => {
      let intensity = getAsType<"Number">(args.intensity);
      intensity = Math.max(0, Math.min(5, intensity)); // Clamp to 0 - 5 for safety
      Toxen.background.storyboard.data.starRushIntensity = intensity;
    }
  });

  addStoryboardComponent("starRushIntensityTransition", {
    name: "Star Rush Intensity Transition",
    arguments: [
      {
        name: "From Intensity",
        identifier: "fromIntensity",
        type: "Number"
      },
      {
        name: "To Intensity",
        identifier: "toIntensity",
        type: "Number"
      },
      {
        name: "Duration for transition in seconds",
        identifier: "duration",
        type: "Number"
      },
    ],
    action: (args, { currentSongTime, eventStartTime }, { setState, getState }) => {
      let state = getState<number>();
      if (state) {
        Toxen.background.storyboard.data.starRushIntensity = state;
        return;
      }
      let fromIntensity = getAsType<"Number">(args.fromIntensity);
      fromIntensity = Math.max(0, Math.min(5, fromIntensity)); // Clamp to 0 - 5
      let toIntensity = getAsType<"Number">(args.toIntensity);
      toIntensity = Math.max(0, Math.min(5, toIntensity));
      let intensity = toIntensity;
      let duration = getAsType<"Number">(args.duration);
      if (duration > 0) {
        let fadeProgress = (currentSongTime - eventStartTime) / duration;
        if (fadeProgress >= 1) {
          fadeProgress = 1;
          setState(toIntensity);
        }
        if (fadeProgress < 1) {
          intensity = fromIntensity + (toIntensity - fromIntensity) * fadeProgress;
        }
      }
      Toxen.background.storyboard.data.starRushIntensity = intensity;
    }
  });

  addStoryboardComponent("text", {
    name: "Text",
    arguments: [
      {
        name: "Text",
        identifier: "text",
        type: "String",
        required: true
      },
      {
        name: "Font size",
        identifier: "fontSize",
        type: "Number",
        description: "Default: 12"
      },
      {
        name: "Font",
        identifier: "font",
        type: "String",
        description: "Default: Arial"
      },
      {
        name: "Color",
        identifier: "color",
        type: "Color"
      },
      {
        name: "X",
        identifier: "x",
        type: "Number"
      },
      {
        name: "Y",
        identifier: "y",
        type: "Number",
        description: "The Y position of the text. 0 is the top of the screen, 1080 is the bottom."
      }
    ],
    action: (args, info, stateManager, ctx) => {
      let text = getAsType<"String">(args.text);
      let fontSize = getAsType<"Number">(args.fontSize) || 12;
      let font = getAsType<"String">(args.font) || "Arial";
      let color = getAsType<"Color">(args.color) || [255, 255, 255];
      let x = getAsType<"Number">(args.x) ?? (ctx.canvas.width / 2);
      let y = getAsType<"Number">(args.y) ?? (ctx.canvas.height / 2);

      return () => {
        ctx.save();
        ctx.font = `${fontSize}px ${font}`;
        ctx.fillStyle = rgbArrayToHex(color);
        ctx.fillText(text, x, y);
        ctx.restore();
      }
    }
  });

  addStoryboardComponent("pulse", {
    name: "Pulse",
    arguments: [
      {
        name: "Color",
        identifier: "color",
        type: "Color",
        required: true
      },
      {
        name: "BPM",
        identifier: "bpm",
        type: "Number",
        placeholder: "Uses song BPM if not set"
      },
      {
        name: "Intensity",
        identifier: "intensity",
        type: "Number",
        required: true
      },
      {
        name: "Beat scale",
        identifier: "beatScale",
        type: "Select",
        selectData: [
          ["4/1"],
          ["2/1"],
          ["1/1"],
          ["1/2"],
          ["1/4"],
          ["1/8"],
        ],
        required: true
      }
    ],
    action: (args, { currentSongTime, eventStartTime, bpm: songBpm }, { setState, getState }, ctx) => {
      // Draw a pulse on the visualizer
      let color = getAsType<"Color">(args.color);
      let intensity = getAsType<"Number">(args.intensity) / 0.5;
      let bpm = getAsType<"Number">(args.bpm || songBpm);
      let beatScale = getAsType<"Select">(args.beatScale);

      switch (beatScale) {
        case "4/1":
          bpm /= 4;
          break;
        case "2/1":
          bpm /= 2;
          break;
        case "1/1":
          // @default
          bpm *= 1;
          break;
        case "1/2":
          bpm *= 2;
          break;
        case "1/4":
          bpm *= 4;
          break;
        case "1/8":
          bpm *= 8;
          break;
      }

      if (bpm <= 0) return;

      const currentSongTimeMs = Math.round(currentSongTime * 1000);
      const eventStartTimeMs = Math.round(eventStartTime * 1000);
      const recurring = Math.round(60 / bpm * 1000); // Time between pulses in ms
      const animateInTime = (recurring * 0.1) / 1000;
      const animateOutTime = (recurring * 0.3) / 1000;

      // Calculate the time since the event started
      const timeSinceEventStart = currentSongTimeMs - eventStartTimeMs;
      
      // Calculate which pulse we should be on based on the event start time
      const pulseIndex = Math.floor(timeSinceEventStart / recurring);
      const nextPulseTime = eventStartTimeMs + (pulseIndex * recurring);
      const timeSinceLastPulse = currentSongTimeMs - nextPulseTime;
      
      // If we're past the current pulse cycle, don't render anything
      if (timeSinceLastPulse >= recurring) {
        return;
      }

      // Calculate progress within the current pulse cycle
      let progress = timeSinceLastPulse / recurring;
      
      // Apply animation timing
      if (progress < animateInTime) {
        intensity *= progress / animateInTime;
      }
      else if (progress > animateOutTime) {
        intensity *= (1 - progress) / (1 - animateOutTime);
      }

      // Animate using ctx, this function is run every frame.
      return () => {
        let hex = rgbArrayToHex(color);
        ctx.fillStyle = hex;
        ctx.globalAlpha = intensity;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalAlpha = 1;
      }
    }
  });
  
  addStoryboardComponent("setBackground", {
    name: "Set Background",
    arguments: [
      {
        name: "Background",
        identifier: "background",
        type: "SelectImage"
      },
    ],
    action: (args) => {
      let background = getAsType<"SelectImage">(args.background);
      Toxen.background.storyboard.data.background = background;
    }
  });
  
  addStoryboardComponent("backgroundDim", {
    name: "Background Dim",
    arguments: [
      {
        name: "Dim",
        identifier: "dim",
        type: "Number"
      },
    ],
    action: (args) => {
      let dim = getAsType<"Number">(args.dim);
      Toxen.background.storyboard.data.backgroundDim = dim;
    }
  });

  addStoryboardComponent("backgroundDimTransition", {
    name: "Background Dim Transition",
    arguments: [
      {
        name: "From Dim",
        identifier: "fromDim",
        type: "Number"
      },
      {
        name: "To Dim",
        identifier: "toDim",
        type: "Number"
      },
      {
        name: "Duration for transition in seconds",
        identifier: "duration",
        type: "Number"
      },
    ],
    action: (args, { currentSongTime, eventStartTime }, { setState, getState }) => {
      let state = getState<number>();
      if (state) {
        Toxen.background.storyboard.data.backgroundDim = state;
        return;
      }
      let fromDim = getAsType<"Number">(args.fromDim);
      let toDim = getAsType<"Number">(args.toDim);
      let dim = toDim;
      let duration = getAsType<"Number">(args.duration);
      if (duration > 0) {
        let fadeProgress = (currentSongTime - eventStartTime) / duration;
        if (fadeProgress >= 1) {
          fadeProgress = 1;
          setState(toDim);
        }
        if (fadeProgress < 1) {
          dim = fromDim + (toDim - fromDim) * fadeProgress;
        }
      }
      Toxen.background.storyboard.data.backgroundDim = dim;
    }
  });

  addStoryboardComponent("dynamicLighting", {
    name: "Dynamic Lighting",
    arguments: [
      {
        name: "Force state",
        identifier: "state",
        type: "Boolean"
      },
    ],
    action: (args) => {
      let state = getAsType<"Boolean">(args.state);
      Toxen.background.storyboard.data.backgroundDynamicLighting = state;
    }
  });

  addStoryboardComponent("floatingTitleReactive", {
    name: "Floating Title Reactive",
    arguments: [
      {
        identifier: "reactive",
        name: "Is reactive?",
        type: "Boolean",
        description: "Whether the title should react to the music."
      }
    ],
    action: (args, info, stateManager, ctx) => {
      let reactive = getAsType<"Boolean">(args.reactive);
      Toxen.background.storyboard.data.floatingTitleReactive = reactive;
    }
  });

  /**
   * Displays a single pulse effect in a corner or edge of the screen.
   * Works the same as pulse, but only displays in a corner or edge of the screen and once, doesn't repeat
   */
  addStoryboardComponent("cornerPulseSingle", {
    name: "Corner Pulse",
    arguments: [
      {
        name: "Color",
        identifier: "color",
        type: "Color",
        required: true
      },
      {
        name: "Intensity",
        identifier: "intensity",
        type: "Number",
        required: true
      },
      {
        name: "Top Left",
        identifier: "pos_topLeft",
        type: "Boolean",
        description: "Display in the top left corner"
      },
      {
        name: "Top Right",
        identifier: "pos_topRight",
        type: "Boolean",
        description: "Display in the top right corner"
      },
      {
        name: "Bottom Left",
        identifier: "pos_bottomLeft",
        type: "Boolean",
        description: "Display in the bottom left corner"
      },
      {
        name: "Bottom Right",
        identifier: "pos_bottomRight",
        type: "Boolean",
        description: "Display in the bottom right corner"
      }
    ],
    action(args, info, stateManager, ctx) {
      let color = getAsType<"Color">(args.color);
      let intensity = getAsType<"Number">(args.intensity) / 0.5;
      const size = 1000;
      
      let {funcs, hex} = stateManager.getState<{ funcs: (() => void)[], hex: string }>() ?? {};
      hex ??= rgbArrayToHex(color);

      if (!funcs) {
        funcs = [];
        if (getAsType<"Boolean">(args.pos_topLeft)) {
          funcs.push(() => {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
            gradient.addColorStop(0, hex);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        if (getAsType<"Boolean">(args.pos_topRight)) {
          funcs.push(() => {
            const gradient = ctx.createRadialGradient(ctx.canvas.width, 0, 0, ctx.canvas.width, 0, size);
            gradient.addColorStop(0, hex);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(ctx.canvas.width, 0, size, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        if (getAsType<"Boolean">(args.pos_bottomLeft)) {
          funcs.push(() => {
            const gradient = ctx.createRadialGradient(0, ctx.canvas.height, 0, 0, ctx.canvas.height, size);
            gradient.addColorStop(0, hex);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, ctx.canvas.height, size, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        if (getAsType<"Boolean">(args.pos_bottomRight)) {
          funcs.push(() => {
            const gradient = ctx.createRadialGradient(ctx.canvas.width, ctx.canvas.height, 0, ctx.canvas.width, ctx.canvas.height, size);
            gradient.addColorStop(0, hex);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(ctx.canvas.width, ctx.canvas.height, size, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        
        stateManager.setState({funcs, hex});
      }
      
      let currentTime = info.currentSongTime - info.eventStartTime;
      let duration = info.eventEndTime - info.eventStartTime;
      let progress = currentTime / duration;
      return () => {
        ctx.save();
        ctx.globalAlpha = intensity * (1 - progress);
        ctx.shadowColor = hex;
        ctx.shadowBlur = 50;
        funcs.forEach(f => f());
        ctx.restore();
      }
    },
  })

  // Hue specific
  addStoryboardComponent("hueVisualizerSync", {
    name: "Philips Hue: Visualizer Sync (Broken)",
    arguments: [],
    action: (args, info, sm) => {
      return () => {
        // const [r, g, b] = hexToRgbArray(Toxen.background.storyboard.data.visualizerColor ?? Toxen.background.storyboard.getVisualizerColor());
        // const brightness = MathX.clamp(
        //   MathX.clamp(Toxen.background.visualizer.getDynamicDim(), 0, 1) * 2,
        //   0,
        //   1
        // );
        // if (HueManager.instance) {
        //   HueManager.setLightNodes(
        //     HueManager.currentLightNodes.map(() => [r * brightness, g * brightness, b * brightness])
        //   );
        // }
      }
    }
  });

  addStoryboardComponent("huePulse", {
    name: "Philips Hue: Pulse (Broken)",
    arguments: [
      {
        name: "Color",
        identifier: "color",
        type: "Color",
        required: true
      },
      {
        name: "BPM",
        identifier: "bpm",
        type: "Number",
        placeholder: "Uses song BPM if not set"
      },
      {
        name: "Intensity",
        identifier: "intensity",
        type: "Number",
        required: true
      },
      {
        name: "Beat scale",
        identifier: "beatScale",
        type: "Select",
        selectData: [
          ["4/1"],
          ["2/1"],
          ["1/1"],
          ["1/2"],
          ["1/4"],
          ["1/8"],
        ],
        required: true
      }
    ],
    action: (args, { currentSongTime, eventStartTime, bpm: songBpm }, { setState, getState }, ctx) => {
      // Draw a pulse on the visualizer
      // let state = getState<{ lastPulse: number }>() ?? { lastPulse: null };
      // let color = getAsType<"Color">(args.color);
      // let intensity = getAsType<"Number">(args.intensity) / 0.5;
      // let bpm = getAsType<"Number">(args.bpm || songBpm);
      // let beatScale = getAsType<"Select">(args.beatScale);

      // switch (beatScale) {
      //   case "4/1":
      //     bpm /= 4;
      //     break;
      //   case "2/1":
      //     bpm /= 2;
      //     break;
      //   case "1/1":
      //     // @default
      //     bpm *= 1;
      //     break;
      //   case "1/2":
      //     bpm *= 2;
      //     break;
      //   case "1/4":
      //     bpm *= 4;
      //     break;
      //   case "1/8":
      //     bpm *= 8;
      //     break;
      // }

      // const currentSongTimeMs = Math.round(currentSongTime * 1000);
      // let recurring = bpm > 0 ? Math.round(60 / bpm * 1000) : 0;
      // const animateInTime = (recurring * 0.1) / 1000;
      // const animateOutTime = (recurring * 0.3) / 1000;

      // if (state.lastPulse === null) {

      //   state.lastPulse = (eventStartTime * 1000) - (animateInTime * 1000);
      // }
      // else if (currentSongTimeMs - state.lastPulse >= recurring) {
      //   if (recurring > 0) {
      //     state.lastPulse = currentSongTimeMs;
      //   }
      //   return;
      // }

      // let progress = (currentSongTimeMs - state.lastPulse) / recurring;
      // if (progress < animateInTime) {
      //   intensity *= progress / animateInTime;
      // }
      // else if (progress > animateOutTime) {
      //   intensity *= (1 - progress) / (1 - animateOutTime);
      // }

      // setState(state);

      // return () => {
      //   intensity = MathX.clamp(intensity, 0, 1);
      //   const [r, g, b] = color.map(x => x * intensity);
      //   HueManager.setLightNodes(
      //     HueManager.currentLightNodes.map(() => {
      //       return [r, g, b] as any;
      //     })
      //   );
      // }
    }
  });
}

export default StoryboardParser;
