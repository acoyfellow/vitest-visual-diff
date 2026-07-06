// Tier C — PIXEL (final 1:1 confirmation).
//
// Ported from @acoyfellow/visual-diff's src/pixels.js, generalized from PNG
// (Node/pngjs) buffers to plain {width,height,data:Uint8ClampedArray} RGBA
// frames — Vitest Browser Mode decodes screenshots via the browser's own
// <canvas>/ImageData (see decode-browser.js), not pngjs (which needs Buffer,
// unavailable in-page). pixelmatch itself is buffer-shape agnostic, so the
// diff algorithm and bbox/threshold logic are unchanged from the original.

import pixelmatch from 'pixelmatch';

/** Default flag threshold: fail when > this % of content-bbox pixels differ. */
export const PIXEL_FLAG_PCT = 1.0;

/**
 * Bounding box of non-white content across the given frames.
 * @param {Array<{data:Uint8ClampedArray}>} imgs
 * @param {number} w @param {number} h
 * @param {number} [pad] pixels of padding around the detected box
 */
export function contentBBox(imgs, w, h, pad = 2) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (const img of imgs) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (img.data[i] < 250 || img.data[i + 1] < 250 || img.data[i + 2] < 250) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h, empty: true };
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, empty: false };
}

/**
 * Tier C pixel diff.
 * @param {{width:number,height:number,data:Uint8ClampedArray}} baselineFrame
 * @param {{width:number,height:number,data:Uint8ClampedArray}} candidateFrame
 * @param {{threshold?:number, includeAA?:boolean, flagPct?:number, emitDiff?:boolean}} [opts]
 * @returns {{pass:boolean, pct:number, diffPx:number, bbox:string,
 *   emptyRender:boolean, diff:(Uint8ClampedArray|null), note?:string}}
 */
export function diffPixels(baselineFrame, candidateFrame, opts = {}) {
  const threshold = opts.threshold ?? 0.1;
  const includeAA = opts.includeAA ?? true;
  const flagPct = opts.flagPct ?? PIXEL_FLAG_PCT;
  const emitDiff = opts.emitDiff ?? true;

  const w = baselineFrame.width, h = baselineFrame.height;
  if (candidateFrame.width !== w || candidateFrame.height !== h) {
    return { pass: false, pct: 100, diffPx: -1, bbox: '0x0', emptyRender: false, diff: null, note: 'dimension mismatch' };
  }

  const diff = new Uint8ClampedArray(w * h * 4);
  const diffPx = pixelmatch(baselineFrame.data, candidateFrame.data, diff, w, h, { threshold, includeAA });
  const bbox = contentBBox([baselineFrame, candidateFrame], w, h);
  const area = bbox.w * bbox.h;
  const pct = +((diffPx / area) * 100).toFixed(3);

  return {
    pass: pct <= flagPct,
    pct,
    diffPx,
    bbox: `${bbox.w}x${bbox.h}`,
    emptyRender: bbox.empty,
    diff: emitDiff ? { width: w, height: h, data: diff } : null,
  };
}
