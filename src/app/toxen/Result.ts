export class Result<T = unknown> {
  constructor(success: boolean) {
    this.success = success;
  }
  readonly success: boolean;

  isSuccess(): this is Success<T> {
    return this.success === true;
  }
  
  isFailure(): this is Failure {
    return this.success === false;
  }
}

export class Success<T> extends Result {
  constructor(public data: T) {
    super(true);
  }
}

export class Failure extends Result {
  constructor(public message: string) {
    super(false);
  }
}