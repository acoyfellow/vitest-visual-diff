// Tier C — PIXEL (final rendered-output confirmation).
//
// Vitest Browser Mode decodes element screenshots through the browser's canvas
// into plain RGBA frames. Pixel differences are scored against the non-white
// content bounding box so empty viewport space cannot dilute a small defect.

import pixelmatch from 'pixelmatch';
import type { PixelFrame, PixelOptions } from './types.ts';

export const PIXEL_FLAG_PCT = 1;

export interface ContentBox {
  x: number;
  y: number;
  w: number;
  h: number;
  empty: boolean;
}

export interface PixelResult {
  pass: boolean;
  pct: number;
  diffPx: number;
  bbox: string;
  emptyRender: boolean;
  diff: PixelFrame | null;
  note?: string;
}

export function contentBBox(
  frames: Array<Pick<PixelFrame, 'data'>>,
  width: number,
  height: number,
  padding = 2,
): ContentBox {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (const frame of frames) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (frame.data[index] < 250 || frame.data[index + 1] < 250 || frame.data[index + 2] < 250) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
  }

  if (maxX < 0) return { x: 0, y: 0, w: width, h: height, empty: true };
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    empty: false,
  };
}

export function diffPixels(
  baseline: PixelFrame,
  candidate: PixelFrame,
  options: PixelOptions = {},
): PixelResult {
  const threshold = options.threshold ?? 0.1;
  const includeAA = options.includeAA ?? true;
  const flagPct = options.flagPct ?? PIXEL_FLAG_PCT;
  const emitDiff = options.emitDiff ?? true;
  const { width, height } = baseline;

  if (candidate.width !== width || candidate.height !== height) {
    return {
      pass: false,
      pct: 100,
      diffPx: -1,
      bbox: '0x0',
      emptyRender: false,
      diff: null,
      note: `dimension mismatch (${width}x${height} vs ${candidate.width}x${candidate.height})`,
    };
  }

  const diffData = new Uint8ClampedArray(width * height * 4);
  const diffPx = pixelmatch(baseline.data, candidate.data, diffData, width, height, {
    threshold,
    includeAA,
  });
  const contentBox = contentBBox([baseline, candidate], width, height);
  const pct = +((diffPx / (contentBox.w * contentBox.h)) * 100).toFixed(3);

  return {
    pass: pct <= flagPct,
    pct,
    diffPx,
    bbox: `${contentBox.w}x${contentBox.h}`,
    emptyRender: contentBox.empty,
    diff: emitDiff ? { width, height, data: diffData } : null,
  };
}
