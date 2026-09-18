import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { fetchCrossReferences, fetchChapter } from '../api/bibleApi';
import { BOOK_BY_ID } from '../data/books';

export default function CrossReferenceModal({ book, chapter, verse, onClose, onNavigate }) {
  const { registerKeyHandlers, registerSoftkeys, settings } = useApp();
  const [refs, setRefs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef  = useRef(null);
  const itemRefs = useRef({});

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchCrossReferences(book, chapter);
        // data is the raw response — filter to our verse
        // helloao cross-ref format: array of { v: verseNumber, r: [{b, c, v},...] }
        // or similar — normalize below
        const verseRefs = extractRefsForVerse(data, verse);

        // Fetch preview text for each ref
        const withPreviews = await Promise.all(
          verseRefs.slice(0, 20).map(async (ref) => {
            try {
              const chData = await fetchChapter(settings.translationId || 'web', ref.book, ref.chapter);
              const v = chData.verses.find(vv => vv.verse === ref.verse);
              return { ...ref, preview: v ? v.text.substring(0, 80) : '' };
            } catch {
              return { ...ref, preview: '' };
            }
          })
        );
        setRefs(withPreviews);
        setLoading(false);
      } catch (err) {
        setError(err.message === 'OFFLINE' ? 'offline' : 'error');
        setLoading(false);
      }
    }
    load();
  }, [book, chapter, verse, settings.translationId]);

  const handleSelect = useCallback(() => {
    const ref = refs[focusIndex];
    if (!ref) return;
    onNavigate(ref.book, ref.chapter, ref.verse);
  }, [refs, focusIndex, onNavigate]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(refs.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: onClose,
      SoftLeft:  onClose,
    });
    registerSoftkeys({
      left:   { label: 'Close', action: onClose },
      center: 'Go',
      right:  '',
    });
  }, [refs, focusIndex, handleSelect, onClose, registerKeyHandlers, registerSoftkeys]);

  // Scroll focused ref to vertical center of the list
  useEffect(() => {
    const el = itemRefs.current[focusIndex];
    const container = listRef.current;
    if (!el || !container) return;
    const targetScrollTop =
      el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [focusIndex]);

  const bookData = BOOK_BY_ID[book];

  return (
    <div className="modal">
      <div className="page-header">
        <span className="header-title">
          Cross Refs — {bookData ? bookData.abbr : book} {chapter}:{verse}
        </span>
      </div>

      <div className="page-content" ref={listRef}>
        {loading && (
          <div className="loading"><span className="spinner" />Loading…</div>
        )}
        {error && (
          <div className="empty-state">
            {error === 'offline' ? 'Cross references unavailable offline.' : 'Failed to load cross references.'}
          </div>
        )}
        {!loading && !error && refs.length === 0 && (
          <div className="empty-state">No cross references found.</div>
        )}
        {refs.map((ref, idx) => {
          const refBook = BOOK_BY_ID[ref.book];
          return (
            <div
              key={idx}
              ref={el => itemRefs.current[idx] = el}
              className={`list-item${focusIndex === idx ? ' focused' : ''}`}
              onClick={() => { setFocusIndex(idx); onNavigate(ref.book, ref.chapter, ref.verse); }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>
                  {refBook ? refBook.name : ref.book} {ref.chapter}:{ref.verse}
                </div>
                {ref.preview && (
                  <div style={{
                    fontSize: 11,
                    color: focusIndex === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text-dim)',
                    marginTop: 2,
                  }}>
                    {ref.preview}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function extractRefsForVerse(data, verse) {
  if (!data) return [];
  // Accept our local format (array) or various helloao API shapes
  let entries = Array.isArray(data) ? data : (data.verses || data.crossReferences || []);

  // Find the entry for our verse
  const verseEntry = entries.find(e =>
    e.verse === verse || e.v === verse || e.verseNumber === verse
  );
  if (!verseEntry) return [];

  const rawRefs = verseEntry.references || verseEntry.refs || verseEntry.r || [];
  const refs = rawRefs.map(r => ({
    book:    r.book || r.b || '',
    chapter: r.chapter || r.c || 1,
    verse:   r.verse || r.v || 1,
    // s = in-degree score from build script; present in local data, absent in API fallback
    score:   r.score || r.s || 0,
  })).filter(r => r.book);

  // Sort by score descending (local data is pre-sorted; this also handles the API fallback)
  refs.sort((a, b) => b.score - a.score);
  return refs;
}
