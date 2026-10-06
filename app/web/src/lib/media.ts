/**
 * Port of `lightning/mediaUtils` `processImage` as used by `c/propertyCarousel`: resize and
 * compress a picture on the client before it is uploaded (`FileUtilities.createFile` only
 * accepted request-sized base64 payloads).
 */
export interface ProcessImageOptions {
  resizeMode: 'fill' | 'fit' | 'none';
  /** `reduce` only shrinks, never upscales. */
  resizeStrategy: 'reduce' | 'always';
  targetWidth: number;
  targetHeight: number;
  /** 0..1, JPEG quality. */
  compressionQuality: number;
  imageSmoothingEnabled: boolean;
  preserveTransparency: boolean;
  backgroundColor: string;
}

export const CAROUSEL_IMAGE_OPTIONS: ProcessImageOptions = {
  resizeMode: 'fill',
  resizeStrategy: 'reduce',
  targetWidth: 500,
  targetHeight: 500,
  compressionQuality: 0.75,
  imageSmoothingEnabled: true,
  preserveTransparency: false,
  backgroundColor: 'white',
};

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode ${(file as File).name ?? 'image'}`));
    };
    image.src = url;
  });
}

function canvasSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return !!document.createElement('canvas').getContext?.('2d');
  } catch {
    return false;
  }
}

/**
 * Draws the picture onto a canvas of at most `targetWidth` x `targetHeight` (`fill`: cover and
 * crop; `fit`: letterbox on `backgroundColor`) and encodes it as JPEG (or PNG when transparency
 * is preserved). Non-image files and environments without canvas return the original blob.
 */
export async function processImage(file: Blob, options: ProcessImageOptions): Promise<Blob> {
  if (!file.type.startsWith('image/') || options.resizeMode === 'none' || !canvasSupported()) {
    return file;
  }
  const image = await loadImage(file);
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) return file;

  const fillScale = Math.max(options.targetWidth / width, options.targetHeight / height);
  const fitScale = Math.min(options.targetWidth / width, options.targetHeight / height);
  let scale = options.resizeMode === 'fill' ? fillScale : fitScale;
  if (options.resizeStrategy === 'reduce') scale = Math.min(scale, 1);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(
    options.resizeMode === 'fill' ? Math.min(options.targetWidth, width * scale) : width * scale,
  );
  canvas.height = Math.round(
    options.resizeMode === 'fill' ? Math.min(options.targetHeight, height * scale) : height * scale,
  );
  const context = canvas.getContext('2d');
  if (!context) return file;

  context.imageSmoothingEnabled = options.imageSmoothingEnabled;
  if (!options.preserveTransparency) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  context.drawImage(
    image,
    (canvas.width - drawWidth) / 2,
    (canvas.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  const type = options.preserveTransparency ? 'image/png' : 'image/jpeg';
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), type, options.compressionQuality);
  });
}

/** `reader.result.split(',')[1]`: the base64 payload of a blob without the data-URL prefix. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });
}
