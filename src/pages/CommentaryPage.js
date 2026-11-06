import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { fetchAvailableCommentaries, fetchCommentaryChapter } from '../api/bibleApi';
import { BOOK_BY_ID } from '../data/books';
import { useBannerAd, BannerAd } from '../ads/BannerAd';

const DEFAULT_COMMENTARY = 'matthew-henry';

/**
 * Classic commentary on the selected verse(s), one commentary at a time.
 * Left/Right cycle through every available commentary (the last one used is
 * remembered); Up/Down scroll the text. Commentaries comment on passages, so
 * every section whose span overlaps the selection is shown, labelled with the
 * verses it covers.
 */
export default function CommentaryPage({ book, chapter, verseStart, verseEnd = verseStart, lastVerse }) {
  const { pop, registerKeyHandlers, registerSoftkeys, settings, updateSettings } = useApp();

  const [commentaries, setCommentaries] = useState([]);
  const [index, setIndex]               = useState(0);
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const contentRef = useRef(null);

  const bookData = BOOK_BY_ID[book];
  const bookName = bookData ? bookData.name : book;
  const refLabel = verseStart === verseEnd
    ? `${bookName} ${chapter}:${verseStart}`
    : `${bookName} ${chapter}:${verseStart}–${verseEnd}`;

  // Load the catalog once, starting on the commentary used last time.
  useEffect(() => {
    let cancelled = false;
    fetchAvailableCommentaries().then(list => {
      if (cancelled) return;
      setCommentaries(list);
      const preferred = settings.commentaryId || DEFAULT_COMMENTARY;
      setIndex(Math.max(0, list.findIndex(c => c.id === preferred)));
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch (or read cached) commentary whenever the current commentary changes.
  useEffect(() => {
    const c = commentaries[index];
    if (!c) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCommentaryChapter(c.id, book, chapter)
      .then(d => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setData(null);
        setError(err.message === 'OFFLINE' ? 'offline' : err.message === 'NOT_AVAILABLE' ? 'missing' : 'error');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [commentaries, index, book, chapter]);

  // Start each commentary at the top.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [index, loading]);

  const cycle = useCallback((delta) => {
    if (commentaries.length < 2) return;
    const next = (index + delta + commentaries.length) % commentaries.length;
    setIndex(next);
    updateSettings({ commentaryId: commentaries[next].id }).catch(() => {});
  }, [commentaries, index, updateSettings]);

  const banner = useBannerAd('commentary-banner');

  const scroll = useCallback((dir) => {
    const c = contentRef.current;
    if (!c) return;
    // Down at the end of the text moves focus onto the banner ad.
    if (dir > 0 && c.scrollTop + c.clientHeight >= c.scrollHeight - 2 && banner.focus()) return;
    const step = Math.max(40, c.clientHeight * 0.8);
    c.scrollTo({ top: Math.max(0, c.scrollTop + dir * step), behavior: 'smooth' });
  }, [banner]);

  useEffect(() => {
    if (banner.focused) {
      // Enter is handled by KaiAds itself (the focused ad container opens the ad).
      registerKeyHandlers({
        ArrowUp:    banner.blur,
        ArrowLeft:  () => { banner.blur(); cycle(-1); },
        ArrowRight: () => { banner.blur(); cycle(1); },
        Enter:      () => {},
        Backspace:  pop,
        SoftLeft:   pop,
      });
      registerSoftkeys({ left: { label: 'Back', action: pop }, center: 'Open Ad', right: '' });
      return;
    }
    registerKeyHandlers({
      ArrowLeft:  () => cycle(-1),
      ArrowRight: () => cycle(1),
      ArrowUp:    () => scroll(-1),
      ArrowDown:  () => scroll(1),
      Backspace:  pop,
      SoftLeft:   pop,
    });
    registerSoftkeys({ left: { label: 'Back', action: pop }, center: '', right: '' });
  }, [cycle, scroll, pop, registerKeyHandlers, registerSoftkeys, banner]);

  // Each section runs from its verse up to the verse before the next section.
  const sections = (data?.sections || []).map((s, i, all) => ({
    ...s,
    endVerse: i + 1 < all.length ? all[i + 1].verse - 1 : (lastVerse || null),
  }));
  const relevant = sections.filter(s =>
    s.verse <= verseEnd && (s.endVerse == null || s.endVerse >= verseStart));
  // Selection falls before the first section (e.g. verse 1 when comments start
  // at verse 2): the chapter introduction is the closest thing to a comment.
  const showIntro = relevant.length === 0 && !!data?.introduction;

  const current = commentaries[index];
  const headerLabel = current ? shortName(current) : '…';

  return (
    <div className="page">
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <span
          onClick={() => cycle(-1)}
          style={{ fontSize: 14, padding: '0 4px', color: 'var(--color-header-text)', opacity: commentaries.length > 1 ? 0.9 : 0.25 }}
        >◂</span>
        <span className="header-title" style={{ textAlign: 'center', flex: 1 }}>
          {headerLabel}
        </span>
        <span
          onClick={() => cycle(1)}
          style={{ fontSize: 14, padding: '0 4px', color: 'var(--color-header-text)', opacity: commentaries.length > 1 ? 0.9 : 0.25 }}
        >▸</span>
      </div>

      <div className="page-content" ref={contentRef} style={{ padding: '6px 8px' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>{refLabel}</span>
          {commentaries.length > 1 && <span>{index + 1} / {commentaries.length}</span>}
        </div>

        {loading ? (
          <div className="loading"><span className="spinner" />Loading…</div>
        ) : error ? (
          <div className="empty-state">
            {error === 'offline'
              ? 'Offline — this commentary has not been saved for this chapter yet'
              : error === 'missing'
                ? 'This commentary does not cover this chapter'
                : 'Failed to load commentary'}
            {commentaries.length > 1 && (
              <div style={{ marginTop: 10, fontSize: 11 }}>◂ ▸ to try another commentary</div>
            )}
          </div>
        ) : relevant.length > 0 ? (
          relevant.map(s => (
            <div key={s.verse} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--color-accent)', marginBottom: 3 }}>
                {rangeLabel(s.verse, s.endVerse)}
              </div>
              <div className="verse-text" style={{ whiteSpace: 'pre-line' }}>{s.text}</div>
            </div>
          ))
        ) : showIntro ? (
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-accent)', marginBottom: 3 }}>
              Chapter introduction
            </div>
            <div className="verse-text" style={{ whiteSpace: 'pre-line' }}>{data.introduction}</div>
          </div>
        ) : (
          <div className="empty-state">
            No comment on this verse in this commentary
            {commentaries.length > 1 && (
              <div style={{ marginTop: 10, fontSize: 11 }}>◂ ▸ to try another commentary</div>
            )}
          </div>
        )}
      </div>

      <BannerAd banner={banner} />
    </div>
  );
}

function rangeLabel(start, end) {
  if (end == null) return `v. ${start}ff.`;
  return end > start ? `v. ${start}–${end}` : `v. ${start}`;
}

// Header names that fit a 240px screen. Unknown commentaries fall back to
// trimming the trailing "(Bible) Commentary".
const SHORT_NAMES = {
  'jamieson-fausset-brown': 'Jamieson-Fausset-Brown',
  'keil-delitzsch':         'Keil & Delitzsch',
  'john-calvin':            'John Calvin',
  'tyndale':                'Tyndale Study Notes',
};

function shortName(commentary) {
  return SHORT_NAMES[commentary.id]
    || commentary.name.replace(/\s*(Old Testament\s+|Bible\s+)?Commentar(y|ies)\s*$/i, '').replace(/'s$/, '')
    || commentary.name;
}
