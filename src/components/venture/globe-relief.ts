import type { GeoProjection } from "d3-geo";

type ReliefTextureLevel = Readonly<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}>;

type ReliefTexture = Readonly<{
  levels: readonly ReliefTextureLevel[];
}>;

export type GlobeReliefRenderer = Readonly<{
  /**
   * Queue a terrain frame and report whether the texture is ready to drive the
   * corresponding vector frame. While it loads (or if it fails), callers can
   * continue drawing their vector fallback directly.
   */
  requestDraw: (projection: GeoProjection, immediate?: boolean) => boolean;
  destroy: () => void;
}>;

type GlobeReliefRendererOptions = Readonly<{
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  textureUrl?: string;
  renderScale?: number;
  opacity?: number;
  fadeStartScale?: number;
  fadeEndScale?: number;
  minimumFrameInterval?: number;
  /** Runs synchronously after the terrain pixels for this projection are committed. */
  onFrame?: (projection: GeoProjection) => void;
}>;

const defaultTextureUrl = "/maps/natural-earth-shaded-relief.webp";
const texturePromises = new Map<string, Promise<ReliefTexture>>();

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function loadTexture(textureUrl: string): Promise<ReliefTexture> {
  const cachedTexture = texturePromises.get(textureUrl);
  if (cachedTexture) return cachedTexture;

  const texturePromise = new Promise<ReliefTexture>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = image.naturalWidth;
      textureCanvas.height = image.naturalHeight;
      const textureContext = textureCanvas.getContext("2d", { willReadFrequently: true });
      if (!textureContext) {
        reject(new Error("Unable to prepare the globe relief texture."));
        return;
      }

      textureContext.drawImage(image, 0, 0);

      // Keep successively prefiltered copies of the equirectangular texture.
      // At the resting globe scale, a single output pixel covers several
      // source texels. Sampling the full-size image directly makes those fine
      // terrain details appear and disappear between small rotations. A mip
      // level close to the projected resolution removes that temporal aliasing
      // without blurring the relief once the user zooms in.
      const levels: ReliefTextureLevel[] = [];
      let levelCanvas = textureCanvas;
      let levelContext = textureContext;

      while (true) {
        const levelData = levelContext.getImageData(
          0,
          0,
          levelCanvas.width,
          levelCanvas.height,
        );
        levels.push({
          data: levelData.data,
          width: levelData.width,
          height: levelData.height,
        });

        if (levelCanvas.width <= 32 || levelCanvas.height <= 16) break;

        const nextCanvas = document.createElement("canvas");
        nextCanvas.width = Math.max(1, Math.round(levelCanvas.width / 2));
        nextCanvas.height = Math.max(1, Math.round(levelCanvas.height / 2));
        const nextContext = nextCanvas.getContext("2d", { willReadFrequently: true });
        if (!nextContext) break;

        nextContext.imageSmoothingEnabled = true;
        nextContext.imageSmoothingQuality = "high";
        nextContext.drawImage(levelCanvas, 0, 0, nextCanvas.width, nextCanvas.height);
        levelCanvas = nextCanvas;
        levelContext = nextContext;
      }

      resolve({ levels });
    };
    image.onerror = () => reject(new Error("Unable to load the globe relief texture."));
    image.src = textureUrl;
  }).catch((error) => {
    texturePromises.delete(textureUrl);
    throw error;
  });

  texturePromises.set(textureUrl, texturePromise);
  return texturePromise;
}

