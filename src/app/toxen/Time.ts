import Converter from "./Converter";

export default class Time {
  constructor(ms: number) {
    this.milliseconds = ms;
    while (this.milliseconds >= 1000) {
      this.milliseconds -= 1000;
      this.seconds += 1;
    }
    while (this.seconds >= 60) {
      this.seconds -= 60;
      this.minutes += 1;
    }
    while (this.minutes >= 60) {
      this.minutes -= 60;
      this.hours += 1;
    }
  }

  
  private milliseconds: number = 0;
  public getMilliseconds() { return this.milliseconds; }
  public addMilliseconds(increment: number = 1) { this.milliseconds += increment; }
  
  private seconds: number = 0;
  public getSeconds() { return this.seconds; }
  public addSeconds(increment: number = 1) { this.seconds += increment; }
  
  private minutes: number = 0;
  public getMinutes() { return this.minutes; }
  public addMinutes(increment: number = 1) { this.minutes += increment; }
  
  private hours: number = 0;
  public getHours() { return this.hours; }
  public addHours(increment: number = 1) { this.hours += increment; }

  public toMillseconds() {
    let ms = this.milliseconds;
    ms += this.seconds * 1000;
    ms += this.minutes * 1000 * 60;
    ms += this.hours * 1000 * 60 * 60;

    return ms;
  }
  
  /**
   * 
   * @param format Format must be structured like "`hh?:mm:ss`". A question mark (?) after a placeholder means to only include it if it is over 0.
   */
  public toTimestamp(format?: string) {
    let order = this.fromFormat(format ?? "hh?:mm:ss");

    let orderStrings = order.map((o) => {
      return Converter.padNumber(o, 2);
    });

    return orderStrings.join(":");
  }

  public toTimestampLiteral() {
    
  }

  public fromFormat(format: string) {
    let order = format.toLowerCase().split(":");
    
    let optionalExpired = false;
    let formatArray: number[] = order.map(o => {
      let optional = o.endsWith("?");
      if (optional) o = o.substring(0, o.length - 1);
      let value: number = null;

      switch (o) {
        case "hh":
          value = this.hours;
          break;
        case "mm":
          value = this.minutes;
          break;
        case "ss":
          value = this.seconds;
          break;
        case "ms":
          value = this.milliseconds;
          break;
      
        default:
          throw `Unable to parse format. Value was "${o}"`;
      }
      
      if (optional && !optionalExpired && value == 0) { return null; }
      optionalExpired = true;
      return value;
    });

    formatArray = formatArray.filter(o => o !== null);
    
    return formatArray;
  }
}