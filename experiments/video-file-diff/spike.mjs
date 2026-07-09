import { readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffVideo } from './diff-video.mjs';
import { generateSamples } from './generate-samples.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { baseline, changed, expectedFirstDivergence } = await generateSamples();
const heatmap = resolve(here, 'artifacts', 'first-divergence.png');

const identical = await diffVideo(baseline, baseline, { heatmapPath: heatmap });
const divergent = await diffVideo(baseline, changed, { heatmapPath: heatmap });
const heatmapBytes = await readFile(heatmap);
const heatmapStat = await stat(heatmap);
const isPng = heatmapBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

const assertions = {
  identicalVideosPass: identical.pass && identical.firstDivergence === -1,
  changedVideoFlagged: !divergent.pass,
  firstDivergenceIsExpected: divergent.firstDivergence === expectedFirstDivergence,
  realHeatmapPngWritten: isPng && heatmapStat.size > 8,
};
const receipt = {
  experiment: 'video-file-diff',
  inputs: {
    baseline: relative(here, baseline),
    changed: relative(here, changed),
    decodedFramesEach: [identical.frames.length, divergent.frames.length],
    expectedFirstDivergence,
  },
  identical: {
    pass: identical.pass,
    firstDivergence: identical.firstDivergence,
  },
  changed: {
    pass: divergent.pass,
    firstDivergence: divergent.firstDivergence,
    divergentFrame: divergent.frames[divergent.firstDivergence],
    heatmapPath: relative(here, divergent.heatmapPathForFirstDivergence),
    heatmapBytes: heatmapStat.size,
  },
  assertions,
  pass: Object.values(assertions).every(Boolean),
};
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.pass) process.exitCode = 1;
