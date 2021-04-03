export default class JSONX {
  private constructor() { }
  public static getObjectValue<T = any>(object: object, key: string): T {
    // debugger;
    const parts = key.split(".");
    let dest: any = object;
    parts.forEach((keyPart, i) => {
      if (typeof dest === "undefined") {
        return;
      }
      if (typeof dest[keyPart] === "undefined") {
        return dest = dest[keyPart];
      }
      dest = dest[keyPart];
    });
    return dest;
  }
  
  public static setObjectValue<T = any>(object: object, key: string, value: T) {
    // debugger;
    const parts = key.split(".");
    let dest: any = object;
    parts.forEach((keyPart, i) => {
      if (i == parts.length - 1) {
        dest[keyPart] = value;
        return;
      }
      if (typeof dest[keyPart] === "undefined") {
        dest[keyPart] = {};
        dest = dest[keyPart];
      }
      dest = dest[keyPart];
    });
  }
}