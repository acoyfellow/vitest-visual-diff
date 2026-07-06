// Decode a base64 PNG screenshot returned by Vitest into a plain RGBA frame
// through the browser's canvas. No Node Buffer or PNG runtime is needed.

import type { PixelFrame } from './types.ts';

export function decodePngBase64(base64: string): Promise<PixelFrame> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('vitest-visual-diff: browser did not provide a 2D canvas context'));
        return;
      }
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ width: canvas.width, height: canvas.height, data: imageData.data });
    };
    image.onerror = () => {
      reject(new Error('vitest-visual-diff: failed to decode screenshot PNG'));
    };
    image.src = `data:image/png;base64,${base64}`;
  });
}
