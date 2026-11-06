import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getPlan, formatReading, TOTAL_READING_DAYS } from '../data/readingPlans';
import { BOOK_BY_ID } from '../data/books';
import {
  loadProgress, currentDayFor, chaptersForDay, sessionIndexFor, isToday,
} from '../data/dailyReadingSession';
import { saveReadingProgress, getReadingProgress } from '../db/db';

function chapterLabel(c) {
  if (!c) return '';
  const b = BOOK_BY_ID[c.book];
  return `${b ? b.name : c.book} ${c.chapter}`;
}

export default function DailyReadingPage({ planId }) {
  const { push, popToRoot, registerKeyHandlers, registerSoftkeys } = useApp();
  const plan = getPlan(planId);

  const [progress, setProgress]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef(null);

  // Load (or initialize) this plan's saved progress. Re-runs on every visit,
  // so returning from the reader shows the latest session position.
  useEffect(() => {
    if (!plan) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const existing = await getReadingProgress(planId);
      const record = existing || await loadProgress(planId);
      if (!existing) await saveReadingProgress(record).catch(() => {});
      if (cancelled) return;
      setProgress(record);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [planId, plan]);

  const day = currentDayFor(plan, progress);
  const chapters = useMemo(() => (plan ? chaptersForDay(planId, day) : []), [plan, planId, day]);
  const completedDays = progress?.completedDays || [];
  const isDayDone = completedDays.includes(day);
  const resumeIndex = sessionIndexFor(progress, day, chapters.length);
  const inSession = !isDayDone && progress?.session?.day === day;

  // Group the flat chapter list back into display ranges, remembering where
  // each range starts so it can be opened directly.
  const ranges = useMemo(() => {
    const out = [];
    chapters.forEach((c, i) => {
      const last = out[out.length - 1];
      if (last && last.book === c.book && c.chapter === last.endChapter + 1) {
        last.endChapter = c.chapter;
        last.endIndex = i;
      } else {
        out.push({ book: c.book, startChapter: c.chapter, endChapter: c.chapter, startIndex: i, endIndex: i, testament: c.testament });
      }
    });
    return out;
  }, [chapters]);

  const items = useMemo(() => [
    ...(chapters.length ? [{ type: 'start' }] : []),
    ...ranges.map(r => ({ type: 'range', r })),
    { type: 'changePlan' },
  ], [chapters.length, ranges]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  const startAt = useCallback((index, resume) => {
    const c = chapters[index];
    if (!c) return;
    push('ChapterReaderPage', {
      book: c.book,
      chapter: c.chapter,
      initialVerse: 1,
      bookmarkReadOnly: true,
      daily: { planId, day, chapters, index, fresh: !resume },
    });
  }, [chapters, push, planId, day]);

  const activateItem = useCallback((item) => {
    if (!item) return;
    if (item.type === 'start') {
      if (isDayDone) startAt(0, false);
      else startAt(resumeIndex, inSession);
    } else if (item.type === 'range') {
      startAt(item.r.startIndex, false);
    } else if (item.type === 'changePlan') {
      push('ReadingPlanSelectionPage');
    }
  }, [isDayDone, startAt, resumeIndex, inSession, push]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(items.length - 1, prev + 1)),
      Enter:     () => activateItem(items[focusIndex]),
      Backspace: popToRoot,
    });
    registerSoftkeys({ left: { label: 'Menu', action: popToRoot }, center: 'Select', right: '' });
  }, [items, focusIndex, activateItem, popToRoot, registerKeyHandlers, registerSoftkeys]);

  if (!plan) {
    return (
      <div className="page">
        <div className="page-header"><span className="header-title">Daily Reading</span></div>
        <div className="page-content empty-state">
          Plan not found.
          <div style={{ marginTop: 10, fontSize: 11 }} className="list-item" onClick={() => push('ReadingPlanSelectionPage')}>
            Choose a Reading Plan
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header"><span className="header-title">Daily Reading</span></div>
        <div className="page-content"><div className="loading"><span className="spinner" />Loading…</div></div>
      </div>
    );
  }

  const pct = Math.round((completedDays.length / TOTAL_READING_DAYS) * 100);
  const finishedToday = isToday(progress?.lastCompletedAt);

  let startLabel;
  if (isDayDone) startLabel = '✓ Completed · Read Again';
  else if (inSession) startLabel = `▶ Continue · ${chapterLabel(chapters[resumeIndex])}`;
  else startLabel = '▶ Start Today’s Reading';

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">{plan.label}</span>
      </div>
      <div className="page-content" ref={listRef}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 4 }}>
            Day {day} of {TOTAL_READING_DAYS} · {pct}% complete
            {plan.mode === 'date' ? ' · by date' : ' · at your pace'}
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          {finishedToday && !isDayDone && (
            <div style={{ fontSize: 11, color: 'var(--color-accent)', marginTop: 4 }}>
              ✓ You finished a day’s reading today
            </div>
          )}
        </div>

        <div className="section-header">Today's Reading</div>
        {chapters.length === 0 && (
          <div className="list-item disabled" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            No reading scheduled
          </div>
        )}
        {items.map((item, idx) => {
          const focused = focusIndex === idx;
          const cls = `list-item${focused ? ' focused' : ''}`;
          const onClick = () => { setFocusIndex(idx); activateItem(item); };
          if (item.type === 'start') {
            return (
              <div key="start" className={cls} onClick={onClick}>
                <span className="list-item-primary" style={{ fontWeight: 'bold' }}>{startLabel}</span>
              </div>
            );
          }
          if (item.type === 'range') {
            const { r } = item;
            const read = isDayDone || (inSession && r.endIndex < resumeIndex);
            return (
              <div key={`r-${r.startIndex}`} className={cls} style={{ paddingLeft: 20 }} onClick={onClick}>
                <span className="list-item-primary">
                  {formatReading([r])}{read ? ' ✓' : ''}
                </span>
                <span style={{ fontSize: 11, color: focused ? 'var(--color-focus-text-dim)' : 'var(--color-text-dim)' }}>
                  {plan.structure.endsWith('Combined') ? (r.testament || '') : ''}
                </span>
              </div>
            );
          }
          return (
            <div key="changePlan" className={cls} onClick={onClick}>
              <span className="list-item-primary">Change Reading Plan ›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
