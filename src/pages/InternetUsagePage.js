import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';

const OPTIONS = [
  { id: 'always',    label: 'Always allowed',  desc: 'API calls on any network' },
  { id: 'wifi-only', label: 'Wi-Fi only',       desc: 'API calls blocked on mobile data' },
  { id: 'never',     label: 'Never',            desc: 'Fully offline mode' },
];

export default function InternetUsagePage() {
  const { pop, registerKeyHandlers, registerSoftkeys, settings, updateSettings } = useApp();
  const [focusIndex, setFocusIndex] = useState(
    Math.max(0, OPTIONS.findIndex(o => o.id === settings.internetUsage))
  );

  const handleSelect = useCallback(async () => {
    await updateSettings({ internetUsage: OPTIONS[focusIndex].id });
    pop();
  }, [focusIndex, updateSettings, pop]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(OPTIONS.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: pop,
    });
    registerSoftkeys({ left: { label: 'Back', action: pop }, center: 'Confirm', right: '' });
  }, [focusIndex, handleSelect, pop, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Internet Usage</span>
      </div>
      <div className="page-content">
        {OPTIONS.map((opt, idx) => {
          const isActive = settings.internetUsage === opt.id;
          return (
            <div
              key={opt.id}
              className={`list-item${focusIndex === idx ? ' focused' : ''}`}
              onClick={() => { setFocusIndex(idx); updateSettings({ internetUsage: opt.id }); pop(); }}
            >
              <span style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: `2px solid ${focusIndex === idx ? '#fff' : 'var(--color-accent)'}`,
                background: isActive ? (focusIndex === idx ? '#fff' : 'var(--color-accent)') : 'transparent',
                marginRight: 10,
                flexShrink: 0,
                display: 'inline-block',
              }} />
              <div style={{ flex: 1 }}>
                <div className="list-item-primary">{opt.label}</div>
                <div className="list-item-secondary">{opt.desc}</div>
              </div>
              {isActive && (
                <span style={{ fontSize: 14, color: focusIndex === idx ? '#fff' : 'var(--color-success)' }}>✓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
