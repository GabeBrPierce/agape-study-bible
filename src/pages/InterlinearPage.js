import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fetchInterlinear, fetchLexicon, strongsToLexKey, getOccurrences, fetchChapter } from '../api/bibleApi';
import { BOOK_BY_ID } from '../data/books';
import { parseLexiconDefinition } from '../utils/lexiconText';
import WORD_STUDY_GUIDE from '../data/wordStudyGuide';

// Cap how many reference rows we render — some Hebrew particles occur 10k+ times
// and a DOM that large is unsafe on low-memory KaiOS devices.
const MAX_REFS = 200;

const vkey = (o) => `${o.book}|${o.chapter}|${o.verse}`;

export default function InterlinearPage({ book, chapter, verse, verseText }) {
  const { push, pop, registerKeyHandlers, registerSoftkeys, settings } = useApp();

  const [words,    setWords]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [focusIdx, setFocusIdx] = useState(0);

  // Lexicon panel state
  const [lexEntry,     setLexEntry]     = useState(null);
  const [lexLoading,   setLexLoading]   = useState(false);
  const [lexError,     setLexError]     = useState(null);
  const [showLex,      setShowLex]      = useState(false);

  // Referenced-verses (occurrence index) state
  const [occurrences, setOccurrences] = useState([]);
  const [occLoading,  setOccLoading]  = useState(false);
  // refFocus: -1 = the definition block (above the references); 0..n = a ref row
  const [refFocus,    setRefFocus]    = useState(-1);
  const [verseTexts,  setVerseTexts]  = useState({}); // "BOOK|ch|v" -> verse text
  const [showGuide,   setShowGuide]   = useState(false);

  const wordRefs    = useRef({});
  const wordListRef = useRef(null);
  const lexPanelRef = useRef(null);
  const occRefs     = useRef({});
  const defRef      = useRef(null);   // the definition block (focus zone -1)
  const guideRef    = useRef(null);
  const navDirRef   = useRef(1);      // +1 last moved down, -1 last moved up

  const bookData = BOOK_BY_ID[book];
  const bookName = bookData ? bookData.name : book;

  // Rendered/navigable subset of the referenced verses
  const refList = useMemo(() => occurrences.slice(0, MAX_REFS), [occurrences]);

  // Fetch the text of each referenced verse so they read inline (no jumping
  // needed). Group by chapter to minimize requests; fetch in small batches and
  // fill rows in as they arrive. fetchChapter is local-first + cached.
  useEffect(() => {
    if (refList.length === 0) { setVerseTexts({}); return; }
    let cancelled = false;
    setVerseTexts({});
    const translationId = settings.translationId || 'web';

    const chapters = [...new Set(refList.map(o => `${o.book}|${o.chapter}`))]
      .map(s => { const [b, c] = s.split('|'); return { book: b, chapter: Number(c) }; });

    (async () => {
      const POOL = 6;
      for (let i = 0; i < chapters.length && !cancelled; i += POOL) {
        await Promise.all(chapters.slice(i, i + POOL).map(async ({ book: b, chapter: c }) => {
          try {
            const data = await fetchChapter(translationId, b, c);
            if (cancelled) return;
            const updates = {};
            for (const v of (data.verses || [])) updates[`${b}|${c}|${v.verse}`] = v.text;
            setVerseTexts(prev => ({ ...prev, ...updates }));
          } catch (_) { /* leave row as label-only */ }
        }));
      }
    })();

    return () => { cancelled = true; };
  }, [refList, settings.translationId]);

  // Load interlinear data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchInterlinear(book, chapter, verse)
      .then(data => {
        if (!cancelled) {
          setWords(data.words || []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message === 'OFFLINE' ? 'offline' : err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [book, chapter, verse]);

  // Scroll focused word to vertical centre of the word list
  useEffect(() => {
    const el = wordRefs.current[focusIdx];
    const container = wordListRef.current;
    if (!el || !container) return;
    const targetScrollTop = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [focusIdx]);

  const openLexicon = useCallback(async (word) => {
    if (!word?.strongs) return;
    // Pass the raw compound strongs; fetchLexicon extracts the lexical word,
    // folds the suffix, and maps to the correct base-number / particle entry.
    if (!strongsToLexKey(word.strongs)) return;
    setLexLoading(true);
    setLexError(null);
    setLexEntry(null);
    setShowLex(true);

    // Load the referenced verses (occurrence index) in parallel. Focus starts on
    // the definition (-1) so the first ArrowDown scrolls the definition, not the
    // references.
    setRefFocus(-1);
    setShowGuide(false);
    setOccurrences([]);
    setOccLoading(true);
    getOccurrences(word.strongs)
      .then(setOccurrences)
      .catch(() => setOccurrences([]))
      .finally(() => setOccLoading(false));

    try {
      const entry = await fetchLexicon(word.strongs);
      setLexEntry(entry);
    } catch (err) {
      setLexError(err.message);
    } finally {
      setLexLoading(false);
    }
  }, []);

  const jumpToRef = useCallback((occ) => {
    if (!occ) return;
    setShowLex(false);
    // Peek at the verse (bookmarkReadOnly) so it doesn't clobber the reading
    // position; the reader's full highlight/favorite/bookmark flow applies there.
    push('ChapterReaderPage', {
      book: occ.book,
      chapter: occ.chapter,
      initialVerse: occ.verse,
      bookmarkReadOnly: true,
    });
  }, [push]);

  // Position the focused zone within the lexicon panel. Short blocks are
  // centered; blocks taller than the panel are aligned to the edge we're moving
  // toward, so the next arrow press scrolls through them incrementally.
  useEffect(() => {
    if (!showLex) return;
    const c = lexPanelRef.current;
    if (!c) return;
    if (refFocus < 0) { c.scrollTo({ top: 0, behavior: 'smooth' }); return; } // definition: show top
    const el = occRefs.current[refFocus];
    if (!el) return;
    const view = c.clientHeight;
    const h = el.offsetHeight;
    let target;
    if (h <= view) target = el.offsetTop - view / 2 + h / 2;          // center
    else if (navDirRef.current < 0) target = el.offsetTop + h - view; // tall, moving up → bottom
    else target = el.offsetTop;                                       // tall, moving down → top
    c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [refFocus, showLex]);

  useEffect(() => {
    if (showGuide) {
      const scrollGuide = (delta) => guideRef.current?.scrollBy({ top: delta, behavior: 'smooth' });
      registerKeyHandlers({
        ArrowUp:   () => scrollGuide(-70),
        ArrowDown: () => scrollGuide(70),
        Backspace: () => setShowGuide(false),
        ArrowLeft: () => setShowGuide(false),
        Enter:     () => setShowGuide(false),
      });
      registerSoftkeys({ left: { label: 'Close', action: () => setShowGuide(false) }, center: '▲▼ Scroll', right: '' });
    } else if (showLex) {
      const c = () => lexPanelRef.current;
      const STEP = () => Math.max(48, ((c()?.clientHeight) || 200) * 0.8);
      const curEl = () => (refFocus < 0 ? defRef.current : occRefs.current[refFocus]);
      const hasRefs = refList.length > 0;

      const moveDown = () => {
        const cont = c();
        const el = curEl();
        if (cont && el) {
          const view = cont.clientHeight;
          const bottom = el.offsetTop + el.offsetHeight;
          if (bottom > cont.scrollTop + view + 2) {
            // current block extends below the view → scroll within it first
            cont.scrollTo({ top: Math.min(bottom - view, cont.scrollTop + STEP()), behavior: 'smooth' });
            return;
          }
        }
        if (!hasRefs) { cont?.scrollBy({ top: STEP(), behavior: 'smooth' }); return; }
        navDirRef.current = 1;
        setRefFocus(prev => Math.min(refList.length - 1, prev < 0 ? 0 : prev + 1));
      };

      const moveUp = () => {
        const cont = c();
        const el = curEl();
        if (cont && el && el.offsetTop < cont.scrollTop - 2) {
          // current block extends above the view → scroll up within it first
          cont.scrollTo({ top: Math.max(el.offsetTop, cont.scrollTop - STEP()), behavior: 'smooth' });
          return;
        }
        navDirRef.current = -1;
        setRefFocus(prev => Math.max(-1, prev - 1));
      };

      registerKeyHandlers({
        ArrowUp:   moveUp,
        ArrowDown: moveDown,
        Enter:     () => { if (refFocus >= 0 && refList[refFocus]) jumpToRef(refList[refFocus]); else setShowLex(false); },
        Backspace: () => setShowLex(false),
        ArrowLeft: () => setShowLex(false),
      });
      registerSoftkeys({
        left:   { label: 'Close', action: () => setShowLex(false) },
        center: refFocus >= 0 ? 'Jump' : '▲▼ Scroll',
        right:  { label: 'Guide', action: () => setShowGuide(true) },
      });
    } else {
      registerKeyHandlers({
        ArrowUp:   () => setFocusIdx(prev => Math.max(0, prev - 1)),
        ArrowDown: () => setFocusIdx(prev => Math.min(words.length - 1, prev + 1)),
        Enter:     () => openLexicon(words[focusIdx]),
        Backspace: () => pop(),
        ArrowLeft: () => pop(),
      });
      registerSoftkeys({
        left:   { label: 'Back', action: pop },
        center: words[focusIdx]?.strongs ? 'Lexicon' : '',
        right:  '',
      });
    }
  }, [showLex, showGuide, words, focusIdx, refList, refFocus, jumpToRef, openLexicon, pop, registerKeyHandlers, registerSoftkeys]);

  const ref = `${bookName} ${chapter}:${verse}`;

  if (loading) {
    return (
      <div className="page">
        <InterlinearHeader refText={ref} />
        <div className="page-content"><div className="loading"><span className="spinner" />Loading…</div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <InterlinearHeader refText={ref} />
        <div className="page-content">
          <div className="empty-state">
            {error === 'offline'
              ? 'Offline — interlinear unavailable'
              : `Interlinear not available\n${error}`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <InterlinearHeader refText={ref} />

      {/* Verse text */}
      {verseText && (
        <div style={{
          padding: '6px 10px',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-dim)',
          borderBottom: '1px solid var(--color-border)',
          fontStyle: 'italic',
          flexShrink: 0,
        }}>
          {verseText}
        </div>
      )}

      {/* Word list */}
      <div className="page-content" ref={wordListRef}>
        {words.map((w, idx) => {
          // Show the resolved lexicon key (e.g. H7225) rather than the raw
          // compound token (e.g. H9003/{H7225G}).
          const strongs = w.strongs ? (strongsToLexKey(w.strongs)?.key || null) : null;
          return (
            <div
              key={idx}
              ref={el => wordRefs.current[idx] = el}
              className={`list-item${focusIdx === idx ? ' focused' : ''}`}
              onClick={() => { setFocusIdx(idx); openLexicon(w); }}
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '7px 10px' }}
            >
              {/* Original text + transliteration */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', width: '100%' }}>
                <span className="font-scriptural" style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: focusIdx === idx ? '#fff' : 'var(--color-text)',
                  direction: 'rtl',
                }}>
                  {w.original || w.word || '—'}
                </span>
                <span className="font-scriptural" style={{
                  fontSize: 11,
                  color: focusIdx === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text-dim)',
                  fontStyle: 'italic',
                }}>
                  {w.translit}
                </span>
                {strongs && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    color: focusIdx === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text-muted)',
                  }}>
                    {strongs}
                  </span>
                )}
              </div>
              {/* Gloss */}
              <div style={{
                fontSize: 12,
                color: focusIdx === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text)',
              }}>
                {w.gloss}
              </div>
              {w.morph && (
                <div style={{
                  fontSize: 10,
                  color: focusIdx === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text-muted)',
                }}>
                  {w.morph}
                </div>
              )}
            </div>
          );
        })}

        {words.length === 0 && !loading && (
          <div className="empty-state">No interlinear data for this verse</div>
        )}
      </div>

      {/* Lexicon panel */}
      {showLex && (
        <div ref={lexPanelRef} style={{
          position: 'absolute',
          bottom: 32, left: 0, right: 0,
          background: 'var(--color-surface)',
          borderTop: '2px solid var(--color-accent)',
          padding: '10px 12px',
          zIndex: 100,
          maxHeight: '55%',
          overflowY: 'auto',
        }}>
          {lexLoading && <div className="loading"><span className="spinner" />Loading…</div>}
          {lexError && <div style={{ color: 'var(--color-danger)', fontSize: 12 }}>{lexError}</div>}
          {lexEntry && (
            <div ref={defRef}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
                <span className="font-scriptural" style={{ fontSize: 16, fontWeight: 700 }}>{lexEntry.word}</span>
                <span className="font-scriptural" style={{ fontSize: 12, color: 'var(--color-text-dim)', fontStyle: 'italic' }}>{lexEntry.translit}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{lexEntry.strongs}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{lexEntry.gloss}</div>
              {(lexEntry.pos || lexEntry.morph) && (
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 4 }}>
                  {lexEntry.pos || lexEntry.morph}
                </div>
              )}
              {lexEntry.root && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  root <span className="font-scriptural">{lexEntry.root}</span>
                </div>
              )}
              {lexEntry.definition && (
                <div className="font-scriptural" style={{ fontSize: 12, color: 'var(--color-text)', lineHeight: 1.45 }}>
                  {parseLexiconDefinition(lexEntry.definition).map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginLeft: it.level * 12, marginBottom: 3 }}>
                      {it.marker && (
                        <span style={{ fontWeight: 700, color: 'var(--color-accent)', flexShrink: 0 }}>{it.marker}</span>
                      )}
                      <span style={{ flex: 1 }}>{it.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Referenced verses — every verse this word occurs in. Selecting one
              jumps into the reader, where highlight / favorite / bookmark live. */}
          {occLoading && refList.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Loading referenced verses…
            </div>
          )}
          {refList.length > 0 && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: 4 }}>
                Referenced verses ({occurrences.length}{occurrences.length > MAX_REFS ? `, showing ${MAX_REFS}` : ''})
              </div>
              {refList.map((o, idx) => {
                const bk = BOOK_BY_ID[o.book];
                const focused = idx === refFocus;
                const text = verseTexts[vkey(o)];
                return (
                  <div
                    key={`${o.book}-${o.chapter}-${o.verse}-${idx}`}
                    ref={el => occRefs.current[idx] = el}
                    className={`list-item${focused ? ' focused' : ''}`}
                    onClick={() => { setRefFocus(idx); jumpToRef(o); }}
                    style={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                      padding: '6px 8px',
                      borderBottom: '1px solid var(--color-border)',
                      background: focused ? 'var(--color-focus-bg)' : 'transparent',
                    }}
                  >
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: focused ? 'var(--color-focus-text)' : 'var(--color-accent)',
                    }}>
                      {bk ? bk.name : o.book} {o.chapter}:{o.verse}
                    </span>
                    <span style={{
                      fontSize: 12,
                      lineHeight: 1.4,
                      color: text === undefined
                        ? 'var(--color-text-muted)'
                        : (focused ? 'var(--color-focus-text)' : 'var(--color-text)'),
                      fontStyle: text === undefined ? 'italic' : 'normal',
                    }}>
                      {text === undefined ? 'Loading…' : (text || '—')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Word-study guide — opened with SoftRight (Guide) from the lexicon */}
      {showGuide && (
        <div style={{
          position: 'absolute',
          top: 0, bottom: 32, left: 0, right: 0,
          background: 'var(--color-surface)',
          zIndex: 110,
          padding: '10px 12px',
          overflowY: 'auto',
        }} ref={guideRef}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--color-accent)' }}>
            Word Study Guide
          </div>
          {WORD_STUDY_GUIDE.map((sec, si) => (
            <div key={si} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{sec.heading}</div>
              {sec.lines.map((ln, li) => (
                <div key={li} style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--color-text)', marginBottom: 4 }}>
                  {ln}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InterlinearHeader({ refText }) {
  return (
    <div className="page-header">
      <span className="header-title">Interlinear — {refText}</span>
    </div>
  );
}
