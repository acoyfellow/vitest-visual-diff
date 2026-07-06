// Decode a base64 PNG screenshot (as returned by Vitest's `page.screenshot({base64:true})`
// or `locator.screenshot({base64:true})`) into a plain RGBA pixel buffer via the
// browser's own <canvas> — no pngjs/Buffer needed in-page.

/**
 * @param {string} base64  raw base64 (no `data:image/png;base64,` prefix)
 * @returns {Promise<{width:number, height:number, data:Uint8ClampedArray}>}
 */
export function decodePngBase64(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ width: canvas.width, height: canvas.height, data: imageData.data });
    };
    img.onerror = (e) => reject(new Error(`diffgate: failed to decode screenshot PNG: ${e?.message || e}`));
    img.src = `data:image/png;base64,${base64}`;
  });
}
