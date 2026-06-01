// Search index: searches over the IndexedDB chapter cache + local assets
// Returns { book, chapter, verse, preview } results

const searchIndex = {
  async searchLocal(query, translationId = 'web', maxResults = 50) {
    const q = query.toLowerCase();
    const results = [];

    // Open the chapter cache store directly
    try {
      const dbReq = indexedDB.open('agape-study-bible', 1);
      const db = await new Promise((res, rej) => {
        dbReq.onsuccess = e => res(e.target.result);
        dbReq.onerror   = e => rej(e.target.error);
      });

      const tx = db.transaction('chapterCache', 'readonly');
      const store = tx.objectStore('chapterCache');
      const allEntries = await new Promise((res, rej) => {
        const r = store.getAll();
        r.onsuccess = e => res(e.target.result);
        r.onerror   = e => rej(e.target.error);
      });

      for (const entry of allEntries) {
        if (entry.translationId !== translationId) continue;
        const verses = entry.data?.verses || [];
        for (const v of verses) {
          const text = (v.text || v.content || '').toLowerCase();
          if (text.includes(q)) {
            results.push({
              book:    entry.book,
              chapter: entry.chapter,
              verse:   v.number ?? v.verse ?? v.verseNumber,
              preview: (v.text || v.content || '').substring(0, 100),
            });
            if (results.length >= maxResults) break;
          }
        }
        if (results.length >= maxResults) break;
      }
    } catch (err) {
      console.error('searchLocal error:', err);
    }

    return results;
  }
};

export default searchIndex;
