import React from 'react';
import { useApp } from '../context/AppContext';
import './SoftkeyBar.css';

export default function SoftkeyBar() {
  const { softkeys } = useApp();
  return (
    <footer className="softkey-bar">
      <span className="softkey softkey-left">{softkeys.left}</span>
      <span className="softkey softkey-center">{softkeys.center}</span>
      <span className="softkey softkey-right">{softkeys.right}</span>
    </footer>
  );
}
