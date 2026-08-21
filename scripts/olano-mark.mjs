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
 * and dark surfaces.
 */

export const RED = '#E5262C';
export const NAVY = '#1E2A3A';
export const CANVAS = 512;

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

// --- Wordmark ----------------------------------------------------------------------------------

/**
 * "olano.ai" drawn as geometry rather than text.
 *
 * An SVG that ships in a README cannot rely on a font: whatever renders it may not have the one we
 * chose, and GitHub will not load a remote face. The wordmark is a geometric sans, so every glyph
 * it needs reduces to a circle, a straight stem, or a half-circle arch — five unique letters plus a
 * dot. Drawing them keeps the file self-contained and identical everywhere.
 *
 * Local units: baseline at y=100, x-height top at y=28, ascender top at y=0.
 */
const WORD_STROKE = 13;
const BASELINE = 100;
const X_TOP = 28;
const BOWL = 29.5; // centreline radius of the round letters
const TRACK = 15; // space between letters

/** Samples a半-circle arch into a polyline; the renderer has no arc primitive and needs none. */
function arch(cx, cy, radius, steps = 28) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = Math.PI + (Math.PI * index) / steps;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

/** Returns the glyph's shapes plus the width it advances. */
function glyph(letter, x, color) {
  const stem = (sx, top, bottom) => ({
    kind: 'polyline',
    points: [
      [sx, top],
      [sx, bottom],
    ],
    width: WORD_STROKE,
    cap: 'butt',
    color,
  });
  const half = WORD_STROKE / 2;

  switch (letter) {
    case 'o': {
      const cx = x + BOWL + half;
      return {
        shapes: [{ kind: 'ring', cx, cy: 64, r: BOWL, width: WORD_STROKE, color }],
        width: 2 * BOWL + WORD_STROKE,
      };
    }
    case 'l':
      return { shapes: [stem(x + half, 0, BASELINE)], width: WORD_STROKE };
    case 'a': {
      const cx = x + BOWL + half;
      return {
        shapes: [
          { kind: 'ring', cx, cy: 64, r: BOWL, width: WORD_STROKE, color },
          stem(cx + BOWL, X_TOP, BASELINE),
        ],
        width: 2 * BOWL + WORD_STROKE,
      };
    }
    case 'n': {
      const radius = 26;
      const left = x + half;
      const right = x + 2 * radius + half;
      return {
        shapes: [
          stem(left, X_TOP, BASELINE),
          {
            kind: 'polyline',
            points: arch(left + radius, X_TOP + radius, radius),
            width: WORD_STROKE,
            color,
          },
          stem(right, X_TOP + radius, BASELINE),
        ],
        width: 2 * radius + WORD_STROKE,
      };
    }
    case 'i':
      return {
        shapes: [
          stem(x + half, X_TOP, BASELINE),
          { kind: 'disc', cx: x + half, cy: 4, r: half, color },
        ],
        width: WORD_STROKE,
      };
    case '.':
      return {
        shapes: [{ kind: 'disc', cx: x + half, cy: BASELINE - half, r: half, color }],
        width: WORD_STROKE,
      };
    default:
      throw new Error(`No glyph for ${letter}`);
  }
}

/** Lays "olano" in navy and ".ai" in red, returning the shapes and the total advance. */
function wordmarkShapes() {
  const shapes = [];
  let x = 0;
  for (const [index, letter] of [...'olano.ai'].entries()) {
    const drawn = glyph(letter, x, index < 5 ? NAVY : RED);
    shapes.push(...drawn.shapes);
    x += drawn.width + TRACK;
  }
  return { shapes, width: x - TRACK };
}

function translateScale(shapes, dx, dy, scale) {
  const point = ([px, py]) => [dx + px * scale, dy + py * scale];
  return shapes.map((shape) => {
    const moved = { ...shape };
    if (shape.points) moved.points = shape.points.map(point);
    if (shape.cx !== undefined) [moved.cx, moved.cy] = point([shape.cx, shape.cy]);
    if (shape.r !== undefined) moved.r = shape.r * scale;
    if (shape.width !== undefined) moved.width = shape.width * scale;
    if (shape.x !== undefined) {
      [moved.x, moved.y] = point([shape.x, shape.y]);
      moved.w = shape.w * scale;
      moved.h = shape.h * scale;
    }
    return moved;
  });
}

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

// --- SVG ---------------------------------------------------------------------------------------

