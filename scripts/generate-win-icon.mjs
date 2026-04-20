import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const iconSources = [
  { file: 'assets/icon/favicon-16.png', size: 16 },
  { file: 'assets/icon/favicon-32.png', size: 32 },
];

async function loadPngIcon(file) {
  return readFile(path.resolve(file));
}

async function buildLargestIcon() {
  const svg = await readFile(path.resolve('assets/icon/mdv.svg'), 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 256,
    },
  });
  return resvg.render().asPng();
}

function buildIco(buffers) {
  const directorySize = 6 + buffers.length * 16;
  const header = Buffer.alloc(directorySize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(buffers.length, 4);

  let offset = directorySize;
  buffers.forEach((entry, index) => {
    const entryOffset = 6 + index * 16;
    const dimension = entry.size >= 256 ? 0 : entry.size;
    header.writeUInt8(dimension, entryOffset);
    header.writeUInt8(dimension, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(entry.buffer.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += entry.buffer.length;
  });

  return Buffer.concat([header, ...buffers.map((entry) => entry.buffer)]);
}

const pngBuffers = await Promise.all(
  iconSources.map(async (entry) => ({
    size: entry.size,
    buffer: await loadPngIcon(entry.file),
  })),
);

pngBuffers.push({
  size: 256,
  buffer: await buildLargestIcon(),
});

await writeFile(path.resolve('assets/icon/mdv.ico'), buildIco(pngBuffers));
