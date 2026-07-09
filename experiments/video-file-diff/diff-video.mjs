import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { extractFrames } from './frame-extractor.mjs';
import { writeRgbaPng } from './png.mjs';
import { ssim } from './ssim.mjs';

/**
 * Decode and compare videos frame-by-frame. A frame passes only when both its
 * pixel ratio and SSIM satisfy their thresholds. Count mismatches fail closed.
 */
export async function diffVideo(pathA, pathB, opts = {}) {
  const {
    maxPixelDiffRatio = 0,
    minSsim = 0.995,
    pixelThreshold = 0.1,
    includeAA = false,
    heatmapPath = resolve('artifacts', 'first-divergence.png'),
    ffmpeg,
    ffprobe,
  } = opts;

  const [a, b] = await Promise.all([
    extractFrames(pathA, { ffmpeg, ffprobe }),
    extractFrames(pathB, { ffmpeg, ffprobe }),
  ]);
  const frames = [];
  let firstDivergence = -1;
  let firstHeatmap = null;
  const count = Math.max(a.length, b.length);

  for (let frame = 0; frame < count; frame++) {
    const frameA = a[frame];
    const frameB = b[frame];
    if (!frameA || !frameB) {
      frames.push({
        frame,
        pixelDiffRatio: null,
        ssim: null,
        pass: false,
        reason: 'frame-count-mismatch',
      });
      if (firstDivergence < 0) firstDivergence = frame;
      continue;
    }
    if (frameA.width !== frameB.width || frameA.height !== frameB.height) {
      frames.push({
        frame,
        pixelDiffRatio: null,
        ssim: 0,
        pass: false,
        reason: 'frame-dimension-mismatch',
      });
      if (firstDivergence < 0) firstDivergence = frame;
      continue;
    }

    const heatmap = new Uint8Array(frameA.data.length);
    const differingPixels = pixelmatch(
      frameA.data,
      frameB.data,
      heatmap,
      frameA.width,
      frameA.height,
      { threshold: pixelThreshold, includeAA },
    );
    const pixelDiffRatio = differingPixels / (frameA.width * frameA.height);
    const frameSsim = ssim(frameA, frameB);
    const pass = pixelDiffRatio <= maxPixelDiffRatio && frameSsim >= minSsim;
    frames.push({
      frame,
      pixelDiffRatio: Number(pixelDiffRatio.toFixed(8)),
      ssim: Number(frameSsim.toFixed(8)),
      pass,
    });

    if (!pass && firstDivergence < 0) {
      firstDivergence = frame;
      await mkdir(dirname(heatmapPath), { recursive: true });
      await writeRgbaPng(heatmapPath, frameA.width, frameA.height, heatmap);
      firstHeatmap = heatmapPath;
    }
  }

  return {
    pass: firstDivergence < 0,
    firstDivergence,
    frames,
    heatmapPathForFirstDivergence: firstHeatmap,
  };
}
