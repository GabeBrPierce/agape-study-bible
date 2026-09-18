#!/usr/bin/env node
/**
 * bundle-translation.js
 * Generalized version of bundle-web.js: downloads a full Bible translation
 * and writes it into public/data/<ID>/<BOOK>/<CHAPTER>.json (same "shape 1"
 * format normalizeChapter()/ChapterReaderPage already expect — { book,
 * bookName, chapter, verses:[{verse, text}] }), then registers it in
 * public/data/manifest.json so the app lists it as bundled/offline-ready
 * without any further download.
 *
 * Usage:
 *   node scripts/bundle-translation.js kjv
 *   node scripts/bundle-translation.js kjv asv bbe
 *   node scripts/bundle-translation.js --all
 *   node scripts/bundle-translation.js --list
 *
 * Safe to re-run — skips chapter files that already exist.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ROOT     = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const MANIFEST = path.join(DATA_DIR, 'manifest.json');

const CONCURRENCY = 6;
const RETRY_MAX   = 3;
const RETRY_DELAY = 1200; // ms

// 66 canonical books, in order — index+1 == canonical number == getbible.net "nr".
const BOOKS = [
  ['GEN', 50], ['EXO', 40], ['LEV', 27], ['NUM', 36], ['DEU', 34],
  ['JOS', 24], ['JDG', 21], ['RUT', 4],  ['1SA', 31], ['2SA', 24],
  ['1KI', 22], ['2KI', 25], ['1CH', 29], ['2CH', 36], ['EZR', 10],
  ['NEH', 13], ['EST', 10], ['JOB', 42], ['PSA', 150],['PRO', 31],
  ['ECC', 12], ['SNG', 8],  ['ISA', 66], ['JER', 52], ['LAM', 5],
  ['EZK', 48], ['DAN', 12], ['HOS', 14], ['JOL', 3],  ['AMO', 9],
  ['OBA', 1],  ['JON', 4],  ['MIC', 7],  ['NAH', 3],  ['HAB', 3],
  ['ZEP', 3],  ['HAG', 2],  ['ZEC', 14], ['MAL', 4],
  ['MAT', 28], ['MRK', 16], ['LUK', 24], ['JHN', 21], ['ACT', 28],
  ['ROM', 16], ['1CO', 16], ['2CO', 13], ['GAL', 6],  ['EPH', 6],
  ['PHP', 4],  ['COL', 4],  ['1TH', 5],  ['2TH', 3],  ['1TI', 6],
  ['2TI', 4],  ['TIT', 3],  ['PHM', 1],  ['HEB', 13], ['JAS', 5],
  ['1PE', 5],  ['2PE', 3],  ['1JN', 5],  ['2JN', 1],  ['3JN', 1],
  ['JUD', 1],  ['REV', 22],
];
const BOOK_BY_NR = Object.fromEntries(BOOKS.map(([id], i) => [i + 1, id]));

// Known open/free translations available to bundle. Add more entries here as
// you find them — `source: 'getbible'` fetches one whole-Bible JSON file from
// api.getbible.net; `source: 'helloao'` fetches one file per chapter from
// bible.helloao.org (same API bibleApi.js already talks to live).
const REGISTRY = {
  kjv: {
    source: 'getbible', abbr: 'kjv', outId: 'KJV',
    name: 'King James Version', shortName: 'KJV', language: 'English',
    license: 'Public domain',
  },
  asv: {
    source: 'getbible', abbr: 'asv', outId: 'ASV',
    name: 'American Standard Version (1901)', shortName: 'ASV', language: 'English',
    license: 'Public domain',
  },
  bbe: {
    source: 'getbible', abbr: 'basicenglish', outId: 'BBE',
    name: 'Bible in Basic English', shortName: 'BBE', language: 'English',
    license: 'Public domain',
  },
  bsb: {
    source: 'helloao', apiId: 'BSB', outId: 'BSB',
    name: 'Berean Standard Bible', shortName: 'BSB', language: 'English',
    license: 'Berean.Bible — Free Use',
  },
  aab: {
    source: 'helloao', apiId: 'AAB', outId: 'AAB',
    name: 'Accessible Ancients Bible', shortName: 'AAB', language: 'English',
    license: 'Open (see bible.helloao.org)',
  },
  ght: {
    source: 'helloao', apiId: 'GHT', outId: 'GHT',
    name: "Garth's Hyper-literal Translation", shortName: 'GHT', language: 'English',
    license: 'Open (see bible.helloao.org)',
  },
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'agape-study-bible-bundler' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, attempt = 1) {
  try {
    return await fetchText(url);
  } catch (err) {
    if (attempt < RETRY_MAX) {
      await sleep(RETRY_DELAY * attempt);
      return fetchWithRetry(url, attempt + 1);
    }
    throw err;
  }
}

function writeChapter(outId, bookId, chapter, data) {
  const dir  = path.join(DATA_DIR, outId, bookId);
  const file = path.join(dir, `${chapter}.json`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

// ── Source: api.getbible.net — one whole-Bible JSON, already verse/text flat ─

async function bundleFromGetBible(cfg) {
  console.log(`  Fetching whole Bible from api.getbible.net/v2/${cfg.abbr}.json …`);
  const raw = await fetchWithRetry(`https://api.getbible.net/v2/${cfg.abbr}.json`);
  const data = JSON.parse(raw);
  const books = data.books || [];
  let written = 0, skipped = 0;

  for (const book of books) {
    const bookId = BOOK_BY_NR[book.nr];
    if (!bookId) continue; // outside our 66-book canon (e.g. Apocrypha) — skip
    for (const chapterObj of (book.chapters || [])) {
      const chapterNum = chapterObj.chapter;
      const file = path.join(DATA_DIR, cfg.outId, bookId, `${chapterNum}.json`);
      if (fs.existsSync(file)) { skipped++; continue; }
      const verses = (chapterObj.verses || []).map(v => ({ verse: v.verse, text: v.text }));
      writeChapter(cfg.outId, bookId, chapterNum, {
        book: bookId,
        bookName: book.name,
        chapter: chapterNum,
        verses,
      });
      written++;
    }
  }
  console.log(`  ${cfg.outId}: ${written} chapters written, ${skipped} already present.`);
}

// ── Source: bible.helloao.org — one file per chapter, "shape 2" content ──────

// Mirrors verseContentToText() in src/api/bibleApi.js — keep in sync if that
// function changes. Duplicated here because this is a standalone Node script.
function verseContentToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content == null ? '' : content);
  const lines = [];
  let current = '';
  const flush = () => { if (current.trim()) lines.push(current.trim()); current = ''; };
  for (const c of content) {
    if (c && typeof c === 'object' && c.lineBreak) { flush(); continue; }
    const text = typeof c === 'string' ? c : (c && typeof c.text === 'string' ? c.text : '');
    if (!text) continue;
    const isPoemLine = !!(c && typeof c === 'object' && c.poem != null);
    if (isPoemLine) { flush(); lines.push(text.trim()); }
    else { current += (current ? ' ' : '') + text; }
  }
  flush();
  return lines.join('\n');
}

async function bundleFromHelloao(cfg) {
  const queue = [];
  for (const [bookId, chapters] of BOOKS) {
    for (let ch = 1; ch <= chapters; ch++) queue.push({ bookId, chapter: ch });
  }
  const total = queue.length;
  let done = 0, written = 0, skipped = 0, failed = 0;
  const failures = [];

  async function worker() {
    while (queue.length > 0) {
      const { bookId, chapter } = queue.shift();
      const file = path.join(DATA_DIR, cfg.outId, bookId, `${chapter}.json`);
      done++;
      if (fs.existsSync(file)) { skipped++; continue; }
      try {
        const raw = await fetchWithRetry(`https://bible.helloao.org/api/${cfg.apiId}/${bookId}/${chapter}.json`);
        const json = JSON.parse(raw);
        const bookName = (json.book && json.book.name) || bookId;
        const verses = (json.chapter && json.chapter.content || [])
          .filter(item => item.type === 'verse')
          .map(item => ({ verse: item.number, text: verseContentToText(item.content) }));
        writeChapter(cfg.outId, bookId, chapter, { book: bookId, bookName, chapter, verses });
        written++;
      } catch (err) {
        failed++;
        failures.push(`${bookId} ${chapter}: ${err.message}`);
      }
      if (done % 50 === 0 || done === total) {
        process.stdout.write(`\r  ${done}/${total}  ${written} written  ${skipped} skipped  ${failed} failed  `);
      }
    }
  }

  console.log(`  Fetching ${total} chapters from bible.helloao.org/api/${cfg.apiId}/… (${CONCURRENCY} concurrent)`);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log('');
  if (failures.length) {
    console.warn(`  ${failures.length} chapter(s) failed:`);
    failures.slice(0, 10).forEach(f => console.warn('    ', f));
  }
}

// ── Manifest ──────────────────────────────────────────────────────────────────

function updateManifest(entry) {
  let manifest = { translations: [] };
  if (fs.existsSync(MANIFEST)) {
    try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (_) {}
  }
  if (!Array.isArray(manifest.translations)) manifest.translations = [];
  if (!manifest.translations.some(t => t.id === 'web')) {
    manifest.translations.unshift({ id: 'web', name: 'World English Bible', shortName: 'WEB', language: 'English' });
  }
  const idx = manifest.translations.findIndex(t => t.id === entry.id);
  if (idx >= 0) manifest.translations[idx] = entry;
  else manifest.translations.push(entry);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function bundleOne(key) {
  const cfg = REGISTRY[key];
  if (!cfg) {
    console.error(`Unknown translation "${key}". Known: ${Object.keys(REGISTRY).join(', ')}`);
    return;
  }
  console.log(`\n=== ${cfg.outId} — ${cfg.name} (${cfg.license}) ===`);
  if (cfg.source === 'getbible') await bundleFromGetBible(cfg);
  else if (cfg.source === 'helloao') await bundleFromHelloao(cfg);
  updateManifest({ id: cfg.outId, name: cfg.name, shortName: cfg.shortName, language: cfg.language });
  console.log(`  Registered ${cfg.outId} in public/data/manifest.json`);
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    console.log('Usage: node scripts/bundle-translation.js <id...> | --all | --list');
    console.log('Known translations:');
    for (const [key, cfg] of Object.entries(REGISTRY)) {
      console.log(`  ${key.padEnd(6)} ${cfg.outId.padEnd(6)} ${cfg.name} (${cfg.license})`);
    }
    return;
  }
  if (args.includes('--list')) {
    for (const [key, cfg] of Object.entries(REGISTRY)) {
      console.log(`${key}\t${cfg.outId}\t${cfg.name}\t${cfg.license}`);
    }
    return;
  }
  const keys = args.includes('--all') ? Object.keys(REGISTRY) : args;
  for (const key of keys) {
    await bundleOne(key.toLowerCase());
  }
  console.log('\nDone. Run `npm run build` to include the new translation(s) in the package.');
}

run().catch(e => { console.error(e); process.exit(1); });
