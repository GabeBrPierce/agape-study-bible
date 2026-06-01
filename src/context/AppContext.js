import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getSettings, saveSettings } from '../db/db';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Navigation Stack ────────────────────────────────────────────────────────
  // Each entry: { page: string, props: object }
  const [navStack, setNavStack] = useState([{ page: 'MainMenu', props: {} }]);

  const push = useCallback((page, props = {}) => {
    setNavStack(prev => {
      const next = [...prev, { page, props }];
      if (next.length > 20) next.shift();
      return next;
    });
  }, []);

  const pop = useCallback(() => {
    setNavStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  }, []);

  const replace = useCallback((page, props = {}) => {
    setNavStack(prev => [...prev.slice(0, -1), { page, props }]);
  }, []);

  const currentPage = navStack[navStack.length - 1];

  // ── Softkeys ─────────────────────────────────────────────────────────────────
  const [softkeys, setSoftkeysState] = useState({ left: '', center: '', right: '' });
  const softkeyCallbacks = useRef({ left: null, center: null, right: null });

  const setSoftkeys = useCallback(({ left, center, right } = {}) => {
    setSoftkeysState(prev => ({
      left:   left   !== undefined ? left   : prev.left,
      center: center !== undefined ? center : prev.center,
      right:  right  !== undefined ? right  : prev.right,
    }));
    if (left   !== undefined) softkeyCallbacks.current.left   = typeof left   === 'object' ? left.action   : null;
    if (center !== undefined) softkeyCallbacks.current.center = typeof center === 'object' ? center.action : null;
    if (right  !== undefined) softkeyCallbacks.current.right  = typeof right  === 'object' ? right.action  : null;
  }, []);

  const registerSoftkeys = useCallback(({ left, center, right } = {}) => {
    setSoftkeysState({
      left:   left   ? (left.label   || left)   : '',
      center: center ? (center.label || center) : '',
      right:  right  ? (right.label  || right)  : '',
    });
    softkeyCallbacks.current.left   = left   ? left.action   : null;
    softkeyCallbacks.current.center = center ? center.action : null;
    softkeyCallbacks.current.right  = right  ? right.action  : null;
  }, []);

  // ── Key handlers (registered by current page) ─────────────────────────────
  const keyHandlers = useRef({});

  const registerKeyHandlers = useCallback((handlers) => {
    keyHandlers.current = handlers || {};
  }, []);

  // ── Settings ─────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState({
    translationId: 'web',
    darkMode: true,
    fontSize: 'medium',
    internetUsage: 'always',
    savedLocation: null,
  });

  useEffect(() => {
    getSettings().then(s => setSettings(s));
  }, []);

  const updateSettings = useCallback(async (partial) => {
    const updated = await saveSettings(partial);
    setSettings(updated);
    return updated;
  }, []);

  // ── Global keydown ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Backspace') e.preventDefault();

      switch (e.key) {
        case 'SoftLeft':
          softkeyCallbacks.current.left?.();
          break;
        case 'SoftRight':
          softkeyCallbacks.current.right?.();
          break;
        case 'Enter':
          // If a specific Enter handler is registered, call it; otherwise call center softkey
          if (keyHandlers.current['Enter']) {
            keyHandlers.current['Enter'](e);
          } else {
            softkeyCallbacks.current.center?.();
          }
          break;
        default: {
          const fn = keyHandlers.current[e.key];
          if (fn) fn(e);
          break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const value = {
    navStack,
    currentPage,
    push,
    pop,
    replace,
    softkeys,
    registerSoftkeys,
    setSoftkeys,
    softkeyCallbacks,
    registerKeyHandlers,
    keyHandlers,
    settings,
    updateSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
