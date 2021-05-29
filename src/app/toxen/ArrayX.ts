export default class ArrayX<T> extends Array<T> {
  // constructor(arrayLength?: number);
  // constructor(arrayLength: number);
  // constructor(...items: T[]);
  // constructor() {
  //   super();
  // }

  /**
   * Remove the elements from the array that the filter finds and returns it in a new array.
   */
  public split<T2 extends T>(filter: (value: T, index: number, array: T[]) => value is T2) {
    let arr: T2[] = [];
    for (let i = 0; i < this.length; i++) {
      const item = this[i];
      if (filter(item, i, this)) {
        arr.push(item);
        this.splice(i, 1);
        i--;
      }
    }
    return arr;
  }
}