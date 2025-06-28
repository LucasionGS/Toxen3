export default class Theme implements ITheme {
  public static async load(): Promise<Theme[]> {
    return toxenapi.loadThemes(Theme);
  }

  public save() {
    return toxenapi.saveTheme(this);
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
    theme.customCSS = themeData.customCSS;

    return theme;
  }

  public static parseToCSS(theme: Theme) {
    let css = ":root {\n";
    
    // Generate CSS variables from theme styles
    for (const key in theme.styles) {
      if (theme.styles.hasOwnProperty(key)) {
        const style = theme.styles[key];
        const template = ThemeStyleKeyValue[key];
        
        if (template && style.value) {
          const variableName = template.cssVariable;
          const variableValue = template.parser(style.value);
          css += `  ${variableName}: ${variableValue};\n`;
        }
      }
    }
    
    // Generate calculated variables for accent color variations
    const accentColorStyle = theme.styles['accentColor'];
    if (accentColorStyle?.value) {
      const [r, g, b] = accentColorStyle.value as RGBColor;
      css += `  --accent-color-dim: rgba(${r}, ${g}, ${b}, 0.15);\n`;
      css += `  --accent-color-hover: rgba(${r}, ${g}, ${b}, 0.25);\n`;
      css += `  --accent-color-active: rgba(${r}, ${g}, ${b}, 0.4);\n`;
    }
    
    // Generate calculated variables for other colors
    const primaryBgStyle = theme.styles['primaryBg'];
    if (primaryBgStyle?.value) {
      const [r, g, b] = primaryBgStyle.value as RGBColor;
      css += `  --primary-bg-rgb: ${r}, ${g}, ${b};\n`;
    }
    
    const textPrimaryStyle = theme.styles['textPrimary'];
    if (textPrimaryStyle?.value) {
      const [r, g, b] = textPrimaryStyle.value as RGBColor;
      css += `  --text-primary-rgb: ${r}, ${g}, ${b};\n`;
    }
    
    css += "}\n";

    // Load external CSS and custom CSS
    theme.loadExternalCSS();
    if (theme.customCSS) css += "\n" + theme.customCSS;
    
    return css;
  }

  /**
   * Creates a default theme with sensible color values
   */
  public static createDefaultTheme(): Theme {
    const theme = new Theme();
    theme.name = "Toxen Default";
    theme.displayName = "Toxen Default Theme";
    theme.description = "The default Toxen theme with green accents";
    
    // Set all the default values from the template
    theme.styles = {};
    for (const sectionName in ThemeStyleTemplate) {
      const section = ThemeStyleTemplate[sectionName];
      for (const styleKey in section) {
        const style = section[styleKey];
        if (style.defaultValue && style.cssVariable) {
          theme.styles[styleKey] = {
            ...style,
            value: style.defaultValue
          };
        }
      }
    }
    
    return theme;
  }

  /**
   * Creates a dark blue theme variant
   */
  public static createDarkBlueTheme(): Theme {
    const theme = Theme.createDefaultTheme();
    theme.name = "Toxen Dark Blue";
    theme.displayName = "Dark Blue Theme";
    theme.description = "A dark theme with blue accents";
    
    // Override accent colors for blue theme
    if (theme.styles['accentColor']) {
      theme.styles['accentColor'].value = [59, 130, 246]; // Blue
    }
    if (theme.styles['accentColorRgb']) {
      theme.styles['accentColorRgb'].value = [59, 130, 246];
    }
    
    return theme;
  }

  /**
   * Creates a purple theme variant
   */
  public static createPurpleTheme(): Theme {
    const theme = Theme.createDefaultTheme();
    theme.name = "Toxen Purple";
    theme.displayName = "Purple Theme";
    theme.description = "A dark theme with purple accents";
    
    // Override accent colors for purple theme
    if (theme.styles['accentColor']) {
      theme.styles['accentColor'].value = [139, 92, 246]; // Purple
    }
    if (theme.styles['accentColorRgb']) {
      theme.styles['accentColorRgb'].value = [139, 92, 246];
    }
    
    return theme;
  }

  /**
   * Loads and applies the external CSS file to `Theme.customCSS`, if it exists.
   */
  public loadExternalCSS() {
    return toxenapi.loadThemeExternalCSS(this);
  }
}

