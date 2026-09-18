import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getHighlighters, deleteHighlighter, saveHighlighter } from '../db/db';

export default function HighlightSelectionPage({ entryPoint, versesToHighlight, onDone }) {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const [highlighters, setHighlighters] = useState([]);
  const [focusIndex, setFocusIndex]     = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showOptions, setShowOptions]   = useState(false);
  const [optionFocus, setOptionFocus]   = useState(0);
  const listRef  = useRef(null);
  const itemRefs = useRef({});

  const isFromReader = entryPoint === 'reader';

  useEffect(() => {
    getHighlighters().then(hls => {
      const sorted = [...hls].sort((a, b) => b.usedAt.localeCompare(a.usedAt));
      setHighlighters(sorted);
    });
  }, []);

  useEffect(() => {
    const el = itemRefs.current[focusIndex];
    const container = listRef.current;
    if (!el || !container) return;
    const targetScrollTop = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [focusIndex]);

  const resort = (list) => [...list].sort((a, b) => b.usedAt.localeCompare(a.usedAt));

  const applyHighlight = useCallback(async (hl) => {
    if (!versesToHighlight || versesToHighlight.length === 0) return;

    // Group verses by book+chapter
    const grouped = {};
    for (const v of versesToHighlight) {
      const key = `${v.book}|${v.chapter}`;
      if (!grouped[key]) grouped[key] = { book: v.book, chapter: v.chapter, verses: [], addedAt: new Date().toISOString() };
      grouped[key].verses.push(v.verse);
    }

    const updatedHl = {
      ...hl,
      usedAt: new Date().toISOString(),
      verses: [
        ...(hl.verses || []).filter(existing => {
          // Remove any overlapping entries
          const key = `${existing.book}|${existing.chapter}`;
          return !grouped[key];
        }),
        ...Object.values(grouped),
      ],
    };
    await saveHighlighter(updatedHl);
    if (onDone) onDone();
    pop();
  }, [versesToHighlight, onDone, pop]);

  const handleSelect = useCallback(() => {
    const hl = highlighters[focusIndex];
    if (!hl) return;
    if (isFromReader) {
      applyHighlight(hl);
    } else {
      push('HighlightListPage', { highlighter: hl });
    }
  }, [highlighters, focusIndex, isFromReader, applyHighlight, push]);

  const handleNew = useCallback(() => {
    push('HighlightCreationPage', {
      versesToHighlight,
      onDone,
      autoClose: isFromReader,
      onSave: (hl) => setHighlighters(prev => resort([hl, ...prev])),
    });
  }, [push, versesToHighlight, onDone, isFromReader]);

  const handleEdit = useCallback(() => {
    const hl = highlighters[focusIndex];
    if (!hl) return;
    push('HighlightCreationPage', {
      existing: hl,
      onSave: (updated) => setHighlighters(prev => resort(prev.map(h => h.id === updated.id ? updated : h))),
    });
  }, [highlighters, focusIndex, push]);

  // Memoized so its identity is stable across renders — otherwise the key/softkey
  // effect below (which lists OPTIONS as a dependency) would re-run every render
  // and re-register softkeys in a loop.
  const hasItems = highlighters.length > 0;
  const OPTIONS = useMemo(
    () => (hasItems ? ['Open', 'Edit', 'Delete', 'New', 'Cancel'] : ['New', 'Cancel']),
    [hasItems]
  );

  const handleOptionSelect = useCallback((label) => {
    setShowOptions(false);
    switch (label) {
      case 'Open':   handleSelect(); break;
      case 'Edit':   handleEdit(); break;
      case 'Delete': setConfirmDelete(highlighters[focusIndex]); break;
      case 'New':    handleNew(); break;
      default: break; // Cancel
    }
  }, [handleSelect, handleEdit, handleNew, highlighters, focusIndex]);

  useEffect(() => {
    if (confirmDelete) {
      registerKeyHandlers({
        Enter:     async () => {
          await deleteHighlighter(confirmDelete.id);
          setHighlighters(prev => prev.filter(h => h.id !== confirmDelete.id));
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
      ArrowDown: () => setFocusIndex(prev => Math.min(highlighters.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: pop,
      SoftRight: () => { setOptionFocus(0); setShowOptions(true); },
    });
    registerSoftkeys({
      left:   { label: 'Back', action: pop },
      center: isFromReader ? 'Apply' : 'Open',
      right:  { label: 'Options', action: () => { setOptionFocus(0); setShowOptions(true); } },
    });
  }, [highlighters, focusIndex, confirmDelete, showOptions, optionFocus, OPTIONS, handleSelect,
      handleOptionSelect, isFromReader, pop, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Highlights</span>
      </div>
      <div className="page-content" ref={listRef}>
        {highlighters.length === 0 ? (
          <div className="empty-state">No highlighters yet.<br />Press Options → New to create one.</div>
        ) : (
          highlighters.map((hl, idx) => (
            <div
              key={hl.id}
              ref={el => itemRefs.current[idx] = el}
              className={`list-item${focusIndex === idx ? ' focused' : ''}`}
              onClick={() => { setFocusIndex(idx); handleSelect(); }}
            >
              <span className="color-swatch" style={{ background: hl.color }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="list-item-primary">{hl.name}</div>
                <div className="list-item-secondary">
                  {(hl.verses || []).reduce((acc, g) => acc + g.verses.length, 0)} verse(s)
                </div>
              </div>
            </div>
          ))
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
            <p>Delete "{confirmDelete.name}"?<br /><span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Verse highlights will be removed on next page load.</span></p>
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                await deleteHighlighter(confirmDelete.id);
                setHighlighters(prev => prev.filter(h => h.id !== confirmDelete.id));
                setConfirmDelete(null);
              }}>Delete</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
