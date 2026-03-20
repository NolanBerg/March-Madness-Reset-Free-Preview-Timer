// Generate minimal PNG icons for the Chrome extension using pure Node.js
const fs = require('fs');
const zlib = require('zlib');

function createPNG(size) {
  const r = size / 2;
  const pixels = Buffer.alloc(size * size * 4); // RGBA

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - r + 0.5;
      const dy = y - r + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > r - 0.5) {
        // Outside circle - transparent
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
        continue;
      }

      // Check if on a basketball line
      const lw = Math.max(1, size / 20);
      const isVLine = Math.abs(dx) < lw / 2;
      const isHLine = Math.abs(dy) < lw / 2;
      const curveDist = Math.sqrt(dx * dx + dy * dy);
      const isCurve = Math.abs(curveDist - r * 0.5) < lw / 2;

      if (isVLine || isHLine || isCurve) {
        // Dark brown lines
        pixels[idx] = 0x7c;
        pixels[idx + 1] = 0x2d;
        pixels[idx + 2] = 0x12;
        pixels[idx + 3] = 255;
      } else {
        // Orange fill
        pixels[idx] = 0xf9;
        pixels[idx + 1] = 0x73;
        pixels[idx + 2] = 0x16;
        pixels[idx + 3] = 255;
      }
    }
  }

  return encodePNG(pixels, size, size);
}

function encodePNG(pixels, width, height) {
  // Build raw image data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // No filter
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuffer, data, crcBuf]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return ~crc;
}

[16, 48, 128].forEach(size => {
  const png = createPNG(size);
  fs.writeFileSync(`icons/icon${size}.png`, png);
  console.log(`Created icon${size}.png (${png.length} bytes)`);
});
