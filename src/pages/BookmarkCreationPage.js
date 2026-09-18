import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  const fields = ['title', 'abbr', 'color', 'description'];
  const [focusField, setFocusField] = useState(0);
  const [title, setTitle]           = useState(existing?.title || '');
  const [abbr, setAbbr]             = useState(existing?.abbr || '');
  const [color, setColor]           = useState(existing?.color || BOOKMARK_COLORS[0]);
  const [description, setDescription] = useState(existing?.description || '');

  const titleRef = useRef(null);
  const abbrRef  = useRef(null);
  const descRef  = useRef(null);
  const fieldRefs = useRef({});

  const colorIndex = BOOKMARK_COLORS.indexOf(color);
  const isValid    = title.length > 0 && abbr.length >= 1 && abbr.length <= 3;

  // Auto-focus first field on mount
  useEffect(() => { titleRef.current?.focus(); }, []);

  // Keep the focused field scrolled into view above the softkey bar.
  useEffect(() => {
    fieldRefs.current[focusField]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusField]);

  // Focus the right input when focusField changes
  useEffect(() => {
    if (focusField === 0) titleRef.current?.focus();
    else if (focusField === 1) abbrRef.current?.focus();
    else if (focusField === 2) document.activeElement?.blur(); // release input so ◀/▶ reach the global handler
    else if (focusField === 3) descRef.current?.focus();
  }, [focusField]);

  // Auto-fill abbr from title while on title field
  useEffect(() => {
    if (!existing && focusField === 0) setAbbr(autoAbbr(title));
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
      book:        existing?.book    || '',
      chapter:     existing?.chapter || 0,
      verse:       existing?.verse   || 0,
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
    };
    if (focusField === 2) {
      handlers.ArrowLeft  = () => setColor(BOOKMARK_COLORS[Math.max(0, colorIndex - 1)]);
      handlers.ArrowRight = () => setColor(BOOKMARK_COLORS[Math.min(BOOKMARK_COLORS.length - 1, colorIndex + 1)]);
    }
    registerKeyHandlers(handlers);
    registerSoftkeys({
      left:   { label: 'Cancel', action: pop },
      center: focusField < fields.length - 1 ? 'Next' : 'Save',
      // Only offer the right Save on earlier fields; on the last field the center
      // key already says Save, so showing it twice is redundant.
      right:  isValid && focusField < fields.length - 1 ? { label: 'Save', action: handleSave } : '',
    });
  }, [focusField, fields.length, colorIndex, isValid, handleSave, pop,
      registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">{existing ? 'Edit Bookmark' : 'New Bookmark'}</span>
      </div>
      <div className="page-content">

        {/* Title */}
        <div className={`field-row${focusField === 0 ? ' focused' : ''}`}
          ref={el => fieldRefs.current[0] = el}
          onClick={() => setFocusField(0)}>
          <div className="field-label">Title *</div>
          <input
            ref={titleRef}
            className="field-input"
            type="text"
            value={title}
            placeholder="e.g. Wednesday Bible Study"
            maxLength={40}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Backspace' && title.length === 0) pop();
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
          <div className="field-label">Color {focusField === 2 ? '(◀ / ▶ to change)' : ''}</div>
          <div className="color-palette">
            {BOOKMARK_COLORS.map((c) => (
              <span
                key={c}
                className={`color-dot${color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={ev => { ev.stopPropagation(); setColor(c); }}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div className={`field-row${focusField === 3 ? ' focused' : ''}`}
          ref={el => fieldRefs.current[3] = el}
          onClick={() => setFocusField(3)}>
          <div className="field-label">Description (optional)</div>
          <input
            ref={descRef}
            className="field-input"
            type="text"
            value={description}
            placeholder="–"
            maxLength={120}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Backspace' && description.length === 0) setFocusField(2);
            }}
          />
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
