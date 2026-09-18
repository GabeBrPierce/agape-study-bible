import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';

const SETTINGS_ITEMS = [
  { id: 'darkMode',        label: 'Dark Mode',       type: 'toggle'  },
  { id: 'bibleVersion',    label: 'Bible Version',    type: 'nav'     },
  { id: 'fontSize',        label: 'Font Size',        type: 'cycle',  options: ['small', 'medium', 'large'] },
  { id: 'manageBookmarks', label: 'Manage Bookmarks', type: 'nav'     },
  { id: 'manageHighlights',label: 'Manage Highlights',type: 'nav'     },
  { id: 'internetUsage',   label: 'Internet Usage',   type: 'nav'     },
  { id: 'about',           label: 'About',            type: 'nav'     },
];

export default function SettingsPage() {
  const { push, pop, registerKeyHandlers, registerSoftkeys, settings, updateSettings } = useApp();
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  const getItemValue = useCallback((item) => {
    if (item.id === 'darkMode') return settings.darkMode ? 'On' : 'Off';
    if (item.id === 'fontSize') return settings.fontSize;
    if (item.id === 'bibleVersion') return settings.translationId?.toUpperCase() || 'WEB';
    if (item.id === 'internetUsage') return settings.internetUsage;
    return '';
  }, [settings]);

  const activateItem = useCallback(async (item) => {
    switch (item.id) {
      case 'darkMode':
        await updateSettings({ darkMode: !settings.darkMode });
        break;
      case 'fontSize': {
        const opts = item.options;
        const idx  = opts.indexOf(settings.fontSize);
        await updateSettings({ fontSize: opts[(idx + 1) % opts.length] });
        break;
      }
      case 'bibleVersion':
        push('VersionSelectionPage');
        break;
      case 'manageBookmarks':
        push('BookmarkSelectionPage', { entryPoint: 'mainMenu' });
        break;
      case 'manageHighlights':
        push('HighlightSelectionPage');
        break;
      case 'internetUsage':
        push('InternetUsagePage');
        break;
      case 'about':
        // Simple inline: just display info
        break;
      default:
        break;
    }
  }, [settings, updateSettings, push]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(SETTINGS_ITEMS.length - 1, prev + 1)),
      ArrowRight:() => activateItem(SETTINGS_ITEMS[focusIndex]),
      ArrowLeft: () => activateItem(SETTINGS_ITEMS[focusIndex]),
      Enter:     () => activateItem(SETTINGS_ITEMS[focusIndex]),
      Backspace: pop,
    });
    registerSoftkeys({ left: { label: 'Back', action: pop }, center: 'Select', right: '' });
  }, [focusIndex, activateItem, pop, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Settings</span>
      </div>
      <div className="page-content" ref={listRef}>
        {SETTINGS_ITEMS.map((item, idx) => (
          <div
            key={item.id}
            className={`list-item${focusIndex === idx ? ' focused' : ''}`}
            onClick={() => { setFocusIndex(idx); activateItem(item); }}
          >
            <span className="list-item-primary">{item.label}</span>
            <span style={{
              fontSize: 11,
              color: focusIndex === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text-dim)',
              marginLeft: 8,
            }}>
              {getItemValue(item)}
              {item.type === 'nav' ? ' ›' : ''}
            </span>
          </div>
        ))}

        {/* About info (shown when last item is focused) */}
        {focusIndex === SETTINGS_ITEMS.length - 1 && (
          <div style={{ padding: '12px 10px', fontSize: 11, color: 'var(--color-text-dim)', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ marginBottom: 4 }}><strong>Agape Study Bible</strong> v3.0.0</div>
            <div style={{ marginBottom: 4 }}>Bible data: Free Use Bible API (bible.helloao.org)</div>
            <div>WEB translation: World English Bible (public domain)</div>
          </div>
        )}
      </div>
    </div>
  );
}
