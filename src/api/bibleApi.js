// Agape Study Bible — API + caching layer
// Uses bible.helloao.org (Free Use Bible API)

import { getCachedChapter, cacheChapter, getSettings, getTranslations } from '../db/db';
import searchIndex from '../db/searchIndex';

const BASE_URL = 'https://bible.helloao.org/api';

// Check internet usage setting before any request
async function canFetch() {
  let settings;
  try { settings = await getSettings(); } catch { return false; }
  if (settings.internetUsage === 'never') return false;
  if (settings.internetUsage === 'wifi-only') {
    // navigator.connection is not available on all devices — best-effort
    if (navigator.connection && navigator.connection.type) {
      return navigator.connection.type === 'wifi';
    }
  }
  return navigator.onLine !== false;
}

/**
 * Fetch a chapter. Strategy:
 * 1. Try local bundled file: /data/{translationId}/{BOOK}/{CHAPTER}.json
 * 2. Try IndexedDB cache
 * 3. Fetch from API and cache
 *
 * Returns { verses: [{verse, text}], book, chapter, bookName } or throws.
 */
export async function fetchChapter(translationId, book, chapter) {
  // 1. Try local bundled asset
  try {
    const res = await fetch(`/data/${translationId}/${book}/${chapter}.json`);
    if (res.ok) {
      const json = await res.json();
      return normalizeChapter(json);
    }
  } catch (_) {}

  // 2. Try IndexedDB cache
  try {
    const cached = await getCachedChapter(translationId, book, chapter);
    if (cached) return normalizeChapter(cached.data);
  } catch (_) {}

  // 3. Fetch from API
  if (!(await canFetch())) {
    throw new Error('OFFLINE');
  }

  const url = `${BASE_URL}/${translationId}/${book}/${chapter}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();

  try { await cacheChapter(translationId, book, chapter, json); } catch (_) {}

  return normalizeChapter(json);
}

/**
 * Normalize a chapter response to our internal format: { book, bookName, chapter, verses }
 *
 * Two shapes are handled:
 *
 * 1. Bundled local files  (public/data/web/…)
 *    { book:"GEN", bookName:"Genesis", chapter:1,
 *      verses: [{ verse:1, text:"In the beginning…" }, …] }
 *
 * 2. helloao live API  (bible.helloao.org/api/{id}/{BOOK}/{CH}.json)
 *    { book:{shortName,name,…}, chapter:{ number:1,
 *      content:[{type:"verse",number:1,content:["text",{noteId:0},"more"]},…] },
 *      translation:{…}, … }
 *
 * Verse content in shape 2 is a mixed array of plain strings and inline objects.
 * Some translations (KJV, poetry, red-letter, etc.) wrap the actual words in
 * objects like { text:"…", poem:1 } or { text:"…", wordsOfJesus:true }, alongside
 * pure-marker objects like { lineBreak:true } or { noteId:0 } that carry no text.
 * We must therefore pull the words out of both bare strings AND any object with a
 * string `text` field — keeping only strings drops whole verses in those bibles.
 *
 * Poetry (Psalms, prophetic oracles, etc.) marks each printed line with its own
 * `poem` chunk (e.g. Psalm 23:1 is two chunks: "The LORD is my shepherd;" /poem 1
 * and "I shall not want." /poem 2). Simply joining every chunk with a space
 * collapses the whole verse into one run-on line and loses the poetic structure,
 * so each `poem` chunk — and any explicit `lineBreak` marker — starts a new line
 * (joined with "\n"); ordinary prose chunks are still joined with a single space
 * on the current line, exactly as before.
 */
function verseContentToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');

  const lines = [];
  let current = '';
  const flush = () => {
    if (current.trim()) lines.push(current.trim());
    current = '';
  };

  for (const c of content) {
    if (c && typeof c === 'object' && c.lineBreak) {
      flush();
      continue;
    }
    const text = typeof c === 'string' ? c : (c && typeof c.text === 'string' ? c.text : '');
    if (!text) continue;
    const isPoemLine = !!(c && typeof c === 'object' && c.poem != null);
    if (isPoemLine) {
      flush();
      lines.push(text.trim());
    } else {
      current += (current ? ' ' : '') + text;
    }
  }
  flush();
  return lines.join('\n');
}

function normalizeChapter(data) {
  let verses;

  if (data.verses) {
    // Shape 1 — bundled / already-normalised cache
    verses = data.verses.map(v => ({
      verse: v.number ?? v.verse ?? v.verseNumber,
      text:  typeof v.text === 'string' ? v.text : (v.content ?? ''),
    }));
  } else if (data.chapter?.content) {
    // Shape 2 — live helloao API
    verses = data.chapter.content
      .filter(item => item.type === 'verse')
      .map(item => ({
        verse: item.number,
        text: verseContentToText(item.content),
      }));
  } else {
    verses = [];
  }

  // In shape 2, book is an object; in shape 1 it's already a string.
  const bookId   = typeof data.book === 'object'
    ? (data.book?.shortName || data.book?.id || '')
    : (data.book || '');
  const bookName = data.bookName
    || (typeof data.book === 'object' ? data.book?.name : '')
    || bookId;
  const chapterNum = typeof data.chapter === 'object'
    ? data.chapter?.number
    : data.chapter;

  return { book: bookId, bookName, chapter: chapterNum, verses };
}

/**
 * Fetch available translations list from the API.
 * Returns array of { id, name, shortName, language, ... }
 */
export async function fetchAvailableTranslations() {
  if (!(await canFetch())) throw new Error('OFFLINE');
  const res = await fetch(`${BASE_URL}/available_translations.json`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  // helloao returns { translations: [...] }
  return json.translations || json || [];
}

// ─── Bundled / installed translation catalog ──────────────────────────────────

let _bundledCache = null;

/**
 * Translations shipped inside the app package (public/data/<id>/…), available
 * fully offline from install with no download needed. Read from
 * public/data/manifest.json, which scripts/bundle-translation.js keeps up to
 * date as translations are added. WEB is always guaranteed even if the
 * manifest is missing or fails to load.
 */
export async function getBundledTranslations() {
  if (_bundledCache) return _bundledCache;
  const fallback = [{ id: 'web', name: 'World English Bible', shortName: 'WEB', language: 'English' }];
  try {
    const res = await fetch('/data/manifest.json');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.translations) && json.translations.length > 0) {
        _bundledCache = json.translations;
        return _bundledCache;
      }
    }
  } catch (_) {}
  _bundledCache = fallback;
  return fallback;
}

/**
 * Every translation available to read right now, offline — bundled translations
 * plus any the user has separately downloaded (fully cached) via
 * VersionSelectionPage. Used by SettingsPage/VersionSelectionPage's "Installed"
 * list and by CompareTranslationsPage to know what it can cycle through.
 */
export async function getInstalledTranslations() {
  const bundled = await getBundledTranslations();
  let dbTranslations = [];
  try { dbTranslations = await getTranslations(); } catch (_) {}
  const bundledIds = new Set(bundled.map(t => t.id));
  const downloaded = dbTranslations.filter(t => t.isInstalled && !bundledIds.has(t.id));
  return [
    ...bundled.map(t => ({ ...t, isInstalled: true, isBundled: true })),
    ...downloaded,
  ];
}

/**
 * Fetch cross-reference data for a book+chapter.
 * Strategy:
 *   1. Local bundled file: /data/cr/{BOOK}/{CHAPTER}.json  (always tried first)
 *   2. Remote API fallback (requires connectivity)
 *
 * Returns array of { v: verseNum, r: [{b, c, v}] } — compatible with
 * extractRefsForVerse in CrossReferenceModal.
 */
export async function fetchCrossReferences(book, chapter) {
  // 1. Try local bundled cross-reference file
  try {
    const res = await fetch(`/data/cr/${book}/${chapter}.json`);
    if (res.ok) return res.json();
  } catch (_) {}

  // 2. Fall back to remote API
  if (!(await canFetch())) throw new Error('OFFLINE');
  const url = `${BASE_URL}/d/open-cross-ref/${book}/${chapter}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// Interlinear + lexicon data repo (served via GitHub Pages).
const INTERLINEAR_BASE = 'https://gabebrpierce.github.io/bible-interlinear';
const LEXICON_BASE = `${INTERLINEAR_BASE}/lexicon`;

/**
 * Fetch interlinear data for a single verse.
 * Source: {INTERLINEAR_BASE}/{BOOK}/{CHAPTER}/{VERSE}.json
 * Returns { ref, book, chapter, verse, testament, words: [{original, translit, strongs, morph, gloss}] }
 */
export async function fetchInterlinear(book, chapter, verse) {
  if (!(await canFetch())) throw new Error('OFFLINE');
  const url = `${INTERLINEAR_BASE}/${book}/${chapter}/${verse}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Interlinear not available (${res.status})`);
  return res.json();
}

