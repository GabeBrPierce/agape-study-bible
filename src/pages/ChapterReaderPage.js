import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fetchChapter } from '../api/bibleApi';
import { BOOK_BY_ID, nextLocation, prevLocation } from '../data/books';
import {
  getHighlightMapForChapter, getFavoriteSetForChapter,
  getRecentBookmarks, saveBookmark, saveSettings, saveFavorite,
  deleteHighlighter, getHighlighters, saveHighlighter, removeHighlightForVerses,
} from '../db/db';
import CrossReferenceModal from '../components/CrossReferenceModal';

// Modes
const MODE_READING    = 'reading';
const MODE_SELECTING  = 'selecting';
const MODE_INSPECTING = 'inspecting';
const MODE_AUDIO      = 'audio';

// The softkey bar is a real flex sibling below .page-content (see App.js), so the
// scroll container's clientHeight already excludes it — content is never hidden
// behind the bar. This inset must therefore be 0; any positive value underestimates
// the viewport and can strand focus on the second-to-last verse (the last verse
// becomes unreachable/unselectable in chapters that only slightly overflow).
const SOFTKEY_INSET = 0;

const BASE_inspectActions = [
  { id: 'highlight',   label: '🎨 Highlight' },
  { id: 'favorite',    label: '⭐ Favorite' },
  { id: 'bookmark',    label: '🔖 Bookmark' },
  { id: 'crossref',    label: '🔗 Cross References' },
  { id: 'interlinear', label: '📖 Interlinear' },
  { id: 'compare',     label: '⇄ Compare Translations' },
  { id: 'listen',      label: '🎧 Listen' },
];

