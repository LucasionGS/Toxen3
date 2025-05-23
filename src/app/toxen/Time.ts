export default class Time {
  constructor(ms: number = 0) {
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

  public static now() {
    let date = new Date(Date.now());
    let time = new Time(date.getMilliseconds());
    time.addSeconds(date.getSeconds());
    time.addMinutes(date.getMinutes());
    time.addHours(date.getHours());
    return time;
  }


  private milliseconds: number = 0;
  public getMilliseconds() { return this.milliseconds; }
  public addMilliseconds(increment: number = 1) {
    this.milliseconds += increment;
    while (this.milliseconds >= 1000) {
      this.milliseconds -= 1000;
      this.addSeconds(1);
    }
  }

  private seconds: number = 0;
  public getSeconds() { return this.seconds; }
  public addSeconds(increment: number = 1) {
    this.seconds += increment;
    while (this.seconds >= 60) {
      this.seconds -= 60;
      this.addMinutes(1);
    }
  }

  private minutes: number = 0;
  public getMinutes() { return this.minutes; }
  public addMinutes(increment: number = 1) {
    this.minutes += increment;
    while (this.minutes >= 60) {
      this.minutes -= 60;
      this.addHours(1);
    }
  }

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

  public toSeconds() {
    return this.toMillseconds() / 1000;
  }

  /**
   * 
   * @param format Format must be structured like "`hh?:mm:ss`". A question mark (?) after a placeholder means to only include it if it is over 0.
   */
  public toTimestamp(format?: string) {
    let order = this.fromFormat(format ?? "hh?:mm:ss");

    let orderStrings = order.map((o) => {
      return o !== null ? o.toString().padStart(2, "0") : null;
    });

    let endValue = "";
    for (let i = 0; i < orderStrings.length; i++) {
      const v = orderStrings[i];
      if (!v) {
        continue;
      }
      if (i === 3 && endValue.length > 0) {
        endValue += `.${(~~v).toString().padStart(3, "0")}`;
      }
      else if (endValue.length > 0) {
        endValue += `:${v}`;
      }
      else {
        endValue += v;
      }
    }
    // return orderStrings.join(":");
    return endValue;
  }

  public toTimestampLiteral() {
    let data = `${this.seconds} sec`;
    if (this.minutes) data = `${this.minutes} min, ${data}`;
    if (this.hours) data = `${this.hours} hours, ${data}`;
    return data;
  }

  private static splitSecondsAndMilliseconds(seconds: number) {
    let ms = seconds * 1000;
    let s = Math.floor(ms / 1000);
    ms -= s * 1000;
    return [s, ms];
  }

  public static fromTimestamp(timestamp: string, onError?: (error: string) => Time) {
    // Assume the timestamp is in the format `hh?:mm?:ss`
    if (!/^-?(\d+:)?(\d+:)?(\d+)(?:\.(\d+))?$/.test(timestamp)) {
      if (onError) {
        return onError("Invalid timestamp format");
      }
      throw `Unable to parse timestamp. Value was "${timestamp}"`;
    }
    let time = new Time();
    let isMinus = timestamp.startsWith("-");

    if (isMinus) { timestamp = timestamp.substring(1); }
    
    let parts = timestamp.split(":").reverse();
    const [s, ms] = Time.splitSecondsAndMilliseconds(parseFloat(parts[0]));
    time.addMilliseconds(ms || 0);
    time.addSeconds(s || 0);
    time.addMinutes(parseInt(parts[1]) || 0);
    time.addHours(parseInt(parts[2]) || 0);

    if (isMinus) {
      time.setNegative();
    }

    return time;
  }

  public setNegative() {
    this.hours *= -1;
    this.minutes *= -1;
    this.seconds *= -1;
    this.milliseconds *= -1;
  }

  public fromFormat(format: string = "hh?:mm:ss") {
    let order = format.toLowerCase().split(/[:.]/);

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

    // formatArray = formatArray.filter(o => o !== null);

    return formatArray;
  }

  public valueOf() {
    return this.toMillseconds();
  }

  public geaterThan(other: Time) {
    return this.toMillseconds() > other.toMillseconds();
  }

  public lessThan(other: Time) {
    return this.toMillseconds() < other.toMillseconds();
  }

  public equals(other: Time) {
    return this.toMillseconds() == other.toMillseconds();
  }

  public static readonly FORMATS = {
    STANDARD: "hh?:mm:ss",
    STANDARD_WITH_MS: "hh?:mm:ss.ms",
  };
}