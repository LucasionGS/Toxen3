import { Toxen } from "../ToxenApp";
import Time from "./Time";

export default class Converter {
  public static numberToTime(ms: number): Time {
    return new Time(ms);
  }

  /**
   * Adds padding 0's to the beginning of a number if needed.
   */
  public static padNumber(number: number, size: number) {
    let s = String(number);
    while (s.length < size) { s = "0" + s; }
    return s;
  }

  /**
   * Trims the specified trailing characters or string from the start and end of the string.
   */
  public static trimChar(txt: string, toTrim: string) {
    while (txt.startsWith(toTrim)) txt = txt.substring(toTrim.length);
    while (txt.endsWith(toTrim)) txt = txt.substring(0, txt.length - toTrim.length);
    return txt;
  }

  public static camelCaseToSpacing(text: string) {
    let reg = /(?<=[\w])([A-Z][a-z]*)/g;
    return text.replace(reg, (_, g1: string) => {
      return " " + g1.toLowerCase();
    });
  }

  /**
   * From SO
   * 
   * https://stackoverflow.com/a/2541680/8614415
   */
  public static async getAverageRGB(img: HTMLImageElement | string, toHex: boolean = false): Promise<string | { r: number; g: number; b: number; }> {
    let canvas = document.createElement('canvas'),
        context = canvas.getContext && canvas.getContext('2d');
    let value = await new Promise<{r: number, g: number, b: number}>(async (resolve) => {
      if (typeof img === "string") {
        let elm = new Image();
        elm.src = img;
        elm.addEventListener("load", () => resolve(action(elm)))
        return;
      }
      return resolve(action(img));
    });

    if (toHex) {
      context.fillStyle = `rgb(${value.r}, ${value.g}, ${value.b})`;
      return context.fillStyle;
    }
    return value;


    function action(imgEl: HTMLImageElement) {
      let blockSize = 5, // only visit every 5 pixels
        defaultRGB = { r: 0, g: 0, b: 0 }, // for non-supporting envs
        data, width, height,
        i = -4,
        length,
        rgb = { r: 0, g: 0, b: 0 },
        count = 0;

      if (!context) {
        return defaultRGB;
      }

      height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
      width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;

      context.drawImage(imgEl, 0, 0);

      try {
        data = context.getImageData(0, 0, width, height);
      } catch (e) {
        /* security error, img on diff domain */
        Toxen.error(e);
        return defaultRGB;
      }

      length = data.data.length;

      while ((i += blockSize * 4) < length) {
        ++count;
        rgb.r += data.data[i];
        rgb.g += data.data[i + 1];
        rgb.b += data.data[i + 2];
      }

      // ~~ used to floor values
      rgb.r = ~~(rgb.r / count);
      rgb.g = ~~(rgb.g / count);
      rgb.b = ~~(rgb.b / count);

      return rgb;
    }

  }
}
