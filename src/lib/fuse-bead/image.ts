export const isHeifFile = (file: File) =>
  /\.(?:heic|heif)$/i.test(file.name)
  || ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'].includes(file.type);

export const visibleContentSize = (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
) => {
  const maxAnalysisEdge = 1600;
  const scale = Math.min(1, maxAnalysisEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  const height = Math.max(1, Math.floor(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { width: sourceWidth, height: sourceHeight };

  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let hasTransparency = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha < 255) hasTransparency = true;
      if (alpha > 1) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!hasTransparency || maxX < minX || maxY < minY) {
    return { width: sourceWidth, height: sourceHeight };
  }
  return { width: maxX - minX + 1, height: maxY - minY + 1 };
};
