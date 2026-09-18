import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getFavorites, deleteFavorite, clearFavorites, saveFavorite } from '../db/db';
import { BOOK_BY_ID } from '../data/books';

function favRef(item) {
  const bk = BOOK_BY_ID[item.book];
  return `${bk ? bk.name : item.book} ${item.chapter}:${item.verse}`;
}

export default function FavoriteSelectionPage() {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const [favorites, setFavorites]       = useState([]);
  const [focusIndex, setFocusIndex]     = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showOptions, setShowOptions]   = useState(false);
  const [optionFocus, setOptionFocus]   = useState(0);
  const [renaming, setRenaming]         = useState(null); // favorite being renamed
  const [renameText, setRenameText]     = useState('');
  const listRef  = useRef(null);
  const itemRefs = useRef({});
  const renameRef = useRef(null);

  useEffect(() => {
    getFavorites().then(setFavorites);
  }, []);

  useEffect(() => {
    const el = itemRefs.current[focusIndex];
    const container = listRef.current;
    if (!el || !container) return;
    const targetScrollTop = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [focusIndex]);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  // Items include: favorites + "Clear All" pinned at bottom — memoized for stable deps
  const items = useMemo(
    () => [...favorites, ...(favorites.length > 0 ? [{ id: '__clear', type: 'clear' }] : [])],
    [favorites]
  );
  const focusedItem = items[focusIndex];
  const isClearFocused = focusedItem?.type === 'clear';

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

  const openRename = useCallback(() => {
    const item = items[focusIndex];
    if (!item || item.type === 'clear') return;
    setRenameText(item.label || '');
    setRenaming(item);
  }, [items, focusIndex]);

  const saveRename = useCallback(async () => {
    if (!renaming) return;
    const label = renameText.trim();
    const updated = { ...renaming, label: label || undefined };
    await saveFavorite(updated);
    setFavorites(prev => prev.map(f => f.id === updated.id ? updated : f));
    setRenaming(null);
  }, [renaming, renameText]);

  const OPTIONS = ['Open', 'Rename', 'Remove', 'Cancel'];

  const handleOptionSelect = useCallback((label) => {
    setShowOptions(false);
    switch (label) {
      case 'Open':   handleSelect(); break;
      case 'Rename': openRename(); break;
      case 'Remove': handleRemoveFocused(); break;
      default: break; // Cancel
    }
  }, [handleSelect, openRename, handleRemoveFocused]);

  useEffect(() => {
    if (renaming) {
      // Input is focused; Enter saves, Cancel/Back dismiss. Typing handled natively.
      registerKeyHandlers({
        Enter:     saveRename,
        SoftLeft:  () => setRenaming(null),
      });
      registerSoftkeys({ left: { label: 'Cancel', action: () => setRenaming(null) }, center: 'Save', right: '' });
      return;
    }

    if (confirmClear) {
      registerKeyHandlers({
        Enter:     async () => { await clearFavorites(); setFavorites([]); setConfirmClear(false); setFocusIndex(0); },
        Backspace: () => setConfirmClear(false),
        SoftLeft:  () => setConfirmClear(false),
      });
      registerSoftkeys({ left: { label: 'Cancel', action: () => setConfirmClear(false) }, center: 'Clear All', right: '' });
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
      ArrowDown: () => setFocusIndex(prev => Math.min(items.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: pop,
      SoftRight: isClearFocused ? undefined : () => { setOptionFocus(0); setShowOptions(true); },
    });
    registerSoftkeys({
      left:   { label: 'Back', action: pop },
      center: isClearFocused ? 'Confirm' : 'Open',
      right:  isClearFocused ? '' : { label: 'Options', action: () => { setOptionFocus(0); setShowOptions(true); } },
    });
  }, [items, focusIndex, confirmClear, showOptions, optionFocus, renaming, isClearFocused,
      handleSelect, handleOptionSelect, saveRename, pop, registerKeyHandlers, registerSoftkeys]);

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
                    ref={el => itemRefs.current[idx] = el}
                    className={`list-item${focusIndex === idx ? ' focused' : ''}`}
                    style={{ color: focusIndex === idx ? 'var(--color-focus-text)' : 'var(--color-danger)', justifyContent: 'center' }}
                    onClick={() => { setFocusIndex(idx); setConfirmClear(true); }}
                  >
                    Clear All Favorites
                  </div>
                );
              }
              return (
                <div
                  key={item.id}
                  ref={el => itemRefs.current[idx] = el}
                  className={`list-item${focusIndex === idx ? ' focused' : ''}`}
                  onClick={() => { setFocusIndex(idx); push('ChapterReaderPage', { book: item.book, chapter: item.chapter, initialVerse: item.verse }); }}
                >
                  <span style={{ fontSize: 14, marginRight: 8, flexShrink: 0 }}>⭐</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label || favRef(item)}
                    </div>
                    <div className="list-item-secondary"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {item.label ? favRef(item) : (item.preview || '')}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
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

      {renaming && (
        <>
          <div className="modal-overlay" />
          <div className="confirm-dialog">
            <p style={{ marginBottom: 8 }}>Rename favorite</p>
            <input
              ref={renameRef}
              className="field-input"
              type="text"
              value={renameText}
              placeholder={favRef(renaming)}
              maxLength={40}
              style={{ marginBottom: 14, textAlign: 'left' }}
              onChange={e => setRenameText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Backspace' && renameText.length === 0) { e.preventDefault(); setRenaming(null); } }}
            />
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={() => setRenaming(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveRename}>Save</button>
            </div>
          </div>
        </>
      )}

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
