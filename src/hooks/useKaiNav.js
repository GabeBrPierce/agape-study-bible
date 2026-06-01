import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Register key handlers for the current page.
 * Pass an object mapping event.key strings to handler functions.
 * Re-registers whenever deps change.
 *
 * Example:
 *   useKaiNav({
 *     ArrowUp:    () => moveUp(),
 *     ArrowDown:  () => moveDown(),
 *     Enter:      () => select(),
 *     Backspace:  () => nav.pop(),
 *   });
 */
export function useKaiNav(handlers, deps = []) {
  const { registerKeyHandlers } = useApp();
  useEffect(() => {
    registerKeyHandlers(handlers);
    return () => registerKeyHandlers({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Manage a simple vertical list focus index.
 * Returns [focusIndex, setFocusIndex, handlers] where handlers can be spread
 * into useKaiNav or used individually.
 */
export function useListNav(length, { onSelect, wrap = true } = {}) {
  // Not a hook with state here — just a helper that returns handler factories.
  // State must be managed in the calling component.
  return {
    getHandlers: (focusIndex, setFocusIndex) => ({
      ArrowUp: () => {
        if (length === 0) return;
        setFocusIndex(prev => {
          const next = prev - 1;
          if (next < 0) return wrap ? length - 1 : 0;
          return next;
        });
      },
      ArrowDown: () => {
        if (length === 0) return;
        setFocusIndex(prev => {
          const next = prev + 1;
          if (next >= length) return wrap ? 0 : length - 1;
          return next;
        });
      },
      Enter: () => {
        if (onSelect) onSelect(focusIndex);
      },
    }),
  };
}
