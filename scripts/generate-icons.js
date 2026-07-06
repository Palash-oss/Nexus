const fs = require('fs');
const path = require('path');

// Simple minimal valid PNG writer in pure JS (no dependencies)
// Writes a flat color (or simple gradient) image of size W x H
function generatePng(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 2; // Color type: Truecolor (RGB)
  ihdrData[10] = 0; // Compression method: deflate
  ihdrData[11] = 0; // Filter method: adaptive
  ihdrData[12] = 0; // Interlace method: no interlace

  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk (pixel data)
  // Each row starts with a filter byte (0 = none) followed by width * 3 bytes (RGB)
  const rowSize = 1 + width * 3;
  const rawPixelData = Buffer.alloc(height * rowSize);
  
  for (let y = 0; y < height; y++) {
    rawPixelData[y * rowSize] = 0; // Filter byte: 0
    for (let x = 0; x < width; x++) {
      const idx = y * rowSize + 1 + x * 3;
      // Simple blue-to-purple gradient
      const pct = (x + y) / (width + height);
      rawPixelData[idx] = Math.min(255, Math.max(0, Math.floor(r * (1 - pct) + 147 * pct))); // R
      rawPixelData[idx + 1] = Math.min(255, Math.max(0, Math.floor(g * (1 - pct) + 51 * pct))); // G
      rawPixelData[idx + 2] = Math.min(255, Math.max(0, Math.floor(b * (1 - pct) + 234 * pct))); // B
    }
  }

  // Very simple deflate implementation (stored blocks, no compression)
  const idatData = deflateNoCompression(rawPixelData);
  const idat = createChunk('IDAT', idatData);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  
  // Calculate CRC
  const crcVal = crc32(chunk.subarray(4, 8 + len));
  chunk.writeInt32BE(crcVal, 8 + len);
  return chunk;
}

function deflateNoCompression(data) {
  // Standard zlib header: CM=8 (deflate), CINFO=7 (32K window size) -> 0x78
  // FCHECK = 0x01 (check bits) -> 0x78 0x01 is a valid header
  const header = Buffer.from([0x78, 0x01]);
  
  const blocks = [];
  let pos = 0;
  
  while (pos < data.length) {
    const chunkLen = Math.min(65535, data.length - pos);
    const lastBlock = (pos + chunkLen >= data.length) ? 1 : 0;
    
    const blockHeader = Buffer.alloc(5);
    blockHeader[0] = lastBlock; // BFINAL (1 bit) + BTYPE (00 = stored)
    blockHeader.writeUInt16LE(chunkLen, 1);
    blockHeader.writeUInt16LE(~chunkLen & 0xffff, 3);
    
    blocks.push(blockHeader);
    blocks.push(data.subarray(pos, pos + chunkLen));
    pos += chunkLen;
  }
  
  const adler = adler32(data);
  const footer = Buffer.alloc(4);
  footer.writeUInt32BE(adler, 0);
  
  return Buffer.concat([header, ...blocks, footer]);
}

// CRC32 table & function
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

function adler32(buf) {
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    s1 = (s1 + buf[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return (s2 << 16) | s1;
}

// Generate the icons
const iconsDir = path.join(__dirname, '../extension/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Color: Blue (37, 99, 235)
fs.writeFileSync(path.join(iconsDir, 'icon16.png'), generatePng(16, 16, 37, 99, 235));
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), generatePng(48, 48, 37, 99, 235));
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), generatePng(128, 128, 37, 99, 235));

console.log("Icons generated successfully!");
