#!/usr/bin/env node
/**
 * build-cross-refs.js
 *
 * Converts the raw bible-cross-reference-json-master files into per-chapter
 * JSON files that the app can fetch offline.
 *
 * Source:  ../../data/cr/bible-cross-reference-json-master/bible-cross-reference-json-master/{1-32}.json
 * Output:  public/data/cr/{BOOK}/{CHAPTER}.json
 *
 * Output format (compatible with extractRefsForVerse in CrossReferenceModal):
 *   [ { "v": 1, "r": [ {"b":"EXO","c":20,"v":11,"s":74}, ... ] }, ... ]
 *
 * Refs within each verse are sorted by score (s) descending.
 * Score = in-degree: the number of distinct source verses that point TO a given
 * target verse across the entire cross-reference dataset.  Verses cited by many
 * passages are inherently more theologically significant, making this a strong
 * relevance proxy in the absence of explicit vote counts.
 *
 * Run: node scripts/build-cross-refs.js
 */

const fs   = require('fs');
const path = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────
const SRC_DIR = path.resolve(
  __dirname,
  '../../data/cr/bible-cross-reference-json-master/bible-cross-reference-json-master'
);
const OUT_DIR = path.resolve(__dirname, '../public/data/cr');

// ── Book-ID normalisation ─────────────────────────────────────────────────────
// The source data uses one abbreviation scheme; the app (helloao API) uses another.
// Map every divergent source abbreviation → the app's canonical ID.
const BOOK_ALIAS = {
  // Old Testament
  EZE: 'EZK',   // Ezekiel
  JOE: 'JOL',   // Joel
  SOS: 'SNG',   // Song of Solomon
  // New Testament
  MAR: 'MRK',   // Mark
  JOH: 'JHN',   // John
  JAM: 'JAS',   // James
  JDE: 'JUD',   // Jude
  '1JO': '1JN', // 1 John
  '2JO': '2JN', // 2 John
  '3JO': '3JN', // 3 John
};

/** Translate a raw source book abbreviation to the app's book ID */
function normalizeBook(raw) { return BOOK_ALIAS[raw] || raw; }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "EXO 20 11" → { b:"EXO", c:20, v:11 }  or  null  (book ID normalised) */
function parseRef(str) {
  const parts = str.trim().split(' ');
  if (parts.length !== 3) return null;
  const c = parseInt(parts[1], 10);
  const v = parseInt(parts[2], 10);
  if (!parts[0] || isNaN(c) || isNaN(v)) return null;
  return { b: normalizeBook(parts[0]), c, v };
}

/** "GEN 1 1" → { book:"GEN", chapter:1, verse:1 }  or  null  (book ID normalised) */
function parseVerseId(str) {
  const parts = str.trim().split(' ');
  if (parts.length !== 3) return null;
  const chapter = parseInt(parts[1], 10);
  const verse   = parseInt(parts[2], 10);
  if (!parts[0] || isNaN(chapter) || isNaN(verse)) return null;
  return { book: normalizeBook(parts[0]), chapter, verse };
}

/** Stable key for a parsed ref: "EXO.20.11" */
function refKey(ref) { return `${ref.b}.${ref.c}.${ref.v}`; }

// ── Pass 1: read all source data + compute in-degree scores ───────────────────
const srcFiles = fs.readdirSync(SRC_DIR)
  .filter(f => /^\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a) - parseInt(b));

console.log(`Pass 1: reading ${srcFiles.length} source files…`);

// byChapter: "GEN/1" → [ { v:number, rawRefs:[{b,c,v}] } ]
const byChapter = new Map();
// inDegree:  "EXO.20.11" → count of source verses pointing to this target
const inDegree  = new Map();

let totalRefs = 0;
let skipped   = 0;

for (const file of srcFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'));

  for (const key of Object.keys(data)) {
    const entry = data[key];
    const vid   = parseVerseId(entry.v || '');
    if (!vid) { skipped++; continue; }

    const { book, chapter, verse } = vid;
    const chKey = `${book}/${chapter}`;
    if (!byChapter.has(chKey)) byChapter.set(chKey, []);

    const rawRefs = [];
    for (const refStr of Object.values(entry.r || {})) {
      const parsed = parseRef(refStr);
      if (!parsed) continue;
      rawRefs.push(parsed);
      // Tally in-degree for this target verse
      const k = refKey(parsed);
      inDegree.set(k, (inDegree.get(k) || 0) + 1);
      totalRefs++;
    }

    if (rawRefs.length > 0) {
      byChapter.get(chKey).push({ v: verse, rawRefs });
    }
  }
}

console.log(`  Parsed ${byChapter.size} chapters, ${totalRefs} refs (${skipped} skipped)`);
console.log(`  In-degree table: ${inDegree.size} unique target verses`);

// Quick sanity check: most-cited verses
const top5 = [...inDegree.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
console.log('  Top-5 most-cited:', top5.map(([k, n]) => `${k}(${n})`).join('  '));

// ── Clean up stale directories for renamed books ──────────────────────────────
// If a previous build wrote files under old aliases, remove them so the app
// never accidentally fetches from a stale path.
const staleDirs = Object.keys(BOOK_ALIAS); // e.g. ['EZE','JOE','SOS','MAR',...]
for (const old of staleDirs) {
  const staleDir = path.join(OUT_DIR, old);
  if (fs.existsSync(staleDir)) {
    fs.rmSync(staleDir, { recursive: true, force: true });
    console.log(`  Removed stale directory: ${old}/`);
  }
}

// ── Pass 2: attach scores, sort, write ────────────────────────────────────────
console.log(`\nPass 2: sorting by score and writing ${byChapter.size} chapter files…`);

let filesWritten = 0;
let totalBytes   = 0;

for (const [chKey, entries] of byChapter) {
  const [book, chapterStr] = chKey.split('/');
  const outDir  = path.join(OUT_DIR, book);
  const outFile = path.join(outDir, `${chapterStr}.json`);
  fs.mkdirSync(outDir, { recursive: true });

  // Sort verse entries by verse number, then sort each verse's refs by score desc
  entries.sort((a, b) => a.v - b.v);

  const output = entries.map(({ v, rawRefs }) => {
    const scoredRefs = rawRefs.map(ref => ({
      ...ref,
      s: inDegree.get(refKey(ref)) || 1,
    }));
    // Sort refs by score descending; secondary sort by canonical position (stable)
    scoredRefs.sort((a, b) => b.s - a.s);
    return { v, r: scoredRefs };
  });

  const json = JSON.stringify(output);
  fs.writeFileSync(outFile, json, 'utf8');
  totalBytes += json.length;
  filesWritten++;
}

console.log(`Wrote ${filesWritten} files`);

const mb = (totalBytes / 1024 / 1024).toFixed(2);
console.log(`Total CR output size: ${mb} MB (${totalBytes.toLocaleString()} bytes)`);
console.log('Done.');
