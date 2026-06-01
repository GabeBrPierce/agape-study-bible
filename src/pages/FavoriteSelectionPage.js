import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { getFavorites, deleteFavorite, clearFavorites } from '../db/db';
import { BOOK_BY_ID } from '../data/books';

export default function FavoriteSelectionPage() {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const [favorites, setFavorites]       = useState([]);
  const [focusIndex, setFocusIndex]     = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    getFavorites().then(setFavorites);
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  // Items include: favorites + "Clear All" pinned at bottom
  const items = [...favorites, ...(favorites.length > 0 ? [{ id: '__clear', type: 'clear' }] : [])];
  const isClearFocused = focusIndex === items.length - 1 && items[focusIndex]?.type === 'clear';

  const handleSelect = useCallback(() => {
    const item = items[focusIndex];
    if (!item) return;
    if (item.type === 'clear') {
      setConfirmClear(true);
    } else {
      push('ChapterReaderPage', { book: item.book, chapter: item.chapter, initialVerse: item.verse });
    }
  }, [items, focusIndex, push]);

  const handleRemoveFocused = useCallback(async () => {
    const item = items[focusIndex];
    if (!item || item.type === 'clear') return;
    await deleteFavorite(item.id);
    setFavorites(prev => {
      const next = prev.filter(f => f.id !== item.id);
      setFocusIndex(i => Math.min(i, next.length > 0 ? next.length : 0));
      return next;
    });
  }, [items, focusIndex]);

  useEffect(() => {
    if (confirmClear) {
      registerKeyHandlers({
        Enter:     async () => { await clearFavorites(); setFavorites([]); setConfirmClear(false); setFocusIndex(0); },
        Backspace: () => setConfirmClear(false),
        SoftLeft:  () => setConfirmClear(false),
      });
      registerSoftkeys({ left: { label: 'Cancel', action: () => setConfirmClear(false) }, center: 'Clear All', right: '' });
      return;
    }

    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(items.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: pop,
      SoftRight: isClearFocused ? undefined : handleRemoveFocused,
    });
    registerSoftkeys({
      left:   { label: 'Back', action: pop },
      center: isClearFocused ? 'Confirm' : 'Open',
      right:  isClearFocused ? '' : { label: 'Remove', action: handleRemoveFocused },
    });
  }, [items, focusIndex, confirmClear, isClearFocused, handleSelect, handleRemoveFocused, pop,
      registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Favorites</span>
      </div>

      <div className="page-content" ref={listRef}>
        {favorites.length === 0 ? (
          <div className="empty-state">
            No favorites yet.<br />
            Select a verse in the reader and press Favorite to add one.
          </div>
        ) : (
          <>
            {items.map((item, idx) => {
              if (item.type === 'clear') {
                return (
                  <div
                    key="__clear"
                    className={`list-item${focusIndex === idx ? ' focused' : ''}`}
                    style={{ color: focusIndex === idx ? '#fff' : 'var(--color-danger)', justifyContent: 'center' }}
                    onClick={() => { setFocusIndex(idx); setConfirmClear(true); }}
                  >
                    Clear All Favorites
                  </div>
                );
              }
              const bk = BOOK_BY_ID[item.book];
              return (
                <div
                  key={item.id}
                  className={`list-item${focusIndex === idx ? ' focused' : ''}`}
                  onClick={() => { setFocusIndex(idx); push('ChapterReaderPage', { book: item.book, chapter: item.chapter, initialVerse: item.verse }); }}
                >
                  <span style={{ fontSize: 14, marginRight: 8, flexShrink: 0 }}>⭐</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>
                      {bk ? bk.name : item.book} {item.chapter}:{item.verse}
                    </div>
                    {item.preview && (
                      <div className="list-item-secondary"
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {item.preview}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {confirmClear && (
        <>
          <div className="modal-overlay" />
          <div className="confirm-dialog">
            <p>Clear all {favorites.length} favorites?</p>
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                await clearFavorites();
                setFavorites([]);
                setConfirmClear(false);
                setFocusIndex(0);
              }}>Clear All</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
