import { Toxen } from "../ToxenApp";
import Time from "./Time";

namespace StoryboardParser {
  export function parse(storyboardObject: string) {

  }

  export class StoryboardArray extends Array<StoryboardItem> {
    constructor(...storyboardObjects: StoryboardItem[]) {
      super(...storyboardObjects);
    }

    public getById(id: number): StoryboardItem {
      return this.find(item => item.id === id);
    }

    public getByTime(time: Time): StoryboardItem {
      let item: StoryboardItem;
      let list: StoryboardItem[] = this.slice();
      let index: number;
      if (list.length === 0) return null;
      while (true) {
        index = Math.floor(list.length / 2);
        item = list[index];
        if (list.length === 0) return null;
        else if (!item) list.splice(index, 1);
        else if (item.start > time) list = list.slice(0, index);
        else if (item.end <= time) list = list.slice(index + 1);
        else return item;
      }
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
    action(args: { [Property in Arguments[number] as Property["identifier"]]: ComponentArgumentTypes[Property["type"]] }): void;
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
  }

  /**
   * An object that contains all storyboard components that can be executed.
   */
  export const components: { [componentName: string]: Component<ComponentArgument[]> } = {};

  function addComponent<Arguments extends ComponentArgument[]>(name: string, component: Component<Arguments>) {
    components[name] = component;
  }

  addComponent("visualizerColor", {
    name: "Visualizer Color",
    arguments: [
      {
        name: "color",
        identifier: "color",
        type: "String"
      },
      {
        name: "color",
        identifier: "color2",
        type: "Number"
      },
    ],
    action: (args) => {
      // Toxen.setAllVisualColors(args.color);
    }
  });

}

export default StoryboardParser;