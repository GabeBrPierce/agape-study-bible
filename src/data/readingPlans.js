// Daily reading plans — Agape Study Bible
//
// 4 plan "structures", each offered in 2 "modes" (8 selectable plans total):
//   - typical         : Genesis → Revelation, standard canonical book order
//   - chrono          : Old + New Testament in approximate historical/chronological order
//   - typicalCombined : an Old Testament reading AND a New Testament reading every day,
//                        each track walked in canonical order
//   - chronoCombined  : same as above, but each track walked in chronological order
//
//   - progress mode : advances only when the user marks a day's reading done —
//                      entirely at their own pace.
//   - date mode      : the reading for "today" is always whatever the plan assigns
//                       to today's day-of-year, tied to the calendar.
//
// NOTE on "chronological": this reorders whole BOOKS to approximate the order
// events/writings occurred; it does not splice individual verses or chapters
// out of a book (e.g. Job is not interleaved verse-by-verse into Genesis). This
// is the same simplification most simple chronological reading plans use.
// Feel free to refine BOOK-level ordering below if a different scheme is preferred.

import { BOOKS, BOOK_BY_ID } from './books';

export const TOTAL_READING_DAYS = 365;

const OT_CANONICAL_IDS = BOOKS.filter(b => b.testament === 'OT').map(b => b.id);
const NT_CANONICAL_IDS = BOOKS.filter(b => b.testament === 'NT').map(b => b.id);

// Approximate chronological (historical-event / composition) order, whole-book granularity.
const OT_CHRONOLOGICAL_IDS = [
  'GEN', 'JOB', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA',
  '2SA', '1CH', 'PSA', 'PRO', 'ECC', 'SNG', '1KI', '2CH', '2KI', 'OBA',
  'JOL', 'JON', 'AMO', 'HOS', 'ISA', 'MIC', 'NAH', 'ZEP', 'JER', 'LAM',
  'HAB', 'DAN', 'EZK', 'EZR', 'HAG', 'ZEC', 'EST', 'NEH', 'MAL',
];

const NT_CHRONOLOGICAL_IDS = [
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'JAS', 'GAL', '1TH', '2TH', '1CO',
  '2CO', 'ROM', 'EPH', 'PHP', 'COL', 'PHM', '1TI', 'TIT', '2TI', 'HEB',
  '1PE', '2PE', 'JUD', '1JN', '2JN', '3JN', 'REV',
];

// ── Build flat chapter lists ────────────────────────────────────────────────

function chapterList(bookIds) {
  const list = [];
  for (const id of bookIds) {
    const b = BOOK_BY_ID[id];
    if (!b) continue;
    for (let ch = 1; ch <= b.chapters; ch++) list.push({ book: id, chapter: ch });
  }
  return list;
}

const CANON_OT  = chapterList(OT_CANONICAL_IDS);
const CANON_NT  = chapterList(NT_CANONICAL_IDS);
const CHRONO_OT = chapterList(OT_CHRONOLOGICAL_IDS);
const CHRONO_NT = chapterList(NT_CHRONOLOGICAL_IDS);

const CANON_ALL  = [...CANON_OT, ...CANON_NT];
const CHRONO_ALL = [...CHRONO_OT, ...CHRONO_NT];

// ── Schedule building ────────────────────────────────────────────────────────

/** Split a flat chapter list into `numDays` buckets, as evenly as possible. */
function splitIntoDays(list, numDays = TOTAL_READING_DAYS) {
  const total = list.length;
  const days = [];
  for (let d = 0; d < numDays; d++) {
    const startIdx = Math.floor((d * total) / numDays);
    const endIdx   = Math.floor(((d + 1) * total) / numDays);
    days.push(list.slice(startIdx, endIdx));
  }
  return days;
}

/** Collapse consecutive same-book chapters into ranges: [{book, startChapter, endChapter}] */
function toRanges(entries) {
  const ranges = [];
  for (const e of entries) {
    const last = ranges[ranges.length - 1];
    if (last && last.book === e.book && e.chapter === last.endChapter + 1) {
      last.endChapter = e.chapter;
    } else {
      ranges.push({ book: e.book, startChapter: e.chapter, endChapter: e.chapter });
    }
  }
  return ranges;
}

