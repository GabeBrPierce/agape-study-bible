import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { saveHighlighter, getHighlighters } from '../db/db';
import { BOOK_BY_ID } from '../data/books';

export default function HighlightListPage({ highlighter: initHl }) {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const [hl, setHl]           = useState(initHl);
  const [focusIndex, setFocusIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [optionFocus, setOptionFocus] = useState(0);
  const listRef = useRef(null);

  // Flatten verses for display
  const flatVerses = [];
  for (const entry of (hl.verses || [])) {
    for (const v of entry.verses) {
      flatVerses.push({ book: entry.book, chapter: entry.chapter, verse: v, entryIndex: hl.verses.indexOf(entry) });
    }
  }

  const OPTIONS = ['Remove Verse', 'Edit Highlighter', 'Cancel'];

  const handleRemoveVerse = useCallback(async (idx) => {
    const fv = flatVerses[idx];
    if (!fv) return;
    const updatedVerses = (hl.verses || []).map(entry => {
      if (entry.book === fv.book && entry.chapter === fv.chapter) {
        const newVerses = entry.verses.filter(v => v !== fv.verse);
        return newVerses.length > 0 ? { ...entry, verses: newVerses } : null;
      }
      return entry;
    }).filter(Boolean);

    const updated = { ...hl, verses: updatedVerses };
    await saveHighlighter(updated);
    setHl(updated);
  }, [hl, flatVerses]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  useEffect(() => {
    if (showOptions) {
      registerKeyHandlers({
        ArrowUp:   () => setOptionFocus(prev => Math.max(0, prev - 1)),
        ArrowDown: () => setOptionFocus(prev => Math.min(OPTIONS.length - 1, prev + 1)),
        Enter:     () => handleOptionSelect(optionFocus),
        Backspace: () => setShowOptions(false),
        SoftLeft:  () => setShowOptions(false),
      });
      registerSoftkeys({ left: { label: 'Cancel', action: () => setShowOptions(false) }, center: 'Select', right: '' });
      return;
    }

    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(flatVerses.length - 1, prev + 1)),
      Enter:     () => openVerse(focusIndex),
      Backspace: pop,
      SoftRight: () => { setOptionFocus(0); setShowOptions(true); },
    });
    registerSoftkeys({
      left:   { label: 'Back', action: pop },
      center: 'Open',
      right:  { label: 'Options', action: () => { setOptionFocus(0); setShowOptions(true); }},
    });
  }, [showOptions, optionFocus, focusIndex, flatVerses, pop, registerKeyHandlers, registerSoftkeys]); // eslint-disable-line

  const openVerse = useCallback((idx) => {
    const fv = flatVerses[idx];
    if (!fv) return;
    push('ChapterReaderPage', { book: fv.book, chapter: fv.chapter, initialVerse: fv.verse });
  }, [flatVerses, push]);

  const handleOptionSelect = useCallback((optIdx) => {
    setShowOptions(false);
    if (optIdx === 0) { handleRemoveVerse(focusIndex); }
    else if (optIdx === 1) {
      push('HighlightCreationPage', {
        existing: hl,
        onSave: (updated) => setHl(updated),
      });
    }
  }, [focusIndex, hl, handleRemoveVerse, push]);

  return (
    <div className="page">
      <div className="page-header" style={{ gap: 6 }}>
        <span className="color-swatch" style={{ background: hl.color, width: 10, height: 10, flexShrink: 0 }} />
        <span className="header-title">{hl.name}</span>
      </div>
      <div className="page-content" ref={listRef}>
        {flatVerses.length === 0 ? (
          <div className="empty-state">No highlighted verses.</div>
        ) : (
          flatVerses.map((fv, idx) => {
            const bk = BOOK_BY_ID[fv.book];
            return (
              <div
                key={`${fv.book}-${fv.chapter}-${fv.verse}`}
                className={`list-item${focusIndex === idx ? ' focused' : ''}`}
                onClick={() => { setFocusIndex(idx); openVerse(idx); }}
              >
                <span
                  className="color-swatch"
                  style={{ background: hl.color, flexShrink: 0 }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>
                    {bk ? bk.name : fv.book} {fv.chapter}:{fv.verse}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Options mini-menu */}
      {showOptions && (
        <div className="action-sheet">
          <div className="action-sheet-title">Options</div>
          {OPTIONS.map((opt, idx) => (
            <div
              key={opt}
              className={`list-item${optionFocus === idx ? ' focused' : ''}`}
              onClick={() => handleOptionSelect(idx)}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