/**
 * Normalize a verse token's `strongs` field to a lexicon file key.
 * Tokens are compound, e.g. "H9003/{H7225G}", "{H1254A}",
 * "H9009/{H0776G}\\H9016", or NT "G3779". The lexical word is the one in
 * {braces}; if there are none, the bare id is used. The disambiguation suffix
 * is folded (H7225G -> H7225) and digits padded to 4 to match the repo's
 * base-number files (H0001.json, G0041.json). H9xxx codes are grammatical
 * particles, served from lexicon/particles.json.
 * Returns { key, isParticle } or null.
 */
export function strongsToLexKey(strongsField) {
  if (!strongsField) return null;
  const raw = Array.isArray(strongsField) ? strongsField.join('/') : String(strongsField);
  let id = null;
  const braced = raw.match(/\{([^}]+)\}/g);
  if (braced && braced.length) {
    id = braced[0].replace(/[{}]/g, '');
  } else {
    const ids = raw.match(/[GH]\d+[A-Za-z]?/g) || [];
    // prefer a real lexical id over a grammatical H9xxx particle
    id = ids.find((t) => !/^H9\d{3}$/.test(t)) || ids[0] || null;
  }
  if (!id) return null;
  const m = id.match(/^([GH])(\d+)([A-Za-z]*)$/);
  if (!m) return null;
  const letter = m[1];
  const n = parseInt(m[2], 10);
  const key = letter + String(n).padStart(4, '0');
  const suffix = m[3] || '';   // disambiguation letter, e.g. "G0435H" -> "H"
  const isParticle = letter === 'H' && n >= 9000 && n <= 9999;
  return { key, isParticle, suffix };
}

