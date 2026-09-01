/**
 * Generates the PWA icon set with no image dependencies.
 *
 * Writes real PNG files (iOS ignores SVG for apple-touch-icon), drawing a
 * rounded indigo tile with a white check mark. Run with: npm run icons
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BRAND = [67, 85, 220];
const WHITE = [255, 255, 255];

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Drawing helpers - all coordinates are 0..1 relative to the canvas
// ---------------------------------------------------------------------------
function roundedRectDistance(x, y, halfWidth, halfHeight, radius) {
  const dx = Math.abs(x) - halfWidth + radius;
  const dy = Math.abs(y) - halfHeight + radius;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lengthSquared = vx * vx + vy * vy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSquared));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function blend(target, offset, colour, alpha) {
  if (alpha <= 0) return;
  const inverse = 1 - alpha;
  target[offset] = Math.round(colour[0] * alpha + target[offset] * inverse);
  target[offset + 1] = Math.round(colour[1] * alpha + target[offset + 1] * inverse);
  target[offset + 2] = Math.round(colour[2] * alpha + target[offset + 2] * inverse);
  target[offset + 3] = Math.round(255 * alpha + target[offset + 3] * inverse);
}

/**
 * @param {number} size        pixel size of the square icon
 * @param {object} options
 * @param {number} options.cornerRadius  0 = square (full bleed), 0.22 = app tile
 * @param {number} options.glyphScale    check mark size relative to the canvas
 */
function drawIcon(size, { cornerRadius = 0.22, glyphScale = 1 } = {}) {
  const pixels = Buffer.alloc(size * size * 4, 0);
  const samples = 3;
  const step = 1 / (samples + 1);

  // Check mark geometry in 0..1 space, scaled about the centre.
  const points = [
    [0.28, 0.53],
    [0.435, 0.685],
    [0.735, 0.335],
  ].map(([x, y]) => [0.5 + (x - 0.5) * glyphScale, 0.5 + (y - 0.5) * glyphScale]);
  const strokeHalf = 0.052 * glyphScale;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let backgroundHits = 0;
      let glyphHits = 0;

      for (let sy = 1; sy <= samples; sy += 1) {
        for (let sx = 1; sx <= samples; sx += 1) {
          const u = (x + sx * step) / size;
          const v = (y + sy * step) / size;

          if (roundedRectDistance(u - 0.5, v - 0.5, 0.5, 0.5, cornerRadius) <= 0) {
            backgroundHits += 1;
          }

          const distance = Math.min(
            segmentDistance(u, v, points[0][0], points[0][1], points[1][0], points[1][1]),
            segmentDistance(u, v, points[1][0], points[1][1], points[2][0], points[2][1]),
          );
          if (distance <= strokeHalf) glyphHits += 1;
        }
      }

      const total = samples * samples;
      const offset = (y * size + x) * 4;

      blend(pixels, offset, BRAND, backgroundHits / total);
      blend(pixels, offset, WHITE, glyphHits / total);
    }
  }

  return encodePng(size, size, pixels);
}

// ---------------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, options: { cornerRadius: 0.22, glyphScale: 1 } },
  { file: 'icon-512.png', size: 512, options: { cornerRadius: 0.22, glyphScale: 1 } },
  // Maskable icons are cropped by the platform, so keep the glyph inside the
  // 80% safe zone and fill the whole canvas.
  { file: 'icon-maskable-512.png', size: 512, options: { cornerRadius: 0, glyphScale: 0.68 } },
  // iOS applies its own mask to the apple-touch-icon: full bleed, no rounding.
  { file: 'apple-touch-icon.png', size: 180, options: { cornerRadius: 0, glyphScale: 0.86 } },
  { file: 'favicon-32.png', size: 32, options: { cornerRadius: 0.22, glyphScale: 1 } },
];

for (const target of targets) {
  const png = drawIcon(target.size, target.options);
  writeFileSync(join(OUT_DIR, target.file), png);
  console.log(`wrote public/icons/${target.file} (${target.size}x${target.size}, ${png.length} bytes)`);
}
