namespace MathX {
  // Clamp a number between a minimum and maximum value.
  export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

export default MathX;