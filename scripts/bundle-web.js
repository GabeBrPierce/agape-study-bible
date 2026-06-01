#!/usr/bin/env node
/**
 * bundle-web.js
 * Downloads the full WEB (World English Bible) translation from bible.helloao.org
 * and writes each chapter to public/data/web/{BOOK}/{CHAPTER}.json
 *
 * Usage:  node scripts/bundle-web.js
 * Resume: safe to re-run — skips already-downloaded files
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CONCURRENCY = 8;   // parallel requests
const RETRY_MAX   = 3;
const RETRY_DELAY = 1200; // ms between retries

const OUT_DIR = path.join(__dirname, '..', 'public', 'data', 'web');

const BOOKS = [
  ['GEN',50],['EXO',40],['LEV',27],['NUM',36],['DEU',34],
  ['JOS',24],['JDG',21],['RUT',4], ['1SA',31],['2SA',24],
  ['1KI',22],['2KI',25],['1CH',29],['2CH',36],['EZR',10],
  ['NEH',13],['EST',10],['JOB',42],['PSA',150],['PRO',31],
  ['ECC',12],['SNG',8], ['ISA',66],['JER',52],['LAM',5],
  ['EZK',48],['DAN',12],['HOS',14],['JOL',3], ['AMO',9],
  ['OBA',1], ['JON',4], ['MIC',7], ['NAH',3], ['HAB',3],
  ['ZEP',3], ['HAG',2], ['ZEC',14],['MAL',4],
  ['MAT',28],['MRK',16],['LUK',24],['JHN',21],['ACT',28],
  ['ROM',16],['1CO',16],['2CO',13],['GAL',6], ['EPH',6],
  ['PHP',4], ['COL',4], ['1TH',5], ['2TH',3], ['1TI',6],
  ['2TI',4], ['TIT',3], ['PHM',1], ['HEB',13],['JAS',5],
  ['1PE',5], ['2PE',3], ['1JN',5], ['2JN',1], ['3JN',1],
  ['JUD',1], ['REV',22],
];

// Build full work list
const ALL = [];
for (const [book, chapters] of BOOKS) {
  for (let ch = 1; ch <= chapters; ch++) {
    ALL.push({ book, chapter: ch });
  }
}
const TOTAL = ALL.length;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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

async function downloadOne(book, chapter, attempt = 1) {
  const url  = `https://bible.helloao.org/api/web/${book}/${chapter}.json`;
  const dir  = path.join(OUT_DIR, book);
  const file = path.join(dir, `${chapter}.json`);

  if (fs.existsSync(file)) return 'skip';

  try {
    const text = await fetch(url);
    JSON.parse(text); // validate
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, text);
    return 'ok';
  } catch (err) {
    if (attempt < RETRY_MAX) {
      await sleep(RETRY_DELAY * attempt);
      return downloadOne(book, chapter, attempt + 1);
    }
    return `fail:${err.message}`;
  }
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let done = 0, skipped = 0, failed = 0;
  const failures = [];
  const queue = [...ALL];

  const startTime = Date.now();

  async function worker() {
    while (queue.length > 0) {
      const { book, chapter } = queue.shift();
      const result = await downloadOne(book, chapter);
      done++;
      if (result === 'skip') skipped++;
      else if (result !== 'ok') { failed++; failures.push(`${book} ${chapter}: ${result}`); }

      if (done % 50 === 0 || done === TOTAL) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const pct     = ((done / TOTAL) * 100).toFixed(1);
        process.stdout.write(`\r  ${done}/${TOTAL} (${pct}%)  ${skipped} skipped  ${failed} failed  ${elapsed}s  `);
      }
    }
  }

  console.log(`\nDownloading WEB translation — ${TOTAL} chapters — ${CONCURRENCY} concurrent\n`);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log('\n');

  if (failures.length > 0) {
    console.warn('Failed chapters:');
    failures.forEach(f => console.warn('  ', f));
  }

  const downloaded = TOTAL - skipped - failed;
  console.log(`Done. ${downloaded} downloaded, ${skipped} already present, ${failed} failed.`);
  console.log(`Output: ${OUT_DIR}`);
}

run().catch(e => { console.error(e); process.exit(1); });
