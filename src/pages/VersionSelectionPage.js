import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { fetchAvailableTranslations } from '../api/bibleApi';
import { getTranslations, saveTranslation } from '../db/db';

const BUNDLED = [{ id: 'web', name: 'World English Bible', shortName: 'WEB', language: 'English', isInstalled: true }];

export default function VersionSelectionPage() {
  const { pop, registerKeyHandlers, registerSoftkeys, settings, updateSettings } = useApp();
  const [installed, setInstalled]     = useState(BUNDLED);
  const [remote, setRemote]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [downloading, setDownloading] = useState(null); // id being downloaded
  const [focusIndex, setFocusIndex]   = useState(0);
  const listRef = useRef(null);

  // Load installed translations from DB
  useEffect(() => {
    getTranslations().then(dbTrans => {
      const extra = dbTrans.filter(t => t.isInstalled && t.id !== 'web');
      setInstalled([...BUNDLED, ...extra]);
    });
  }, []);

  // Fetch remote list
  const refreshRemote = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAvailableTranslations();
      const installedIds = new Set(installed.map(t => t.id));
      setRemote(all.filter(t => !installedIds.has(t.id)).slice(0, 30));
    } catch {
      // Offline — show nothing
    } finally {
      setLoading(false);
    }
  }, [installed]);

  useEffect(() => { refreshRemote(); }, []); // eslint-disable-line

  const allItems = [
    ...installed.map(t => ({ ...t, section: 'installed' })),
    ...remote.map(t => ({ ...t, section: 'remote', isInstalled: false })),
  ];

  const handleSelect = useCallback(async () => {
    const item = allItems[focusIndex];
    if (!item) return;
    if (item.isInstalled) {
      await updateSettings({ translationId: item.id });
      pop();
    } else {
      // Download translation (placeholder — fetch all chapters would be huge)
      setDownloading(item.id);
      try {
        const newTrans = { ...item, isInstalled: true, installedAt: new Date().toISOString() };
        await saveTranslation(newTrans);
        setInstalled(prev => [...prev, newTrans]);
        setRemote(prev => prev.filter(t => t.id !== item.id));
        await updateSettings({ translationId: item.id });
      } catch (err) {
        console.error('Download failed:', err);
      } finally {
        setDownloading(null);
      }
      pop();
    }
  }, [allItems, focusIndex, updateSettings, pop]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(allItems.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: pop,
      SoftRight: refreshRemote,
    });
    registerSoftkeys({ left: { label: 'Back', action: pop }, center: 'Select', right: { label: 'Refresh', action: refreshRemote } });
  }, [allItems, focusIndex, handleSelect, refreshRemote, pop, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Bible Version</span>
      </div>
      <div className="page-content" ref={listRef}>
        <div className="section-header">Installed</div>
        {installed.map((t, idx) => (
          <div
            key={t.id}
            className={`list-item${focusIndex === idx ? ' focused' : ''}`}
            onClick={() => { setFocusIndex(idx); handleSelect(); }}
          >
            <span className="list-item-primary">{t.shortName || t.id.toUpperCase()}</span>
            <span style={{ fontSize: 11, color: focusIndex === idx ? 'rgba(255,255,255,0.7)' : 'var(--color-text-dim)' }}>
              {t.name}
              {settings.translationId === t.id && ' ✓'}
            </span>
          </div>
        ))}

        {loading && (
          <div className="loading"><span className="spinner" />Loading available…</div>
        )}

        {remote.length > 0 && (
          <>
            <div className="section-header">Available to Download</div>
            {remote.map((t, i) => {
              const idx = installed.length + i;
              return (
                <div
                  key={t.id}
                  className={`list-item${focusIndex === idx ? ' focused' : ''}`}
                  onClick={() => { setFocusIndex(idx); handleSelect(); }}
                >
                  <span className="list-item-primary">{t.shortName || t.id.toUpperCase()}</span>
                  <span style={{ fontSize: 11, color: focusIndex === idx ? 'rgba(255,255,255,0.7)' : 'var(--color-text-dim)' }}>
                    {downloading === t.id ? 'Downloading…' : (t.language || '')}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
