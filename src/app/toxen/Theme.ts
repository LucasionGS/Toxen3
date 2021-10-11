export default class Theme implements ITheme {
  constructor() {

  }

  name: string;
  description: string;
  styles: ThemeStyle = {};

  public static create(themeData: ITheme) {
    const theme = new Theme();
    theme.name = themeData.name;
    theme.description = themeData.description;
    theme.styles = themeData.styles;
  }

  public static parseToCSS(themeStyle: ThemeStyle) {
    let css = "";
    for (const key in themeStyle) {
      if (themeStyle.hasOwnProperty(key)) {
        const style = themeStyle[key];
        style.parser(style.value)
      }
    }
    return css;
  }
}

interface ITheme {
  name: string;
  description: string;
  styles: ThemeStyle;
}

type ThemeStyle = { [key: string]: IThemeStyleItem<ThemeStyleItemType> };
interface IThemeStyleItem<T extends ThemeStyleItemType> extends IThemeStyleItemTemplate<T> {
  value: ThemeStyleItemTypeParsers[T];
}

/**
 * Theme Style Item Type:Parser. Includes parsers function typess for the different types of styles.
 */
interface ThemeStyleItemTypeParsers {
  "string": string;
  "number": number;
  "color": RGBColor;
}

type ThemeStyleItemType = keyof ThemeStyleItemTypeParsers;

interface IThemeStyleItemTemplate<T extends ThemeStyleItemType> {
  title: string;
  selector: string;
  type: T;
  description?: string;

  parser: (value: ThemeStyleItemTypeParsers[T]) => string;
}

class ThemeStyleItem<T extends ThemeStyleItemType> implements IThemeStyleItemTemplate<T> {
  title: string;
  selector: string;
  type: T;
  description: string;
  parser: (value: ThemeStyleItemTypeParsers[T]) => string;

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
      selector: ".sidepanel",
      description: "The background color of the panel",
      type: "color",
      parser: (rgb) => {
        return `background-color: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      }
    }),
  },
  "Text & UI": {
    panelBackground: new ThemeStyleItem({
      title: "Base Text color",
      selector: "*",
      description: "The color of the panel",
      type: "color",
      parser: (rgb) => {
        return `background-color: rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      }
    }),
  },
};
