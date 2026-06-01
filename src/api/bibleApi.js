// Agape Study Bible — API + caching layer
// Uses bible.helloao.org (Free Use Bible API)

import { getCachedChapter, cacheChapter, getSettings } from '../db/db';
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
 * Normalize helloao API response to our internal format.
 * helloao returns { book, bookName, chapter, thisChapterAudioLinks, verses, ... }
 * verses: [ { number, text } ] or [ { verse, text } ]
 */
function normalizeChapter(data) {
  const verses = (data.verses || []).map(v => ({
    verse: v.number ?? v.verse ?? v.verseNumber,
    text:  v.text ?? v.content ?? '',
  }));
  return {
    book:     data.book || '',
    bookName: data.bookName || data.book || '',
    chapter:  data.chapter,
    verses,
  };
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

/**
 * Fetch cross-reference data for a book+chapter.
 * Returns array of { verse, references: [{book, chapter, verse}] }
 */
export async function fetchCrossReferences(book, chapter) {
  if (!(await canFetch())) throw new Error('OFFLINE');
  const url = `${BASE_URL}/d/open-cross-ref/${book}/${chapter}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/**
 * Fetch interlinear data for a single verse.
 * helloao may not have this directly; we attempt a chapter-level interlinear fetch.
 */
export async function fetchInterlinear(translationId, book, chapter) {
  if (!(await canFetch())) throw new Error('OFFLINE');
  // Attempt the interlinear endpoint (may not exist for all translations)
  const url = `${BASE_URL}/${translationId}/${book}/${chapter}/interlinear.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Interlinear not available (${res.status})`);
  return res.json();
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
