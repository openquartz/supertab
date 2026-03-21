const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t))
  ];
}

class Raster {
  constructor(size) {
    this.size = size;
    this.pixels = new Uint8Array(size * size * 4);
  }

  blendPixel(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    if (a <= 0) return;

    const index = (y * this.size + x) * 4;
    const srcA = clamp(a, 0, 1);
    const dstA = this.pixels[index + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);

    if (outA <= 0) return;

    const outR = (r * srcA + this.pixels[index] * dstA * (1 - srcA)) / outA;
    const outG = (g * srcA + this.pixels[index + 1] * dstA * (1 - srcA)) / outA;
    const outB = (b * srcA + this.pixels[index + 2] * dstA * (1 - srcA)) / outA;

    this.pixels[index] = Math.round(outR);
    this.pixels[index + 1] = Math.round(outG);
    this.pixels[index + 2] = Math.round(outB);
    this.pixels[index + 3] = Math.round(outA * 255);
  }

  drawRoundedRect(x, y, w, h, radius, colorFn, alpha = 1) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.ceil(x + w);
    const y1 = Math.ceil(y + h);

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const cx = px + 0.5;
        const cy = py + 0.5;

        const qx = Math.abs(cx - (x + w / 2)) - (w / 2 - radius);
        const qy = Math.abs(cy - (y + h / 2)) - (h / 2 - radius);
        const ox = Math.max(qx, 0);
        const oy = Math.max(qy, 0);
        const outside = Math.hypot(ox, oy) - radius;
        const inside = Math.min(Math.max(qx, qy), 0);
        const dist = outside + inside;
        const coverage = clamp(0.7 - dist, 0, 1);

        if (coverage <= 0) continue;

        const color = colorFn(cx, cy);
        this.blendPixel(px, py, color[0], color[1], color[2], alpha * coverage);
      }
    }
  }

  drawCircle(cx, cy, radius, color, alpha = 1) {
    const x0 = Math.floor(cx - radius - 1);
    const y0 = Math.floor(cy - radius - 1);
    const x1 = Math.ceil(cx + radius + 1);
    const y1 = Math.ceil(cy + radius + 1);

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const dx = (px + 0.5) - cx;
        const dy = (py + 0.5) - cy;
        const dist = Math.hypot(dx, dy);
        const coverage = clamp(radius + 0.7 - dist, 0, 1);
        if (coverage <= 0) continue;
        this.blendPixel(px, py, color[0], color[1], color[2], alpha * coverage);
      }
    }
  }

  drawLineByCircles(points, radius, color, alpha = 1) {
    for (const [x, y] of points) {
      this.drawCircle(x, y, radius, color, alpha);
    }
  }

  toPNG() {
    const width = this.size;
    const height = this.size;
    const rowSize = width * 4 + 1;
    const raw = Buffer.alloc(rowSize * height);

    for (let y = 0; y < height; y++) {
      const rowStart = y * rowSize;
      raw[rowStart] = 0;
      const srcStart = y * width * 4;
      for (let x = 0; x < width * 4; x++) {
        raw[rowStart + 1 + x] = this.pixels[srcStart + x];
      }
    }

    const idat = zlib.deflateSync(raw, { level: 9 });
    return encodePNG(width, height, idat);
  }
}

function quadraticPoints(x0, y0, cx, cy, x1, y1, steps) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
    const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
    points.push([x, y]);
  }
  return points;
}

function renderIcon(size) {
  const r = new Raster(size);
  const s = size / 512;

  const bgStart = [44, 142, 255];
  const bgEnd = [21, 82, 214];

  r.drawRoundedRect(40 * s, 40 * s, 432 * s, 432 * s, 120 * s, (x, y) => {
    const t = clamp(((x - 40 * s) + (y - 40 * s)) / (864 * s), 0, 1);
    return mixColor(bgStart, bgEnd, t);
  }, 1);

  r.drawRoundedRect(40 * s, 40 * s, 432 * s, 432 * s, 120 * s, () => [255, 255, 255], 0.07);

  r.drawRoundedRect(142 * s, 146 * s, 211 * s, 178 * s, 30 * s, () => [255, 255, 255], 0.30);
  r.drawRoundedRect(166 * s, 172 * s, 211 * s, 178 * s, 30 * s, () => [246, 250, 255], 0.98);

  r.drawRoundedRect(198 * s, 196 * s, 148 * s, 20 * s, 10 * s, () => [198, 217, 255], 0.95);
  r.drawRoundedRect(198 * s, 228 * s, 112 * s, 16 * s, 8 * s, () => [212, 228, 255], 0.92);

  const lineColorStart = [46, 125, 255];
  const lineColorEnd = [26, 83, 199];
  const steps = Math.max(24, Math.round(120 * s));

  const p1 = quadraticPoints(199 * s, 286 * s, 264 * s, 226 * s, 329 * s, 286 * s, steps);
  const p2 = quadraticPoints(199 * s, 286 * s, 264 * s, 346 * s, 329 * s, 286 * s, steps);

  p1.forEach((p, i) => {
    const t = i / Math.max(1, p1.length - 1);
    r.drawCircle(p[0], p[1], 11 * s, mixColor(lineColorStart, lineColorEnd, t), 0.95);
  });
  p2.forEach((p, i) => {
    const t = i / Math.max(1, p2.length - 1);
    r.drawCircle(p[0], p[1], 11 * s, mixColor(lineColorStart, lineColorEnd, t), 0.95);
  });

  r.drawCircle(264 * s, 286 * s, 16 * s, [255, 255, 255], 1);
  r.drawRoundedRect(120 * s, 356 * s, 272 * s, 54 * s, 20 * s, () => [255, 255, 255], 0.16);

  return r.toPNG();
}

function encodePNG(width, height, compressedData) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = pngChunk('IHDR', ihdr);
  const idatChunk = pngChunk('IDAT', compressedData);
  const iendChunk = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function writeIcon(size, outPath) {
  const png = renderIcon(size);
  fs.writeFileSync(outPath, png);
}

function main() {
  const root = path.resolve(__dirname, '..');
  const imagesDir = path.join(root, 'images');
  const assetsDir = path.join(root, 'assets', 'icons');

  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    writeIcon(size, path.join(imagesDir, `icon${size}.png`));
    writeIcon(size, path.join(assetsDir, `icon-${size}.png`));
  }
}

main();
