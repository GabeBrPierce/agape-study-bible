import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { parseAddress, BOOKS, BOOK_BY_ID } from '../data/books';


export default function AddressSelectionPage() {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [focusIndex, setFocusIndex] = useState(-1); // -1 = input focused
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef(null);
  const listRef  = useRef(null);
  const itemRefs = useRef({});

  // Auto-focus the input on mount so the OS IME activates immediately
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll focused result to centre when navigating the list
  useEffect(() => {
    if (focusIndex < 0) return;
    const el = itemRefs.current[focusIndex];
    const container = listRef.current;
    if (!el || !container) return;
    const targetScrollTop = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [focusIndex]);

  // Filter results whenever query changes
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setResults([]); setInvalid(false); return; }

    // Attempt full address parse first
    const parsed = parseAddress(query);
    if (parsed) {
      setResults([{ type: 'address', ...parsed, label: formatAddress(parsed) }]);
      setInvalid(false);
      return;
    }

    // Partial book name match → show all books that start with query
    const bookMatches = BOOKS.filter(b =>
      b.name.toLowerCase().startsWith(q) ||
      b.abbr.toLowerCase().startsWith(q) ||
      b.id.toLowerCase().startsWith(q)
    );

    if (bookMatches.length > 0) {
      setResults(bookMatches.map(b => ({ type: 'book', book: b.id, label: b.name })));
      setInvalid(false);
    } else {
      setResults([]);
      setInvalid(true);
    }
  }, [query]);


  const handleSelect = useCallback(() => {
    if (focusIndex >= 0 && results[focusIndex]) {
      activateResult(results[focusIndex], push);
    }
  }, [focusIndex, results, push]);

  useEffect(() => {
    const totalItems = results.length;
    registerKeyHandlers({
      ArrowUp: () => {
        setFocusIndex(prev => prev <= 0 ? (totalItems > 0 ? totalItems - 1 : -1) : prev - 1);
      },
      ArrowDown: () => {
        setFocusIndex(prev => {
          if (totalItems === 0) return -1;
          return prev >= totalItems - 1 ? 0 : prev + 1;
        });
      },
      Enter: handleSelect,
    });
    registerSoftkeys({
      left: { label: 'Back', action: pop },
      center: 'Go',
      right: { label: 'Topical', action: () => push('TopicalSelectionPage') },
    });
  }, [results, focusIndex, handleSelect, pop, push, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Address Selection</span>
      </div>

      {/* Search bar — real input so the OS IME handles T9/multitap automatically */}
      <div className="search-bar">
        <input
          ref={inputRef}
          className="search-input-display"
          type="text"
          value={query}
          placeholder="Type book or address…"
          onChange={e => { setQuery(e.target.value); setFocusIndex(-1); }}
          onKeyDown={e => {
            // When the input is empty, Backspace should navigate back
            if (e.key === 'Backspace' && query.length === 0) pop();
          }}
        />
      </div>

      {invalid && (
        <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--color-danger)' }}>
          No matching book or address
        </div>
      )}

      <div className="page-content" ref={listRef}>
        {results.map((r, idx) => (
          <div
            key={idx}
            ref={el => itemRefs.current[idx] = el}
            className={`list-item${focusIndex === idx ? ' focused' : ''}`}
            onClick={() => { setFocusIndex(idx); activateResult(r, push); }}
          >
            <span className="list-item-primary">{r.label}</span>
          </div>
        ))}
        {results.length === 0 && !invalid && (
          <div className="empty-state">
            Enter a book name or address like "John 3:16"
          </div>
        )}
      </div>
    </div>
  );
}

function formatAddress({ book, chapter, verse }) {
  const b = BOOK_BY_ID[book];
  return `${b ? b.name : book} ${chapter}:${verse}`;
}

function activateResult(result, push) {
  if (result.type === 'address') {
    push('ChapterReaderPage', {
      book: result.book,
      chapter: result.chapter,
      initialVerse: result.verse,
    });
  } else if (result.type === 'book') {
    push('BookSelectionPage', { preselectedBook: result.book });
  }
}
