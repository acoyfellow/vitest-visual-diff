# Real video-file frame diff

This isolated experiment compares two **actual WebM/MP4 video files** by decoding
them to ordered RGBA frames, then applying two image-only checks to every aligned
frame:

1. `pixelmatch` produces an exact-ish pixel-difference ratio and a visual diff
   heatmap.
2. A grayscale SSIM score supplies a perceptual signal.

It reports the first frame that fails either configured threshold. Following the
sequencing behavior of `visual-diff/src/temporal.js`, missing/extra frames are a
fail-closed `frame-count-mismatch`, not silently truncated.

## Honest capability boundary

Raw video contains pixels, timestamps, and codec data; it has **no DOM**. This
experiment therefore proves only pixel and perceptual similarity. It makes no
structure, computed-style, semantic, accessibility, or reference-identity
claims. That is intentional graceful degradation for recordings: the two tiers
that have real evidence run, and unsupported tiers are not faked.

The SSIM implementation is adapted from the global grayscale scorer in
`visual-diff/experiments/E-PERCEPT/src/ssim.mjs`. It is useful as a perceptual
signal, but it is not a full multi-scale/video-aware metric.

## Requirements and reproduction

`ffmpeg` and `ffprobe` must be on `PATH`; decoding real MP4/WebM files is never
simulated. Check with:

```sh
which ffmpeg ffprobe
```

If they are unavailable, `frame-extractor.mjs` fails clearly. A truthful
fallback for environments without ffmpeg is to generate or retain ordered raw
frame PNGs and run an image-sequence comparator; that would not decode a video,
so this experiment does not label it as a successful video-file result. The
sample generator also fails clearly rather than inventing an output.

From the repository root:

```sh
bun install --frozen-lockfile
node experiments/video-file-diff/spike.mjs
```

`generate-samples.mjs` uses ffmpeg to create two real, lossless, all-keyframe VP9
WebM files at 96x64 and 10 fps. Both have 20 frames. The changed file adds a box
starting at frame 10. Lossless all-keyframe encoding keeps earlier frames
independent and deterministic.

The public experiment API is:

```js
import { diffVideo } from './diff-video.mjs';

const result = await diffVideo('baseline.webm', 'candidate.webm', {
  maxPixelDiffRatio: 0,
  minSsim: 0.995,
  pixelThreshold: 0.1,
  heatmapPath: './first-divergence.png',
});
```

It returns:

```js
{
  pass,
  firstDivergence, // -1 on pass
  frames: [{ frame, pixelDiffRatio, ssim, pass }],
  heatmapPathForFirstDivergence,
}
```

On a frame-count mismatch, unpaired frame records also contain
`reason: "frame-count-mismatch"`, with null pixel/SSIM values because no pair
exists to score.

## Real end-to-end receipt

Captured by actually running the command above on 2026-07-08:

```json
{
  "experiment": "video-file-diff",
  "inputs": {
    "baseline": "artifacts/baseline.webm",
    "changed": "artifacts/changed-at-frame-10.webm",
    "decodedFramesEach": [
      20,
      20
    ],
    "expectedFirstDivergence": 10
  },
  "identical": {
    "pass": true,
    "firstDivergence": -1
  },
  "changed": {
    "pass": false,
    "firstDivergence": 10,
    "divergentFrame": {
      "frame": 10,
      "pixelDiffRatio": 0.05273438,
      "ssim": 0.88712729,
      "pass": false
    },
    "heatmapPath": "artifacts/first-divergence.png",
    "heatmapBytes": 217
  },
  "assertions": {
    "identicalVideosPass": true,
    "changedVideoFlagged": true,
    "firstDivergenceIsExpected": true,
    "realHeatmapPngWritten": true
  },
  "pass": true
}
```

Generated evidence is retained under `artifacts/`: the two WebM inputs and the
PNG heatmap for frame 10.

## What is not proven yet

- Variable-frame-rate alignment by presentation timestamp; this spike compares
  decoder output by ordered frame index.
- Audio comparison, metadata comparison, seeking, or streaming large files.
- Cross-codec tolerance calibration. Defaults are deliberately strict on pixels
  (`maxPixelDiffRatio: 0`) and may flag benign codec differences.
- Local/windowed or multi-scale SSIM, temporal perceptual metrics, and masking.
- DOM/style/semantic/accessibility equivalence (impossible to infer from raw
  video pixels alone).
- Production hardening against hostile media files, resource limits, or ffmpeg
  sandboxing.
