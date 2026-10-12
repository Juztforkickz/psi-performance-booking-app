// Conservative RGB comparison, shared with the workshop importer. An uncertain
// match is kept. Never use a filename or a similarity match to change ownership.
export function photoSignature(image: { width: number; height: number; data: Uint8Array }) {
  const { width, height, data } = image;
  const channels: number[] = [];
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const x0 = Math.floor(x * width / 64), x1 = Math.max(x0 + 1, Math.floor((x + 1) * width / 64));
    const y0 = Math.floor(y * height / 64), y1 = Math.max(y0 + 1, Math.floor((y + 1) * height / 64));
    const sums = [0, 0, 0];
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const offset = (Math.min(py, height - 1) * width + Math.min(px, width - 1)) * 4;
      for (let c = 0; c < 3; c++) sums[c] += data[offset + c];
    }
    const count = (x1 - x0) * (y1 - y0);
    channels.push(...sums.map(sum => Math.floor(sum / count + .5)));
  }
  return `rgb64:${width}:${height}:${channels.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export function visuallyIdentical(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const pattern = /^rgb64:(\d+):(\d+):([a-f0-9]{24576})$/;
  const first = pattern.exec(a), second = pattern.exec(b);
  if (!first || !second || Math.abs(Number(first[1]) / Number(first[2]) - Number(second[1]) / Number(second[2])) > .001) return false;
  let difference = 0, sum = 0, squared = 0;
  for (let i = 0; i < first[3].length; i += 2) {
    const v = parseInt(first[3].slice(i, i + 2), 16), w = parseInt(second[3].slice(i, i + 2), 16);
    const delta = Math.abs(v - w);
    if (delta > 3) return false;
    difference += delta; sum += v; squared += v * v;
  }
  const count = 64 * 64 * 3;
  // Flat images are ambiguous. Byte identity still handles exact duplicates.
  return difference / count <= .5 && squared / count - (sum / count) ** 2 > 64;
}

// A coarse match only selects candidates. Check every pixel as well so a small
// changed workshop detail cannot disappear inside an averaged cell.
export function identicalPhotoPixels(a: { width: number; height: number; data: Uint8Array }, b: { width: number; height: number; data: Uint8Array }) {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) return false;
  let total = 0;
  for (let i = 0; i < a.data.length; i++) {
    if (i % 4 === 3) continue;
    const difference = Math.abs(a.data[i] - b.data[i]);
    if (difference > 3) return false;
    total += difference;
  }
  return total / (a.width * a.height * 3) <= .5;
}
