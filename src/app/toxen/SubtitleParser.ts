import { Toxen } from "../ToxenApp";
import Song from "./Song";
import Time from "./Time";

namespace SubtitleParser {

  export interface SubtitleOptions {
    color: string;
    font: string;
    fontSize: string;
    bold: string;
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

    public song?: Song;
    /**
     * Type of subtitle file this is parsed from.
     */
    public type: string;

    // Options
    public options: Partial<SubtitleOptions> = { }

    public getById(id: number): SubtitleItem {
      return this.find(item => item.id === id);
    }

    public getByTime(time: Time): SubtitleItem {
      let item: SubtitleItem;
      let list: SubtitleItem[] = this.slice();
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
      case ".lrc":
        // content = exportLrc(data);
        break;
      default:
        throw new Error("Unsupported extension");
    }
    return content;
  }

  export function parseByExtension(data: string, extension: string) {
    switch (extension) {
      case ".srt": return parseSrt(data);
      case ".tst": return parseTst(data);
      case ".lrc": return parseLrc(data);
      default: throw new Error("Unsupported extension");
    }
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
  
  export function parseSrt(text: string): SubtitleArray {
    let lines = text.split(/\r?\n/);
    let index = 0;
    const items: SubtitleArray = new SubtitleArray();
    items.type = "srt";
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

  export function parseTst(text: string): SubtitleArray {
    let lines = text.split(/\r?\n/);
    let index = 0;
    const items: SubtitleArray = new SubtitleArray();
    items.type = "tst";
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
          const matches = line.match(/@(\w+)(?:\s*=\s*(.*))?/);
          if (matches) {
            const [, key, value] = matches;
            (options as any)[key] = value || "true";
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

  function parseLrcTime(time: string): Time {
    let parts = time.split(/[.:]/g);
    let hours = parseInt(parts[0]);
    let minutes = parseInt(parts[1]);
    let seconds = parseInt(parts[2]);
    return new Time(hours * 3600000 + minutes * 60000 + seconds * 1000);
  }

  function exportLrcTime(time: Time): string {
    let hours = (time.getHours()).toString().padStart(2, "0");
    let minutes = (time.getMinutes()).toString().padStart(2, "0");
    let seconds = (time.getSeconds() + Math.round(time.getMilliseconds() / 1000)).toString().padStart(2, "0");
    return `${hours}:${minutes}.${seconds}`;
  }

  export function parseLrc(text: string): SubtitleArray {
    let lines = text.split(/\r?\n/);
    let index = 0;
    const items: SubtitleArray = new SubtitleArray();
    items.type = "lrc";
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
      if (index >= lines.length) { break; }
      item.id = items.length + 1;
      const makeRegex = () => /^\[(\d+\:\d+\.\d+)\](.*)/;
      if (makeRegex().test(line)) {
        const matches = line.match(makeRegex());
        item.start = parseLrcTime(matches[1]);
        item.text = matches[2] || "";
        items.push(item);
        // throw new Error("Not implemented");
      }
      getNextLine();
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemNext = items[i + 1];
      if (i + 1 < items.length) {
        item.end = itemNext.start;
      }
      else {
        item.end = new Time(item.start.valueOf() + 1500);
      }
    }
    
    return items;
  }
}

export default SubtitleParser;