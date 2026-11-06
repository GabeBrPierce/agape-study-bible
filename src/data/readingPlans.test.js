import { PLANS, TOTAL_READING_DAYS } from './readingPlans';
import { chaptersForDay } from './dailyReadingSession';

const chapterCount = (planId) => {
  let n = 0;
  for (let d = 1; d <= TOTAL_READING_DAYS; d++) n += chaptersForDay(planId, d).length;
  return n;
};

test('every plan has a reading on every day', () => {
  for (const p of PLANS) {
    for (let d = 1; d <= TOTAL_READING_DAYS; d++) {
      expect(chaptersForDay(p.id, d).length).toBeGreaterThan(0);
    }
  }
});

test('whole-Bible plans cover all 1189 chapters once', () => {
  expect(chapterCount('typical-progress')).toBe(1189);
  expect(chapterCount('chrono-progress')).toBe(1189);
});

test('OT + NT plans read OT once and NT twice, with NT every day', () => {
  for (const id of ['typicalCombined-progress', 'chronoCombined-progress']) {
    expect(chapterCount(id)).toBe(929 + 260 * 2);
    for (let d = 1; d <= TOTAL_READING_DAYS; d++) {
      const ch = chaptersForDay(id, d);
      expect(ch.some(c => c.testament === 'NT')).toBe(true);
      // OT chapters come before NT so the reader can switch over once.
      const firstNt = ch.findIndex(c => c.testament === 'NT');
      expect(ch.slice(firstNt).every(c => c.testament === 'NT')).toBe(true);
    }
  }
});
