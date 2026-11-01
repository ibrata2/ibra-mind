const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets', 'ibra-mind-icon.png.base64');
const encoded = fs.readFileSync(source, 'utf8').trim();
const png = Buffer.from(encoded, 'base64');
if (png.length < 1024 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
  throw new Error('The embedded IBRA MIND PNG icon is missing or invalid.');
}

fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'ibra-mind-icon.png'), png);
fs.writeFileSync(path.join(root, 'assets', 'ibra-mind-icon.png'), png);

// Windows accepts PNG-compressed icon frames in ICO files (Vista and later).
// A 256px frame remains crisp when Windows selects smaller shell sizes.
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(0, 6); // 256px is encoded as zero in an ICO directory entry.
header.writeUInt8(0, 7);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);
fs.writeFileSync(path.join(root, 'assets', 'ibra-mind.ico'), Buffer.concat([header, png]));

