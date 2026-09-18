import React from 'react';
import { useApp } from '../context/AppContext';
import './SoftkeyBar.css';

function fireKey(key) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

export default function SoftkeyBar() {
  const { softkeys } = useApp();
  return (
    <footer className="softkey-bar">
      <span
        className="softkey softkey-left"
        onClick={() => fireKey('SoftLeft')}
        title="F1"
      >
        {softkeys.left}
      </span>
      <span
        className="softkey softkey-center"
        onClick={() => fireKey('Enter')}
        title="Enter"
      >
        {softkeys.center}
      </span>
      <span
        className="softkey softkey-right"
        onClick={() => fireKey('SoftRight')}
        title="F2"
      >
        {softkeys.right}
      </span>
    </footer>
  );
}
