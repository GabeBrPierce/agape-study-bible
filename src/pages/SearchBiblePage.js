import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { searchLocal } from '../api/bibleApi';
import { BOOK_BY_ID } from '../data/books';

export default function SearchBiblePage() {
  const { push, pop, registerKeyHandlers, registerSoftkeys, settings } = useApp();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [state, setState]       = useState('idle'); // idle | searching | results | no-results
  const [focusIndex, setFocusIndex] = useState(-1);

  const debounceRef = useRef(null);
  const translationId = settings.translationId || 'web';

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setState('idle'); setResults([]); return; }

    setState('searching');
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchLocal(query, translationId, 50);
        setResults(res);
        setState(res.length === 0 ? 'no-results' : 'results');
        setFocusIndex(res.length > 0 ? 0 : -1);
      } catch {
        setResults([]);
        setState('no-results');
      }
    }, 300);
  }, [query, translationId]);

  const appendChar = useCallback((ch) => {
    setQuery(prev => prev + ch);
    setFocusIndex(-1);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
    setResults([]);
    setState('idle');
    setFocusIndex(-1);
  }, []);

  const deleteChar = useCallback(() => {
    if (query.length > 0) {
      setQuery(prev => prev.slice(0, -1));
    } else {
      pop();
    }
  }, [query, pop]);

  const openResult = useCallback((idx) => {
    const r = results[idx];
    if (!r) return;
    push('ChapterReaderPage', { book: r.book, chapter: r.chapter, initialVerse: r.verse });
  }, [results, push]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => (prev <= 0 ? results.length - 1 : prev - 1)),
      ArrowDown: () => setFocusIndex(prev => (prev >= results.length - 1 ? 0 : prev + 1)),
      Enter:     () => { if (focusIndex >= 0) openResult(focusIndex); },
      Backspace: deleteChar,
      ...Object.fromEntries(
        ['0','1','2','3','4','5','6','7','8','9','*','#'].map(k => [k, () => appendChar(k)])
      ),
    });
    registerSoftkeys({
      left:   { label: 'Back', action: pop },
      center: focusIndex >= 0 ? 'Open' : 'Search',
      right:  { label: 'Clear', action: clearQuery },
    });
  }, [results, focusIndex, openResult, deleteChar, appendChar, clearQuery, pop,
      registerKeyHandlers, registerSoftkeys]);

  function highlightMatch(text, q) {
    if (!q || !text) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Search Bible</span>
      </div>

      <div className="search-bar">
        <span style={{ fontSize: 12, color: 'var(--color-text-dim)', marginRight: 6 }}>🔍</span>
        <div className="search-input-display">
          {query || <span style={{ color: 'var(--color-text-muted)' }}>Type to search…</span>}
          <span className="cursor-blink" />
        </div>
      </div>

      <div className="page-content">
        {state === 'idle' && (
          <div className="empty-state">Search the Bible text<br />using your keypad</div>
        )}
        {state === 'searching' && (
          <div className="loading"><span className="spinner" />Searching…</div>
        )}
        {state === 'no-results' && (
          <div className="empty-state">No results for "{query}"<br />Try a broader search</div>
        )}
        {state === 'results' && results.map((r, idx) => {
          const bk = BOOK_BY_ID[r.book];
          return (
            <div
              key={idx}
              className={`list-item${focusIndex === idx ? ' focused' : ''}`}
              onClick={() => { setFocusIndex(idx); openResult(idx); }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>
                  {bk ? bk.name : r.book} {r.chapter}:{r.verse}
                </div>
                <div style={{
                  fontSize: 11,
                  color: focusIndex === idx ? 'rgba(255,255,255,0.75)' : 'var(--color-text-dim)',
                  marginTop: 2,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {highlightMatch(r.preview, query)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