// particles.json is small (~50 entries); fetch once and keep in memory.
let _particlesCache = null;
async function getParticles() {
  if (_particlesCache) return _particlesCache;
  const res = await fetch(`${LEXICON_BASE}/particles.json`);
  if (!res.ok) throw new Error(`Particles not available (${res.status})`);
  _particlesCache = await res.json();
  return _particlesCache;
}

/**
 * Look up every verse where a Strong's word occurs, from the occurrence index
 * served alongside the lexicon (one file per key at {LEXICON_BASE}/occ/<KEY>.json).
 * Only the file for the word being viewed is fetched. Accepts the raw compound
 * `strongs` field or a normalized key (e.g. "H7225").
 * Returns an array of { book, chapter, verse } (book = 3-letter code). Empty when
 * offline, or when the word has no occurrence data (e.g. NT/Greek words, which
 * the index omits).
 */
const _occCache = new Map();
export async function getOccurrences(strongsField) {
  const norm = typeof strongsField === 'string' && /^[GH]\d{4}$/.test(strongsField)
    ? { key: strongsField }
    : strongsToLexKey(strongsField);
  if (!norm || !norm.key) return [];
  const key = norm.key;
  if (_occCache.has(key)) return _occCache.get(key);
  if (!(await canFetch())) return [];

  let result = [];
  try {
    const res = await fetch(`${LEXICON_BASE}/occ/${key}.json`);
    if (res.ok) {
      const tuples = await res.json(); // [[book, chapter, verse], …]
      result = tuples.map(([book, chapter, verse]) => ({ book, chapter, verse }));
    }
  } catch (_) {}
  _occCache.set(key, result);
  return result;
}

/**
 * Fetch the lexicon entry for a verse token's Strong's field.
 * Accepts the raw compound `strongs` string (or array); normalization to the
 * correct base-number file key is handled internally. H9xxx particles are
 * resolved from particles.json, preferring BDB prose when present.
 * Returns { strongs, word, translit, morph, pos, root, gloss, definition,
 *           references, testament }.
 */
export async function fetchLexicon(strongsField) {
  if (!(await canFetch())) throw new Error('OFFLINE');
  const norm = strongsToLexKey(strongsField);
  if (!norm) throw new Error("No Strong's number");

  if (norm.isParticle) {
    const particles = await getParticles();
    const p = particles[norm.key];
    if (!p) throw new Error('Particle entry not found');
    const b = p.bdb || null;
    return {
      strongs: p.strongs,
      word: p.word,
      translit: p.translit,
      morph: p.morph,
      pos: b ? b.pos : '',
      root: '',
      gloss: (b && b.gloss) || p.gloss,
      definition: (b && b.definition) || p.definition,
      references: (b && b.references) || [],
      testament: p.testament,
      isParticle: true,
    };
  }

  // Some Abbott-Smith Greek entries (and a few Hebrew) are stored only under a
  // disambiguation suffix — e.g. ἀνήρ is "G0435G"/"G0435H" with no plain
  // "G0435.json". Try the suffix the token actually carried first, then the
  // folded base, then the known variant suffixes.
  const candidates = [];
  if (norm.suffix) candidates.push(norm.key + norm.suffix);
  candidates.push(norm.key, norm.key + 'G', norm.key + 'H');

  const seen = new Set();
  for (const cand of candidates) {
    if (seen.has(cand)) continue;
    seen.add(cand);
    const res = await fetch(`${LEXICON_BASE}/${cand}.json`);
    if (res.ok) return res.json();
  }
  throw new Error('Lexicon entry not found');
}

/**
 * Search locally cached/bundled verses for a query string.
 * This is a simple in-memory text search over locally available chapters.
 * For a full implementation, an offline search index would be needed.
 * Returns array of { book, chapter, verse, preview } up to maxResults.
 */
export async function searchLocal(query, translationId = 'web', maxResults = 50) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const results = [];

  return searchIndex.searchLocal(q, translationId, maxResults);
}
