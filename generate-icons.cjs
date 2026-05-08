const zlib = require('zlib')
const fs = require('fs')

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c
}
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function makePNG(size, bg) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 3 // indexed color

  // Build palette: bg color + accent
  const [br, bg2, bb] = bg
  const accent = [251, 191, 36] // #fbbf24 yellow

  const plte = Buffer.alloc(256 * 3)
  plte[0] = br; plte[1] = bg2; plte[2] = bb   // index 0 = bg
  plte[3] = 255; plte[4] = 255; plte[5] = 255 // index 1 = white
  plte[6] = accent[0]; plte[7] = accent[1]; plte[8] = accent[2] // index 2 = yellow

  // Draw: rounded rect background + simple W letter
  const pixels = new Uint8Array(size * size)

  const r = Math.floor(size * 0.18) // corner radius
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.min(x, size - 1 - x)
      const cy = Math.min(y, size - 1 - y)
      if (cx >= r || cy >= r || (cx - r) * (cx - r) + (cy - r) * (cy - r) <= r * r) {
        pixels[y * size + x] = 0 // bg
      } else {
        pixels[y * size + x] = 1 // white corner (transparent effect)
      }
    }
  }

  // Draw "₩" symbol as simple pixels in center
  const sym = [
    [0,0,0,0,1,0,0,0,1,0,0,0,0],
    [0,0,0,0,1,0,0,0,1,0,0,0,0],
    [0,0,0,1,0,1,0,1,0,1,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,0,0,1,0,1,0,1,0,1,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,0,0,0,1,0,1,0,1,0,0,0,0],
    [0,0,0,0,0,1,0,1,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,0,0,0,0],
  ]
  const sw = sym[0].length
  const sh = sym.length
  const sx = Math.floor((size - sw * Math.floor(size / 20)) / 2)
  const sy = Math.floor((size - sh * Math.floor(size / 20)) / 2)
  const scale = Math.floor(size / 20)

  for (let row = 0; row < sh; row++) {
    for (let col = 0; col < sw; col++) {
      if (sym[row][col]) {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = sx + col * scale + dx
            const py = sy + row * scale + dy
            if (px >= 0 && px < size && py >= 0 && py < size) {
              pixels[py * size + px] = 2 // yellow
            }
          }
        }
      }
    }
  }

  // Build scanlines
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size)
    row[0] = 0
    for (let x = 0; x < size; x++) row[1 + x] = pixels[y * size + x]
    rows.push(row)
  }
  const raw = Buffer.concat(rows)
  const idat = zlib.deflateSync(raw)

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const bg = [30, 58, 95] // #1e3a5f
fs.writeFileSync('public/icon-192.png', makePNG(192, bg))
fs.writeFileSync('public/icon-512.png', makePNG(512, bg))
console.log('✅ 아이콘 생성 완료')
