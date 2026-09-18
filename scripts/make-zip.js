/**
 * make-zip.js — minimal, zero-dependency ZIP writer.
 *
 * Why this exists: Windows PowerShell's Compress-Archive writes ZIP entry
 * names with BACKSLASH separators (e.g. "icons\icon-56.png"), which violates
 * the ZIP spec (APPNOTE 4.4.17.1 requires forward slashes). KaiStore then
 * can't find "icons/icon-56.png" and rejects the package.
 *
 * This writer always uses forward slashes and produces a standards-compliant
 * archive (local headers + central directory + EOCD, deflate or store).
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Recursively collect file paths ─────────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

// ── DOS date/time encoding ──────────────────────────────────────────────────────
function dosDateTime(mtime) {
  const d = new Date(mtime);
  const year = Math.max(1980, d.getFullYear());
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const date = (((year - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

/**
 * Zip the CONTENTS of srcDir into outPath (entries are relative to srcDir,
 * so manifest etc. land at the archive root — exactly what KaiStore needs).
 */
function makeZip(srcDir, outPath) {
  const files   = walk(srcDir).sort(); // sorted = stable order
  const chunks  = [];   // local headers + data
  const central = [];   // central directory records
  let offset = 0;

  for (const full of files) {
    const rel  = path.relative(srcDir, full).split(path.sep).join('/'); // FORWARD slashes
    const data = fs.readFileSync(full);
    const crc  = crc32(data);

    // Deflate; fall back to "store" if compression doesn't help.
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const method = useDeflate ? 8 : 0;
    const body   = useDeflate ? deflated : data;

    const nameBuf = Buffer.from(rel, 'utf8');
    const { time, date } = dosDateTime(fs.statSync(full).mtime);

    // Local file header (30 bytes + name)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0x0800, 6);       // flags: UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);           // extra length
    chunks.push(local, nameBuf, body);

    // Central directory record (46 bytes + name)
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);      // signature
    cd.writeUInt16LE(20, 4);              // version made by
    cd.writeUInt16LE(20, 6);              // version needed
    cd.writeUInt16LE(0x0800, 8);          // flags: UTF-8 names
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);             // extra length
    cd.writeUInt16LE(0, 32);             // comment length
    cd.writeUInt16LE(0, 34);             // disk number
    cd.writeUInt16LE(0, 36);             // internal attrs
    cd.writeUInt32LE(0, 38);            // external attrs
    cd.writeUInt32LE(offset, 42);       // local header offset
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);     // signature
  eocd.writeUInt16LE(0, 4);              // disk number
  eocd.writeUInt16LE(0, 6);              // central dir disk
  eocd.writeUInt16LE(files.length, 8);   // entries on this disk
  eocd.writeUInt16LE(files.length, 10);  // total entries
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);        // central dir offset
  eocd.writeUInt16LE(0, 20);             // comment length

  fs.writeFileSync(outPath, Buffer.concat([...chunks, centralBuf, eocd]));
  return { count: files.length };
}

module.exports = { makeZip };
