// Daily reading session helpers: turn a plan day into an ordered chapter list,
// remember where the reader is inside that list, and mark the day complete.
//
// Progress record (readingProgress store, keyed by planId):
//   { planId, mode, currentDay, completedDays, startedAt, lastReadAt,
//     lastCompletedAt, session: { day, index } | null }

import { BOOK_BY_ID } from './books';
import { getPlan, getReadingForDay, dayOfYear, TOTAL_READING_DAYS } from './readingPlans';
import { getReadingProgress, saveReadingProgress } from '../db/db';

export function defaultProgress(planId, mode) {
  return {
    planId,
    mode,
    currentDay: 1,
    completedDays: [],
    startedAt: new Date().toISOString(),
    lastReadAt: null,
    lastCompletedAt: null,
    session: null,
  };
}

/** The plan day that is "today" for this plan + saved progress. */
export function currentDayFor(plan, progress) {
  if (!plan) return 1;
  return plan.mode === 'date' ? dayOfYear() : (progress?.currentDay || 1);
}

/** Flat, ordered list of the chapters assigned to a plan day (OT track first, then NT). */
export function chaptersForDay(planId, day) {
  const out = [];
  for (const r of getReadingForDay(planId, day)) {
    const testament = BOOK_BY_ID[r.book]?.testament || null;
    for (let ch = r.startChapter; ch <= r.endChapter; ch++) {
      out.push({ book: r.book, chapter: ch, testament });
    }
  }
  return out;
}

/** True when an ISO timestamp falls on today's local calendar date. */
export function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

/** Saved session index for this day, or 0 when there is no session for it. */
export function sessionIndexFor(progress, day, chapterCount) {
  const s = progress?.session;
  if (!s || s.day !== day || chapterCount === 0) return 0;
  return Math.min(Math.max(s.index, 0), chapterCount - 1);
}

export async function loadProgress(planId) {
  const plan = getPlan(planId);
  return (await getReadingProgress(planId)) || defaultProgress(planId, plan?.mode);
}

// Each helper below is a read-modify-write on the same record; run them one at
// a time so a late session save can never overwrite a completion.
let queue = Promise.resolve();
function serialize(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/** Remember which chapter of the day the reader is on. */
export function saveSessionPosition(planId, day, index) {
  return serialize(async () => {
    const p = await loadProgress(planId);
    const updated = { ...p, session: { day, index }, lastReadAt: new Date().toISOString() };
    await saveReadingProgress(updated);
    return updated;
  });
}

/**
 * Mark a plan day complete. Progress-mode plans advance to the next day.
 * Safe to call twice for the same day (does not double-advance).
 */
export function completeDay(planId, day) {
  return serialize(async () => {
    const plan = getPlan(planId);
    const p = await loadProgress(planId);
    const nowIso = new Date().toISOString();
    const completedDays = p.completedDays || [];
    const already = completedDays.includes(day);
    const updated = {
      ...p,
      session: null,
      lastReadAt: nowIso,
      lastCompletedAt: nowIso,
      completedDays: already ? completedDays : [...completedDays, day],
    };
    if (plan?.mode === 'progress' && !already && (p.currentDay || 1) === day) {
      updated.currentDay = Math.min(day + 1, TOTAL_READING_DAYS);
    }
    await saveReadingProgress(updated);
    return updated;
  });
}
