import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { fetchChapter, getInstalledTranslations } from '../api/bibleApi';
import { BOOK_BY_ID } from '../data/books';

/**
 * Shows a single verse, one translation at a time. Left/Right cycle through
 * every installed translation (bundled + downloaded); the current
 * translation's name is shown in the header. ◂/▸ arrows are drawn on the
 * screen edges as a visual hint for the same Left/Right navigation.
 */
export default function CompareTranslationsPage({ book, chapter, verse, translationId }) {
  const { pop, registerKeyHandlers, registerSoftkeys } = useApp();

  const [translations, setTranslations] = useState([]);
  const [index, setIndex]                = useState(0);
  const [text, setText]                  = useState('');
  const [loading, setLoading]            = useState(true);
  const [error, setError]                = useState(null);

  const bookData = BOOK_BY_ID[book];
  const bookName = bookData ? bookData.name : book;

  // Load the list of translations to cycle through, starting on whichever
  // one the reader was using when Compare was opened.
  useEffect(() => {
    let cancelled = false;
    getInstalledTranslations().then(list => {
      if (cancelled) return;
      setTranslations(list);
      const startIdx = Math.max(0, list.findIndex(t => t.id === translationId));
      setIndex(startIdx);
    });
    return () => { cancelled = true; };
  }, [translationId]);

  // Fetch the verse text whenever the current translation changes.
  useEffect(() => {
    const t = translations[index];
    if (!t) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchChapter(t.id, book, chapter)
      .then(data => {
        if (cancelled) return;
        const v = (data.verses || []).find(v => v.verse === verse);
        setText(v ? v.text : '');
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message === 'OFFLINE' ? 'offline' : 'error');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [translations, index, book, chapter, verse]);

  const prevTranslation = useCallback(() => {
    setIndex(prev => (translations.length ? (prev - 1 + translations.length) % translations.length : 0));
  }, [translations.length]);

  const nextTranslation = useCallback(() => {
    setIndex(prev => (translations.length ? (prev + 1) % translations.length : 0));
  }, [translations.length]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowLeft:  prevTranslation,
      ArrowRight: nextTranslation,
      Backspace:  pop,
      SoftLeft:   pop,
    });
    registerSoftkeys({ left: { label: 'Back', action: pop }, center: '', right: '' });
  }, [prevTranslation, nextTranslation, pop, registerKeyHandlers, registerSoftkeys]);

  const current = translations[index];
  const headerLabel = current ? (current.shortName || current.id.toUpperCase()) : '…';

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title" style={{ textAlign: 'center', flex: 1 }}>
          {headerLabel}
        </span>
      </div>

      <div
        className="page-content"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 26px',
          minHeight: '100%',
        }}
      >
        <span
          onClick={prevTranslation}
          style={{
            position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
            fontSize: 20, color: 'var(--color-accent)', opacity: translations.length > 1 ? 0.9 : 0.25,
          }}
        >◂</span>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 8 }}>
            {bookName} {chapter}:{verse}
          </div>

          {loading ? (
            <div className="loading"><span className="spinner" />Loading…</div>
          ) : error ? (
            <div className="empty-state">
              {error === 'offline' ? 'Offline — not cached for this translation' : 'Failed to load verse'}
            </div>
          ) : (
            <div className="verse-text" style={{ whiteSpace: 'pre-line' }}>
              {text || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Verse not available</span>}
            </div>
          )}

          {translations.length > 1 && (
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 12 }}>
              {index + 1} / {translations.length}
            </div>
          )}
        </div>

        <span
          onClick={nextTranslation}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            fontSize: 20, color: 'var(--color-accent)', opacity: translations.length > 1 ? 0.9 : 0.25,
          }}
        >▸</span>
      </div>
    </div>
  );
}
