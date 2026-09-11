/**
 * 极简 RGBA 位图 + PNG 编码器（零依赖）。
 * 所有美术素材都是这里用代码"画"出来的，因此天然是原创作品（CC0）。
 */
import { deflateSync } from 'node:zlib';

/** 解析 '#rrggbb' / '#rrggbbaa' -> [r,g,b,a] */
export function rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}

/** 在两色之间线性插值，t ∈ [0,1] */
export function mix(a, b, t) {
  const A = typeof a === 'string' ? rgb(a) : a;
  const B = typeof b === 'string' ? rgb(b) : b;
  return [
    Math.round(A[0] + (B[0] - A[0]) * t),
    Math.round(A[1] + (B[1] - A[1]) * t),
    Math.round(A[2] + (B[2] - A[2]) * t),
    Math.round(A[3] + (B[3] - A[3]) * t),
  ];
}

export class Raster {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  set(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const col = typeof c === 'string' ? rgb(c) : c;
    const i = (y * this.w + x) * 4;
    this.data[i] = col[0];
    this.data[i + 1] = col[1];
    this.data[i + 2] = col[2];
    this.data[i + 3] = col[3];
  }

  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  rect(x, y, w, h, c, alpha = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.blend(x + i, y + j, c, alpha);
  }

  /** 带 alpha 混合的像素写入 */
  blend(x, y, c, alpha = 1) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || alpha <= 0) return;
    const col = typeof c === 'string' ? rgb(c) : c;
    const a = (col[3] / 255) * alpha;
    if (a <= 0) return;
    const i = (y * this.w + x) * 4;
    const dstA = this.data[i + 3] / 255;
    const outA = a + dstA * (1 - a);
    if (outA <= 0) return;
    this.data[i] = Math.round((col[0] * a + this.data[i] * dstA * (1 - a)) / outA);
    this.data[i + 1] = Math.round((col[1] * a + this.data[i + 1] * dstA * (1 - a)) / outA);
    this.data[i + 2] = Math.round((col[2] * a + this.data[i + 2] * dstA * (1 - a)) / outA);
    this.data[i + 3] = Math.round(outA * 255);
  }

  circle(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.blend(x, y, c);
      }
    }
  }

  /** 每像素回调，可返回颜色或 null */
  shade(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = fn(x, y);
      if (c) this.blend(x, y, c);
    }
  }

  toPNG() {
    return encodePNG(this.w, this.h, this.data);
  }
}

/* ------------------------------- PNG 编码 ------------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

export function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: None
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------- 噪点/纹理 ------------------------------- */

/** 确定性伪随机（保证每次生成结果一致） */
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

/** 在区域内撒点，用于石纹/土纹 */
export function speckle(raster, x0, y0, w, h, colors, seed, density = 0.08) {
  const rng = makeRng(seed);
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (rng() < density) raster.blend(x, y, colors[(rng() * colors.length) | 0]);
    }
  }
}
