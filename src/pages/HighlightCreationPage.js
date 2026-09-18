import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { saveHighlighter } from '../db/db';
import { HIGHLIGHT_COLORS } from '../data/books';

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function autoAbbr(name) {
  return name.split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 3);
}

export default function HighlightCreationPage({ existing, versesToHighlight, onSave, onDone, autoClose }) {
  const { pop, registerKeyHandlers, registerSoftkeys } = useApp();

  const fields = ['name', 'abbr', 'color', 'notes'];
  const [focusField, setFocusField] = useState(0);
  const [name,  setName]  = useState(existing?.name  || '');
  const [abbr,  setAbbr]  = useState(existing?.abbr  || '');
  const [color, setColor] = useState(existing?.color || HIGHLIGHT_COLORS[0]);
  const [notes, setNotes] = useState(existing?.notes || '');

  const nameRef  = useRef(null);
  const abbrRef  = useRef(null);
  const notesRef = useRef(null);
  const fieldRefs = useRef({});

  const colorIndex = HIGHLIGHT_COLORS.indexOf(color);
  const isValid    = name.length > 0;

  // Auto-focus first field on mount
  useEffect(() => { nameRef.current?.focus(); }, []);

  // Keep the focused field (and anything just below it, like the verse count)
  // scrolled into view above the softkey bar.
  useEffect(() => {
    fieldRefs.current[focusField]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusField]);

  // Focus the right input when focusField changes
  useEffect(() => {
    if (focusField === 0) nameRef.current?.focus();
    else if (focusField === 1) abbrRef.current?.focus();
    else if (focusField === 2) document.activeElement?.blur(); // release input so ◀/▶ reach the global handler
    else if (focusField === 3) notesRef.current?.focus();
  }, [focusField]);

  // Auto-fill abbr from name while on name field
  useEffect(() => {
    if (!existing && focusField === 0) setAbbr(autoAbbr(name));
  }, [name, existing, focusField]);

  const handleSave = useCallback(async () => {
    if (!isValid) return;
    const now = new Date().toISOString();

    const newVerses = [];
    if (versesToHighlight && versesToHighlight.length > 0) {
      const grouped = {};
      for (const v of versesToHighlight) {
        const key = `${v.book}|${v.chapter}`;
        if (!grouped[key]) grouped[key] = { book: v.book, chapter: v.chapter, verses: [], addedAt: now };
        grouped[key].verses.push(v.verse);
      }
      newVerses.push(...Object.values(grouped));
    }

    const hl = {
      id:        existing?.id || genId(),
      name:      name.trim(),
      abbr:      abbr.trim().toUpperCase() || autoAbbr(name),
      color,
      notes:     notes.trim(),
      createdAt: existing?.createdAt || now,
      usedAt:    now,
      verses:    existing ? [...(existing.verses || []), ...newVerses] : newVerses,
    };
    await saveHighlighter(hl);
    if (onSave) onSave(hl);
    if (onDone) onDone();
    pop(); // pop HighlightCreationPage → HighlightSelectionPage
    if (autoClose) pop(); // pop HighlightSelectionPage → reader (batched with above)
  }, [isValid, name, abbr, color, notes, existing, versesToHighlight, onSave, onDone, pop, autoClose]);

  useEffect(() => {
    const handlers = {
      ArrowUp:   () => setFocusField(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusField(prev => Math.min(fields.length - 1, prev + 1)),
      Enter:     () => { if (focusField < fields.length - 1) setFocusField(p => p + 1); else handleSave(); },
    };
    if (focusField === 2) {
      handlers.ArrowLeft  = () => setColor(HIGHLIGHT_COLORS[Math.max(0, colorIndex - 1)]);
      handlers.ArrowRight = () => setColor(HIGHLIGHT_COLORS[Math.min(HIGHLIGHT_COLORS.length - 1, colorIndex + 1)]);
    }
    registerKeyHandlers(handlers);
    registerSoftkeys({
      left:   { label: 'Cancel', action: pop },
      center: focusField < fields.length - 1 ? 'Next' : 'Save',
      // Only offer the right Save on earlier fields; on the last field the center
      // key already says Save, so showing it twice is redundant.
      right:  isValid && focusField < fields.length - 1 ? { label: 'Save', action: handleSave } : '',
    });
  }, [focusField, colorIndex, isValid, handleSave, pop,
      registerKeyHandlers, registerSoftkeys, fields.length]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">{existing ? 'Edit Highlighter' : 'New Highlighter'}</span>
      </div>
      <div className="page-content">

        {/* Name */}
        <div className={`field-row${focusField === 0 ? ' focused' : ''}`}
          ref={el => fieldRefs.current[0] = el}
          onClick={() => setFocusField(0)}>
          <div className="field-label">Name *</div>
          <input
            ref={nameRef}
            className="field-input"
            type="text"
            value={name}
            placeholder="e.g. Important"
            maxLength={40}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Backspace' && name.length === 0) pop();
            }}
          />
        </div>

        {/* Abbreviation */}
        <div className={`field-row${focusField === 1 ? ' focused' : ''}`}
          ref={el => fieldRefs.current[1] = el}
          onClick={() => setFocusField(1)}>
          <div className="field-label">Abbreviation (1–3 chars)</div>
          <input
            ref={abbrRef}
            className="field-input"
            type="text"
            value={abbr}
            placeholder="–"
            maxLength={3}
            onChange={e => setAbbr(e.target.value.toUpperCase().slice(0, 3))}
            onKeyDown={e => {
              if (e.key === 'Backspace' && abbr.length === 0) setFocusField(0);
            }}
          />
        </div>

        {/* Color */}
        <div className={`field-row${focusField === 2 ? ' focused' : ''}`}
          ref={el => fieldRefs.current[2] = el}
          onClick={() => setFocusField(2)}>
          <div className="field-label">Color {focusField === 2 ? '(◀/▶ to change)' : ''}</div>
          <div className="color-palette">
            {HIGHLIGHT_COLORS.map(c => (
              <span
                key={c}
                className={`color-dot${color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={ev => { ev.stopPropagation(); setColor(c); }}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className={`field-row${focusField === 3 ? ' focused' : ''}`}
          ref={el => fieldRefs.current[3] = el}
          onClick={() => setFocusField(3)}>
          <div className="field-label">Notes (optional)</div>
          <input
            ref={notesRef}
            className="field-input"
            type="text"
            value={notes}
            placeholder="–"
            maxLength={120}
            onChange={e => setNotes(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Backspace' && notes.length === 0) setFocusField(2);
            }}
          />
        </div>

        {versesToHighlight && versesToHighlight.length > 0 && (
          <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--color-text-dim)' }}>
            {versesToHighlight.length} verse(s) will be highlighted
          </div>
        )}
      </div>
    </div>
  );
}
