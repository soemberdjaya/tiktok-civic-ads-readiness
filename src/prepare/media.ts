export const MAX_SLIDES = 10;
export const IMAGE_LONG_SIDE = 1568;
export const MAX_VIDEO_SECONDS = 60;
export const FRAME_LONG_SIDE = 768;
/** Max size of a video file sent whole to providers that read video natively. */
export const MAX_NATIVE_VIDEO_BYTES = 18 * 1024 * 1024;

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fit(w: number, h: number, longSide: number) {
  const s = Math.min(1, longSide / Math.max(w, h));
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create JPEG.'))), 'image/jpeg', quality),
  );
}

/** Downscale an image to a 1,568 px long side and save it as JPEG. */
export async function prepareImage(file: File): Promise<{ blob: Blob; name: string; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const { w, h } = fit(bmp.width, bmp.height, IMAGE_LONG_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return { blob: await canvasToJpeg(canvas), name: file.name, width: w, height: h };
}

function once(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      el.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      el.removeEventListener(event, ok);
      reject(new Error('The browser can\'t play this video. Try MP4 (H.264).'));
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener('error', fail, { once: true });
  });
}

/** Grab one frame per second (768 px JPEG) via <video> and <canvas>. */
export async function extractFrames(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<{ duration: number; width: number; height: number; frames: { t: number; blob: Blob }[] }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await once(video, 'loadedmetadata');
    let duration = video.duration;
    if (duration === Infinity) {
      // Screen-recorder WebM often lacks duration metadata; a far seek forces the browser to compute it.
      video.currentTime = 1e7;
      await once(video, 'seeked');
      duration = video.duration;
    }
    if (!Number.isFinite(duration)) throw new Error('Could not read the video duration.');
    if (duration > MAX_VIDEO_SECONDS + 0.5) throw new Error(`Video must be at most ${MAX_VIDEO_SECONDS} seconds.`);
    const { w, h } = fit(video.videoWidth, video.videoHeight, FRAME_LONG_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const frames: { t: number; blob: Blob }[] = [];
    const total = Math.max(1, Math.floor(duration));
    for (let i = 0; i < total; i++) {
      // Sample mid-second to avoid landing on transition frames.
      const t = Math.min(duration - 0.05, i + 0.5);
      video.currentTime = t;
      await once(video, 'seeked');
      ctx.drawImage(video, 0, 0, w, h);
      frames.push({ t: i, blob: await canvasToJpeg(canvas, 0.8) });
      onProgress?.(i + 1, total);
    }
    return { duration, width: w, height: h, frames };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Parse .srt or .vtt subtitles into timestamped transcript segments. */
export function parseSubtitles(src: string): { start: number; end: number; text: string }[] {
  const toSec = (s: string) => {
    const m = /(?:(\d+):)?(\d+):(\d+)[.,](\d+)/.exec(s.trim());
    if (!m) return NaN;
    return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
  };
  const out: { start: number; end: number; text: string }[] = [];
  for (const block of src.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n').filter(Boolean);
    const timing = lines.findIndex((l) => l.includes('-->'));
    if (timing < 0) continue;
    const [a, b] = lines[timing]!.split('-->');
    const start = toSec(a ?? '');
    const end = toSec((b ?? '').split(' ').filter(Boolean)[0] ?? '');
    const text = lines.slice(timing + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && text) out.push({ start, end, text });
  }
  return out;
}

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
