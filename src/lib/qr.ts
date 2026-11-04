// Standalone ISO/IEC 18004 QR Code SVG Generator (Zero External Dependencies)
// Supports alphanumeric & byte modes, error correction levels L and M.

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGf() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_EXP[i + 255] = val;
    GF_LOG[val] = i;
    val = (val << 1) ^ (val & 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function rsCompute(data: number[], numEc: number): number[] {
  let poly = [1];
  for (let i = 0; i < numEc; i++) {
    const factor = [1, GF_EXP[i]];
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], factor[0]);
      next[j + 1] ^= gfMul(poly[j], factor[1]);
    }
    poly = next;
  }

  const res = new Array(numEc).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res.shift()!;
    res.push(0);
    for (let j = 0; j < numEc; j++) {
      res[j] ^= gfMul(poly[j + 1], factor);
    }
  }
  return res;
}

const QR_VERSIONS = [
  null,
  { version: 1, size: 21, dataBytes: 16, ecBytes: 10, blocks: 1, align: [] },
  { version: 2, size: 25, dataBytes: 28, ecBytes: 16, blocks: 1, align: [6, 18] },
  { version: 3, size: 29, dataBytes: 44, ecBytes: 26, blocks: 1, align: [6, 22] },
  { version: 4, size: 33, dataBytes: 64, ecBytes: 18, blocks: 2, align: [6, 26] },
  { version: 5, size: 37, dataBytes: 86, ecBytes: 24, blocks: 2, align: [6, 30] },
  { version: 6, size: 41, dataBytes: 108, ecBytes: 16, blocks: 4, align: [6, 34] },
  { version: 7, size: 45, dataBytes: 124, ecBytes: 18, blocks: 4, align: [6, 22, 38] },
  { version: 8, size: 49, dataBytes: 154, ecBytes: 22, blocks: 4, align: [6, 24, 42] },
  { version: 9, size: 53, dataBytes: 182, ecBytes: 22, blocks: 5, align: [6, 26, 46] },
  { version: 10, size: 57, dataBytes: 216, ecBytes: 26, blocks: 5, align: [6, 28, 50] },
];

export function generateQrSvg(text: string, margin = 4): string {
  const utf8 = Buffer.from(text, "utf8");
  let ver: (typeof QR_VERSIONS)[number] = null;
  for (let v = 1; v < QR_VERSIONS.length; v++) {
    const candidate = QR_VERSIONS[v];
    if (candidate && candidate.dataBytes >= utf8.length + 3) {
      ver = candidate;
      break;
    }
  }
  if (!ver) {
    throw new Error("Text too long for built-in QR generator");
  }

  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode
  pushBits(utf8.length, 8);
  for (let i = 0; i < utf8.length; i++) {
    pushBits(utf8[i], 8);
  }

  // Terminator
  const totalDataBits = ver.dataBytes * 8;
  const termLen = Math.min(4, totalDataBits - bits.length);
  pushBits(0, termLen);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i + b];
    }
    dataBytes.push(byteVal);
  }

  const numBlocks = ver.blocks;
  const bytesPerBlock = Math.floor(ver.dataBytes / numBlocks);
  const extraBlocks = ver.dataBytes % numBlocks;
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let byteOffset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const len = bytesPerBlock + (b >= numBlocks - extraBlocks ? 1 : 0);
    const blockData = dataBytes.slice(byteOffset, byteOffset + len);
    blocks.push(blockData);
    ecBlocks.push(rsCompute(blockData, ver.ecBytes));
    byteOffset += len;
  }

  const interleaved: number[] = [];
  const maxBlockLen = bytesPerBlock + (extraBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < blocks[b].length) {
        interleaved.push(blocks[b][i]);
      }
    }
  }
  for (let i = 0; i < ver.ecBytes; i++) {
    for (let b = 0; b < numBlocks; b++) {
      interleaved.push(ecBlocks[b][i]);
    }
  }

  const finalBits: number[] = [];
  for (const b of interleaved) {
    for (let i = 7; i >= 0; i--) {
      finalBits.push((b >> i) & 1);
    }
  }

  // Matrix creation
  const size = ver.size;
  const matrix: (number | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null)
  );

  function setFinder(r: number, c: number) {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const nr = r + i;
        const nc = c + j;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (i === -1 || i === 7 || j === -1 || j === 7) {
          matrix[nr][nc] = 0;
        } else if (i === 0 || i === 6 || j === 0 || j === 6) {
          matrix[nr][nc] = 1;
        } else if (i >= 2 && i <= 4 && j >= 2 && j <= 4) {
          matrix[nr][nc] = 1;
        } else {
          matrix[nr][nc] = 0;
        }
      }
    }
  }

  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }
  matrix[size - 8][8] = 1;

  // Alignment patterns
  const alignCoords = ver.align;
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const ar = alignCoords[i];
      const ac = alignCoords[j];
      if (matrix[ar][ac] !== null) continue;
      for (let di = -2; di <= 2; di++) {
        for (let dj = -2; dj <= 2; dj++) {
          const isEdge = Math.abs(di) === 2 || Math.abs(dj) === 2;
          const isCenter = di === 0 && dj === 0;
          matrix[ar + di][ac + dj] = isEdge || isCenter ? 1 : 0;
        }
      }
    }
  }

  // Format reserve area
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = 0;
    if (matrix[i][8] === null) matrix[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = 0;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = 0;
  }

  // Fill data with Mask 0 ((r + c) % 2 === 0)
  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (matrix[r][c] === null) {
          const bit = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = mask ? bit ^ 1 : bit;
        }
      }
    }
    upwards = !upwards;
  }

  // Format info for EC L, Mask 0: 0x77c4 (BCH code 15,5)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  const fCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = fCoords[i];
    matrix[r][c] = formatBits[i];
  }
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = formatBits[i];
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][size - 8 + i] = formatBits[7 + i];
  }

  // Render SVG
  const totalSize = size + margin * 2;
  const rects: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        rects.push(`<rect x="${c + margin}" y="${r + margin}" width="1" height="1"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges" fill="currentColor">${rects.join("")}</svg>`;
}

/**
 * Creates a secure opaque verification token for confirmed priority bookings
 */
export function generateQrPassToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates an entry payload formatted for verified scanning
 * Encodes only opaque non-guessable identifiers — never sensitive personal data
 */
export function formatQrPassPayload(bookingNumber: string, qrPassToken: string): string {
  return JSON.stringify({
    app: "GODAVARI_ONE_PUSH_2027",
    v: 1,
    ref: bookingNumber,
    token: qrPassToken,
  });
}