interface ITheme {
  name: string;
  displayName: string;
  description: string;
  styles: ThemeStyle;
  customCSS?: string;
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
  selector?: string;
  cssVariable?: string;
  type: T;
  description?: string;
  defaultValue?: ThemeStyleItemParserTypes[T];

  parser: (value: ThemeStyleItemParserTypes[T]) => string;
}

class ThemeStyleItem<T extends ThemeStyleItemType> implements IThemeStyleItemTemplate<T> {
  title: string;
  selector?: string;
  cssVariable?: string;
  type: T;
  description: string;
  defaultValue?: ThemeStyleItemParserTypes[T];
  parser: (value: ThemeStyleItemParserTypes[T]) => string;

  constructor(data: IThemeStyleItemTemplate<T>) {
    this.title = data.title;
    this.selector = data.selector;
    this.cssVariable = data.cssVariable;
    this.type = data.type;
    this.description = data.description || "";
    this.defaultValue = data.defaultValue;
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

// Helper functions for color parsing
const rgbToString = (rgb: RGBColor) => `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
const rgbToHex = (rgb: RGBColor) => `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;
const rgbToRgba = (rgb: RGBColor, alpha: number = 1) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;

export const ThemeStyleTemplate: IThemeStyleTemplate = {
  "Core Colors": {
    primaryBg: new ThemeStyleItem({
      title: "Primary Background",
      cssVariable: "--primary-bg",
      type: "color",
      description: "Main background color of the application",
      defaultValue: [32, 33, 36],
      parser: (rgb) => rgbToHex(rgb)
    }),
    secondaryBg: new ThemeStyleItem({
      title: "Secondary Background",
      cssVariable: "--secondary-bg",
      type: "color",
      description: "Secondary background color for panels and sections",
      defaultValue: [42, 42, 42],
      parser: (rgb) => rgbToHex(rgb)
    }),
    tertiaryBg: new ThemeStyleItem({
      title: "Tertiary Background",
      cssVariable: "--tertiary-bg",
      type: "color",
      description: "Tertiary background color for subtle elements",
      defaultValue: [53, 53, 53],
      parser: (rgb) => rgbToHex(rgb)
    }),
    accentColor: new ThemeStyleItem({
      title: "Accent Color",
      cssVariable: "--accent-color",
      type: "color",
      description: "Primary accent color used throughout the interface",
      defaultValue: [182, 255, 186],
      parser: (rgb) => rgbToHex(rgb)
    }),
    accentColorRgb: new ThemeStyleItem({
      title: "Accent Color RGB",
      cssVariable: "--accent-color-rgb",
      type: "color",
      description: "Accent color as RGB values for transparency effects",
      defaultValue: [182, 255, 186],
      parser: (rgb) => rgbToString(rgb)
    }),
  },
  "Text Colors": {
    textPrimary: new ThemeStyleItem({
      title: "Primary Text",
      cssVariable: "--text-primary",
      type: "color",
      description: "Primary text color",
      defaultValue: [255, 255, 255],
      parser: (rgb) => rgbToHex(rgb)
    }),
    textSecondary: new ThemeStyleItem({
      title: "Secondary Text",
      cssVariable: "--text-secondary",
      type: "color",
      description: "Secondary text color for less important text",
      defaultValue: [225, 225, 225],
      parser: (rgb) => rgbToHex(rgb)
    }),
    textMuted: new ThemeStyleItem({
      title: "Muted Text",
      cssVariable: "--text-muted",
      type: "color",
      description: "Muted text color for disabled or subtle text",
      defaultValue: [167, 167, 167],
      parser: (rgb) => rgbToHex(rgb)
    }),
  },
  "Surface Colors": {
    surfaceBg: new ThemeStyleItem({
      title: "Surface Background",
      cssVariable: "--surface-bg",
      type: "color",
      description: "Background color for surfaces like cards and inputs",
      defaultValue: [255, 255, 255],
      parser: (rgb) => rgbToRgba(rgb, 0.05)
    }),
    surfaceBgHover: new ThemeStyleItem({
      title: "Surface Background Hover",
      cssVariable: "--surface-bg-hover",
      type: "color",
      description: "Background color for surfaces on hover",
      defaultValue: [255, 255, 255],
      parser: (rgb) => rgbToRgba(rgb, 0.08)
    }),
    surfaceBgActive: new ThemeStyleItem({
      title: "Surface Background Active",
      cssVariable: "--surface-bg-active",
      type: "color",
      description: "Background color for active surfaces",
      defaultValue: [255, 255, 255],
      parser: (rgb) => rgbToRgba(rgb, 0.12)
    }),
  },
  "Border Colors": {
    borderPrimary: new ThemeStyleItem({
      title: "Primary Border",
      cssVariable: "--border-primary",
      type: "color",
      description: "Primary border color",
      defaultValue: [182, 255, 186],
      parser: (rgb) => rgbToRgba(rgb, 0.15)
    }),
    borderSecondary: new ThemeStyleItem({
      title: "Secondary Border",
      cssVariable: "--border-secondary",
      type: "color",
      description: "Secondary border color",
      defaultValue: [255, 255, 255],
      parser: (rgb) => rgbToRgba(rgb, 0.1)
    }),
    borderFocus: new ThemeStyleItem({
      title: "Focus Border",
      cssVariable: "--border-focus",
      type: "color",
      description: "Border color for focused elements",
      defaultValue: [182, 255, 186],
      parser: (rgb) => rgbToHex(rgb)
    }),
  },
  "Status Colors": {
    successColor: new ThemeStyleItem({
      title: "Success Color",
      cssVariable: "--success-color",
      type: "color",
      description: "Color for success states",
      defaultValue: [74, 222, 128],
      parser: (rgb) => rgbToHex(rgb)
    }),
    warningColor: new ThemeStyleItem({
      title: "Warning Color",
      cssVariable: "--warning-color",
      type: "color",
      description: "Color for warning states",
      defaultValue: [251, 191, 36],
      parser: (rgb) => rgbToHex(rgb)
    }),
    errorColor: new ThemeStyleItem({
      title: "Error Color",
      cssVariable: "--error-color",
      type: "color",
      description: "Color for error states",
      defaultValue: [239, 68, 68],
      parser: (rgb) => rgbToHex(rgb)
    }),
    infoColor: new ThemeStyleItem({
      title: "Info Color",
      cssVariable: "--info-color",
      type: "color",
      description: "Color for info states",
      defaultValue: [59, 130, 246],
      parser: (rgb) => rgbToHex(rgb)
    }),
  },
  "Music Player": {
    playerProgress: new ThemeStyleItem({
      title: "Player Progress",
      cssVariable: "--player-progress",
      type: "color",
      description: "Color for music player progress indicators",
      defaultValue: [0, 255, 0],
      parser: (rgb) => rgbToRgba(rgb, 0.25)
    }),
    playerSelected: new ThemeStyleItem({
      title: "Player Selected",
      cssVariable: "--player-selected",
      type: "color",
      description: "Color for selected songs in the player",
      defaultValue: [255, 107, 53],
      parser: (rgb) => rgbToHex(rgb)
    }),
    playerPlaying: new ThemeStyleItem({
      title: "Player Playing",
      cssVariable: "--player-playing",
      type: "color",
      description: "Color for currently playing song indicator",
      defaultValue: [182, 255, 186],
      parser: (rgb) => rgbToHex(rgb)
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