import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { fetchAvailableTranslations, fetchChapter, getInstalledTranslations } from '../api/bibleApi';
import { saveTranslation } from '../db/db';
import { BOOKS } from '../data/books';

const DOWNLOAD_CONCURRENCY = 4;

/** Every canonical (book, chapter) pair — used to fully download a translation. */
function allChapters() {
  const list = [];
  for (const b of BOOKS) {
    for (let ch = 1; ch <= b.chapters; ch++) list.push({ book: b.id, chapter: ch });
  }
  return list;
}

/**
 * Download every chapter of a translation so it's readable fully offline.
 * fetchChapter() already caches each chapter into IndexedDB as it's fetched
 * (see bibleApi.js / db.js), and evictOldCache() skips chapters belonging to
 * an isInstalled translation — so once this finishes (and the translation is
 * marked installed) the whole thing stays available offline indefinitely.
 */
async function downloadTranslation(translationId, onProgress) {
  const queue = allChapters();
  const total = queue.length;
  let done = 0;
  async function worker() {
    while (queue.length > 0) {
      const { book, chapter } = queue.shift();
      try { await fetchChapter(translationId, book, chapter); } catch (_) { /* keep going */ }
      done++;
      onProgress(done, total);
    }
  }
  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
}

export default function VersionSelectionPage() {
  const { pop, registerKeyHandlers, registerSoftkeys, settings, updateSettings } = useApp();
  const [installed, setInstalled]     = useState([]);
  const [remote, setRemote]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [downloading, setDownloading] = useState(null); // id being downloaded
  const [progress, setProgress]       = useState({ done: 0, total: 0 });
  const [focusIndex, setFocusIndex]   = useState(0);
  const listRef = useRef(null);

  const reloadInstalled = useCallback(() => {
    getInstalledTranslations().then(setInstalled);
  }, []);

  // Load installed translations (bundled + fully-downloaded) from DB
  useEffect(() => { reloadInstalled(); }, [reloadInstalled]);

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
    if (downloading) return; // one download at a time
    const item = allItems[focusIndex];
    if (!item) return;
    if (item.isInstalled) {
      await updateSettings({ translationId: item.id });
      pop();
    } else {
      // Download every chapter of the translation so it's readable offline,
      // then mark it installed so it stays cached (see downloadTranslation above).
      setDownloading(item.id);
      setProgress({ done: 0, total: 0 });
      try {
        const newTrans = { ...item, isInstalled: true, installedAt: new Date().toISOString() };
        await saveTranslation(newTrans); // mark installed first so caching never evicts mid-download
        await downloadTranslation(item.id, (done, total) => setProgress({ done, total }));
        reloadInstalled();
        setRemote(prev => prev.filter(t => t.id !== item.id));
        await updateSettings({ translationId: item.id });
        pop();
      } catch (err) {
        console.error('Download failed:', err);
      } finally {
        setDownloading(null);
      }
    }
  }, [allItems, focusIndex, updateSettings, pop, reloadInstalled, downloading]);

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
            <span style={{ fontSize: 11, color: focusIndex === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text-dim)' }}>
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
                  <span style={{ fontSize: 11, color: focusIndex === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text-dim)' }}>
                    {downloading === t.id
                      ? (progress.total > 0
                          ? `Downloading… ${Math.round((progress.done / progress.total) * 100)}%`
                          : 'Downloading…')
                      : (t.language || '')}
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
