import { rgbToHex } from "../components/Form/FormInputFields/FormInputColorPicker";
import { Toxen } from "../ToxenApp";
import Time from "./Time";

namespace StoryboardParser {
  export class StoryboardArray extends Array<StoryboardItem> {
    constructor(...storyboardObjects: StoryboardItem[]) {
      super(...storyboardObjects);

      // Sort by start time
      
    }

    public getById(id: number): StoryboardItem {
      return this.find(item => item.id === id);
    }

    // public getByTime(time: Time): StoryboardItem {
    //   let item: StoryboardItem;
    //   let list: StoryboardItem[] = this.slice();
    //   let index: number;
    //   if (list.length === 0) return null;
    //   while (true) {
    //     index = Math.floor(list.length / 2);
    //     item = list[index];
    //     if (list.length === 0) return null;
    //     else if (!item) list.splice(index, 1);
    //     else if (item.start > time) list = list.slice(0, index);
    //     else if (item.end <= time) list = list.slice(index + 1);
    //     else return item;
    //   }
    // }

    public getByTime(time: Time): StoryboardItem[] {
      // Get all items that has Time in range
      let list: StoryboardItem[] = this.slice();
      
      let items: StoryboardItem[] = [];
      
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item.end < time) return items;
        if (item.start <= time && item.end > time) {
          items.push(item);
        }
      }

      return items;
    }
  }

  export class StoryboardItem {
    public id: number;
    public start: Time;
    public end: Time;
    public text: string;
    public options: Action[];
  }

  interface Action {
    [key: string]: any;
  }

  interface Component<Arguments extends ComponentArgument[]> {
    /**
     * Display name for the component.
     */
    name: string;
    arguments: Arguments;
    action(
      args: { [Property in Arguments[number]as Property["identifier"]]: ComponentArgumentTypes[Property["type"]] },
      currentTime: number,
      duration: number,
    ): void;
  }

  interface ComponentArgument {
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
  }

  interface ComponentArgumentTypes {
    String: string;
    Number: number;
    Color: [number, number, number, number?];
  }

  /**
   * An object that contains all storyboard components that can be executed.
   */
  export const components: { [componentName: string]: Component<ComponentArgument[]> } = {};

  function addComponent<Arguments extends ComponentArgument[]>(name: string, component: Component<Arguments>) {
    components[name] = component;
  }

  function getAsType<T extends keyof ComponentArgumentTypes>(value: any) { return value as ComponentArgumentTypes[T]; }

  addComponent("visualizerColor", {
    name: "Visualizer Color",
    arguments: [
      {
        name: "Color",
        identifier: "color",
        type: "Color"
      },
      {
        name: "Duration",
        identifier: "color",
        type: "String"
      },
    ],
    action: (args, c, d) => {
      let color = getAsType<"Color">(args.color);
      Toxen.background.storyboard.data.visualizerColor = rgbToHex({
        r: color[0],
        g: color[1],
        b: color[2],
        a: color[3]
      });
      // Toxen.setAllVisualColors(args.color);
    }
  });

}

export default StoryboardParser;