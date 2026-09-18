import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { PLANS } from '../data/readingPlans';

export default function ReadingPlanSelectionPage() {
  const { push, pop, registerKeyHandlers, registerSoftkeys, settings, updateSettings } = useApp();
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('.list-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  const selectPlan = useCallback(async (plan) => {
    await updateSettings({ activeReadingPlanId: plan.id });
    push('DailyReadingPage', { planId: plan.id });
  }, [push, updateSettings]);

  const handleSelect = useCallback(() => {
    const plan = PLANS[focusIndex];
    if (plan) selectPlan(plan);
  }, [focusIndex, selectPlan]);

  useEffect(() => {
    registerKeyHandlers({
      ArrowUp:   () => setFocusIndex(prev => Math.max(0, prev - 1)),
      ArrowDown: () => setFocusIndex(prev => Math.min(PLANS.length - 1, prev + 1)),
      Enter:     handleSelect,
      Backspace: pop,
    });
    registerSoftkeys({ left: { label: 'Back', action: pop }, center: 'Select', right: '' });
  }, [handleSelect, pop, registerKeyHandlers, registerSoftkeys]);

  return (
    <div className="page">
      <div className="page-header">
        <span className="header-title">Daily Reading Plans</span>
      </div>
      <div className="page-content" ref={listRef}>
        {PLANS.map((plan, idx) => (
          <div
            key={plan.id}
            className={`list-item${focusIndex === idx ? ' focused' : ''}`}
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, minHeight: 44 }}
            onClick={() => { setFocusIndex(idx); selectPlan(plan); }}
          >
            <span className="list-item-primary">
              {plan.label}
              {settings.activeReadingPlanId === plan.id && ' ✓'}
            </span>
            <span style={{
              fontSize: 11,
              color: focusIndex === idx ? 'var(--color-focus-text-dim)' : 'var(--color-text-dim)',
            }}>
              {plan.sublabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
