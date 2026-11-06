import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { requestAd } from './kaiAds';

// Requested banner size. KaiAds picks the best-fitting creative up to this
// size (max 240x264); 240 wide matches KaiOS screens.
export const BANNER_W = 240;
export const BANNER_H = 60;

/**
 * One banner per page mount (no refreshing, per KaiAds' 30s refresh rule).
 * Returns the container ref plus focus helpers: KaiOS has no pointer, so the
 * page moves focus onto the banner with the arrow keys and KaiAds opens the
 * ad when Enter is pressed while its container has focus.
 */
export function useBannerAd(slot, ready = true) {
  const containerRef = useRef(null);
  const requestedRef = useRef(false);
  const mountedRef   = useRef(false);
  const [shown, setShown]     = useState(false);
  const [focused, setFocused] = useState(false);

  // A mounted flag (not a per-effect cancel) because a KaiAds request can't be
  // cancelled, and React's dev StrictMode mounts, unmounts and remounts once.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // `ready` lets a page wait until <BannerAd> is actually rendered (e.g. after
  // its loading screen); the ad is requested once, the first time it is.
  useEffect(() => {
    if (!ready || requestedRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    requestedRef.current = true;
    requestAd({
      slot,
      container,
      w: BANNER_W,
      h: BANNER_H,
      onready: (ad) => {
        if (!mountedRef.current) return;
        ad.on('display', () => { if (mountedRef.current) setShown(true); });
        ad.call('display', { tabindex: 0, display: 'block' });
      },
      onerror: () => {},
    });
  }, [slot, ready]);

  // KaiAds renders its own wrapper (with tabindex="0") inside our container;
  // that wrapper is the element that must hold focus for Enter to open the ad.
  const focus = useCallback(() => {
    const c = containerRef.current;
    if (!shown || !c) return false;
    const target = c.querySelector('[tabindex]') || c;
    target.focus();
    setFocused(true);
    return true;
  }, [shown]);

  const blur = useCallback(() => {
    const c = containerRef.current;
    if (c && c.contains(document.activeElement)) document.activeElement.blur();
    setFocused(false);
  }, []);

  // Stable identity so pages can list `banner` in effect deps without looping.
  return useMemo(
    () => ({ containerRef, shown, focused, focus, blur }),
    [shown, focused, focus, blur],
  );
}

/** Banner strip, placed as the last child of a .page (above the softkey bar). */
export function BannerAd({ banner }) {
  const { containerRef, shown, focused } = banner;
  return (
    <div
      className={`banner-ad${shown ? ' shown' : ''}${focused ? ' focused' : ''}`}
      aria-label="Advertisement"
    >
      {shown && <div className="banner-ad-label">Sponsored{focused ? ' · Enter to open' : ''}</div>}
      <div ref={containerRef} className="banner-ad-slot" style={{ width: BANNER_W, maxHeight: BANNER_H }} />
    </div>
  );
}
