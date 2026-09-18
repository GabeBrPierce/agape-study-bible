import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { TOPICAL_TREE } from '../data/books';

// Stack entries: { type: 'root' } | { type: 'testament', index } | { type: 'category', tIndex, cIndex }
export default function TopicalSelectionPage() {
  const { push, pop, registerKeyHandlers, registerSoftkeys } = useApp();

  // navPath: array of indices describing current layer
  const [path, setPath] = useState([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef  = useRef(null);
  const itemRefs = useRef({});

  const currentItems = getCurrentItems(path);

  useEffect(() => {
    const el = itemRefs.current[focusIndex];
    const container = listRef.current;
    if (!el || !container) return;
    const targetScrollTop = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [focusIndex]);

  const goDeeper = useCallback((idx) => {
    const item = currentItems[idx];
    if (!item) return;
    if (item.type === 'book') {
      push('ChapterSelectionPage', { book: item.id });
    } else {
      setPath(prev => [...prev, idx]);
      setFocusIndex(0);
    }
  }, [currentItems, push]);

  const goBack = useCallback(() => {
    if (path.length === 0) {
      pop();
    } else {
      setPath(prev => prev.slice(0, -1));
      setFocusIndex(0);
    }
  }, [path, pop]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:    () => setFocusIndex(prev => prev > 0 ? prev - 1 : currentItems.length - 1),
      ArrowDown:  () => setFocusIndex(prev => prev < currentItems.length - 1 ? prev + 1 : 0),
      ArrowRight: () => goDeeper(focusIndex),
      Enter:      () => goDeeper(focusIndex),
      ArrowLeft:  goBack,
      Backspace:  goBack,
    });
    registerSoftkeys({ left: { label: 'Back', action: goBack }, center: 'Select', right: '' });
  }, [currentItems, focusIndex, goDeeper, goBack, registerKeyHandlers, registerSoftkeys]);

  const title = path.length === 0
    ? 'Topical'
    : path.length === 1
      ? TOPICAL_TREE[path[0]].label
      : TOPICAL_TREE[path[0]].children[path[1]].label;

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">{title}</span>
      </div>
      <div className="page-content" ref={listRef}>
        {currentItems.map((item, idx) => (
          <div
            key={idx}
            ref={el => itemRefs.current[idx] = el}
            className={`list-item${focusIndex === idx ? ' focused' : ''}`}
            onClick={() => { setFocusIndex(idx); goDeeper(idx); }}
          >
            <span className="list-item-primary">{item.label || item.name}</span>
            {item.type !== 'book' && (
              <span style={{ fontSize: 11, color: focusIndex === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text-dim)' }}>›</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getCurrentItems(path) {
  if (path.length === 0) {
    return TOPICAL_TREE.map((t, i) => ({ label: t.label, type: 'testament', index: i }));
  }
  if (path.length === 1) {
    const testament = TOPICAL_TREE[path[0]];
    return testament.children.map((c, i) => ({ label: c.label, type: 'category', index: i }));
  }
  if (path.length === 2) {
    const category = TOPICAL_TREE[path[0]].children[path[1]];
    return category.books.map(b => ({ ...b, type: 'book' }));
  }
  return [];
}
