import React, { useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';

const CONFETTI_COLORS = ['#f4c430', '#e8505b', '#4fc3f7', '#81c784', '#ba68c8', '#ffb74d', '#ffffff'];
const CONFETTI_COUNT  = 48;

// Renders the current toast from AppContext, plus a one-shot confetti burst
// when the toast asks for it. Neither element takes focus or pointer events,
// so key handling on the page underneath is unaffected.
export default function Toast() {
  const { toast, dismissToast } = useApp();

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(dismissToast, toast.confetti ? 3600 : 2200);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <>
      {toast.confetti && <Confetti key={`c-${toast.id}`} />}
      <div key={`t-${toast.id}`} className="toast" role="status" aria-live="polite">
        {toast.text}
      </div>
    </>
  );
}

function Confetti() {
  // Random layout is fixed per mount so re-renders don't reshuffle pieces.
  const pieces = useMemo(() => Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    left:     Math.random() * 100,
    delay:    Math.random() * 0.7,
    duration: 2.2 + Math.random() * 1.2,
    size:     5 + Math.round(Math.random() * 4),
    color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    sway:     i % 2 === 0 ? 'confetti-fall-a' : 'confetti-fall-b',
    round:    Math.random() < 0.3,
  })), []);

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            background: p.color,
            borderRadius: p.round ? '50%' : 1,
            animationName: p.sway,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
