import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { getBookmarks, saveBookmark, deleteBookmark } from '../db/db';
import { BOOK_BY_ID } from '../data/books';

export default function BookmarkSelectionPage({ entryPoint = 'mainMenu', book, chapter, verse }) {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const [bookmarks, setBookmarks] = useState([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null); // bookmark to delete
  const listRef = useRef(null);
  const isFromReader = entryPoint === 'reader';

  useEffect(() => {
    getBookmarks().then(bms => {
      // Sort by usedAt descending
      const sorted = [...bms].sort((a, b) => b.usedAt.localeCompare(a.usedAt));
      setBookmarks(sorted);
    });
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
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
    } else {
      // Navigate to bookmarked verse
      await saveBookmark({ ...bm, usedAt: new Date().toISOString() });
      push('ChapterReaderPage', { book: bm.book, chapter: bm.chapter, initialVerse: bm.verse });
    }
  }, [bookmarks, focusIndex, isFromReader, book, chapter, verse, push, pop]);

  useEffect(() => {
    if (confirmDelete) {
      registerKeyHandlers({
        Enter:    async () => {
          await deleteBookmark(confirmDelete.id);
          setBookmarks(prev => prev.filter(b => b.id !== confirmDelete.id));
          setConfirmDelete(null);
          setFocusIndex(0);
        },
        Backspace: () => setConfirmDelete(null),
        SoftLeft:  () => setConfirmDelete(null),
      });
      registerSoftkeys({ left: { label: 'Cancel', action: () => setConfirmDelete(null) }, center: 'Delete', right: '' });
      return;
    }

    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(bookmarks.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: pop,
      SoftRight: () => push('BookmarkCreationPage', {
        onSave: (bm) => {
          setBookmarks(prev => [...prev, bm].sort((a, b) => b.usedAt.localeCompare(a.usedAt)));
        },
      }),
    });
    registerSoftkeys({
      left:   { label: 'Back', action: pop },
      center: isFromReader ? 'Save Here' : 'Open',
      right:  { label: 'New', action: () => push('BookmarkCreationPage', {
        onSave: (bm) => setBookmarks(prev => [bm, ...prev]),
      })},
    });
  }, [bookmarks, focusIndex, confirmDelete, handleSelect, isFromReader, pop, push,
      registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Bookmarks</span>
      </div>

      <div className="page-content" ref={listRef}>
        {bookmarks.length === 0 ? (
          <div className="empty-state">No bookmarks yet.<br />Press New to create one.</div>
        ) : (
          bookmarks.map((bm, idx) => {
            const bk = BOOK_BY_ID[bm.book];
            return (
              <div
                key={bm.id}
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
                {focusIndex === idx && (
                  <span
                    style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginLeft: 4, cursor: 'default' }}
                    onClick={e => { e.stopPropagation(); setConfirmDelete(bm); }}
                  >✕</span>
                )}
              </div>
            );
          })
        )}
      </div>

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
