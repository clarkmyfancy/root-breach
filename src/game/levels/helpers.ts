import type { Point } from '../models/types';

export function horizontalPath(y: number, startX: number, endX: number): Point[] {
  const path: Point[] = [];
  const step = startX <= endX ? 1 : -1;
  for (let x = startX; step > 0 ? x <= endX : x >= endX; x += step) {
    path.push({ x, y });
  }
  return path;
}
