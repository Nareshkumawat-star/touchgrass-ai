// Throwaway probe: builds a synthetic leaf image and times the vision model.
import { deflateSync } from "node:zlib";
import { writeFileSync, readFileSync } from "node:fs";

const SIZE = 160;
const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 3 + 1)] = 0; // filter byte
  for (let x = 0; x < SIZE; x += 1) {
    const offset = y * (SIZE * 3 + 1) + 1 + x * 3;
    // Leaf-ish ellipse, darker midrib down the middle, cream background.
    const nx = (x - SIZE / 2) / (SIZE * 0.28);
    const ny = (y - SIZE / 2) / (SIZE * 0.45);
    const inside = nx * nx + ny * ny < 1;
    const midrib = Math.abs(x - SIZE / 2) < 2;
    if (inside) {
      const [r, g, b] = midrib ? [40, 80, 45] : [107, 160, 60];
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    } else {
      raw[offset] = 240;
      raw[offset + 1] = 243;
      raw[offset + 2] = 233;
    }
  }
}

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

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // truecolour
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync("scripts/test-leaf.png", png);
console.log(`wrote scripts/test-leaf.png (${png.length} bytes)`);

const body = {
  model: process.argv[2] || "qwen2.5vl:3b",
  stream: false,
  format: "json",
  keep_alive: "10m",
  options: { temperature: 0.3, num_predict: 400 },
  messages: [
    {
      role: "system",
      content:
        'You identify what is in a photo. Never claim certainty. Reply with a single JSON object: {"identification": string, "confidence": number, "description": string, "funFact": string, "category": "plant"|"leaf"|"flower"|"bird"|"insect"|"tree"|"fungus"|"outdoor-object"|"unknown", "uncertain": boolean}',
    },
    {
      role: "user",
      content: "Identify what is in this photo.",
      images: [readFileSync("scripts/test-leaf.png").toString("base64")],
    },
  ],
};

const started = Date.now();
const response = await fetch("http://127.0.0.1:11434/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const elapsed = Date.now() - started;
const data = await response.json();
const content = data.message?.content ?? "";
console.log(`elapsed_ms=${elapsed}`);
try {
  console.log(JSON.stringify(JSON.parse(content), null, 2));
} catch {
  console.log("NOT VALID JSON:", content.slice(0, 500));
}
