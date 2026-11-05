const RECORD_SECONDS = 15;
const MAX_BYTES = 12 * 1024 * 1024;
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
];

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const mime of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* 某些浏览器会对未知 mime 抛错 */
    }
  }
  return '';
}

export function canRecordVideo() {
  return Boolean(
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    pickMime()
  );
}

export async function getGameVideo(gameId, { signal } = {}) {
  try {
    const response = await fetch(`/api/videos/${encodeURIComponent(gameId)}`, {
      signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.video || null;
  } catch {
    return null;
  }
}

export function startGameplayRecording(canvas, emuSound, { seconds = RECORD_SECONDS, onTick } = {}) {
  const mime = pickMime();
  if (!mime) throw new Error('当前浏览器不支持录制');
  if (typeof canvas.captureStream !== 'function') throw new Error('当前浏览器不支持录制画面');

  const stream = canvas.captureStream(30);
  let audioDestination = null;
  const gainNode = emuSound?.gainNode;
  const audioCtx = emuSound?.audioCtx;
  if (gainNode && audioCtx && typeof audioCtx.createMediaStreamDestination === 'function') {
    try {
      audioDestination = audioCtx.createMediaStreamDestination();
      gainNode.connect(audioDestination);
      for (const track of audioDestination.stream.getAudioTracks()) stream.addTrack(track);
    } catch (error) {
      console.warn('录制音频失败，改为只录画面', error);
      audioDestination = null;
    }
  }

  const options = { mimeType: mime, videoBitsPerSecond: 2_500_000 };
  if (audioDestination) options.audioBitsPerSecond = 96_000;
  const recorder = new MediaRecorder(stream, options);
  const chunks = [];
  const planned = Math.max(1, Math.round(seconds));
  let remaining = planned;
  let ticker = 0;

  const cleanup = () => {
    if (ticker) clearInterval(ticker);
    ticker = 0;
    if (audioDestination && gainNode) {
      try { gainNode.disconnect(audioDestination); } catch {}
    }
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch {}
    }
  };

  const done = new Promise((resolve, reject) => {
    recorder.addEventListener('dataavailable', event => {
      if (event.data?.size) chunks.push(event.data);
    });
    recorder.addEventListener('error', event => {
      cleanup();
      reject(event.error || new Error('录制失败'));
    });
    recorder.addEventListener('stop', () => {
      const recorded = Math.max(1, planned - Math.max(0, remaining));
      cleanup();
      const type = (recorder.mimeType || mime).split(';')[0];
      const blob = new Blob(chunks, { type });
      if (!blob.size) {
        reject(new Error('没有录到画面'));
        return;
      }
      if (blob.size > MAX_BYTES) {
        reject(new Error('视频体积过大，请缩短录制时长'));
        return;
      }
      resolve({ blob, type, seconds: recorded });
    });
  });

  const stop = () => {
    if (recorder.state === 'inactive') return;
    try { recorder.stop(); } catch {}
  };

  recorder.start(1000);
  if (onTick) onTick(remaining);
  ticker = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      if (onTick) onTick(0);
      stop();
      return;
    }
    if (onTick) onTick(remaining);
  }, 1000);

  return { done, stop, mimeType: mime, seconds: planned };
}

export async function saveGameVideo(gameId, blob, { duration, width, height } = {}) {
  const query = new URLSearchParams();
  if (duration) query.set('duration', String(Math.round(duration)));
  if (width) query.set('width', String(Math.round(width)));
  if (height) query.set('height', String(Math.round(height)));
  const response = await fetch(`/api/videos/${encodeURIComponent(gameId)}?${query.toString()}`, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || 'video/mp4' },
    body: blob
  });
  if (!response.ok) {
    let message = `上传失败（${response.status}）`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      /* 响应不是 JSON */
    }
    throw new Error(message);
  }
  return response.json();
}

export async function deleteGameVideo(gameId) {
  const response = await fetch(`/api/videos/${encodeURIComponent(gameId)}`, { method: 'DELETE' });
  return response.ok || response.status === 404;
}

export function formatVideoTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export { RECORD_SECONDS };