function shapeToSvg(shape) {
  const colour = shape.color ?? RED;
  switch (shape.kind) {
    case 'polygon':
      return `<polygon points="${shape.points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')}" fill="${colour}"/>`;
    case 'rect':
      return `<rect x="${round(shape.x)}" y="${round(shape.y)}" width="${round(shape.w)}" height="${round(shape.h)}" rx="${round(shape.r)}" fill="${colour}"/>`;
    case 'disc':
      return `<circle cx="${round(shape.cx)}" cy="${round(shape.cy)}" r="${round(shape.r)}" fill="${colour}"/>`;
    case 'ring':
      return `<circle cx="${round(shape.cx)}" cy="${round(shape.cy)}" r="${round(shape.r)}" fill="none" stroke="${colour}" stroke-width="${round(shape.width)}"/>`;
    case 'polyline': {
      const [start, ...rest] = shape.points;
      const path = `M${round(start[0])} ${round(start[1])}${rest.map(([x, y]) => `L${round(x)} ${round(y)}`).join('')}${shape.closed ? 'Z' : ''}`;
      return `<path d="${path}" fill="none" stroke="${colour}" stroke-width="${round(shape.width)}" stroke-linecap="${shape.cap ?? 'round'}" stroke-linejoin="round"/>`;
    }
    default:
      throw new Error(`Unknown shape ${shape.kind}`);
  }
}

/** @returns {string} The mark as a standalone SVG document. */
export function markSvg() {
  const body = SHAPES.map((shape) => `    ${shapeToSvg(shape)}`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" role="img" aria-labelledby="title">
  <title id="title">Olano Singapore</title>
  <g fill="${RED}">
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

function toRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Returns the painted colour at one sample point, or null where the canvas stays transparent. */
function sampleShapes(shapes, x, y) {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (insideShape(x, y, shape)) return toRgb(shape.color ?? RED);
  }
  return null;
}

/** Supersampled rasteriser shared by every PNG this module produces. */
function rasterise(shapes, width, height, { supersample = 3 } = {}) {
  const pixels = Buffer.alloc(width * height * 4);
  const samplesPerPixel = supersample * supersample;
  const step = 1 / supersample;
  const offset = step / 2;

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let covered = 0;

      for (let subRow = 0; subRow < supersample; subRow += 1) {
        const y = (row * supersample + subRow) * step + offset;
        for (let subColumn = 0; subColumn < supersample; subColumn += 1) {
          const colour = sampleShapes(
            shapes,
            (column * supersample + subColumn) * step + offset,
            y,
          );
          if (!colour) continue;
          red += colour[0];
          green += colour[1];
          blue += colour[2];
          covered += 1;
        }
      }

      const index = (row * width + column) * 4;
      if (covered === 0) continue;
      pixels[index] = Math.round(red / covered);
      pixels[index + 1] = Math.round(green / covered);
      pixels[index + 2] = Math.round(blue / covered);
      pixels[index + 3] = Math.round((covered / samplesPerPixel) * 255);
    }
  }

  return encodePng(width, height, pixels);
}

export function renderOlanoIcon(size = 512, { supersample = 3 } = {}) {
  return rasterise(translateScale(SHAPES, 0, 0, size / CANVAS), size, size, { supersample });
}

/** Rasterises the horizontal lockup at a given width, for previewing what the SVG will look like. */
export function renderLockup(width = 969, { supersample = 2 } = {}) {
  const { shapes, viewWidth, viewHeight } = lockupGeometry();
  const scale = width / viewWidth;
  return rasterise(translateScale(shapes, 0, 0, scale), width, Math.round(viewHeight * scale), {
    supersample,
  });
}

const LOCKUP_HEIGHT = 260;
const LOCKUP_PADDING = 24;
const LOCKUP_GAP = 56;

/**
 * The horizontal lockup: mark, then wordmark, sized for a README header.
 *
 * @returns {string} A standalone SVG document.
 */
function lockupGeometry() {
  const markSize = LOCKUP_HEIGHT - LOCKUP_PADDING * 2;
  const markScale = markSize / CANVAS;
  const word = wordmarkShapes();
  const wordScale = (markSize * 0.62) / BASELINE;
  const wordWidth = word.width * wordScale;
  const wordBaseline = LOCKUP_HEIGHT / 2 + (BASELINE * wordScale) / 2;
  const wordLeft = LOCKUP_PADDING + markSize + LOCKUP_GAP;
  const width = Math.round(wordLeft + wordWidth + LOCKUP_PADDING);

  const shapes = [
    ...translateScale(SHAPES, LOCKUP_PADDING, LOCKUP_PADDING, markScale),
    ...translateScale(word.shapes, wordLeft, wordBaseline - BASELINE * wordScale, wordScale),
  ];

  return { shapes, viewWidth: width, viewHeight: LOCKUP_HEIGHT };
}

/** @returns {string} The horizontal lockup as a standalone SVG document. */
export function lockupSvg() {
  const { shapes, viewWidth, viewHeight } = lockupGeometry();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${viewHeight}" width="${viewWidth}" height="${viewHeight}" role="img" aria-labelledby="lockup-title">
  <title id="lockup-title">olano.ai — Singapore MCP</title>
${shapes.map((shape) => `  ${shapeToSvg(shape)}`).join('\n')}
</svg>
`;
}