function buildSequentialSchedule(list) {
  return splitIntoDays(list).map(toRanges);
}

function buildCombinedSchedule(listA, listB) {
  const daysA = splitIntoDays(listA);
  const daysB = splitIntoDays(listB);
  const days = [];
  for (let d = 0; d < TOTAL_READING_DAYS; d++) {
    days.push([...toRanges(daysA[d]), ...toRanges(daysB[d])]);
  }
  return days;
}

// Each schedule is an array of TOTAL_READING_DAYS entries; entry[d] is that
// day's reading: an array of { book, startChapter, endChapter }.
const SCHEDULES = {
  typical:         buildSequentialSchedule(CANON_ALL),
  chrono:          buildSequentialSchedule(CHRONO_ALL),
  typicalCombined: buildCombinedSchedule(CANON_OT, CANON_NT),
  chronoCombined:  buildCombinedSchedule(CHRONO_OT, CHRONO_NT),
};

// ── Plan definitions (4 structures × 2 modes = 8 plans) ─────────────────────

export const PLANS = [
  { id: 'typical-progress', structure: 'typical', mode: 'progress',
    label: 'Whole Bible — Canonical Order',
    sublabel: 'Genesis to Revelation, at your own pace' },
  { id: 'typical-date', structure: 'typical', mode: 'date',
    label: 'Whole Bible — Canonical Order',
    sublabel: "Genesis to Revelation, today's reading by date" },

  { id: 'chrono-progress', structure: 'chrono', mode: 'progress',
    label: 'Whole Bible — Chronological Order',
    sublabel: 'Historical order, at your own pace' },
  { id: 'chrono-date', structure: 'chrono', mode: 'date',
    label: 'Whole Bible — Chronological Order',
    sublabel: "Historical order, today's reading by date" },

  { id: 'typicalCombined-progress', structure: 'typicalCombined', mode: 'progress',
    label: 'OT + NT Together — Canonical',
    sublabel: 'An Old & New Testament reading daily, at your own pace' },
  { id: 'typicalCombined-date', structure: 'typicalCombined', mode: 'date',
    label: 'OT + NT Together — Canonical',
    sublabel: "An Old & New Testament reading daily, by date" },

  { id: 'chronoCombined-progress', structure: 'chronoCombined', mode: 'progress',
    label: 'OT + NT Together — Chronological',
    sublabel: 'Historical order, both testaments daily, at your own pace' },
  { id: 'chronoCombined-date', structure: 'chronoCombined', mode: 'date',
    label: 'OT + NT Together — Chronological',
    sublabel: "Historical order, both testaments daily, by date" },
];

export function getPlan(planId) {
  return PLANS.find(p => p.id === planId) || null;
}

export function getScheduleForPlan(planId) {
  const plan = getPlan(planId);
  return plan ? SCHEDULES[plan.structure] : null;
}

/** 1-indexed day (1..TOTAL_READING_DAYS) → that day's reading ranges. */
export function getReadingForDay(planId, day) {
  const schedule = getScheduleForPlan(planId);
  if (!schedule) return [];
  const idx = Math.min(Math.max(day, 1), schedule.length) - 1;
  return schedule[idx] || [];
}

/** Today's 1-indexed day-of-year, capped to TOTAL_READING_DAYS (handles leap years). */
export function dayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffMs = date.setHours ? date - start : new Date(date) - start;
  const day = Math.floor(diffMs / 86400000) + 1;
  return Math.min(Math.max(day, 1), TOTAL_READING_DAYS);
}

/** Human-readable reading list, e.g. "Genesis 1-3; Matthew 1" */
export function formatReading(reading) {
  if (!reading || reading.length === 0) return '';
  return reading.map(r => {
    const b = BOOK_BY_ID[r.book];
    const name = b ? b.name : r.book;
    return r.startChapter === r.endChapter
      ? `${name} ${r.startChapter}`
      : `${name} ${r.startChapter}-${r.endChapter}`;
  }).join('; ');
}
