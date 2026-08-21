import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';

/**
 * Rasterises plugins/olano-singapore/assets/olano-singapore.svg to a PNG.
 *
 * Claude Desktop renders the bundle icon from a raster image, and the repository only ships the
 * mark as SVG. Rendering it here keeps the bundle icon identical to the plugin icon without adding
 * a native image dependency to CI.
 */

const VIEWBOX = 512;
const CORNER_RADIUS = 112;
const STROKE_WIDTH = 24;
const CENTRE = 256;
const CIRCLE_RADIUS = 58;
const WHITE = [255, 255, 255];
const RED = [239, 83, 80];

const HEXAGON = [
  [256, 92],
  [376, 164],
  [376, 348],
  [256, 420],
  [136, 348],
  [136, 164],
];

const SPOKES = [
  [256, 92, 256, 214],
  [376, 164, 272, 224],
  [376, 348, 272, 288],
  [256, 420, 256, 298],
  [136, 348, 240, 288],
  [136, 164, 240, 224],
];

const SEGMENTS = [
  ...HEXAGON.map((point, index) => {
    const next = HEXAGON[(index + 1) % HEXAGON.length];
    return [point[0], point[1], next[0], next[1]];
  }),
  ...SPOKES,
];

function distanceToSegment(x, y, [ax, ay, bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function insideRoundedSquare(x, y) {
  const inset = Math.min(x, VIEWBOX - x, y, VIEWBOX - y);
  if (inset < 0) return false;
  const cornerX = Math.min(x, VIEWBOX - x);
  const cornerY = Math.min(y, VIEWBOX - y);
  if (cornerX >= CORNER_RADIUS || cornerY >= CORNER_RADIUS) return true;
  return Math.hypot(CORNER_RADIUS - cornerX, CORNER_RADIUS - cornerY) <= CORNER_RADIUS;
}

/** Returns the painted colour at one sample point, or null where the canvas stays transparent. */
function sample(x, y) {
  if (!insideRoundedSquare(x, y)) return null;

  const half = STROKE_WIDTH / 2;
  const radial = Math.hypot(x - CENTRE, y - CENTRE);
  if (Math.abs(radial - CIRCLE_RADIUS) <= half) return RED;
  if (radial <= CIRCLE_RADIUS) return WHITE;

  for (const segment of SEGMENTS) {
    if (distanceToSegment(x, y, segment) <= half) return RED;
  }
  return WHITE;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    raw[row * (stride + 1)] = 0;
    pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param {number} size Output edge length in pixels.
 * @param {number} supersample Samples per axis used for antialiasing.
 * @returns {Buffer} A PNG image.
 */
export function renderOlanoIcon(size = 512, supersample = 3) {
  const pixels = Buffer.alloc(size * size * 4);
  const step = VIEWBOX / (size * supersample);
  const samplesPerPixel = supersample * supersample;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let covered = 0;

      for (let subRow = 0; subRow < supersample; subRow += 1) {
        const y = (row * supersample + subRow + 0.5) * step;
        for (let subColumn = 0; subColumn < supersample; subColumn += 1) {
          const colour = sample((column * supersample + subColumn + 0.5) * step, y);
          if (!colour) continue;
          red += colour[0];
          green += colour[1];
          blue += colour[2];
          covered += 1;
        }
      }

      const offset = (row * size + column) * 4;
      if (covered === 0) continue;
      pixels[offset] = Math.round(red / covered);
      pixels[offset + 1] = Math.round(green / covered);
      pixels[offset + 2] = Math.round(blue / covered);
      pixels[offset + 3] = Math.round((covered / samplesPerPixel) * 255);
    }
  }

  return encodePng(size, size, pixels);
}
