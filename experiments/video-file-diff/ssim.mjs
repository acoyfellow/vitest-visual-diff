function grayscale(frame) {
  const gray = new Float64Array(frame.width * frame.height);
  for (let i = 0; i < gray.length; i++) {
    const offset = i * 4;
    gray[i] =
      0.299 * frame.data[offset] + 0.587 * frame.data[offset + 1] + 0.114 * frame.data[offset + 2];
  }
  return gray;
}

/** Global grayscale SSIM, adapted from visual-diff's E-PERCEPT spike. */
export function ssim(frameA, frameB) {
  if (frameA.width !== frameB.width || frameA.height !== frameB.height) return 0;

  const a = grayscale(frameA);
  const b = grayscale(frameB);
  const count = a.length;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < count; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= count;
  meanB /= count;

  let varianceA = 0;
  let varianceB = 0;
  let covariance = 0;
  for (let i = 0; i < count; i++) {
    const deltaA = a[i] - meanA;
    const deltaB = b[i] - meanB;
    varianceA += deltaA * deltaA;
    varianceB += deltaB * deltaB;
    covariance += deltaA * deltaB;
  }
  varianceA /= count;
  varianceB /= count;
  covariance /= count;

  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  return (
    ((2 * meanA * meanB + c1) * (2 * covariance + c2)) /
    ((meanA ** 2 + meanB ** 2 + c1) * (varianceA + varianceB + c2))
  );
}
