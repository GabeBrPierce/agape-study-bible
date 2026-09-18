import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getBookmarks, saveBookmark, deleteBookmark } from '../db/db';
import { BOOK_BY_ID } from '../data/books';

export default function BookmarkSelectionPage({ entryPoint = 'mainMenu', book, chapter, verse, onDone }) {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const [bookmarks, setBookmarks] = useState([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null); // bookmark to delete
  const [showOptions, setShowOptions] = useState(false);
  const [optionFocus, setOptionFocus] = useState(0);
  const listRef  = useRef(null);
  const itemRefs = useRef({});
  const isFromReader = entryPoint === 'reader';

  useEffect(() => {
    getBookmarks().then(bms => {
      const sorted = [...bms].sort((a, b) => b.usedAt.localeCompare(a.usedAt));
      setBookmarks(sorted);
    });
  }, []);

  useEffect(() => {
    const el = itemRefs.current[focusIndex];
    const container = listRef.current;
    if (!el || !container) return;
    const targetScrollTop = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [focusIndex]);

  const handleSelect = useCallback(async () => {
    const bm = bookmarks[focusIndex];
    if (!bm) return;

    if (isFromReader) {
      // Save current verse to this bookmark
      const updated = {
        ...bm,
        book, chapter, verse,
        usedAt: new Date().toISOString(),
      };
      await saveBookmark(updated);
      pop();
      onDone?.();
    } else {
      // Navigate to bookmarked verse
      await saveBookmark({ ...bm, usedAt: new Date().toISOString() });
      push('ChapterReaderPage', { book: bm.book, chapter: bm.chapter, initialVerse: bm.verse });
    }
  }, [bookmarks, focusIndex, isFromReader, book, chapter, verse, push, pop, onDone]);

  const resort = (list) => [...list].sort((a, b) => b.usedAt.localeCompare(a.usedAt));

  const handleNew = useCallback(() => {
    push('BookmarkCreationPage', {
      onSave: (bm) => setBookmarks(prev => resort([bm, ...prev])),
    });
  }, [push]);

  const handleEdit = useCallback(() => {
    const bm = bookmarks[focusIndex];
    if (!bm) return;
    push('BookmarkCreationPage', {
      existing: bm,
      onSave: (updated) => setBookmarks(prev => resort(prev.map(b => b.id === updated.id ? updated : b))),
    });
  }, [bookmarks, focusIndex, push]);

  // Options action sheet for the focused bookmark
  // Memoized so its identity is stable across renders — otherwise the key/softkey
  // effect (which lists OPTIONS as a dependency) would re-run every render and
  // re-register softkeys in a loop.
  const hasItems = bookmarks.length > 0;
  const OPTIONS = useMemo(
    () => (hasItems ? ['Open', 'Edit', 'Delete', 'New', 'Cancel'] : ['New', 'Cancel']),
    [hasItems]
  );

  const handleOptionSelect = useCallback((label) => {
    setShowOptions(false);
    switch (label) {
      case 'Open':   handleSelect(); break;
      case 'Edit':   handleEdit(); break;
      case 'Delete': setConfirmDelete(bookmarks[focusIndex]); break;
      case 'New':    handleNew(); break;
      default: break; // Cancel
    }
  }, [handleSelect, handleEdit, handleNew, bookmarks, focusIndex]);

  useEffect(() => {
    if (confirmDelete) {
      registerKeyHandlers({
        Enter:    async () => {
          await deleteBookmark(confirmDelete.id);
          setBookmarks(prev => prev.filter(b => b.id !== confirmDelete.id));
          setConfirmDelete(null);
          setFocusIndex(i => Math.max(0, i - 1));
        },
        Backspace: () => setConfirmDelete(null),
        SoftLeft:  () => setConfirmDelete(null),
      });
      registerSoftkeys({ left: { label: 'Cancel', action: () => setConfirmDelete(null) }, center: 'Delete', right: '' });
      return;
    }

    if (showOptions) {
      registerKeyHandlers({
        ArrowUp:   () => setOptionFocus(prev => Math.max(0, prev - 1)),
        ArrowDown: () => setOptionFocus(prev => Math.min(OPTIONS.length - 1, prev + 1)),
        Enter:     () => handleOptionSelect(OPTIONS[optionFocus]),
        Backspace: () => setShowOptions(false),
        SoftLeft:  () => setShowOptions(false),
      });
      registerSoftkeys({ left: { label: 'Cancel', action: () => setShowOptions(false) }, center: 'Select', right: '' });
      return;
    }

    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(bookmarks.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: pop,
      SoftRight: () => { setOptionFocus(0); setShowOptions(true); },
    });
    registerSoftkeys({
      left:   { label: 'Back', action: pop },
      center: isFromReader ? 'Save Here' : 'Open',
      right:  { label: 'Options', action: () => { setOptionFocus(0); setShowOptions(true); } },
    });
  }, [bookmarks, focusIndex, confirmDelete, showOptions, optionFocus, OPTIONS, handleSelect,
      handleOptionSelect, isFromReader, pop, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Bookmarks</span>
      </div>

      <div className="page-content" ref={listRef}>
        {bookmarks.length === 0 ? (
          <div className="empty-state">No bookmarks yet.<br />Press Options → New to create one.</div>
        ) : (
          bookmarks.map((bm, idx) => {
            const bk = BOOK_BY_ID[bm.book];
            return (
              <div
                key={bm.id}
                ref={el => itemRefs.current[idx] = el}
                className={`list-item${focusIndex === idx ? ' focused' : ''}`}
                onClick={() => { setFocusIndex(idx); handleSelect(); }}
              >
                <span
                  className="badge"
                  style={{ background: bm.color, marginRight: 8, fontSize: 10, flexShrink: 0 }}
                >
                  {bm.abbr}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="list-item-primary">{bm.title}</div>
                  <div className="list-item-secondary">
                    {bk ? bk.name : bm.book} {bm.chapter}:{bm.verse}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showOptions && (
        <div className="action-sheet">
          <div className="action-sheet-title">Options</div>
          {OPTIONS.map((opt, idx) => (
            <div
              key={opt}
              className={`list-item${optionFocus === idx ? ' focused' : ''}`}
              onClick={() => handleOptionSelect(opt)}
            >
              {opt}
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <>
          <div className="modal-overlay" />
          <div className="confirm-dialog">
            <p>Delete "{confirmDelete.title}"?</p>
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                await deleteBookmark(confirmDelete.id);
                setBookmarks(prev => prev.filter(b => b.id !== confirmDelete.id));
                setConfirmDelete(null);
              }}>Delete</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
