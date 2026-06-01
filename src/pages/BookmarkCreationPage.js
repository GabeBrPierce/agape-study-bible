import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { saveBookmark } from '../db/db';
import { BOOKMARK_COLORS } from '../data/books';

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function autoAbbr(title) {
  return title.split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 3);
}

export default function BookmarkCreationPage({ existing, onSave }) {
  const { pop, registerKeyHandlers, registerSoftkeys } = useApp();

  const [fields] = useState(['title', 'abbr', 'color', 'description']);
  const [focusField, setFocusField] = useState(0);
  const [title, setTitle]           = useState(existing?.title || '');
  const [abbr, setAbbr]             = useState(existing?.abbr || '');
  const [color, setColor]           = useState(existing?.color || BOOKMARK_COLORS[0]);
  const [description, setDescription] = useState(existing?.description || '');

  const colorIndex = BOOKMARK_COLORS.indexOf(color);
  const isValid    = title.length > 0 && abbr.length >= 1 && abbr.length <= 3;

  const typeChar = useCallback((ch) => {
    if (focusField === 0) setTitle(prev => prev.slice(0, 40 - 1) + ch);
    if (focusField === 1) setAbbr(prev => prev.slice(0, 2) + ch);
    if (focusField === 3) setDescription(prev => prev.slice(0, 119) + ch);
  }, [focusField]);

  const deleteLast = useCallback(() => {
    if (focusField === 0) {
      if (title.length > 0) { setTitle(prev => prev.slice(0, -1)); }
      else if (focusField > 0) setFocusField(prev => prev - 1);
      else pop();
    }
    if (focusField === 1) { if (abbr.length > 0) setAbbr(prev => prev.slice(0, -1)); else setFocusField(0); }
    if (focusField === 3) { if (description.length > 0) setDescription(prev => prev.slice(0, -1)); else setFocusField(2); }
  }, [focusField, title, abbr, description, pop]);

  // Auto-fill abbr from title on first change
  useEffect(() => {
    if (!existing && focusField === 0) {
      setAbbr(autoAbbr(title));
    }
  }, [title, existing, focusField]);

  const handleSave = useCallback(async () => {
    if (!isValid) return;
    const now = new Date().toISOString();
    const bm = {
      id:          existing?.id || genId(),
      title:       title.trim(),
      abbr:        abbr.trim().toUpperCase(),
      color,
      description: description.trim(),
      book:        existing?.book  || '',
      chapter:     existing?.chapter || 0,
      verse:       existing?.verse  || 0,
      createdAt:   existing?.createdAt || now,
      usedAt:      now,
    };
    await saveBookmark(bm);
    if (onSave) onSave(bm);
    pop();
  }, [isValid, title, abbr, color, description, existing, onSave, pop]);

  useEffect(() => {
    const handlers = {
      ArrowUp:   () => setFocusField(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusField(prev => Math.min(fields.length - 1, prev + 1)),
      Enter:     () => {
        if (focusField < fields.length - 1) setFocusField(prev => prev + 1);
        else handleSave();
      },
      Backspace: deleteLast,
      SoftLeft:  () => pop(),
      SoftRight: isValid ? handleSave : undefined,
    };
    if (focusField === 2) {
      // Color field: left/right cycles colors
      handlers.ArrowLeft  = () => setColor(BOOKMARK_COLORS[Math.max(0, colorIndex - 1)]);
      handlers.ArrowRight = () => setColor(BOOKMARK_COLORS[Math.min(BOOKMARK_COLORS.length - 1, colorIndex + 1)]);
    } else {
      handlers['*'] = () => typeChar('*');
      handlers['#'] = () => typeChar('#');
      [...'0123456789'].forEach(d => { handlers[d] = () => typeChar(d); });
    }
    registerKeyHandlers(handlers);
    registerSoftkeys({
      left:   { label: 'Cancel', action: pop },
      center: focusField < fields.length - 1 ? 'Next' : 'Save',
      right:  isValid ? { label: 'Save', action: handleSave } : '',
    });
  }, [focusField, fields, colorIndex, isValid, handleSave, deleteLast, typeChar, pop,
      registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">{existing ? 'Edit Bookmark' : 'New Bookmark'}</span>
      </div>
      <div className="page-content">

        {/* Title */}
        <div className={`field-row${focusField === 0 ? ' focused' : ''}`}>
          <div className="field-label">Title *</div>
          <div className="field-value">
            {title || <span style={{ color: 'var(--color-text-muted)' }}>e.g. Wednesday Bible Study</span>}
            {focusField === 0 && <span className="cursor-blink" />}
          </div>
        </div>

        {/* Abbr */}
        <div className={`field-row${focusField === 1 ? ' focused' : ''}`}>
          <div className="field-label">Abbreviation (1–3 chars)</div>
          <div className="field-value">
            {abbr || <span style={{ color: 'var(--color-text-muted)' }}>–</span>}
            {focusField === 1 && <span className="cursor-blink" />}
          </div>
        </div>

        {/* Color */}
        <div className={`field-row${focusField === 2 ? ' focused' : ''}`}>
          <div className="field-label">Color {focusField === 2 ? '(◀ / ▶ to change)' : ''}</div>
          <div className="color-palette">
            {BOOKMARK_COLORS.map((c) => (
              <span
                key={c}
                className={`color-dot${color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div className={`field-row${focusField === 3 ? ' focused' : ''}`}>
          <div className="field-label">Description (optional)</div>
          <div className="field-value" style={{ minHeight: 36, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {description || <span style={{ color: 'var(--color-text-muted)' }}>–</span>}
            {focusField === 3 && <span className="cursor-blink" />}
          </div>
        </div>

        {!isValid && title.length > 0 && (
          <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--color-danger)' }}>
            Abbreviation must be 1–3 characters
          </div>
        )}
      </div>
    </div>
  );
}
