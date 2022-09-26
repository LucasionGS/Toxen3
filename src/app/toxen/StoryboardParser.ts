import { hexToRgb, hexToRgbArray, rgbArrayToHex, rgbToHex } from "../components/Form/FormInputFields/FormInputColorPicker";
import { Toxen } from "../ToxenApp";
import { VisualizerStyle } from "./Settings";
import Time from "./Time";
import yaml from "js-yaml";
import fsp from "fs/promises";

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
     * To draw after the background dim, return a another function from this function.
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
     * Is this argument required?
     */
    required?: boolean;
  }

  export interface ComponentArgumentTypes {
    String: string;
    Number: number;
    Color: [number, number, number, number?];
    VisualizerStyle: VisualizerStyle;
    Boolean: boolean;
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
  function addComponent<Arguments extends ComponentArgument[]>(name: string, component: Component<Arguments>) {
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

  interface PreparseStoryboardConfig {
    storyboard: SBEventConfig[];
    variables?: { [key: string]: any };
    version?: number;
    author?: string;
  }

  export interface StoryboardConfig {
    storyboard: SBEvent[];
    version?: number;
    author?: string;
    variables?: { [key: string]: any };
  }

  export function save(path: string, config: StoryboardConfig) {
    const data = yaml.dump({
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
    } as PreparseStoryboardConfig);
    return fsp.writeFile(path, data);
  }

  let eventIndex = 0;
  // `index` will be reset to 0 when the storyboard is finished.
  // `index` will be set to first event that intersects with the current time, when user skips to a different time.
  // `index` will be incremented by 1 every time a new event is added to `currentEvents`
  // `index` will be checked every frame to see if it needs to be incremented. Check if loadedStoryboard[index].endTime < currentTime
  let loadedStoryboard: StoryboardConfig = {
    storyboard: [],
  };

  export function setStoryboard(config: StoryboardConfig) {
    if (config) {
      loadedStoryboard = config;
    }
    else {
      loadedStoryboard = { // Default storyboard
        storyboard: [],
      };
    }
    if (loadedStoryboard) loadedStoryboard.storyboard.sort((a, b) => a.startTime - b.startTime);
    eventIndex = 0;

    return loadedStoryboard;
  }

  export function parseStoryboard(storyboardYaml: string, validateFields: boolean = true): StoryboardConfig {
    const storyboardConfig = yaml.load(storyboardYaml) as PreparseStoryboardConfig;

    if (!storyboardConfig.storyboard) throw new Error("Storyboard is missing `storyboard` property.");
    if (typeof storyboardConfig.version === "number" && storyboardConfig.version !== version) throw new Error(`Storyboard version is not supported. Expected ${version}, got ${storyboardConfig.version}`);

    try {
      const events = storyboardConfig.storyboard.map((e, i) => SBEvent.fromConfig(e, storyboardConfig.variables, i, validateFields));
      return {
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
    if (loadedStoryboard) loadedStoryboard.storyboard.forEach(tlEvent => {
      tlEvent.setState(null);
      if (tlEvent.once) {
        tlEvent.done = false;
      }
    });
  };

  interface SongInfo {
    currentSongTime: number;
    songDuration: number;

    isPaused: boolean;
  }

  interface EventInfo extends SongInfo {
    eventStartTime: number;
    eventEndTime: number;
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
  addComponent("visualizerColor", {
    name: "Visualizer Color",
    arguments: [
      {
        name: "Color",
        identifier: "color",
        type: "Color"
      }
    ],
    action: (args) => {
      let color = getAsType<"Color">(args.color);
      const hex = rgbToHex({
        r: color[0],
        g: color[1],
        b: color[2],
        a: color[3]
      });

      Toxen.background.storyboard.data.visualizerColor = hex;
    }
  });

  addComponent("visualizerColorTransition", {
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

  addComponent("visualizerStyle", {
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

  addComponent("visualizerIntensity", {
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

  addComponent("visualizerIntensityTransition", {
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

  addComponent("pulse", {
    name: "Pulse",
    arguments: [
      {
        name: "Color",
        identifier: "color",
        type: "Color"
      },
      {
        name: "Intensity",
        identifier: "intensity",
        type: "Number"
      },
      {
        name: "BPM",
        identifier: "bpm",
        type: "Number"
      },
    ],
    action: (args, { currentSongTime, eventStartTime }, { setState, getState }, ctx) => {
      // Draw a pulse on the visualizer
      let state = getState<{ lastPulse: number }>() ?? { lastPulse: null };
      let color = getAsType<"Color">(args.color);
      let intensity = getAsType<"Number">(args.intensity);
      let bpm = getAsType<"Number">(args.bpm);

      const currentSongTimeMs = Math.round(currentSongTime * 1000);
      let recurring = bpm > 0 ? Math.round(60 / bpm * 1000) : 0;
      const animateInTime = (recurring * 0.1) / 1000;
      const animateOutTime = (recurring * 0.3) / 1000;

      // Animate using ctx, this function is run every frame.
      if (state.lastPulse === null) {

        state.lastPulse = (eventStartTime * 1000) - (animateInTime * 1000);
      }
      else if (currentSongTimeMs - state.lastPulse >= recurring) {
        if (recurring > 0) {
          state.lastPulse = currentSongTimeMs;
        }
        return;
      }

      let progress = (currentSongTimeMs - state.lastPulse) / recurring;
      if (progress < animateInTime) {
        intensity *= progress / animateInTime;
      }
      else if (progress > animateOutTime) {
        intensity *= (1 - progress) / (1 - animateOutTime);
      }

      setState(state);

      return () => {
        let hex = rgbArrayToHex(color);
        ctx.fillStyle = hex;
        ctx.globalAlpha = intensity;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalAlpha = 1;
      }
    }
  });

  addComponent("backgroundDim", {
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

  addComponent("backgroundDimTransition", {
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

  addComponent("dynamicLighting", {
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
}

export default StoryboardParser;