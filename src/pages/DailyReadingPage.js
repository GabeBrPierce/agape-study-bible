import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  getPlan, getReadingForDay, formatReading, dayOfYear, TOTAL_READING_DAYS,
} from '../data/readingPlans';
import { getReadingProgress, saveReadingProgress } from '../db/db';

function defaultProgress(planId, mode) {
  return {
    planId,
    mode,
    currentDay: 1,
    completedDays: [],
    startedAt: new Date().toISOString(),
    lastReadAt: null,
  };
}

export default function DailyReadingPage({ planId }) {
  const { push, pop, popToRoot, registerKeyHandlers, registerSoftkeys } = useApp();
  const plan = getPlan(planId);

  const [progress, setProgress]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef(null);

  // Load (or initialize) this plan's saved progress.
  useEffect(() => {
    if (!plan) { setLoading(false); return; }
    let cancelled = false;
    getReadingProgress(planId).then(async (rec) => {
      if (cancelled) return;
      const record = rec || defaultProgress(planId, plan.mode);
      if (!rec) await saveReadingProgress(record).catch(() => {});
      setProgress(record);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [planId, plan]);

  const day = plan
    ? (plan.mode === 'date' ? dayOfYear() : (progress?.currentDay || 1))
    : 1;
  const reading = plan ? getReadingForDay(planId, day) : [];
  const completedDays = progress?.completedDays || [];
  const isDoneToday = completedDays.includes(day);

  const items = [
    ...reading.map(r => ({ type: 'reading', r })),
    { type: 'markDone' },
    { type: 'changePlan' },
  ];

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  const markDone = useCallback(async () => {
    if (!progress || isDoneToday) return;
    const nowIso = new Date().toISOString();
    const updated = plan.mode === 'progress'
      ? { ...progress, currentDay: Math.min(day + 1, TOTAL_READING_DAYS), completedDays: [...completedDays, day], lastReadAt: nowIso }
      : { ...progress, completedDays: [...completedDays, day], lastReadAt: nowIso };
    await saveReadingProgress(updated);
    setProgress(updated);
  }, [progress, isDoneToday, plan, day, completedDays]);

  const activateItem = useCallback((item) => {
    if (!item) return;
    if (item.type === 'reading') {
      push('ChapterReaderPage', { book: item.r.book, chapter: item.r.startChapter, bookmarkReadOnly: true });
    } else if (item.type === 'markDone') {
      markDone();
    } else if (item.type === 'changePlan') {
      push('ReadingPlanSelectionPage');
    }
  }, [push, markDone]);

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
        </div>

        <div className="section-header">Today's Reading</div>
        {reading.length === 0 && (
          <div className="list-item disabled" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            No reading scheduled
          </div>
        )}
        {items.map((item, idx) => {
          const focused = focusIndex === idx;
          if (item.type === 'reading') {
            return (
              <div
                key={`r-${idx}`}
                className={`list-item${focused ? ' focused' : ''}`}
                onClick={() => { setFocusIndex(idx); activateItem(item); }}
              >
                <span className="list-item-primary">{formatReading([item.r])}</span>
              </div>
            );
          }
          if (item.type === 'markDone') {
            return (
              <div
                key="markDone"
                className={`list-item${focused ? ' focused' : ''}${isDoneToday ? ' disabled' : ''}`}
                onClick={() => { setFocusIndex(idx); activateItem(item); }}
              >
                <span className="list-item-primary">
                  {isDoneToday ? '✓ Marked Done' : 'Mark Today’s Reading Done'}
                </span>
              </div>
            );
          }
          return (
            <div
              key="changePlan"
              className={`list-item${focused ? ' focused' : ''}`}
              onClick={() => { setFocusIndex(idx); activateItem(item); }}
            >
              <span className="list-item-primary">Change Reading Plan ›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
