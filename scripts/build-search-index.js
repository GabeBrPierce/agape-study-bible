#!/usr/bin/env node
/**
 * build-search-index.js
 *
 * Walks every bundled chapter file under public/data/web/ and produces a
 * single compact search index at public/data/web/search-index.json.
 *
 * Index format:
 *   {
 *     "hash":        "<sha256 of all verse text, canonical order>",
 *     "verseCount":  31102,
 *     "bookCount":   66,
 *     "generatedAt": "<ISO timestamp>",
 *     "verses": [
 *       { "b": "GEN", "c": 1, "v": 1, "t": "In the beginning..." },
 *       ...
 *     ]
 *   }
 *
 * Usage:  node scripts/build-search-index.js
 * Re-run any time the bundled data changes.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// Canonical book order (matches bundle-web.js)
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

const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'web');
const OUT_FILE = path.join(DATA_DIR, 'search-index.json');

function run() {
  const verses = [];
  const hashInput = crypto.createHash('sha256');
  let missingChapters = 0;
  let booksFound = 0;

  for (const [book, chapterCount] of BOOKS) {
    let bookHasAny = false;
    for (let ch = 1; ch <= chapterCount; ch++) {
      const file = path.join(DATA_DIR, book, `${ch}.json`);
      if (!fs.existsSync(file)) { missingChapters++; continue; }

      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        console.warn(`  parse error: ${book}/${ch}.json — ${e.message}`);
        continue;
      }

      const rawVerses = data.verses || [];
      for (const v of rawVerses) {
        const verseNum = v.verse ?? v.number ?? v.verseNumber;
        const text     = (v.text ?? v.content ?? '').trim();
        if (!text) continue;

        verses.push({ b: book, c: ch, v: verseNum, t: text });
        // Feed canonical text into the hash (book:chapter:verse:text\n)
        hashInput.update(`${book}:${ch}:${verseNum}:${text}\n`);
        bookHasAny = true;
      }
    }
    if (bookHasAny) booksFound++;
  }

  const hash = hashInput.digest('hex');

  const index = {
    hash,
    verseCount:  verses.length,
    bookCount:   booksFound,
    generatedAt: new Date().toISOString(),
    verses,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(index));

  const sizeMB = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log(`\nSearch index written to:\n  ${OUT_FILE}`);
  console.log(`\n  Verses  : ${verses.length.toLocaleString()}`);
  console.log(`  Books   : ${booksFound}`);
  console.log(  `  Missing : ${missingChapters} chapter files`);
  console.log(`  SHA-256 : ${hash}`);
  console.log(`  Size    : ${sizeMB} MB (uncompressed)`);
}

run();
