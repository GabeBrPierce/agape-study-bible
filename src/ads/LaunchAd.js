import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { requestAd, launchAdDue, markLaunchAdShown } from './kaiAds';

// KaiAds suggests 5-10s for a fullscreen ad shown in real time; past that the
// user is already reading and an interruption would be worse than no ad.
const LAUNCH_AD_TIMEOUT_MS = 8000;

// Module-level so React dev StrictMode's double effect run can't count the
// launch twice or send two requests.
let launchHandled = false;

// Requests one fullscreen ad per eligible launch and shows it only if the user
// is still on the main menu when it arrives. Renders nothing itself; KaiAds
// draws the fullscreen ad over the whole app.
export default function LaunchAd() {
  const { currentPage, setAdActive } = useApp();
  const pageRef = useRef(currentPage.page);
  pageRef.current = currentPage.page;

  useEffect(() => {
    if (launchHandled) return;
    launchHandled = true;
    if (!launchAdDue()) return;
    requestAd({
      slot: 'launch-fullscreen',
      timeout: LAUNCH_AD_TIMEOUT_MS,
      onready: (ad) => {
        if (pageRef.current !== 'MainMenu') return;
        ad.on('display', () => { markLaunchAdShown(); setAdActive(true); });
        ad.on('close',   () => setAdActive(false));
        ad.on('click',   () => setAdActive(false));
        ad.call('display');
      },
      onerror: () => {},
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per launch

  return null;
}
