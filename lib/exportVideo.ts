import { brand } from "./brand";
import { formatClock } from "./courseModel";
import { positionAt } from "./simulation";
import type {
  CoursePath,
  DistanceCourseConfig,
  Point2D,
  SimSwimmer,
} from "./types";

export type ExportVideoOptions = {
  paths: CoursePath[];
  courseByDistance: Record<string, DistanceCourseConfig>;
  roster: SimSwimmer[];
  /** distance → color */
  colorByDistance: Record<string, string>;
  backgroundImageUrl: string | null;
  /** Legend entries in display order */
  legend: Array<{ distance: string; color: string }>;
  windowStart: number;
  windowEnd: number;
  playbackSeconds: number;
  dotDiameterNorm: number;
  size?: number;
  fps?: number;
  onProgress?: (ratio: number, simMinutes: number) => void;
  signal?: AbortSignal;
};

export type ExportVideoResult = {
  blob: Blob;
  filename: string;
  mimeType: string;
};

type RecorderMime = { mimeType: string; extension: string };

function pickRecorderMime(): RecorderMime {
  const candidates: RecorderMime[] = [
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
    { mimeType: "video/mp4", extension: "mp4" },
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c.mimeType)
    ) {
      return c;
    }
  }
  return { mimeType: "", extension: "webm" };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load background image."));
    img.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(size / iw, size / ih);
  const w = iw * scale;
  const h = ih * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  const h = size;
  const w = size * 0.9;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx - w, cy + h * 0.55);
  ctx.lineTo(cx + w, cy + h * 0.55);
  ctx.closePath();
  ctx.fillStyle = brand.buoyOrange;
  ctx.fill();
  ctx.strokeStyle = brand.white;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
  size: number,
) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * size, points[0].y * size);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * size, points[i].y * size);
  }
  ctx.closePath();
  ctx.strokeStyle = brand.blue;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (const p of points) {
    drawTriangle(ctx, p.x * size, p.y * size, 14);
  }
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  legend: Array<{ distance: string; color: string }>,
  size: number,
) {
  if (legend.length === 0) return;
  const pad = 16;
  const rowH = 22;
  const box = 12;
  ctx.font = "600 14px Barlow, Segoe UI, sans-serif";
  let maxLabel = 0;
  for (const item of legend) {
    maxLabel = Math.max(maxLabel, ctx.measureText(item.distance).width);
  }
  const panelW = pad * 2 + box + 8 + maxLabel;
  const panelH = pad + legend.length * rowH + 4;
  const x0 = size - panelW - 12;
  const y0 = size - panelH - 12;

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = brand.border;
  ctx.lineWidth = 1;
  ctx.fillRect(x0, y0, panelW, panelH);
  ctx.strokeRect(x0, y0, panelW, panelH);

  legend.forEach((item, i) => {
    const y = y0 + pad + i * rowH;
    ctx.fillStyle = item.color;
    ctx.fillRect(x0 + pad, y, box, box);
    ctx.fillStyle = brand.navyText;
    ctx.fillText(item.distance, x0 + pad + box + 8, y + box - 1);
  });
}

function drawClock(ctx: CanvasRenderingContext2D, label: string, size: number) {
  ctx.font = "700 22px Barlow Condensed, Barlow, sans-serif";
  const metrics = ctx.measureText(label);
  const padX = 10;
  const padY = 8;
  const w = metrics.width + padX * 2;
  const h = 28 + padY;
  const x = size - w - 14;
  const y = 14;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.strokeStyle = brand.border;
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = brand.navyText;
  ctx.fillText(label, x + padX, y + h - padY - 2);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function canExportVideo(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/**
 * Render the simulation to a video blob via MediaRecorder + canvas.captureStream.
 * Duration matches playbackSeconds at the given fps. Browser typically yields WebM
 * (Chrome/Firefox) or MP4 (some Safari builds) — not QuickTime .mov.
 */
export async function exportSimulationVideo(
  options: ExportVideoOptions,
): Promise<ExportVideoResult> {
  if (!canExportVideo()) {
    throw new Error("Video export is not supported in this browser.");
  }

  const {
    paths,
    courseByDistance,
    roster,
    colorByDistance,
    backgroundImageUrl,
    legend,
    windowStart,
    windowEnd,
    playbackSeconds,
    dotDiameterNorm,
    size = 1080,
    fps = 30,
    onProgress,
    signal,
  } = options;

  const mime = pickRecorderMime();
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");

  let bgImage: HTMLImageElement | null = null;
  if (backgroundImageUrl) {
    bgImage = await loadImage(backgroundImageUrl);
  }

  const pathMap = new Map(paths.map((p) => [p.id, p]));
  const frameCount = Math.max(1, Math.round(playbackSeconds * fps));
  const span = windowEnd - windowStart;

  const stream = canvas.captureStream(0);
  const chunks: BlobPart[] = [];
  const recorder = mime.mimeType
    ? new MediaRecorder(stream, {
        mimeType: mime.mimeType,
        videoBitsPerSecond: 8_000_000,
      })
    : new MediaRecorder(stream, { videoBitsPerSecond: 8_000_000 });

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error("MediaRecorder failed."));
    recorder.onstop = () => {
      const type = recorder.mimeType || mime.mimeType || "video/webm";
      resolve(new Blob(chunks, { type }));
    };
  });

  recorder.start(100);

  const frameMs = 1000 / fps;
  const videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void;
  };
  const supportsRequestFrame = typeof videoTrack.requestFrame === "function";

  try {
    for (let i = 0; i <= frameCount; i++) {
      if (signal?.aborted) {
        throw new DOMException("Export cancelled", "AbortError");
      }

      const ratio = i / frameCount;
      const t = windowStart + ratio * span;

      // Background
      if (bgImage) {
        drawCover(ctx, bgImage, size);
      } else {
        ctx.fillStyle = brand.canvasWater;
        ctx.fillRect(0, 0, size, size);
      }

      for (const path of paths) {
        drawPath(ctx, path.points, size);
      }

      const r = Math.max(2, (dotDiameterNorm * size) / 2);
      for (const s of roster) {
        const course = courseByDistance[s.distance];
        if (!course) continue;
        const path = pathMap.get(course.pathId);
        if (!path) continue;
        const pos = positionAt(
          t,
          s,
          path,
          course.laps,
          course.lapLengthFeet,
        );
        if (!pos) continue;
        ctx.beginPath();
        ctx.arc(pos.x * size, pos.y * size, r, 0, Math.PI * 2);
        ctx.fillStyle = colorByDistance[s.distance] ?? brand.blue;
        ctx.globalAlpha = 0.82;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      drawClock(ctx, formatClock(t), size);
      drawLegend(ctx, legend, size);

      onProgress?.(ratio, t);

      if (supportsRequestFrame) {
        videoTrack.requestFrame!();
        await sleep(4);
      } else {
        await sleep(frameMs);
      }
    }
  } catch (err) {
    if (recorder.state !== "inactive") recorder.stop();
    stream.getTracks().forEach((tr) => tr.stop());
    throw err;
  }

  // Let the last frame settle
  await sleep(120);
  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());

  const blob = await stopped;
  const ext =
    blob.type.includes("mp4") ? "mp4" : mime.extension || "webm";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return {
    blob,
    filename: `swim-congestion-${stamp}.${ext}`,
    mimeType: blob.type,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
