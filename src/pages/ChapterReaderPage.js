import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { fetchChapter } from '../api/bibleApi';
import { BOOK_BY_ID, nextLocation, prevLocation } from '../data/books';
import {
  getHighlightMapForChapter, getFavoriteSetForChapter,
  getBookmarksByChapter, saveSettings, saveFavorite,
  deleteHighlighter, getHighlighters, saveHighlighter,
} from '../db/db';
import CrossReferenceModal from '../components/CrossReferenceModal';

// Modes
const MODE_READING    = 'reading';
const MODE_SELECTING  = 'selecting';
const MODE_INSPECTING = 'inspecting';
const MODE_AUDIO      = 'audio';

const INSPECT_ACTIONS = [
  { id: 'highlight',   label: '🎨 Highlight' },
  { id: 'favorite',    label: '⭐ Favorite' },
  { id: 'bookmark',    label: '🔖 Bookmark' },
  { id: 'crossref',    label: '🔗 Cross References' },
  { id: 'interlinear', label: '📖 Interlinear' },
  { id: 'listen',      label: '🎧 Listen' },
];

export default function ChapterReaderPage({ book, chapter, initialVerse = 1 }) {
  const { push, pop, registerKeyHandlers, registerSoftkeys, settings, updateSettings } = useApp();

  const [verses, setVerses]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [focusedVerse, setFocusedVerse] = useState(0); // index in verses array
  const [mode, setMode]                 = useState(MODE_READING);
  const [selRange, setSelRange]         = useState({ start: 0, end: 0 });
  const [inspectFocus, setInspectFocus] = useState(0);
  const [highlightMap, setHighlightMap] = useState({}); // verseNumber → color
  const [favoriteSet, setFavoriteSet]   = useState(new Set());
  const [bookmarkBadge, setBookmarkBadge] = useState(null); // { abbr, color }
  const [showCrossRef, setShowCrossRef] = useState(false);
  const [crossRefVerse, setCrossRefVerse] = useState(null);
  const [audioState, setAudioState]     = useState('idle'); // idle|loading|playing|paused
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef(null);

  // Digit-based verse jump
  const digitBuffer = useRef('');
  const digitTimer   = useRef(null);
  const verseRefs    = useRef({});
  const contentRef   = useRef(null);

  const translationId = settings.translationId || 'web';

  // ── Load chapter ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const data = await fetchChapter(translationId, book, chapter);
        if (cancelled) return;
        setVerses(data.verses || []);

        // Batch load visual state
        const [hMap, fSet, bms] = await Promise.all([
          getHighlightMapForChapter(book, chapter),
          getFavoriteSetForChapter(book, chapter),
          getBookmarksByChapter(book, chapter),
        ]);
        if (cancelled) return;
        setHighlightMap(hMap);
        setFavoriteSet(fSet);
        setBookmarkBadge(bms.length > 0 ? { abbr: bms[0].abbr, color: bms[0].color } : null);

        // Scroll to initial verse
        const idx = data.verses.findIndex(v => v.verse === initialVerse);
        setFocusedVerse(Math.max(0, idx));
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message === 'OFFLINE' ? 'offline' : 'error');
          setLoading(false);
        }
      }
    }
    load();

    return () => { cancelled = true; };
  }, [book, chapter, translationId, initialVerse]);

  // ── Save location whenever focused verse changes ─────────────────────────
  useEffect(() => {
    if (verses.length === 0) return;
    const v = verses[focusedVerse];
    if (!v) return;
    updateSettings({ savedLocation: { book, chapter, verse: v.verse } }).catch(() => {});
  }, [book, chapter, focusedVerse, verses, updateSettings]);

  // ── Scroll focused verse into center view ────────────────────────────────
  useEffect(() => {
    const el = verseRefs.current[focusedVerse];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedVerse]);

  // ── Audio cleanup on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goToChapter = useCallback((newBook, newChapter) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setAudioState('idle');
    push('ChapterReaderPage', { book: newBook, chapter: newChapter, initialVerse: 1 });
  }, [push]);

  const prevChapter = useCallback(() => {
    const loc = prevLocation(book, chapter);
    if (loc) goToChapter(loc.book, loc.chapter);
  }, [book, chapter, goToChapter]);

  const nextChapter = useCallback(() => {
    const loc = nextLocation(book, chapter);
    if (loc) goToChapter(loc.book, loc.chapter);
  }, [book, chapter, goToChapter]);

  // ── Mode: READING key handlers ───────────────────────────────────────────
  const readingHandlers = useCallback(() => ({
    ArrowUp: () => setFocusedVerse(prev => Math.max(0, prev - 1)),
    ArrowDown: () => setFocusedVerse(prev => Math.min(verses.length - 1, prev + 1)),
    ArrowLeft:  prevChapter,
    ArrowRight: nextChapter,
    Enter: () => {
      setSelRange({ start: focusedVerse, end: focusedVerse });
      setMode(MODE_SELECTING);
    },
    Backspace: () => pop(),
    SoftRight: () => {
      const v = verses[focusedVerse];
      if (v) push('ChapterSelectionPage', { book });
    },
    ...Object.fromEntries('0123456789'.split('').map(d => [d, () => {
      digitBuffer.current += d;
      clearTimeout(digitTimer.current);
      digitTimer.current = setTimeout(() => {
        const num = parseInt(digitBuffer.current, 10);
        digitBuffer.current = '';
        const target = Math.min(num, verses.length) - 1;
        if (target >= 0) setFocusedVerse(target);
      }, 1000);
    }])),
  }), [verses, focusedVerse, prevChapter, nextChapter, pop, push, book]);

  // ── Mode: SELECTING key handlers ─────────────────────────────────────────
  const selectingHandlers = useCallback(() => ({
    ArrowUp: () => setSelRange(prev => ({
      ...prev, end: Math.max(prev.start, prev.end - 1)
    })),
    ArrowDown: () => setSelRange(prev => ({
      ...prev, end: Math.min(verses.length - 1, prev.end + 1)
    })),
    Enter: () => {
      setInspectFocus(0);
      setMode(MODE_INSPECTING);
    },
    Backspace: () => setMode(MODE_READING),
    SoftLeft:  () => setMode(MODE_READING),
  }), [verses]);

  // ── Mode: INSPECTING key handlers ────────────────────────────────────────
  const inspectingHandlers = useCallback(() => ({
    ArrowUp:   () => setInspectFocus(prev => Math.max(0, prev - 1)),
    ArrowDown: () => setInspectFocus(prev => Math.min(INSPECT_ACTIONS.length - 1, prev + 1)),
    ArrowLeft: () => setMode(MODE_READING),
    Enter:     () => handleInspectAction(INSPECT_ACTIONS[inspectFocus].id),
    Backspace: () => setMode(MODE_READING),
    SoftLeft:  () => setMode(MODE_READING),
  }), [inspectFocus]); // eslint-disable-line

  const handleInspectAction = useCallback((actionId) => {
    const selectedVerses = verses.slice(selRange.start, selRange.end + 1);
    setMode(MODE_READING);

    switch (actionId) {
      case 'highlight':
        push('HighlightSelectionPage', {
          entryPoint: 'reader',
          versesToHighlight: selectedVerses.map(v => ({ book, chapter, verse: v.verse })),
          onDone: () => {
            getHighlightMapForChapter(book, chapter).then(setHighlightMap);
          },
        });
        break;
      case 'favorite':
        handleFavorite(selectedVerses);
        break;
      case 'bookmark':
        push('BookmarkSelectionPage', {
          entryPoint: 'reader',
          book, chapter, verse: selectedVerses[0]?.verse,
        });
        break;
      case 'crossref':
        if (selectedVerses.length === 1) {
          setCrossRefVerse(selectedVerses[0].verse);
          setShowCrossRef(true);
        } else {
          // Multi-verse: pick first for now
          setCrossRefVerse(selectedVerses[0].verse);
          setShowCrossRef(true);
        }
        break;
      case 'interlinear':
        // TODO: open interlinear view
        break;
      case 'listen':
        handleListen();
        break;
      default:
        break;
    }
  }, [verses, selRange, book, chapter, push]); // eslint-disable-line

  const handleFavorite = useCallback(async (selectedVerses) => {
    for (const v of selectedVerses) {
      const fav = {
        id:      `${book}-${chapter}-${v.verse}-${Date.now()}`,
        book,
        chapter,
        verse:   v.verse,
        preview: v.text.substring(0, 60),
        addedAt: new Date().toISOString(),
      };
      await saveFavorite(fav);
    }
    const fSet = await getFavoriteSetForChapter(book, chapter);
    setFavoriteSet(fSet);
  }, [book, chapter]);

  const handleListen = useCallback(() => {
    const audioUrl = `/audio-data/${book}/${chapter}.mp3`;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setAudioState('loading');

    audio.addEventListener('canplay', () => setAudioState('playing'));
    audio.addEventListener('timeupdate', () => {
      if (audio.duration) setAudioProgress(audio.currentTime / audio.duration);
    });
    audio.addEventListener('ended', () => { setAudioState('idle'); setAudioProgress(0); });
    audio.addEventListener('error', () => {
      setAudioState('idle');
      // TODO: attempt remote audio
    });

    audio.play().catch(() => setAudioState('idle'));
    setMode(MODE_AUDIO);
  }, [book, chapter]);

  // ── Register handlers for current mode ───────────────────────────────────
  useEffect(() => {
    if (loading || error) return;

    if (mode === MODE_READING) {
      registerKeyHandlers(readingHandlers());
      const bookData = BOOK_BY_ID[book];
      registerSoftkeys({
        left:   { label: 'Back', action: pop },
        center: 'Select',
        right:  { label: 'Chapters', action: () => push('ChapterSelectionPage', { book }) },
      });
    } else if (mode === MODE_SELECTING) {
      registerKeyHandlers(selectingHandlers());
      registerSoftkeys({ left: { label: 'Cancel', action: () => setMode(MODE_READING) }, center: 'Inspect', right: '' });
    } else if (mode === MODE_INSPECTING) {
      registerKeyHandlers(inspectingHandlers());
      registerSoftkeys({ left: { label: 'Cancel', action: () => setMode(MODE_READING) }, center: 'Do', right: '' });
    } else if (mode === MODE_AUDIO) {
      registerKeyHandlers({
        Backspace: () => {
          if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
          setAudioState('idle');
          setMode(MODE_READING);
        },
        Enter: () => {
          if (!audioRef.current) return;
          if (audioState === 'playing') { audioRef.current.pause(); setAudioState('paused'); }
          else { audioRef.current.play(); setAudioState('playing'); }
        },
      });
      registerSoftkeys({ left: { label: 'Stop', action: () => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        setAudioState('idle'); setMode(MODE_READING);
      }}, center: audioState === 'playing' ? 'Pause' : 'Play', right: '' });
    }
  }, [mode, loading, error, audioState, readingHandlers, selectingHandlers, inspectingHandlers,
      registerKeyHandlers, registerSoftkeys, pop, push, book]);

  // ── Render ────────────────────────────────────────────────────────────────
  const bookData = BOOK_BY_ID[book];
  const bookName = bookData ? bookData.name : book;

  if (loading) {
    return (
      <div className="page">
        <ReaderHeader bookName={bookName} chapter={chapter} badge={bookmarkBadge} prevChapter={prevChapter} nextChapter={nextChapter} />
        <div className="page-content"><div className="loading"><span className="spinner" />Loading…</div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <ReaderHeader bookName={bookName} chapter={chapter} badge={bookmarkBadge} prevChapter={prevChapter} nextChapter={nextChapter} />
        <div className="page-content">
          <div className="empty-state">
            {error === 'offline'
              ? 'Offline — content unavailable'
              : 'Failed to load chapter'}
            <div style={{ marginTop: 10, fontSize: 11 }}>Press Back to go back</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <ReaderHeader bookName={bookName} chapter={chapter} badge={bookmarkBadge} prevChapter={prevChapter} nextChapter={nextChapter} />

      {/* Verses */}
      <div className="page-content reader-content" ref={contentRef}>
        {verses.map((v, idx) => {
          const isFocused  = idx === focusedVerse;
          const isSelected = mode === MODE_SELECTING && idx >= selRange.start && idx <= selRange.end;
          const hlColor    = highlightMap[v.verse];
          const isFav      = favoriteSet.has(v.verse);

          return (
            <div
              key={v.verse}
              ref={el => verseRefs.current[idx] = el}
              className={`verse-row${isFocused ? ' focused' : ''}${isSelected ? ' selected' : ''}`}
              style={{
                background: isFocused
                  ? 'var(--color-focus-bg)'
                  : isSelected
                    ? 'var(--color-accent-dim)'
                    : hlColor
                      ? hlColor + '33'
                      : 'transparent',
                borderLeft: hlColor ? `3px solid ${hlColor}` : undefined,
                padding: '5px 8px',
                display: 'flex',
                gap: 6,
                borderBottom: '1px solid var(--color-border)',
              }}
              onClick={() => setFocusedVerse(idx)}
            >
              <span style={{
                fontSize: 10,
                color: isFocused ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)',
                flexShrink: 0,
                minWidth: 18,
                marginTop: 2,
              }}>
                {v.verse}
              </span>
              <span className="verse-text" style={{
                color: isFocused ? '#fff' : 'var(--color-text)',
                flex: 1,
              }}>
                {v.text || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Verse not available</span>}
              </span>
              {isFav && (
                <span style={{ fontSize: 10, flexShrink: 0 }}>⭐</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Inspection action sheet */}
      {mode === MODE_INSPECTING && (
        <div className="action-sheet">
          <div className="action-sheet-title">
            {selRange.start === selRange.end
              ? `${bookName} ${chapter}:${verses[selRange.start]?.verse}`
              : `${bookName} ${chapter}:${verses[selRange.start]?.verse}–${verses[selRange.end]?.verse}`}
          </div>
          {INSPECT_ACTIONS.map((a, idx) => (
            <div
              key={a.id}
              className={`list-item${inspectFocus === idx ? ' focused' : ''}`}
              onClick={() => { setInspectFocus(idx); handleInspectAction(a.id); }}
            >
              {a.label}
            </div>
          ))}
        </div>
      )}

      {/* Audio progress bar */}
      {mode === MODE_AUDIO && (
        <div style={{ padding: '4px 8px', background: 'var(--color-surface)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 3 }}>
            {audioState === 'loading' ? 'Loading audio…' : audioState === 'playing' ? '▶ Playing' : '⏸ Paused'}
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${audioProgress * 100}%` }} />
          </div>
        </div>
      )}

      {/* Cross-reference modal */}
      {showCrossRef && (
        <CrossReferenceModal
          book={book}
          chapter={chapter}
          verse={crossRefVerse}
          onClose={() => setShowCrossRef(false)}
          onNavigate={(b, c, v) => {
            setShowCrossRef(false);
            push('ChapterReaderPage', { book: b, chapter: c, initialVerse: v });
          }}
        />
      )}
    </div>
  );
}

function ReaderHeader({ bookName, chapter, badge, prevChapter, nextChapter }) {
  return (
    <div className="page-header" style={{ justifyContent: 'space-between' }}>
      <button
        onClick={prevChapter}
        style={{ background: 'none', border: 'none', color: 'var(--color-header-text)',
          fontSize: 12, padding: '0 4px', cursor: 'default', opacity: 0.8 }}
      >◀</button>
      <span className="header-title" style={{ textAlign: 'center', flex: 1 }}>
        {bookName} {chapter}
      </span>
      {badge && (
        <span
          className="badge"
          style={{ background: badge.color, fontSize: 9, marginRight: 4 }}
        >
          {badge.abbr}
        </span>
      )}
      <button
        onClick={nextChapter}
        style={{ background: 'none', border: 'none', color: 'var(--color-header-text)',
          fontSize: 12, padding: '0 4px', cursor: 'default', opacity: 0.8 }}
      >▶</button>
    </div>
  );
}
