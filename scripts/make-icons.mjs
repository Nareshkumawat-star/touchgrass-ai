// Generates the PWA PNG icons from the same leaf mark as public/icon.svg.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function renderPng(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const scale = size / 512;
  const radius = 112 * scale;
  const bg = [44, 90, 52];
  const leaf = [138, 195, 92];
  const cream = [230, 239, 221];

  // Leaf: quadratic-ish region between the stem line and the outer curve.
  const inLeaf = (x, y) => {
    // Normalised coordinates against the 512 design canvas.
    const px = x / scale;
    const py = y / scale;
    if (py < 118 || py > 392) return false;
    // Curve from (128,384) up to (384,128): leaf body to the upper-right side.
    const t = (py - 128) / 256; // 0 at top, 1 at bottom
    const left = 384 - 256 * t;
    const right = 384 - 256 * t * t - 40 * Math.sin(Math.PI * t);
    return px >= Math.min(left, right) - 2 && px <= Math.max(left, right) + 2;
  };

  const inStem = (x, y) => {
    const px = x / scale;
    const py = y / scale;
    // Diagonal stem from bottom-left to upper-right.
    const startX = 128;
    const startY = 384;
    const endX = 352;
    const endY = 240;
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy);
    const t = ((px - startX) * dx + (py - startY) * dy) / (len * len);
    if (t < 0 || t > 1) return false;
    const projX = startX + t * dx;
    const projY = startY + t * dy;
    return Math.hypot(px - projX, py - projY) <= 7;
  };

  const inMeaningDot = (x, y) => {
    const px = x / scale;
    const py = y / scale;
    return Math.hypot(px - 128, py - 384) <= 22;
  };

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = rowStart + 1 + x * 3;
      // Rounded square: outside the corner radius is transparent-looking cream.
      const cx = Math.min(x, size - 1 - x) / scale;
      const cy = Math.min(y, size - 1 - y) / scale;
      const insideRounded = cx >= radius || cy >= radius || Math.hypot(radius - cx, radius - cy) <= radius;

      let colour = cream;
      if (insideRounded) colour = bg;

      if (inLeaf(x, y)) colour = bg;
      if (insideRounded && inLeaf(x, y)) colour = leaf;
      if (insideRounded && inStem(x, y)) colour = bg;
      if (insideRounded && inMeaningDot(x, y)) colour = cream;

      raw[offset] = colour[0];
      raw[offset + 1] = colour[1];
      raw[offset + 2] = colour[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const png = renderPng(size);
  writeFileSync(`public/icon-${size}.png`, png);
  console.log(`public/icon-${size}.png (${png.length} bytes)`);
}
