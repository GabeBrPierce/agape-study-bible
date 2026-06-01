import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { BOOKS } from '../data/books';

export default function BookSelectionPage({ preselectedBook }) {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const initialIndex = preselectedBook
    ? BOOKS.findIndex(b => b.id === preselectedBook)
    : 0;
  const [focusIndex, setFocusIndex] = useState(Math.max(0, initialIndex));
  const listRef = useRef(null);

  // Digit accumulation for jumping to book number
  const digitBuffer = useRef('');
  const digitTimer   = useRef(null);

  const moveFocus = useCallback((dir) => {
    setFocusIndex(prev => {
      const next = prev + dir;
      if (next < 0) return BOOKS.length - 1;
      if (next >= BOOKS.length) return 0;
      return next;
    });
  }, []);

  const handleSelect = useCallback(() => {
    push('ChapterSelectionPage', { book: BOOKS[focusIndex].id });
  }, [focusIndex, push]);

  const handleDigit = useCallback((digit) => {
    digitBuffer.current += digit;
    clearTimeout(digitTimer.current);
    digitTimer.current = setTimeout(() => {
      const num = parseInt(digitBuffer.current, 10);
      digitBuffer.current = '';
      if (!isNaN(num) && num >= 1 && num <= BOOKS.length) {
        setFocusIndex(num - 1);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:   () => moveFocus(-1),
      ArrowDown: () => moveFocus(1),
      Enter:     handleSelect,
      Backspace: pop,
      ...Object.fromEntries('0123456789'.split('').map(d => [d, () => handleDigit(d)])),
    });
    registerSoftkeys({ left: { label: 'Back', action: pop }, center: 'Select', right: '' });
  }, [moveFocus, handleSelect, handleDigit, pop, registerKeyHandlers, registerSoftkeys]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  const otBooks = BOOKS.filter(b => b.testament === 'OT');
  const ntBooks = BOOKS.filter(b => b.testament === 'NT');

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Select Book</span>
      </div>
      <div className="page-content" ref={listRef}>
        <div className="section-header">Old Testament</div>
        {otBooks.map((book) => {
          const idx = BOOKS.indexOf(book);
          return (
            <div
              key={book.id}
              className={`list-item${focusIndex === idx ? ' focused' : ''}`}
              onClick={() => { setFocusIndex(idx); push('ChapterSelectionPage', { book: book.id }); }}
            >
              <span style={{ width: 22, fontSize: 10, color: focusIndex === idx ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)', flexShrink: 0 }}>
                {book.canonical}
              </span>
              <span className="list-item-primary">{book.name}</span>
              <span style={{ fontSize: 11, color: focusIndex === idx ? 'rgba(255,255,255,0.6)' : 'var(--color-text-dim)' }}>
                {book.chapters} ch
              </span>
            </div>
          );
        })}

        <div className="section-header">New Testament</div>
        {ntBooks.map((book) => {
          const idx = BOOKS.indexOf(book);
          return (
            <div
              key={book.id}
              className={`list-item${focusIndex === idx ? ' focused' : ''}`}
              onClick={() => { setFocusIndex(idx); push('ChapterSelectionPage', { book: book.id }); }}
            >
              <span style={{ width: 22, fontSize: 10, color: focusIndex === idx ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)', flexShrink: 0 }}>
                {book.canonical}
              </span>
              <span className="list-item-primary">{book.name}</span>
              <span style={{ fontSize: 11, color: focusIndex === idx ? 'rgba(255,255,255,0.6)' : 'var(--color-text-dim)' }}>
                {book.chapters} ch
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
