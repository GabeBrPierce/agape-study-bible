import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getRecentBookmarks, getRecentHighlighters, getSettings } from '../db/db';
import { BOOK_BY_ID } from '../data/books';

const MENU_ITEMS = [
  { id: 'continue',     label: 'Continue Reading',  requiresLocation: true  },
  { id: 'dailyReading', label: 'Daily Reading',      requiresLocation: false },
  { id: 'address',   label: 'Address Selection',  requiresLocation: false },
  { id: 'search',    label: 'Search Bible',        requiresLocation: false },
  { id: 'bookmarks', label: 'Bookmarks',           requiresLocation: false },
  { id: 'highlights',label: 'Highlights',          requiresLocation: false },
  { id: 'favorites', label: 'Favorites',           requiresLocation: false },
  { id: 'settings',  label: 'Settings',            requiresLocation: false },
];

export default function MainMenu() {
  const { push, registerKeyHandlers, registerSoftkeys, settings, activateBookmarkSession } = useApp();
  const [focusIndex, setFocusIndex] = useState(0);
  const [recentBookmarks, setRecentBookmarks]   = useState([]);
  const [recentHighlights, setRecentHighlights] = useState([]);
  const savedLocation = settings.savedLocation;
  const activeReadingPlanId = settings.activeReadingPlanId;

  // Build the flat list of focusable items (memoized so stable callbacks don't loop)
  const items = useMemo(
    () => buildItemList(MENU_ITEMS, recentBookmarks, recentHighlights, savedLocation, activeReadingPlanId),
    [recentBookmarks, recentHighlights, savedLocation, activeReadingPlanId]
  );

  useEffect(() => {
    getRecentBookmarks(3).then(setRecentBookmarks).catch(() => {});
    getRecentHighlighters(3).then(setRecentHighlights).catch(() => {});
  }, []);

  // Keep focused item centred in the scroll container
  const listRef = useRef(null);
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector('.list-item.focused');
    if (!el) return;
    const targetScrollTop =
      el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [focusIndex]);

  const getSelectableCount = useCallback(() => items.filter(i => !i.disabled).length, [items]);

  const moveFocus = useCallback((dir) => {
    setFocusIndex(prev => {
      let next = prev + dir;
      // Skip disabled items
      for (let i = 0; i < items.length; i++) {
        if (next < 0) next = items.length - 1;
        if (next >= items.length) next = 0;
        if (!items[next]?.disabled) break;
        next += dir;
      }
      return next;
    });
  }, [items]);

  const handleSelect = useCallback(() => {
    const item = items[focusIndex];
    if (!item || item.disabled) return;
    activateItem(item, push, savedLocation, activateBookmarkSession, activeReadingPlanId);
  }, [focusIndex, items, push, savedLocation, activateBookmarkSession, activeReadingPlanId]);

  // Backspace at the root menu exits the app directly (no confirmation modal).
  const handleBackspace = useCallback(() => {
    if (window.close) window.close();
  }, []);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:   () => moveFocus(-1),
      ArrowDown: () => moveFocus(1),
      Enter:     handleSelect,
      Backspace: handleBackspace,
    });
    registerSoftkeys({ left: '', center: 'Select', right: '' });
  }, [moveFocus, handleSelect, handleBackspace, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">✦ Agape Study Bible</span>
      </div>

      <div className="page-content" ref={listRef}>
        {items.map((item, idx) => (
          <MenuRow
            key={`${item.id}-${idx}`}
            item={item}
            focused={idx === focusIndex}
            onClick={() => { setFocusIndex(idx); activateItem(item, push, savedLocation, activateBookmarkSession, activeReadingPlanId); }}
          />
        ))}
      </div>
    </div>
  );
}

function MenuRow({ item, focused, onClick }) {
  if (item.type === 'section') {
    return <div className="section-header">{item.label}</div>;
  }
  if (item.type === 'empty') {
    return (
      <div className="list-item disabled" style={{ paddingLeft: 20, fontSize: 11, color: 'var(--color-text-muted)' }}>
        {item.label}
      </div>
    );
  }

  const isSubItem = item.indent;
  return (
    <div
      className={`list-item${focused ? ' focused' : ''}${item.disabled ? ' disabled' : ''}`}
      style={isSubItem ? { paddingLeft: 20 } : undefined}
      onClick={onClick}
    >
      {item.color && (
        <span className="color-swatch" style={{ background: item.color }} />
      )}
      <span className="list-item-primary">{item.label}</span>
      {item.sub && (
        <span style={{ fontSize: 11, color: focused ? 'var(--color-focus-text-dim)' : 'var(--color-text-dim)' }}>
          {item.sub}
        </span>
      )}
    </div>
  );
}

