import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { getHighlighters, deleteHighlighter, saveHighlighter, getHighlightMapForChapter } from '../db/db';

export default function HighlightSelectionPage({ entryPoint, versesToHighlight, onDone }) {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();
  const [highlighters, setHighlighters] = useState([]);
  const [focusIndex, setFocusIndex]     = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const listRef = useRef(null);

  const isFromReader = entryPoint === 'reader';

  useEffect(() => {
    getHighlighters().then(hls => {
      const sorted = [...hls].sort((a, b) => b.usedAt.localeCompare(a.usedAt));
      setHighlighters(sorted);
    });
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

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

  useEffect(() => {
    if (confirmDelete) {
      registerKeyHandlers({
        Enter:     async () => {
          await deleteHighlighter(confirmDelete.id);
          setHighlighters(prev => prev.filter(h => h.id !== confirmDelete.id));
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
      ArrowDown: () => setFocusIndex(prev => Math.min(highlighters.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: pop,
      SoftRight: () => push('HighlightCreationPage', {
        versesToHighlight,
        onSave: (hl) => setHighlighters(prev => [hl, ...prev]),
        onDone,
      }),
    });
    registerSoftkeys({
      left:   { label: 'Back', action: pop },
      center: isFromReader ? 'Apply' : 'Open',
      right:  { label: 'New', action: () => push('HighlightCreationPage', {
        versesToHighlight, onDone,
        onSave: (hl) => setHighlighters(prev => [hl, ...prev]),
      })},
    });
  }, [highlighters, focusIndex, confirmDelete, handleSelect, isFromReader, versesToHighlight,
      onDone, pop, push, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Highlights</span>
      </div>
      <div className="page-content" ref={listRef}>
        {highlighters.length === 0 ? (
          <div className="empty-state">No highlighters yet.<br />Press New to create one.</div>
        ) : (
          highlighters.map((hl, idx) => (
            <div
              key={hl.id}
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
              {focusIndex === idx && (
                <span
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', cursor: 'default' }}
                  onClick={e => { e.stopPropagation(); setConfirmDelete(hl); }}
                >✕</span>
              )}
            </div>
          ))
        )}
      </div>

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
