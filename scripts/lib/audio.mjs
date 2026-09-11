/**
 * 极简 WAV(16-bit PCM, 单声道) 编码器 + 合成器。
 * 音效与 BGM 全部由代码合成 —— 原创，CC0。
 */

const SAMPLE_RATE = 22050;

/** 方波 / 三角波 / 正弦 / 噪声 */
function osc(type, phase) {
  const t = phase - Math.floor(phase);
  switch (type) {
    case 'square':
      return t < 0.5 ? 1 : -1;
    case 'saw':
      return 2 * t - 1;
    case 'triangle':
      return 4 * Math.abs(t - 0.5) - 1;
    case 'noise':
      return Math.random() * 2 - 1;
    default:
      return Math.sin(2 * Math.PI * t);
  }
}

export function createTrack(seconds) {
  return {
    sampleRate: SAMPLE_RATE,
    n: Math.floor(seconds * SAMPLE_RATE),
    buf: new Float32Array(Math.floor(seconds * SAMPLE_RATE)),
  };
}

/**
 * 向轨道中添加一个音符。
 * @param {object} track
 * @param {object} o {freq, start, dur, wave, gain, attack, decay, glideTo}
 */
export function note(track, o) {
  const { freq, start, dur, wave = 'square', gain = 0.25, attack = 0.005, decay = null, glideTo = null } = o;
  const i0 = Math.floor(start * track.sampleRate);
  const i1 = Math.min(track.n, Math.floor((start + dur) * track.sampleRate));
  let phase = 0;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / track.sampleRate;
    const f = glideTo == null ? freq : freq + (glideTo - freq) * (t / dur);
    phase += f / track.sampleRate;
    // 包络：attack 上升 + 指数衰减到尾部
    const a = Math.min(1, t / Math.max(attack, 1e-4));
    const d = decay == null ? 1 : Math.exp(-t / decay);
    // 尾部 30ms 淡出，避免爆音
    const fade = Math.min(1, ((i1 - i) / track.sampleRate) / 0.03);
    track.buf[i] += osc(wave, phase) * gain * a * d * fade;
  }
}

/** 归一化并写出 16-bit PCM WAV */
export function trackToWav(track, targetPeak = 0.85) {
  let peak = 0;
  for (let i = 0; i < track.n; i++) peak = Math.max(peak, Math.abs(track.buf[i]));
  const k = peak > 0 ? targetPeak / peak : 0;
  const data = Buffer.alloc(track.n * 2);
  for (let i = 0; i < track.n; i++) {
    let v = Math.max(-1, Math.min(1, track.buf[i] * k));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(track.sampleRate, 24);
  header.writeUInt32LE(track.sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** 半音 -> 频率（A4 = 440Hz） */
export function hz(semitoneFromA4) {
  return 440 * Math.pow(2, semitoneFromA4 / 12);
}

/** 音名 -> 相对 A4 的半音数，如 'C4' 'F#3' */
export function st(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note: ${name}`);
  const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return base + acc + (parseInt(m[3], 10) - 4) * 12;
}
