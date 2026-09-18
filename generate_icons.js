// Simple PNG generator for Chrome Extension icons (16, 48, 128 px)
// Generates solid, valid PNGs with Mojaru style teal and yellow brand icon
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size, bgR, bgG, bgB, fgR, fgG, fgB) {
  const width = size;
  const height = size;

  // Raw pixel data: each row starts with filter byte 0, then RGBA for each pixel
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  const radius = width / 2;
  const cx = width / 2;
  const cy = width / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius - 1) {
        // Draw icon: check if inside "M" or central symbol
        const relX = x / width;
        const relY = y / height;

        // Golden/Yellow "M" shape or teal circle
        let isForeground = false;
        // Stylized 'M'
        if (relY >= 0.25 && relY <= 0.75) {
          // Left bar
          if (relX >= 0.22 && relX <= 0.34) isForeground = true;
          // Right bar
          if (relX >= 0.66 && relX <= 0.78) isForeground = true;
          // Diagonal left to center
          if (relY >= 0.25 && relY <= 0.60 && Math.abs(relX - (0.28 + (relY - 0.25) * 0.6)) < 0.07) isForeground = true;
          // Diagonal right to center
          if (relY >= 0.25 && relY <= 0.60 && Math.abs(relX - (0.72 - (relY - 0.25) * 0.6)) < 0.07) isForeground = true;
        }

        if (isForeground) {
          rawData[pxOffset] = fgR;
          rawData[pxOffset + 1] = fgG;
          rawData[pxOffset + 2] = fgB;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = bgR;
          rawData[pxOffset + 1] = bgG;
          rawData[pxOffset + 2] = bgB;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Transparent outside circle
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA (6)
  ihdrData[10] = 0; // Compression method: 0
  ihdrData[11] = 0; // Filter method: 0
  ihdrData[12] = 0; // Interlace method: 0
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type), data]));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
const iconSizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

iconSizes.forEach(size => {
  // Background: Deep Slate Teal [15, 118, 110], Foreground: Mojaru Gold [250, 204, 21]
  const pngBuf = createPNG(size, 15, 118, 110, 250, 204, 21);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), pngBuf);
  console.log(`Generated icon${size}.png`);
});
