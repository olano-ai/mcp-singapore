import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';

/**
 * The Olano Singapore mark, defined once as geometry.
 *
 * Both outputs come from this file: the SVG that ships as the plugin asset, and the PNG that
 * Claude Desktop shows for the .mcpb bundle. Keeping one source means the icon a user sees in the
 * install dialog cannot drift from the icon in the plugin listing.
 *
 * The background is transparent and the mark fills the canvas. A white plate underneath made the
 * icon read as a bright square with a small detail inside it against Claude Desktop's dark
 * extension tile, which is where this asset is seen most; red on transparent carries on both light
 * and dark surfaces. Pass `plate: true` for a surface that needs the white square back.
 */

export const RED = '#E5262C';
export const NAVY = '#1E2A3A';
export const CANVAS = 512;

const PLATE_RADIUS = 96;
const OCTAGON_RADIUS = 219;
const OCTAGON_STROKE = 15;

/** Octagon vertices, offset 22.5 degrees so the mark has a flat top and bottom edge. */
const VERTICES = Array.from({ length: 8 }, (_, index) => {
  const angle = (Math.PI / 180) * (22.5 + index * 45);
  return [
    CANVAS / 2 + OCTAGON_RADIUS * Math.cos(angle),
    CANVAS / 2 + OCTAGON_RADIUS * Math.sin(angle),
  ];
});

const INNER_RADIUS = 148;
const SPOKE_STROKE = 9;
const OUTER_NODE = 24;
const INNER_NODE = 11;

/** A second ring of nodes, rotated half a step, so vertex-to-node links triangulate the band. */
const INNER = Array.from({ length: 8 }, (_, index) => {
  const angle = (Math.PI / 180) * (45 + index * 45);
  return [CANVAS / 2 + INNER_RADIUS * Math.cos(angle), CANVAS / 2 + INNER_RADIUS * Math.sin(angle)];
});

const SPOKES = INNER.flatMap((node, index) => [
  [VERTICES[index], node],
  [VERTICES[(index + 1) % 8], node],
]);

/**
 * Painted in order; later shapes cover earlier ones.
 *
 * The mark is the network alone. Four attempts at a Marina Bay Sands silhouette all collapsed at
 * icon size into something else — a temple, a table, a letter — because three verticals under a
 * horizontal is a shape the eye already has readings for. The skyline stays in the full lockup,
 * which has the room to draw it properly; this asset is used at 16-48px and needs to survive there.
 * Weight sits in the nodes rather than the lines, because discs are what still read once the
 * strokes have thinned past a pixel.
 */
const SHAPES = [
  ...SPOKES.map(([from, to]) => ({ kind: 'polyline', points: [from, to], width: SPOKE_STROKE })),
  { kind: 'polyline', points: INNER, width: SPOKE_STROKE, closed: true },
  { kind: 'polyline', points: VERTICES, width: OCTAGON_STROKE, closed: true },
  ...INNER.map(([cx, cy]) => ({ kind: 'disc', cx, cy, r: INNER_NODE })),
  ...VERTICES.map(([cx, cy]) => ({ kind: 'disc', cx, cy, r: OUTER_NODE })),
];

function round(value) {
  return Number(value.toFixed(2));
}

// --- Signed distance tests, shared by the rasteriser -------------------------------------------

function distanceToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function insideRoundedRect(x, y, { x: rx, y: ry, w, h, r }) {
  const halfWidth = w / 2;
  const halfHeight = h / 2;
  const offsetX = Math.abs(x - (rx + halfWidth)) - (halfWidth - r);
  const offsetY = Math.abs(y - (ry + halfHeight)) - (halfHeight - r);
  return Math.hypot(Math.max(offsetX, 0), Math.max(offsetY, 0)) - r <= 0;
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insideShape(x, y, shape) {
  switch (shape.kind) {
    case 'polygon':
      return insidePolygon(x, y, shape.points);
    case 'rect':
      return insideRoundedRect(x, y, shape);
    case 'disc':
      return Math.hypot(x - shape.cx, y - shape.cy) <= shape.r;
    case 'ring':
      return Math.abs(Math.hypot(x - shape.cx, y - shape.cy) - shape.r) <= shape.width / 2;
    case 'polyline': {
      const points = shape.closed ? [...shape.points, shape.points[0]] : shape.points;
      for (let index = 0; index < points.length - 1; index += 1) {
        if (distanceToSegment(x, y, points[index], points[index + 1]) <= shape.width / 2) {
          return true;
        }
      }
      return false;
    }
    default:
      throw new Error(`Unknown shape ${shape.kind}`);
  }
}

function insidePlate(x, y) {
  return insideRoundedRect(x, y, { x: 0, y: 0, w: CANVAS, h: CANVAS, r: PLATE_RADIUS });
}

// --- SVG ---------------------------------------------------------------------------------------

function shapeToSvg(shape) {
  switch (shape.kind) {
    case 'polygon':
      return `<polygon points="${shape.points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')}"/>`;
    case 'rect':
      return `<rect x="${round(shape.x)}" y="${round(shape.y)}" width="${round(shape.w)}" height="${round(shape.h)}" rx="${round(shape.r)}"/>`;
    case 'disc':
      return `<circle cx="${round(shape.cx)}" cy="${round(shape.cy)}" r="${round(shape.r)}"/>`;
    case 'ring':
      return `<circle cx="${round(shape.cx)}" cy="${round(shape.cy)}" r="${round(shape.r)}" fill="none" stroke="${RED}" stroke-width="${round(shape.width)}"/>`;
    case 'polyline': {
      const [start, ...rest] = shape.points;
      const path = `M${round(start[0])} ${round(start[1])}${rest.map(([x, y]) => `L${round(x)} ${round(y)}`).join('')}${shape.closed ? 'Z' : ''}`;
      return `<path d="${path}" fill="none" stroke="${RED}" stroke-width="${round(shape.width)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    default:
      throw new Error(`Unknown shape ${shape.kind}`);
  }
}

/**
 * @param {{ plate?: boolean }} options Set plate true to sit the mark on a white rounded square.
 * @returns {string} The mark as a standalone SVG document.
 */
export function markSvg({ plate = false } = {}) {
  const body = SHAPES.map((shape) => `    ${shapeToSvg(shape)}`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" role="img" aria-labelledby="title">
  <title id="title">Olano Singapore</title>
${plate ? `  <rect width="${CANVAS}" height="${CANVAS}" rx="${PLATE_RADIUS}" fill="#fff"/>\n` : ''}  <g fill="${RED}">
${body}
  </g>
</svg>
`;
}

// --- PNG ---------------------------------------------------------------------------------------

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

const RED_RGB = [0xe5, 0x26, 0x2c];
const WHITE_RGB = [255, 255, 255];

/** Returns the painted colour at one sample point, or null where the canvas stays transparent. */
function sample(x, y, plate) {
  const painted = SHAPES.some((shape) => insideShape(x, y, shape));
  if (painted) return RED_RGB;
  if (plate && insidePlate(x, y)) return WHITE_RGB;
  return null;
}

/**
 * @param {number} size Output edge length in pixels.
 * @param {{ plate?: boolean, supersample?: number }} options
 * @returns {Buffer} A PNG image.
 */
export function renderOlanoIcon(size = 512, { plate = false, supersample = 3 } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const step = CANVAS / (size * supersample);
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
          const colour = sample((column * supersample + subColumn + 0.5) * step, y, plate);
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
