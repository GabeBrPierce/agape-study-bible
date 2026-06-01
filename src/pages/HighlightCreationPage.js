import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { saveHighlighter } from '../db/db';
import { HIGHLIGHT_COLORS } from '../data/books';

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function autoAbbr(name) {
  return name.split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 3);
}

export default function HighlightCreationPage({ existing, versesToHighlight, onSave, onDone }) {
  const { pop, registerKeyHandlers, registerSoftkeys } = useApp();

  const fields = ['name', 'abbr', 'color', 'notes'];
  const [focusField, setFocusField] = useState(0);
  const [name,  setName]  = useState(existing?.name  || '');
  const [abbr,  setAbbr]  = useState(existing?.abbr  || '');
  const [color, setColor] = useState(existing?.color || HIGHLIGHT_COLORS[0]);
  const [notes, setNotes] = useState(existing?.notes || '');

  const colorIndex = HIGHLIGHT_COLORS.indexOf(color);
  const isValid    = name.length > 0;

  useEffect(() => {
    if (!existing && focusField === 0) setAbbr(autoAbbr(name));
  }, [name, existing, focusField]);

  const typeChar = useCallback((ch) => {
    if (focusField === 0) setName(prev => prev.slice(0, 39) + ch);
    if (focusField === 1) setAbbr(prev => prev.slice(0, 2) + ch);
    if (focusField === 3) setNotes(prev => prev.slice(0, 119) + ch);
  }, [focusField]);

  const deleteLast = useCallback(() => {
    if (focusField === 0) { name.length > 0 ? setName(p => p.slice(0,-1)) : pop(); }
    if (focusField === 1) { abbr.length  > 0 ? setAbbr(p => p.slice(0,-1)) : setFocusField(0); }
    if (focusField === 3) { notes.length > 0 ? setNotes(p => p.slice(0,-1)) : setFocusField(2); }
  }, [focusField, name, abbr, notes, pop]);

  const handleSave = useCallback(async () => {
    if (!isValid) return;
    const now = new Date().toISOString();

    // Build verses array from versesToHighlight
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
    pop();
  }, [isValid, name, abbr, color, notes, existing, versesToHighlight, onSave, onDone, pop]);

  useEffect(() => {
    const handlers = {
      ArrowUp:   () => setFocusField(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusField(prev => Math.min(fields.length - 1, prev + 1)),
      Enter:     () => { if (focusField < fields.length - 1) setFocusField(p => p + 1); else handleSave(); },
      Backspace: deleteLast,
      SoftLeft:  () => pop(),
    };
    if (focusField === 2) {
      handlers.ArrowLeft  = () => setColor(HIGHLIGHT_COLORS[Math.max(0, colorIndex - 1)]);
      handlers.ArrowRight = () => setColor(HIGHLIGHT_COLORS[Math.min(HIGHLIGHT_COLORS.length - 1, colorIndex + 1)]);
    } else {
      [...'0123456789*#'].forEach(d => { handlers[d] = () => typeChar(d); });
    }
    registerKeyHandlers(handlers);
    registerSoftkeys({
      left:   { label: 'Cancel', action: pop },
      center: focusField < fields.length - 1 ? 'Next' : 'Save',
      right:  isValid ? { label: 'Save', action: handleSave } : '',
    });
  }, [focusField, colorIndex, isValid, handleSave, deleteLast, typeChar, pop,
      registerKeyHandlers, registerSoftkeys, fields.length]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">{existing ? 'Edit Highlighter' : 'New Highlighter'}</span>
      </div>
      <div className="page-content">
        <div className={`field-row${focusField === 0 ? ' focused' : ''}`}>
          <div className="field-label">Name *</div>
          <div className="field-value">
            {name || <span style={{ color: 'var(--color-text-muted)' }}>e.g. Important</span>}
            {focusField === 0 && <span className="cursor-blink" />}
          </div>
        </div>
        <div className={`field-row${focusField === 1 ? ' focused' : ''}`}>
          <div className="field-label">Abbreviation (1–3 chars)</div>
          <div className="field-value">
            {abbr || '–'}
            {focusField === 1 && <span className="cursor-blink" />}
          </div>
        </div>
        <div className={`field-row${focusField === 2 ? ' focused' : ''}`}>
          <div className="field-label">Color {focusField === 2 ? '(◀/▶ to change)' : ''}</div>
          <div className="color-palette">
            {HIGHLIGHT_COLORS.map(c => (
              <span
                key={c}
                className={`color-dot${color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className={`field-row${focusField === 3 ? ' focused' : ''}`}>
          <div className="field-label">Notes (optional)</div>
          <div className="field-value" style={{ minHeight: 36, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {notes || '–'}
            {focusField === 3 && <span className="cursor-blink" />}
          </div>
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
