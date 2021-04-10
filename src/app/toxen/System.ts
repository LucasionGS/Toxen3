import fsp from "fs/promises";
import { Dirent } from "fs";
import Path from "path";

export default class System {
  public static async recursive(path: string): Promise<Dirent[]>;
  public static async recursive(path: string, orgPath: string): Promise<Dirent[]>;
  public static async recursive(path: string, orgPath: string = path) {
    let files = await fsp.readdir(path, { withFileTypes: true });
    let newFiles: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let newPath = Path.resolve(path, file.name);
      file.name = Path.relative(orgPath, newPath);

      if (file.isDirectory()) {
        let newFiles = await System.recursive(newPath, orgPath)
        files.push(...newFiles);
      }
    }
    
    return files;
  }

  public static async handleDroppedFiles(files: FileList | File[]) {
    Promise.resolve().then(() => {
      if (files instanceof FileList) files = [...files];
      files
    });
  }
}