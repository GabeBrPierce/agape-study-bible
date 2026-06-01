import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { parseAddress, BOOKS, BOOK_BY_ID } from '../data/books';

// KaiOS keypad mapping for T9-like text input
const KEYPAD_MAP = {
  '2': 'abc2', '3': 'def3', '4': 'ghi4', '5': 'jkl5',
  '6': 'mno6', '7': 'pqrs7', '8': 'tuv8', '9': 'wxyz9',
  '0': ' 0',   '1': '1',    '*': '*',     '#': '#',
};

export default function AddressSelectionPage() {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [focusIndex, setFocusIndex] = useState(-1); // -1 = input focused
  const [invalid, setInvalid] = useState(false);

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

  const appendChar = useCallback((ch) => {
    setQuery(prev => prev + ch);
    setFocusIndex(-1);
  }, []);

  const deleteChar = useCallback(() => {
    if (query.length > 0) {
      setQuery(prev => prev.slice(0, -1));
      setFocusIndex(-1);
    } else {
      pop();
    }
  }, [query, pop]);

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
      Backspace: deleteChar,
      // Keypad
      ...Object.fromEntries(
        ['0','1','2','3','4','5','6','7','8','9','*','#'].map(k => [k, () => appendChar(k)])
      ),
    });
    registerSoftkeys({
      left: { label: 'Back', action: pop },
      center: 'Go',
      right: { label: 'Topical', action: () => push('TopicalSelectionPage') },
    });
  }, [results, focusIndex, handleSelect, deleteChar, appendChar, pop, push, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Address Selection</span>
      </div>

      {/* Search bar */}
      <div className="search-bar">
        <div className="search-input-display">
          {query || <span style={{ color: 'var(--color-text-muted)' }}>Type book or address…</span>}
          <span className="cursor-blink" />
        </div>
      </div>

      {invalid && (
        <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--color-danger)' }}>
          No matching book or address
        </div>
      )}

      <div className="page-content">
        {results.map((r, idx) => (
          <div
            key={idx}
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
