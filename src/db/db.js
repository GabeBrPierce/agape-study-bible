// IndexedDB wrapper for Agape Study Bible
// Stores: settings, bookmarks, highlights, favorites, chapterCache, translations,
//         readingProgress, commentaryCache

const DB_NAME = 'agape-study-bible';
const DB_VERSION = 3;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // settings — single record keyed by 'app'
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }

      // bookmarks
      if (!db.objectStoreNames.contains('bookmarks')) {
        const bookmarks = db.createObjectStore('bookmarks', { keyPath: 'id' });
        bookmarks.createIndex('bookChapter', ['book', 'chapter'], { unique: false });
        bookmarks.createIndex('usedAt', 'usedAt', { unique: false });
      }

      // highlights
      if (!db.objectStoreNames.contains('highlights')) {
        db.createObjectStore('highlights', { keyPath: 'id' });
      }

      // favorites
      if (!db.objectStoreNames.contains('favorites')) {
        const favorites = db.createObjectStore('favorites', { keyPath: 'id' });
        favorites.createIndex('bookChapterVerse', ['book', 'chapter', 'verse'], { unique: false });
        favorites.createIndex('addedAt', 'addedAt', { unique: false });
      }

      // chapterCache — keyed by "{translationId}/{book}/{chapter}"
      if (!db.objectStoreNames.contains('chapterCache')) {
        const cache = db.createObjectStore('chapterCache', { keyPath: 'key' });
        cache.createIndex('fetchedAt', 'fetchedAt', { unique: false });
      }

      // translations
      if (!db.objectStoreNames.contains('translations')) {
        db.createObjectStore('translations', { keyPath: 'id' });
      }

      // readingProgress — one record per reading plan, keyed by planId
      if (!db.objectStoreNames.contains('readingProgress')) {
        db.createObjectStore('readingProgress', { keyPath: 'planId' });
      }

      // commentaryCache — keyed by "{commentaryId}/{book}/{chapter}", plus a
      // "list" entry holding the available-commentaries catalog. Never evicted:
      // once a chapter's commentary is fetched it stays readable offline.
      if (!db.objectStoreNames.contains('commentaryCache')) {
        db.createObjectStore('commentaryCache', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ─── Generic helpers ─────────────────────────────────────────────────────────

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

function req2p(idbRequest) {
  return new Promise((resolve, reject) => {
    idbRequest.onsuccess = (e) => resolve(e.target.result);
    idbRequest.onerror   = (e) => reject(e.target.error);
  });
}

async function getAll(storeName) {
  const store = await tx(storeName);
  return req2p(store.getAll());
}

async function getOne(storeName, key) {
  const store = await tx(storeName);
  return req2p(store.get(key));
}

async function put(storeName, value, key) {
  const store = await tx(storeName, 'readwrite');
  return req2p(key !== undefined ? store.put(value, key) : store.put(value));
}

async function del(storeName, key) {
  const store = await tx(storeName, 'readwrite');
  return req2p(store.delete(key));
}

async function clear(storeName) {
  const store = await tx(storeName, 'readwrite');
  return req2p(store.clear());
}

async function getAllByIndex(storeName, indexName, value) {
  const store = await tx(storeName);
  const index = store.index(indexName);
  return req2p(index.getAll(value));
}

// ─── Settings ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  translationId: 'web',
  darkMode: true,
  fontSize: 'medium',
  internetUsage: 'always',
  savedLocation: null,
};

export async function getSettings() {
  const stored = await getOne('settings', 'app');
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await put('settings', updated, 'app');
  // Also mirror a few critical prefs to localStorage for synchronous read on startup
  try {
    localStorage.setItem('darkMode',  String(updated.darkMode));
    localStorage.setItem('fontSize',  updated.fontSize);
  } catch (_) {}
  return updated;
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

export async function getBookmarks() {
  return getAll('bookmarks');
}

export async function getBookmark(id) {
  return getOne('bookmarks', id);
}

export async function saveBookmark(bookmark) {
  await put('bookmarks', bookmark);
  return bookmark;
}

export async function deleteBookmark(id) {
  return del('bookmarks', id);
}

export async function getBookmarksByChapter(book, chapter) {
  return getAllByIndex('bookmarks', 'bookChapter', [book, chapter]);
}

export async function getRecentBookmarks(n = 3) {
  const all = await getAll('bookmarks');
  return all.sort((a, b) => b.usedAt.localeCompare(a.usedAt)).slice(0, n);
}

// ─── Highlights ──────────────────────────────────────────────────────────────

export async function getHighlighters() {
  return getAll('highlights');
}

export async function getHighlighter(id) {
  return getOne('highlights', id);
}

export async function saveHighlighter(highlighter) {
  await put('highlights', highlighter);
  return highlighter;
}

export async function deleteHighlighter(id) {
  return del('highlights', id);
}

/**
 * Returns a map of verseNumber → highlighterColor for a given book+chapter.
 * Used by ChapterReaderPage to apply highlight styles on load.
 */
export async function getHighlightMapForChapter(book, chapter) {
  const all = await getAll('highlights');
  const map = {}; // verseNumber → color
  for (const h of all) {
    for (const entry of (h.verses || [])) {
      if (entry.book === book && entry.chapter === chapter) {
        for (const v of entry.verses) {
          map[v] = h.color;
        }
      }
    }
  }
  return map;
}

/**
 * Remove specific verse numbers from all highlighters for a given book+chapter.
 * Used by the "Remove Highlight" inspect action in ChapterReaderPage.
 */
export async function removeHighlightForVerses(book, chapter, verseNumbers) {
  const verseSet = new Set(verseNumbers);
  const all = await getAll('highlights');
  for (const h of all) {
    const hasChapter = (h.verses || []).some(e => e.book === book && e.chapter === chapter);
    if (!hasChapter) continue;
    const updatedEntries = (h.verses || []).map(entry => {
      if (entry.book !== book || entry.chapter !== chapter) return entry;
      const kept = entry.verses.filter(v => !verseSet.has(v));
      return kept.length > 0 ? { ...entry, verses: kept } : null;
    }).filter(Boolean);
    await saveHighlighter({ ...h, verses: updatedEntries });
  }
}

/**
 * Add verses to a highlighter, merging them with any verses it already holds
 * in the same chapter. The verses are first removed from every highlighter
 * (this one included) so a verse only ever carries one highlight and the color
 * just applied is the one shown.
 * versesToHighlight: [{ book, chapter, verse }]. Returns the saved highlighter.
 */
export async function addVersesToHighlighter(highlighter, versesToHighlight) {
  const now = new Date().toISOString();
  const grouped = {};
  for (const v of versesToHighlight) {
    const key = `${v.book}|${v.chapter}`;
    if (!grouped[key]) grouped[key] = { book: v.book, chapter: v.chapter, verses: [] };
    grouped[key].verses.push(v.verse);
  }
  for (const g of Object.values(grouped)) {
    await removeHighlightForVerses(g.book, g.chapter, g.verses);
  }

  const stored = await getHighlighter(highlighter.id);
  const entries = ((stored ? stored.verses : highlighter.verses) || []).map(e => ({ ...e }));
  for (const g of Object.values(grouped)) {
    const entry = entries.find(e => e.book === g.book && e.chapter === g.chapter);
    if (entry) {
      entry.verses = Array.from(new Set([...entry.verses, ...g.verses])).sort((a, b) => a - b);
    } else {
      entries.push({ book: g.book, chapter: g.chapter, verses: [...g.verses].sort((a, b) => a - b), addedAt: now });
    }
  }

  const updated = { ...highlighter, verses: entries };
  await saveHighlighter(updated);
  return updated;
}

export async function getRecentHighlighters(n = 3) {
  const all = await getAll('highlights');
  return all.sort((a, b) => b.usedAt.localeCompare(a.usedAt)).slice(0, n);
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export async function getFavorites() {
  const all = await getAll('favorites');
  return all.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function saveFavorite(fav) {
  await put('favorites', fav);
  return fav;
}

export async function deleteFavorite(id) {
  return del('favorites', id);
}

export async function clearFavorites() {
  return clear('favorites');
}

export async function getFavoriteSetForChapter(book, chapter) {
  // Returns a Set of verse numbers that are favorited in this chapter
  const results = await getAllByIndex('favorites', 'bookChapterVerse',
    IDBKeyRange ? undefined : [book, chapter]
  );
  // Fallback: filter all
  const all = await getAll('favorites');
  return new Set(
    all.filter(f => f.book === book && f.chapter === chapter).map(f => f.verse)
  );
}

// ─── Commentary Cache ─────────────────────────────────────────────────────────

export async function getCachedCommentary(key) {
  return getOne('commentaryCache', key);
}

export async function cacheCommentary(key, data) {
  await put('commentaryCache', { key, data, fetchedAt: new Date().toISOString() });
}

// ─── Chapter Cache ────────────────────────────────────────────────────────────

export async function getCachedChapter(translationId, book, chapter) {
  const key = `${translationId}/${book}/${chapter}`;
  return getOne('chapterCache', key);
}

export async function cacheChapter(translationId, book, chapter, data) {
  const key = `${translationId}/${book}/${chapter}`;
  await put('chapterCache', {
    key,
    translationId,
    book,
    chapter,
    data,
    fetchedAt: new Date().toISOString(),
  });
}

/**
 * Evict cache entries older than 7 days — except chapters belonging to a
 * translation the user has fully downloaded (isInstalled), which are meant
 * to stay available offline indefinitely.
 */
export async function evictOldCache() {
  const all = await getAll('chapterCache');
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let installedIds = new Set();
  try {
    installedIds = new Set((await getAll('translations')).filter(t => t.isInstalled).map(t => t.id));
  } catch (_) {}
  for (const entry of all) {
    if (installedIds.has(entry.translationId)) continue;
    if (entry.fetchedAt < cutoff) await del('chapterCache', entry.key);
  }
}

// ─── Translations ─────────────────────────────────────────────────────────────

export async function getTranslations() {
  return getAll('translations');
}

export async function saveTranslation(translation) {
  await put('translations', translation);
  return translation;
}

export async function deleteTranslation(id) {
  return del('translations', id);
}

// ─── Reading Plan Progress ─────────────────────────────────────────────────────

export async function getReadingProgress(planId) {
  return getOne('readingProgress', planId);
}

export async function getAllReadingProgress() {
  return getAll('readingProgress');
}

export async function saveReadingProgress(record) {
  await put('readingProgress', record);
  return record;
}

export async function deleteReadingProgress(planId) {
  return del('readingProgress', planId);
}

// ─── Initialise on first run ──────────────────────────────────────────────────

export async function initDB() {
  await openDB();
  await evictOldCache();
  // Ensure default settings exist
  const s = await getOne('settings', 'app');
  if (!s) await put('settings', DEFAULT_SETTINGS, 'app');
  // Sync localStorage mirrors for startup reads
  try {
    const settings = await getSettings();
    localStorage.setItem('darkMode', String(settings.darkMode));
    localStorage.setItem('fontSize', settings.fontSize);
  } catch (_) {}
}
