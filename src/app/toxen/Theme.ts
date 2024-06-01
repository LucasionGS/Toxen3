import Settings from "./Settings";
import CrossPlatform from "./CrossPlatform";
import fs from "fs";
import fsp from "fs/promises";

export default class Theme implements ITheme {
  public static readonly themeFolderPath = CrossPlatform.getToxenDataPath("themes");
  public static async load(): Promise<Theme[]> {
    const themes: Theme[] = await fsp.readdir(Theme.themeFolderPath).then(async (files) => {
      const themeFiles = files.filter((file) => file.endsWith(".json"));
      const themePromises = themeFiles.map((file) => {
        return fsp.readFile(`${Theme.themeFolderPath}/${file}`, "utf8").then((data) => {
          return Theme.create(JSON.parse(data));
        });
      });
      return Promise.all(themePromises);
    }).catch(async () => {
      await fsp.mkdir(Theme.themeFolderPath);
      return [];
    });

    return themes;
  }

  public save() {
    const data = JSON.stringify(this, null, 2);
    return fsp.writeFile(`${Theme.themeFolderPath}/${this.name}.json`, data);
  }

  name: string;
  displayName: string;
  public getDisplayName() {
    return this.displayName || this.name;
  }
  description: string;
  styles: ThemeStyle = {};
  customCSS: string;

  public static create(themeData: ITheme) {
    const theme = new Theme();
    theme.name = themeData.name;
    theme.displayName = themeData.displayName;
    theme.description = themeData.description;
    theme.styles = themeData.styles;

    return theme;
  }

  public static parseToCSS(theme: Theme) {
    let css = "";
    const selectorValuePair: { [selector: string]: (ThemeStyle[string] & { key: string } )[] } = {};
    for (const key in theme.styles) {
      if (theme.styles.hasOwnProperty(key)) {
        const style: (ThemeStyle[string] & { key: string } ) = {
          ...ThemeStyleKeyValue[key],
          ...theme.styles[key],
          key
        };
        if (!selectorValuePair[style.selector]) {
          selectorValuePair[style.selector] = [];
        }
        selectorValuePair[style.selector].push(style);
      }
    }

    for (const selector in selectorValuePair) {
      if (selectorValuePair.hasOwnProperty(selector)) {
        const styles = selectorValuePair[selector];
        css += `\n${selector} {\n`;
        for (const style of styles) {
          if (style.value) css += `  ${ThemeStyleKeyValue[style.key].parser(style.value)};\n`;
        }
        css += "}\n";
      }
    }

    theme.loadExternalCSS();
    if (theme.customCSS) css += "\n" + theme.customCSS;
    
    return css;
  }

  /**
   * Loads and applies the external CSS file to `Theme.customCSS`, if it exists.
   */
  public loadExternalCSS() {
    const cssPath = `${Theme.themeFolderPath}/${this.name}.css`;
    console.log(cssPath);
    
    if (fs.existsSync(cssPath)) {
      const css = fs.readFileSync(cssPath, "utf8");
      this.customCSS = css;
    }
    else this.customCSS = "";
  }
}

interface ITheme {
  name: string;
  displayName: string;
  description: string;
  styles: ThemeStyle;
}

type ThemeStyle = { [key: string]: IThemeStyleItem<ThemeStyleItemType> };
interface IThemeStyleItem<T extends ThemeStyleItemType> extends IThemeStyleItemTemplate<T> {
  value: ThemeStyleItemParserTypes[T];
}

/**
 * Theme Style Item Type:Parser. Includes parsers function typess for the different types of styles.
 */
interface ThemeStyleItemParserTypes {
  "string": string;
  "number": number;
  "color": RGBColor;
}

type ThemeStyleItemType = keyof ThemeStyleItemParserTypes;

interface IThemeStyleItemTemplate<T extends ThemeStyleItemType> {
  title: string;
  selector: string;
  type: T;
  description?: string;

  parser: (value: ThemeStyleItemParserTypes[T]) => string;
}

class ThemeStyleItem<T extends ThemeStyleItemType> implements IThemeStyleItemTemplate<T> {
  title: string;
  selector: string;
  type: T;
  description: string;
  parser: (value: ThemeStyleItemParserTypes[T]) => string;

  constructor(data: IThemeStyleItemTemplate<T>) {
    this.title = data.title;
    this.selector = data.selector;
    this.type = data.type;
    this.description = data.description || "";
    this.parser = data.parser;
  }
}

interface IThemeStyleTemplate {
  [ReadableSectionName: string]: {
    [key: string]: ThemeStyleItem<ThemeStyleItemType>
  }
};

// Special style types
type RGBColor = [number, number, number];

export const ThemeStyleTemplate: IThemeStyleTemplate = {
  "Side Panel": {
    panelBackground: new ThemeStyleItem({
      title: "Panel Background color",
      selector: ".sidepanel, .sidepanel-section-header",
      description: "The background color of the panel",
      type: "color",
      parser: (rgb) => {
        return `background-color: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]});`;
      }
    }),
  },
  "Text & UI": {
    textColor: new ThemeStyleItem({
      title: "Base Text color",
      selector: "*",
      description: "Base color of the text",
      type: "color",
      parser: (rgb) => {
        return `color: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}); border-color: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}) !important`;
      }
    }),
    songElementColor: new ThemeStyleItem({
      title: "Song Element Text color",
      selector: ".song-element *",
      description: "The color of the panel",
      type: "color",
      parser: (rgb) => {
        return `color: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      }
    }),
  },
};

const ThemeStyleKeyValue: { [key: string]: IThemeStyleItemTemplate<ThemeStyleItemType> } = {};
for (const key in ThemeStyleTemplate) {
  if (Object.prototype.hasOwnProperty.call(ThemeStyleTemplate, key)) {
    const style = ThemeStyleTemplate[key];
    for (const key2 in style) {
      if (Object.prototype.hasOwnProperty.call(style, key2)) {
        ThemeStyleKeyValue[key2] = style[key2];
      }
    }
  }
}