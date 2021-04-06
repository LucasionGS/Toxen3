export default class Debug {
  public static async wait(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }
}