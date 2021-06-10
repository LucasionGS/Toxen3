import Path from "path";

export default class CrossPlatform {
  public static getAppDataPath() {
    if (process.platform === "win32") {
      return Path.resolve(process.env.APPDATA)
    }
    else if (process.platform == "darwin") {
      return Path.resolve(process.env.HOME, "Library/Preferences");
    }
    else {
      return Path.resolve(process.env.HOME, ".local/share");
    }
  }

  public static getToxenDataPath(): string;
  public static getToxenDataPath(relativeFile: string): string;
  public static getToxenDataPath(relativeFile?: string) {
    let args = [
      CrossPlatform.getAppDataPath(),
      ".toxenData3"
    ];

    relativeFile && args.push(relativeFile);

    return Path.resolve(...args);
  }
}