export default function ChapterReaderPage({ book, chapter, initialVerse = 1, bookmarkReadOnly = false }) {
  const {
    push, pop, popToRoot,
    bookmarkSessionActive, activateBookmarkSession,
    registerKeyHandlers, registerSoftkeys,
    settings, updateSettings,
  } = useApp();

  const [verses, setVerses]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [focusedVerse, setFocusedVerse] = useState(0); // index in verses array
  const [mode, setMode]                 = useState(MODE_READING);
  const [selRange, setSelRange]         = useState({ start: 0, end: 0 });
  const [inspectFocus, setInspectFocus] = useState(0);
  const [highlightMap, setHighlightMap] = useState({}); // verseNumber → color
  const [favoriteSet, setFavoriteSet]   = useState(new Set());
  const [activeBookmark, setActiveBookmark] = useState(null);
  const activeBookmarkRef = useRef(null); // { abbr, color }
  const [showCrossRef, setShowCrossRef] = useState(false);
  const [crossRefVerse, setCrossRefVerse] = useState(null);
  const [audioState, setAudioState]     = useState('idle'); // idle|loading|playing|paused
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef(null);

  // Digit-based verse jump
  const digitBuffer = useRef('');
  const digitTimer   = useRef(null);
  const verseRefs      = useRef({});
  const contentRef     = useRef(null);
  const actionSheetRef = useRef(null);
  const actionItemRefs = useRef({});
  const navDirRef      = useRef(1); // +1 = last moved down, -1 = last moved up

  // Track whether the user has actively navigated in this reading session.
  // savedLocation only updates from real reading movement, not from mounts/remounts
  // caused by returning from Interlinear, cross-ref peeks, search lookups, etc.
  const isActiveReadingRef = useRef(false);

  // Keep ref in sync with state so effects can read current bookmark without stale closure
  activeBookmarkRef.current = activeBookmark;

  const translationId = settings.translationId || 'web';

  // ── Dynamic inspect actions (add Remove Highlight when verse is highlighted) ─
  const inspectActions = useMemo(() => {
    const selectedVerseNums = verses.slice(selRange.start, selRange.end + 1).map(v => v.verse);
    const anyHighlighted = selectedVerseNums.some(vn => highlightMap[vn]);
    if (!anyHighlighted) return BASE_inspectActions;
    return [
      { id: 'highlight',        label: '🎨 Highlight' },
      { id: 'remove_highlight', label: '🚫 Remove Highlight' },
      { id: 'favorite',         label: '⭐ Favorite' },
      { id: 'bookmark',         label: '🔖 Bookmark' },
      { id: 'crossref',         label: '🔗 Cross References' },
      { id: 'interlinear',      label: '📖 Interlinear' },
      { id: 'compare',          label: '⇄ Compare Translations' },
      { id: 'listen',           label: '🎧 Listen' },
    ];
  }, [verses, selRange, highlightMap]);

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
        const [hMap, fSet] = await Promise.all([
          getHighlightMapForChapter(book, chapter),
          getFavoriteSetForChapter(book, chapter),
        ]);
        if (cancelled) return;
        setHighlightMap(hMap);
        setFavoriteSet(fSet);
        // Only load the active bookmark when a bookmark session is explicitly active
        // (case A: opened from bookmark list; case B: saved via inspect menu).
        // Continue Reading, Address Selection, and cross-references do not activate a session.
        if (bookmarkSessionActive) {
          const recent = await getRecentBookmarks(1);
          if (!cancelled) setActiveBookmark(recent[0] || null);
        } else {
          setActiveBookmark(null);
        }

        // On remount (returning from Interlinear, cross-ref, etc.), restore to the
        // savedLocation verse so the reader snaps back to exactly where the user was.
        // On a fresh navigation to a new chapter, use initialVerse.
        const savedLoc = settings.savedLocation;
        const restoreVerse =
          (savedLoc?.book === book && savedLoc?.chapter === chapter)
            ? savedLoc.verse   // returning to same chapter — snap back to saved position
            : initialVerse;    // fresh navigation — use the requested verse
        const idx = data.verses.findIndex(v => v.verse === restoreVerse);
        setFocusedVerse(Math.max(0, idx));
        // Reset the active-reading flag so remounts don't overwrite savedLocation
        isActiveReadingRef.current = false;
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

  // ── Save location + bookmark only when the user actively reads ───────────
  // Does NOT fire on mount/remount so peeking at cross-refs, interlinear, or
  // searching elsewhere never clobbers the user's reading position.
  useEffect(() => {
    if (!isActiveReadingRef.current) return;
    if (verses.length === 0) return;
    const v = verses[focusedVerse];
    if (!v) return;
    updateSettings({ savedLocation: { book, chapter, verse: v.verse } }).catch(() => {});
    if (bookmarkSessionActive && !bookmarkReadOnly) {
      const bm = activeBookmarkRef.current;
      if (bm) {
        const updated = { ...bm, book, chapter, verse: v.verse, usedAt: new Date().toISOString() };
        activeBookmarkRef.current = updated;
        setActiveBookmark(updated);
        saveBookmark(updated).catch(() => {});
      }
    }
  }, [book, chapter, focusedVerse, verses, updateSettings, bookmarkSessionActive]); // eslint-disable-line

  // ── Bring the focused verse into view when focus changes ───────────────────
  // Short verses are centered. Verses taller than the viewport are aligned to
  // the edge we're travelling toward (top when moving down, bottom when moving
  // up) so the reader starts at the right end and the arrow keys can then scroll
  // through the verse before focus jumps to the next one.
  // While selecting, follow the END of the selection so the growing range stays
  // in view; otherwise follow the focused verse.
  const activeVerseIndex = mode === MODE_SELECTING ? selRange.end : focusedVerse;
  useEffect(() => {
    const el = verseRefs.current[activeVerseIndex];
    const c  = contentRef.current;
    if (!el || !c) return;
    const view   = c.clientHeight - SOFTKEY_INSET;
    const verseH = el.offsetHeight;
    let target;
    if (verseH <= view) {
      target = el.offsetTop - view / 2 + verseH / 2;     // center
    } else if (navDirRef.current < 0) {
      target = el.offsetTop + verseH - view;             // tall + moving up → show bottom
    } else {
      target = el.offsetTop;                             // tall + moving down → show top
    }
    c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeVerseIndex]);

  // ── Scroll focused inspect action to center of the action sheet ──────────
  useEffect(() => {
    const el = actionItemRefs.current[inspectFocus];
    const container = actionSheetRef.current;
    if (!el || !container) return;
    const targetScrollTop =
      el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [inspectFocus]);

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
    updateSettings({ savedLocation: { book: newBook, chapter: newChapter, verse: 1 } }).catch(() => {});
    if (bookmarkSessionActive && !bookmarkReadOnly) {
      const bm = activeBookmarkRef.current;
      if (bm) {
        const updated = { ...bm, book: newBook, chapter: newChapter, verse: 1, usedAt: new Date().toISOString() };
        activeBookmarkRef.current = updated;
        saveBookmark(updated).catch(() => {});
      }
    }
    push('ChapterReaderPage', { book: newBook, chapter: newChapter, initialVerse: 1 });
  }, [push, updateSettings, bookmarkSessionActive, bookmarkReadOnly]);

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
    ArrowUp: () => {
      const el = verseRefs.current[focusedVerse];
      const c  = contentRef.current;
      if (el && c && el.offsetTop < c.scrollTop - 2) {
        // Focused verse extends above the view → scroll up within it first.
        const step = Math.max(40, (c.clientHeight - SOFTKEY_INSET) * 0.8);
        c.scrollTo({ top: Math.max(el.offsetTop, c.scrollTop - step), behavior: 'smooth' });
        return;
      }
      navDirRef.current = -1;
      isActiveReadingRef.current = true;
      setFocusedVerse(prev => Math.max(0, prev - 1));
    },
    ArrowDown: () => {
      const el = verseRefs.current[focusedVerse];
      const c  = contentRef.current;
      if (el && c) {
        const view        = c.clientHeight - SOFTKEY_INSET;
        const verseBottom = el.offsetTop + el.offsetHeight;
        if (verseBottom > c.scrollTop + view + 2) {
          // Focused verse extends below the view → scroll down within it first.
          const step = Math.max(40, view * 0.8);
          c.scrollTo({ top: Math.min(verseBottom - view, c.scrollTop + step), behavior: 'smooth' });
          return;
        }
      }
      navDirRef.current = 1;
      isActiveReadingRef.current = true;
      setFocusedVerse(prev => Math.min(verses.length - 1, prev + 1));
    },
    ArrowLeft:  prevChapter,
    ArrowRight: nextChapter,
    Enter: () => {
      setSelRange({ start: focusedVerse, end: focusedVerse });
      setMode(MODE_SELECTING);
    },
    Backspace: () => pop(),
    SoftLeft: () => popToRoot(),
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
        if (target >= 0) { isActiveReadingRef.current = true; setFocusedVerse(target); }
      }, 1000);
    }])),
  }), [verses, focusedVerse, prevChapter, nextChapter, pop, popToRoot, push, book]);

  // ── Mode: SELECTING key handlers ─────────────────────────────────────────
  const selectingHandlers = useCallback(() => ({
    ArrowUp: () => { navDirRef.current = -1; setSelRange(prev => ({
      ...prev, end: Math.max(prev.start, prev.end - 1)
    })); },
    ArrowDown: () => { navDirRef.current = 1; setSelRange(prev => ({
      ...prev, end: Math.min(verses.length - 1, prev.end + 1)
    })); },
    Enter: () => {
      setInspectFocus(0);
      setMode(MODE_INSPECTING);
    },
    Backspace: () => setMode(MODE_READING),
    SoftLeft:  () => setMode(MODE_READING),
  }), [verses]);

  // ── Mode: INSPECTING action handler (defined before inspectingHandlers so deps are valid) ──
  const handleInspectAction = useCallback(async (actionId) => {
    const selectedVerses = verses.slice(selRange.start, selRange.end + 1);
    setMode(MODE_READING);

    switch (actionId) {
      case 'remove_highlight': {
        const verseNums = selectedVerses.map(v => v.verse);
        await removeHighlightForVerses(book, chapter, verseNums);
        const hMap = await getHighlightMapForChapter(book, chapter);
        setHighlightMap(hMap);
        break;
      }
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
          onDone: () => {
            // activateBookmarkSession writes to context, so it survives the
            // pop + remount of ChapterReaderPage and the ribbon appears on return.
            activateBookmarkSession();
          },
        });
        break;
      case 'crossref':
        setCrossRefVerse(selectedVerses[0]?.verse ?? null);
        setShowCrossRef(true);
        break;
      case 'interlinear': {
        const iv = selectedVerses[0];
        if (iv) {
          push('InterlinearPage', {
            book,
            chapter,
            verse: iv.verse,
            verseText: iv.text,
          });
        }
        break;
      }
      case 'compare': {
        const cv = selectedVerses[0];
        if (cv) {
          push('CompareTranslationsPage', {
            book, chapter, verse: cv.verse, translationId,
          });
        }
        break;
      }
      case 'listen':
        handleListen();
        break;
      default:
        break;
    }
  }, [verses, selRange, book, chapter, push, setHighlightMap, translationId]); // eslint-disable-line

  // ── Mode: INSPECTING key handlers ────────────────────────────────────────
  const inspectingHandlers = useCallback(() => ({
    ArrowUp:   () => setInspectFocus(prev => Math.max(0, prev - 1)),
    ArrowDown: () => setInspectFocus(prev => Math.min(inspectActions.length - 1, prev + 1)),
    ArrowLeft: () => setMode(MODE_READING),
    Enter:     () => handleInspectAction(inspectActions[inspectFocus].id),
    Backspace: () => setMode(MODE_READING),
    SoftLeft:  () => setMode(MODE_READING),
  }), [inspectFocus, handleInspectAction, inspectActions]);

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
    const audioUrl = `https://raw.githubusercontent.com/GabeBrPierce/audio-data/master/${book}/${chapter}.mp3`;
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
    if (loading) return;

    if (error) {
      registerKeyHandlers({ Backspace: pop });
      registerSoftkeys({ left: { label: 'Back', action: pop }, center: '', right: '' });
      return;
    }

    if (mode === MODE_READING) {
      registerKeyHandlers(readingHandlers());
      const bookData = BOOK_BY_ID[book];
      registerSoftkeys({
        left:   { label: 'Menu', action: popToRoot },
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
  }, [mode, loading, error, audioState, showCrossRef, readingHandlers, selectingHandlers, inspectingHandlers,
      registerKeyHandlers, registerSoftkeys, pop, popToRoot, push, book]);

  // ── Stable cross-ref callbacks (memoised so modal's handler effect doesn't
  //    re-run on every ChapterReaderPage render, avoiding stale-closure issues) ─
  const handleCrossRefClose = useCallback(() => {
    setShowCrossRef(false);
  }, []);

  const handleCrossRefNavigate = useCallback((b, c, v) => {
    setShowCrossRef(false);
    push('ChapterReaderPage', { book: b, chapter: c, initialVerse: v, bookmarkReadOnly: true });
  }, [push]);

  // ── Render ────────────────────────────────────────────────────────────────
  const bookData = BOOK_BY_ID[book];
  const bookName = bookData ? bookData.name : book;

  if (loading) {
    return (
      <div className="page">
        <ReaderHeader bookName={bookName} chapter={chapter} badge={activeBookmark} prevChapter={prevChapter} nextChapter={nextChapter} />
        <div className="page-content"><div className="loading"><span className="spinner" />Loading…</div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <ReaderHeader bookName={bookName} chapter={chapter} badge={activeBookmark} prevChapter={prevChapter} nextChapter={nextChapter} />
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
      <ReaderHeader bookName={bookName} chapter={chapter} badge={activeBookmark} prevChapter={prevChapter} nextChapter={nextChapter} />

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
                padding: activeBookmark && bookmarkSessionActive ? '5px 20px 5px 8px' : '5px 8px',
                display: 'flex',
                gap: 6,
                borderBottom: '1px solid var(--color-border)',
              }}
              onClick={() => setFocusedVerse(idx)}
            >
              <span style={{
                fontSize: 10,
                color: isFocused ? 'var(--color-focus-text-dim)' : 'var(--color-text-muted)',
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
        <div className="action-sheet" ref={actionSheetRef}>
          <div className="action-sheet-title">
            {selRange.start === selRange.end
              ? `${bookName} ${chapter}:${verses[selRange.start]?.verse}`
              : `${bookName} ${chapter}:${verses[selRange.start]?.verse}–${verses[selRange.end]?.verse}`}
          </div>
          {inspectActions.map((a, idx) => (
            <div
              key={a.id}
              ref={el => actionItemRefs.current[idx] = el}
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

      {/* Bookmark ribbon */}
      {activeBookmark && bookmarkSessionActive && (
        <BookmarkRibbon bookmark={activeBookmark} />
      )}

      {/* Cross-reference modal */}
      {showCrossRef && (
        <CrossReferenceModal
          book={book}
          chapter={chapter}
          verse={crossRefVerse}
          onClose={handleCrossRefClose}
          onNavigate={handleCrossRefNavigate}
        />
      )}
    </div>
  );
}

function BookmarkRibbon({ bookmark }) {
  return (
    <div
      className="bookmark-ribbon"
      style={{ backgroundColor: bookmark.color }}
      aria-hidden="true"
    >
      <span className="bookmark-ribbon-abbr">{bookmark.abbr}</span>
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
