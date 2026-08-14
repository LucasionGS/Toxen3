/**
 * Reusable scratch buffers for styles that build a point list every frame.
 *
 * Float64 rather than Float32 so coordinates keep the precision they had as plain numbers.
 */
export function ensureScratch(current: Float64Array, size: number): Float64Array {
  return current && current.length >= size ? current : new Float64Array(size);
}
