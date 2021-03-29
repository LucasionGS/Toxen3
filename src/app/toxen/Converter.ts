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
    while (s.length < size) {s = "0" + s;}
    return s;
  }
}