export function createGlobeReliefRenderer({
  canvas,
  width,
  height,
  textureUrl = defaultTextureUrl,
  renderScale = 0.5,
  opacity = 0.72,
  fadeStartScale = Number.POSITIVE_INFINITY,
  fadeEndScale = Number.POSITIVE_INFINITY,
  minimumFrameInterval = 34,
  onFrame,
}: GlobeReliefRendererOptions): GlobeReliefRenderer {
  const outputWidth = Math.max(1, Math.round(width * renderScale));
  const outputHeight = Math.max(1, Math.round(height * renderScale));
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    return {
      requestDraw: () => false,
      destroy: () => undefined,
    };
  }

  const outputImage = context.createImageData(outputWidth, outputHeight);
  const outputData = outputImage.data;
  const logicalPixelWidth = width / outputWidth;
  const logicalPixelHeight = height / outputHeight;
  let texture: ReliefTexture | null = null;
  let latestProjection: GeoProjection | null = null;
  let timeoutId: number | null = null;
  let animationFrameId: number | null = null;
  let lastRenderTime = Number.NEGATIVE_INFINITY;
  let disposed = false;

  const reliefOpacity = (projectionScale: number) => {
    if (projectionScale <= fadeStartScale || fadeEndScale <= fadeStartScale) {
      return opacity;
    }
    if (projectionScale >= fadeEndScale) return 0;
    return opacity * (1 - (projectionScale - fadeStartScale) / (fadeEndScale - fadeStartScale));
  };

  const selectTextureLevel = (loadedTexture: ReliefTexture, projectionScale: number) => {
    const baseLevel = loadedTexture.levels[0];
    const averageProjectedPixelsPerRadian = (
      outputDimension: number,
      logicalPixelSize: number,
    ) => {
      const projectedRadius = projectionScale / logicalPixelSize;
      const coveredPixels = Math.min(outputDimension, projectedRadius * 2);
      const angularSpan = 2 * Math.asin(Math.min(1, outputDimension / (projectedRadius * 2)));
      return coveredPixels / angularSpan;
    };
    const projectedPixelsPerRadian = Math.min(
      averageProjectedPixelsPerRadian(outputWidth, logicalPixelWidth),
      averageProjectedPixelsPerRadian(outputHeight, logicalPixelHeight),
    );
    const sourcePixelsPerRadian = baseLevel.width / (Math.PI * 2);
    const sourceToOutputRatio = sourcePixelsPerRadian / projectedPixelsPerRadian;
    const idealLevel = Math.max(0, Math.round(Math.log2(Math.max(1, sourceToOutputRatio))));
    return loadedTexture.levels[Math.min(loadedTexture.levels.length - 1, idealLevel)];
  };

  const render = () => {
    animationFrameId = null;
    timeoutId = null;
    if (disposed || !texture || !latestProjection) return;

    const projection = latestProjection;
    const projectionScale = projection.scale();
    const nextOpacity = reliefOpacity(projectionScale);
    const textureLevel = selectTextureLevel(texture, projectionScale);
    outputData.fill(0);

    if (nextOpacity > 0) {
      const [centerX, centerY] = projection.translate();
      const minimumX = clamp(
        Math.floor((centerX - projectionScale) / logicalPixelWidth),
        0,
        outputWidth - 1,
      );
      const maximumX = clamp(
        Math.ceil((centerX + projectionScale) / logicalPixelWidth),
        0,
        outputWidth - 1,
      );
      const minimumY = clamp(
        Math.floor((centerY - projectionScale) / logicalPixelHeight),
        0,
        outputHeight - 1,
      );
      const maximumY = clamp(
        Math.ceil((centerY + projectionScale) / logicalPixelHeight),
        0,
        outputHeight - 1,
      );
      const sphereRadiusSquared = projectionScale * projectionScale;

      for (let outputY = minimumY; outputY <= maximumY; outputY += 1) {
        const logicalY = (outputY + 0.5) * logicalPixelHeight;
        const distanceY = logicalY - centerY;

        for (let outputX = minimumX; outputX <= maximumX; outputX += 1) {
          const logicalX = (outputX + 0.5) * logicalPixelWidth;
          const distanceX = logicalX - centerX;
          if (distanceX * distanceX + distanceY * distanceY > sphereRadiusSquared) continue;

          const coordinates = projection.invert?.([logicalX, logicalY]);
          if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) {
            continue;
          }

          const wrappedLongitude = ((coordinates[0] + 180) % 360 + 360) % 360;
          // Bilinear sampling complements the prefiltered level: terrain moves
          // continuously between texels instead of snapping at their edges.
          const sourceX = (wrappedLongitude / 360) * textureLevel.width - 0.5;
          const boundedSourceY = clamp(
            ((90 - coordinates[1]) / 180) * textureLevel.height - 0.5,
            0,
            textureLevel.height - 1,
          );
          const sourceXFloor = Math.floor(sourceX);
          const sourceYFloor = Math.floor(boundedSourceY);
          const sourceXMix = sourceX - sourceXFloor;
          const sourceYMix = boundedSourceY - sourceYFloor;
          const sourceX0 =
            ((sourceXFloor % textureLevel.width) + textureLevel.width) % textureLevel.width;
          const sourceX1 = (sourceX0 + 1) % textureLevel.width;
          const sourceY0 = sourceYFloor;
          const sourceY1 = Math.min(textureLevel.height - 1, sourceY0 + 1);
          const sourceIndex00 = (sourceY0 * textureLevel.width + sourceX0) * 4;
          const sourceIndex10 = (sourceY0 * textureLevel.width + sourceX1) * 4;
          const sourceIndex01 = (sourceY1 * textureLevel.width + sourceX0) * 4;
          const sourceIndex11 = (sourceY1 * textureLevel.width + sourceX1) * 4;
          const topAlpha =
            textureLevel.data[sourceIndex00 + 3] * (1 - sourceXMix) +
            textureLevel.data[sourceIndex10 + 3] * sourceXMix;
          const bottomAlpha =
            textureLevel.data[sourceIndex01 + 3] * (1 - sourceXMix) +
            textureLevel.data[sourceIndex11 + 3] * sourceXMix;
          const sourceAlpha = topAlpha * (1 - sourceYMix) + bottomAlpha * sourceYMix;
          if (sourceAlpha === 0) continue;

          const outputIndex = (outputY * outputWidth + outputX) * 4;
          for (let channel = 0; channel < 3; channel += 1) {
            const top =
              textureLevel.data[sourceIndex00 + channel] * (1 - sourceXMix) +
              textureLevel.data[sourceIndex10 + channel] * sourceXMix;
            const bottom =
              textureLevel.data[sourceIndex01 + channel] * (1 - sourceXMix) +
              textureLevel.data[sourceIndex11 + channel] * sourceXMix;
            outputData[outputIndex + channel] = Math.round(
              top * (1 - sourceYMix) + bottom * sourceYMix,
            );
          }
          outputData[outputIndex + 3] = Math.round(sourceAlpha * nextOpacity);
        }
      }
    }

    context.putImageData(outputImage, 0, 0);
    lastRenderTime = performance.now();
    // Keep the SVG boundaries, highlighted countries, and markers on the exact
    // projection frame used above. Updating them from the animation timer would
    // let the vector layer advance between the more expensive raster frames,
    // which reads as terrain/boundary flicker while the globe spins.
    onFrame?.(projection);
  };

  const scheduleRender = (immediate: boolean) => {
    if (disposed || !texture || !latestProjection) return;

    if (immediate) {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (animationFrameId === null) animationFrameId = window.requestAnimationFrame(render);
      return;
    }

    if (timeoutId !== null || animationFrameId !== null) return;
    const delay = Math.max(0, minimumFrameInterval - (performance.now() - lastRenderTime));
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      animationFrameId = window.requestAnimationFrame(render);
    }, delay);
  };

  loadTexture(textureUrl)
    .then((loadedTexture) => {
      if (disposed) return;
      texture = loadedTexture;
      scheduleRender(true);
    })
    .catch(() => {
      // The vector globe remains fully usable when its decorative relief cannot load.
    });

  return {
    requestDraw: (projection, immediate = false) => {
      latestProjection = projection;
      scheduleRender(immediate);
      return texture !== null;
    },
    destroy: () => {
      disposed = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
      context.clearRect(0, 0, outputWidth, outputHeight);
      latestProjection = null;
      texture = null;
    },
  };
}