function buildItemList(menuItems, bookmarks, highlights, savedLocation, activeReadingPlanId) {
  const list = [];
  for (const m of menuItems) {
    if (m.id === 'continue') {
      let sub = 'John 3:16';
      if (savedLocation) {
        const book = BOOK_BY_ID[savedLocation.book];
        sub = `${book ? book.name : savedLocation.book} ${savedLocation.chapter}:${savedLocation.verse}`;
      }
      list.push({ ...m, disabled: false, sub, action: 'continue' });

    } else if (m.id === 'dailyReading') {
      const sub = activeReadingPlanId ? "Today's reading" : 'Choose a plan';
      list.push({ ...m, disabled: false, sub, action: 'dailyReading' });

    } else if (m.id === 'bookmarks') {
      list.push({ ...m, action: 'bookmarks' });
      if (bookmarks.length === 0) {
        list.push({ id: 'bm-empty', type: 'empty', label: 'No bookmarks yet', disabled: true });
      } else {
        for (const bm of bookmarks) {
          const book = BOOK_BY_ID[bm.book];
          list.push({
            id: `bm-${bm.id}`,
            label: bm.title,
            sub: `${book ? book.name : bm.book} ${bm.chapter}:${bm.verse}`,
            color: bm.color,
            indent: true,
            action: 'open-bookmark',
            bookmark: bm,
          });
        }
        if (bookmarks.length >= 3) {
          list.push({ id: 'bm-all', label: 'All Bookmarks', indent: true, action: 'all-bookmarks' });
        }
      }

    } else if (m.id === 'highlights') {
      list.push({ ...m, action: 'highlights' });
      if (highlights.length === 0) {
        list.push({ id: 'hl-empty', type: 'empty', label: 'No highlights yet', disabled: true });
      } else {
        for (const hl of highlights) {
          list.push({
            id: `hl-${hl.id}`,
            label: hl.name,
            color: hl.color,
            indent: true,
            action: 'open-highlight',
            highlighter: hl,
          });
        }
        if (highlights.length >= 3) {
          list.push({ id: 'hl-all', label: 'All Highlights', indent: true, action: 'all-highlights' });
        }
      }

    } else {
      list.push({ ...m, action: m.id });
    }
  }
  return list;
}

function activateItem(item, push, savedLocation, activateBookmarkSession, activeReadingPlanId) {
  switch (item.action) {
    case 'continue': {
      const loc = savedLocation || { book: 'JHN', chapter: 3, verse: 16 };
      push('ChapterReaderPage', {
        book: loc.book,
        chapter: loc.chapter,
        initialVerse: loc.verse,
      });
      break;
    }
    case 'dailyReading':
      if (activeReadingPlanId) {
        push('DailyReadingPage', { planId: activeReadingPlanId });
      } else {
        push('ReadingPlanSelectionPage');
      }
      break;
    case 'address':
      push('AddressSelectionPage');
      break;
    case 'search':
      push('SearchBiblePage');
      break;
    case 'bookmarks':
    case 'all-bookmarks':
      push('BookmarkSelectionPage', { entryPoint: 'mainMenu' });
      break;
    case 'open-bookmark':
      activateBookmarkSession();
      push('ChapterReaderPage', {
        book:    item.bookmark.book,
        chapter: item.bookmark.chapter,
        initialVerse: item.bookmark.verse,
      });
      break;
    case 'highlights':
    case 'all-highlights':
      push('HighlightSelectionPage');
      break;
    case 'open-highlight':
      push('HighlightListPage', { highlighter: item.highlighter });
      break;
    case 'favorites':
      push('FavoriteSelectionPage');
      break;
    case 'settings':
      push('SettingsPage');
      break;
    default:
      break;
  }
}
