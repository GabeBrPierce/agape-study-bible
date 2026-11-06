// Thin wrapper around the KaiAds SDK (https://www.kaiads.com/publishers/sdk.html).
//
// public/kaiads/kaiads.v5.min.js is KaiAds' official loader: it defines
// window.getKaiAd as a queue and then loads the real SDK, so getKaiAd can be
// called as soon as the loader script itself has loaded.

import { KAIADS_PUBLISHER_ID, KAIADS_APP, ADS_KAIOS_ONLY } from './adsConfig';

// Development builds always request test ads; production builds request real
// ones. Test ads earn nothing but are safe to click.
const TEST_MODE = process.env.NODE_ENV === 'production' ? 0 : 1;

const LOADER_SRC = `${process.env.PUBLIC_URL}/kaiads/kaiads.v5.min.js`;

export function adsEnabled() {
  if (!ADS_KAIOS_ONLY) return true;
  return /kaios/i.test(navigator.userAgent || '');
}

let loaderPromise = null;
function loadSdk() {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    if (typeof window.getKaiAd === 'function') { resolve(); return; }
    const s = document.createElement('script');
    s.src = LOADER_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loaderPromise = null; reject(new Error('KaiAds loader failed')); };
    document.head.appendChild(s);
  });
  return loaderPromise;
}

/**
 * Request one ad. Without `container` KaiAds returns a fullscreen ad; with
 * `container` (plus w/h) it returns a responsive banner rendered inside it.
 * `onready(ad)` receives the ad object; call ad.call('display') to show it.
 * Errors (no fill, timeout, offline, not on KaiOS) go to `onerror(code)`.
 */
export function requestAd({ slot, container, w, h, timeout, onready, onerror }) {
  if (!adsEnabled()) { onerror && onerror('disabled'); return; }
  loadSdk().then(() => {
    const config = {
      publisher: KAIADS_PUBLISHER_ID,
      app: KAIADS_APP,
      slot,
      test: TEST_MODE,
      onready,
      onerror: (err) => onerror && onerror(err),
    };
    if (timeout) config.timeout = timeout;
    if (container) Object.assign(config, { container, w, h });
    window.getKaiAd(config);
  }).catch(() => onerror && onerror('loader'));
}

// ── Launch fullscreen frequency ────────────────────────────────────────────
// KaiAds rule: after a fullscreen ad at launch, no other fullscreen ad until
// five more sessions have completed. So: show one, then skip the next five
// launches. The counter only resets when an ad is actually displayed, so a
// launch with no ad available (offline, no fill) doesn't use up the slot.

const LAUNCH_KEY = 'kaiads.launchesSinceFullscreen';
export const LAUNCHES_BETWEEN_FULLSCREEN = 5;

function readLaunches() {
  try {
    const v = parseInt(localStorage.getItem(LAUNCH_KEY), 10);
    return Number.isFinite(v) ? v : null;
  } catch (_) { return null; }
}

function writeLaunches(n) {
  try { localStorage.setItem(LAUNCH_KEY, String(n)); } catch (_) {}
}

/** Call once per app launch. Returns true when this launch may show a fullscreen ad. */
export function launchAdDue() {
  const since = readLaunches();
  const due = since === null || since >= LAUNCHES_BETWEEN_FULLSCREEN;
  if (!due) writeLaunches(since + 1);
  return due;
}

/** Call when the launch fullscreen ad was actually displayed. */
export function markLaunchAdShown() {
  writeLaunches(0);
}
