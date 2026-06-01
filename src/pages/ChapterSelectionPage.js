import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { BOOK_BY_ID } from '../data/books';

const COLS = 5; // columns in the chapter grid

export default function ChapterSelectionPage({ book }) {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const bookData = BOOK_BY_ID[book];
  const totalChapters = bookData ? bookData.chapters : 1;
  const [focusIndex, setFocusIndex] = useState(0); // 0-based chapter index

  const digitBuffer = useRef('');
  const digitTimer   = useRef(null);
  const gridRef      = useRef(null);

  const handleSelect = useCallback(() => {
    push('ChapterReaderPage', { book, chapter: focusIndex + 1, initialVerse: 1 });
  }, [book, focusIndex, push]);

  const move = useCallback((dir) => {
    setFocusIndex(prev => {
      let next = prev + dir;
      if (next < 0) next = 0;
      if (next >= totalChapters) next = totalChapters - 1;
      return next;
    });
  }, [totalChapters]);

  const handleDigit = useCallback((d) => {
    digitBuffer.current += d;
    clearTimeout(digitTimer.current);
    digitTimer.current = setTimeout(() => {
      const num = parseInt(digitBuffer.current, 10);
      digitBuffer.current = '';
      if (!isNaN(num) && num >= 1 && num <= totalChapters) {
        setFocusIndex(num - 1);
      }
    }, 1000);
  }, [totalChapters]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:    () => move(-COLS),
      ArrowDown:  () => move(COLS),
      ArrowLeft:  () => move(-1),
      ArrowRight: () => move(1),
      Enter:      handleSelect,
      Backspace:  pop,
      ...Object.fromEntries('0123456789'.split('').map(d => [d, () => handleDigit(d)])),
    });
    registerSoftkeys({ left: { label: 'Back', action: pop }, center: 'Select', right: '' });
  }, [move, handleSelect, handleDigit, pop, registerKeyHandlers, registerSoftkeys]);

  useEffect(() => {
    if (!gridRef.current) return;
    const el = gridRef.current.querySelector('.chapter-cell.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  const chapters = Array.from({ length: totalChapters }, (_, i) => i + 1);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">{bookData ? bookData.name : book}</span>
      </div>
      <div className="page-content">
        <div
          ref={gridRef}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gap: 1,
            padding: 4,
          }}
        >
          {chapters.map((ch) => (
            <div
              key={ch}
              className={`chapter-cell${focusIndex === ch - 1 ? ' focused' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 36,
                fontSize: 13,
                border: '1px solid var(--color-border)',
                background: focusIndex === ch - 1 ? 'var(--color-focus-bg)' : 'var(--color-surface)',
                color: focusIndex === ch - 1 ? '#fff' : 'var(--color-text)',
                cursor: 'default',
                borderRadius: 3,
              }}
              onClick={() => { setFocusIndex(ch - 1); push('ChapterReaderPage', { book, chapter: ch, initialVerse: 1 }); }}
            >
              {ch}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
