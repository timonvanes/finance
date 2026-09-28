// Client-side document scanning for a photographed receipt: guess its edges,
// let the user fine-tune the four corners, then warp that quad flat into a
// straight rectangular crop. No external CV library — receipts are small,
// flat and usually near-rectangular, so a lightweight heuristic plus manual
// correction is enough, and keeps this dependency-free.

export interface Point {
  x: number;
  y: number;
}

const WORK_SIZE = 220; // downscale for the detection pass — only need a rough box

// Anything drawImage() accepts and that carries its own pixel dimensions —
// an <img>, a <video> frame, or an already-captured <canvas>.
export type ImageSource = CanvasImageSource;

// Guesses the receipt's four corners (in the source's own pixel space) by
// finding the bounding box of the brightest contiguous area against a darker
// background (the common case: a receipt on a table/counter). Falls back to
// an inset rectangle when nothing usable is found. Cheap enough to call
// several times a second on a live video frame.
export function detectCorners(source: ImageSource, w: number, h: number): [Point, Point, Point, Point] {
  const fallback = (): [Point, Point, Point, Point] => {
    const mx = w * 0.06;
    const my = h * 0.06;
    return [
      { x: mx, y: my },
      { x: w - mx, y: my },
      { x: w - mx, y: h - my },
      { x: mx, y: h - my },
    ];
  };
  if (!w || !h) return fallback();

  const scale = WORK_SIZE / Math.max(w, h);
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback();
  ctx.drawImage(source, 0, 0, sw, sh);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, sw, sh).data;
  } catch {
    return fallback(); // e.g. a tainted canvas — shouldn't happen for a local file, but don't crash the flow
  }

  const lum = new Float32Array(sw * sh);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lum[p] = l;
    sum += l;
  }
  const mean = sum / lum.length;
  let variance = 0;
  for (let p = 0; p < lum.length; p++) variance += (lum[p] - mean) ** 2;
  const std = Math.sqrt(variance / lum.length);
  const threshold = mean + std * 0.25; // paper is usually brighter than what it's sitting on

  let minX = sw,
    minY = sh,
    maxX = 0,
    maxY = 0,
    hits = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (lum[y * sw + x] >= threshold) {
        hits++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const area = (maxX - minX) * (maxY - minY);
  const totalArea = sw * sh;
  if (hits === 0 || area < totalArea * 0.15 || area > totalArea * 0.97) {
    return fallback();
  }

  const pad = 0.01; // a hair of margin so the detected edge isn't clipped
  const toFull = (x: number, y: number): Point => ({ x: (x / sw) * w, y: (y / sh) * h });
  const padX = (maxX - minX) * pad;
  const padY = (maxY - minY) * pad;
  return [
    toFull(minX - padX, minY - padY),
    toFull(maxX + padX, minY - padY),
    toFull(maxX + padX, maxY + padY),
    toFull(minX - padX, maxY + padY),
  ];
}

function clampPoint(p: Point, w: number, h: number): Point {
  return { x: Math.min(Math.max(p.x, 0), w), y: Math.min(Math.max(p.y, 0), h) };
}

export function clampCorners(corners: [Point, Point, Point, Point], w: number, h: number): [Point, Point, Point, Point] {
  return corners.map((p) => clampPoint(p, w, h)) as [Point, Point, Point, Point];
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Bilinear-sample `src` at a fractional pixel coordinate.
function sampleBilinear(src: ImageData, x: number, y: number, out: Uint8ClampedArray, outIdx: number) {
  const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(y)));
  const x1 = Math.min(src.width - 1, x0 + 1);
  const y1 = Math.min(src.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const d = src.data;
  const w = src.width;
  for (let c = 0; c < 4; c++) {
    const p00 = d[(y0 * w + x0) * 4 + c];
    const p10 = d[(y0 * w + x1) * 4 + c];
    const p01 = d[(y1 * w + x0) * 4 + c];
    const p11 = d[(y1 * w + x1) * 4 + c];
    const top = p00 + (p10 - p00) * fx;
    const bottom = p01 + (p11 - p01) * fx;
    out[outIdx + c] = top + (bottom - top) * fy;
  }
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Warps the quad [topLeft, topRight, bottomRight, bottomLeft] flat into a
// straight rectangle via inverse bilinear-patch sampling (not a full
// projective homography, but close enough for a phone photo's mild
// perspective, and far simpler than solving one). `source` is already a
// full-resolution still (a captured <canvas> or a loaded <img>), not a live
// video element — the caller grabs one frame before calling this.
export function warpToCanvas(
  source: ImageSource,
  sourceW: number,
  sourceH: number,
  corners: [Point, Point, Point, Point],
  maxLongSide = 2000
): HTMLCanvasElement {
  const [tl, tr, br, bl] = corners;
  const outW = Math.max(dist(tl, tr), dist(bl, br));
  const outH = Math.max(dist(tl, bl), dist(tr, br));
  const scale = Math.min(1, maxLongSide / Math.max(outW, outH, 1));
  const targetW = Math.max(1, Math.round(outW * scale));
  const targetH = Math.max(1, Math.round(outH * scale));

  const full = document.createElement("canvas");
  full.width = sourceW;
  full.height = sourceH;
  const fullCtx = full.getContext("2d")!;
  fullCtx.drawImage(source, 0, 0, sourceW, sourceH);
  const srcData = fullCtx.getImageData(0, 0, full.width, full.height);

  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const outCtx = out.getContext("2d")!;
  const outImg = outCtx.createImageData(targetW, targetH);

  for (let oy = 0; oy < targetH; oy++) {
    const v = targetH === 1 ? 0 : oy / (targetH - 1);
    const left = lerp(tl, bl, v);
    const right = lerp(tr, br, v);
    for (let ox = 0; ox < targetW; ox++) {
      const u = targetW === 1 ? 0 : ox / (targetW - 1);
      const p = lerp(left, right, u);
      sampleBilinear(srcData, p.x, p.y, outImg.data, (oy * targetW + ox) * 4);
      outImg.data[(oy * targetW + ox) * 4 + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);
  return out;
}

export function canvasToJpegFile(canvas: HTMLCanvasElement, name: string, quality = 0.92): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Kon de foto niet verwerken."));
        resolve(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      quality
    );
  });
}
