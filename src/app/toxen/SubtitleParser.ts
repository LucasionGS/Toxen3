import { Toxen } from "../ToxenApp";
import Time from "./Time";

namespace SubtitleParser {

  export interface SubtitleOptions {
    color: string;
    font: string;
    fontSize: string;
  }

  export interface SubtitleItem {
    id: number,
    start: Time,
    end: Time,
    text: string,
    options: Partial<SubtitleOptions>,
  }

  export class SubtitleArray extends Array<SubtitleItem>{
    constructor(...items: SubtitleItem[]) {
      super(...items);
    }

    // Options
    public options: SubtitleOptions = {
      color: "#FFFFFF",
      font: "Arial",
      fontSize: "24",
    }

    public getById(id: number): SubtitleItem {
      return this.find(item => item.id === id);
    }

    public getByTime(time: Time): SubtitleItem {
      let item: SubtitleItem;
      let list: SubtitleItem[] = this.slice();
      let index: number;
      if (list.length === 0) return null;
      while (true) {
        // debugger;
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

  function applyOptions(subject: SubtitleArray | SubtitleItem, options: Partial<SubtitleOptions>) {
    for (let key in options) {
      if (options.hasOwnProperty(key)) {
        (subject.options as any)[key] = (options as any)[key];
      }
    }
  }

  export function exportByExtension(data: SubtitleArray, extension: string) {
    let content: string;
    switch (extension) {
      case ".srt":
        content = exportSrt(data);
        break;
      case ".tst":
        content = exportTst(data);
        break;
      default:
        throw new Error("Unsupported extension");
    }
    return content;
  }

  export function parseByExtension(data: string, extension: string) {
    let content: SubtitleArray;
    switch (extension) {
      case ".srt":
        content = parseSrt(data);
        break;
      case ".tst":
        content = parseTst(data);
        break;
      default:
        throw new Error("Unsupported extension");
    }
    return content;
  }

  export function parseSrt(text: string): SubtitleArray {
    let lines = text.split("\n");
    let index = 0;
    const items: SubtitleArray = new SubtitleArray();
    const getLine = () => lines[index];
    const getNextLine = () => lines[++index];
    while (index < lines.length) {
      let line = getLine();
      const item: SubtitleItem = {
        id: null,
        start: null,
        end: null,
        text: null,
        options: {}
      };
      while (!line && index < lines.length) { line = getNextLine(); }
      if (index >= lines.length) { break; }
      if (!isNaN(+line)) {
        item.id = +line;
        line = getNextLine();
      }
      if (/\d+:\d+:\d+,\d+\s+-->\s+\d+:\d+:\d+,\d+/.test(line)) {
        [item.start, item.end] = line.split(/\s+-->\s+/).map(parseSrtTime);
        line = getNextLine();
      }
      let textLines: string[] = [];
      while (line) {
        textLines.push(line);
        line = getNextLine();
      }

      item.text = textLines.join("<br />");
      items.push(item);
      continue;
    }

    return items;
  }

  export function exportSrt(items: SubtitleArray): string {
    let text = "";
    for (let item of items) {
      text += `${item.id}\n`;
      text += `${exportSrtTime(item.start)} --> ${exportSrtTime(item.end)}\n`;
      text += `${item.text.replace(/<br\s*\/?>/g, "\n")}\n\n`;
    }
    return text;
  }

  function parseSrtTime(time: string): Time {
    let parts = time.split(/[:,]/g);
    let hours = parseInt(parts[0]);
    let minutes = parseInt(parts[1]);
    let seconds = parseInt(parts[2]);
    let milliseconds = parseInt(parts[3]);
    return new Time(hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds);
  }

  function exportSrtTime(time: Time): string {
    let hours = (time.getHours()).toString().padStart(2, "0");
    let minutes = (time.getMinutes()).toString().padStart(2, "0");
    let seconds = (time.getSeconds()).toString().padStart(2, "0");
    let milliseconds = (time.getMilliseconds()).toString().padStart(3, "0");
    return `${hours}:${minutes}:${seconds},${milliseconds}`;
  }

  export function parseTst(text: string): SubtitleArray {
    let lines = text.split("\n");
    let index = 0;
    const items: SubtitleArray = new SubtitleArray();
    const getLine = () => lines[index];
    const getNextLine = () => lines[++index];
    while (index < lines.length) {
      let line = getLine();
      const item: SubtitleItem = {
        id: null,
        start: null,
        end: null,
        text: null,
        options: {},
      };
      while (!line && index < lines.length) { line = getNextLine(); }

      const getOptions = () => {
        const options: Partial<SubtitleOptions> = {};
        while (line && line.startsWith("@")) {
          const matches = line.match(/@(\w+)\s*=\s*(.*)/);
          if (matches) {
            const [, key, value] = matches;
            (options as any)[key] = value;
          }
          else Toxen.error(`${index + 1}: Invalid option line in TST file: ${line}`);
          // Final
          line = getNextLine();
        }
        return options;
      }
      applyOptions(items, getOptions());
      while (!line && index < lines.length) { line = getNextLine(); }
      if (index >= lines.length) { break; }
      item.id = items.length + 1;
      if (/\d+:\d+:\d+,\d+\s+\|\s+\d+:\d+:\d+,\d+/.test(line)) {
        [item.start, item.end] = line.split(/\s+\|\s+/).map(parseSrtTime);
        line = getNextLine();
      }
      applyOptions(item, getOptions());
      let textLines: string[] = [];
      while (line) {
        textLines.push(line);
        line = getNextLine();
      }

      item.text = textLines.map(s => s.replace(/\\(.)/g, "$1")).join("<br />");
      items.push(item);
    }
    console.log(items);
    return items;
  }

  export function exportTst(items: SubtitleArray): string {
    let text = "";
    for (const key in items.options) {
      if (Object.prototype.hasOwnProperty.call(items.options, key)) {
        const value: string = (items.options as any)[key];
        text += `@${key} = ${value}\n`;
      }
    }
    text += "\n";
    for (let item of items) {
      text += `${exportSrtTime(item.start)} | ${exportSrtTime(item.end)}\n`;
      for (const key in item.options) {
        if (Object.prototype.hasOwnProperty.call(item.options, key)) {
          const value: string = (item.options as any)[key];
          text += `@${key} = ${value}\n`;
        }
      }
      text += `${item.text.replace(/<br\s*\/?>/g, "\n")}\n\n`;
    }

    return text;
  }
}

export default SubtitleParser;