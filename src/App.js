import React, { useEffect } from 'react';
import './App.css';
import { AppProvider, useApp } from './context/AppContext';
import { initDB } from './db/db';
import SoftkeyBar from './components/SoftkeyBar';

// Pages
import MainMenu           from './pages/MainMenu';
import ChapterReaderPage  from './pages/ChapterReaderPage';
import AddressSelectionPage from './pages/AddressSelectionPage';
import BookSelectionPage  from './pages/BookSelectionPage';
import ChapterSelectionPage from './pages/ChapterSelectionPage';
import TopicalSelectionPage from './pages/TopicalSelectionPage';
import SearchBiblePage    from './pages/SearchBiblePage';
import BookmarkSelectionPage from './pages/BookmarkSelectionPage';
import BookmarkCreationPage  from './pages/BookmarkCreationPage';
import HighlightSelectionPage from './pages/HighlightSelectionPage';
import HighlightListPage  from './pages/HighlightListPage';
import HighlightCreationPage from './pages/HighlightCreationPage';
import FavoriteSelectionPage from './pages/FavoriteSelectionPage';
import SettingsPage       from './pages/SettingsPage';
import VersionSelectionPage from './pages/VersionSelectionPage';
import InternetUsagePage  from './pages/InternetUsagePage';

const PAGE_MAP = {
  MainMenu,
  ChapterReaderPage,
  AddressSelectionPage,
  BookSelectionPage,
  ChapterSelectionPage,
  TopicalSelectionPage,
  SearchBiblePage,
  BookmarkSelectionPage,
  BookmarkCreationPage,
  HighlightSelectionPage,
  HighlightListPage,
  HighlightCreationPage,
  FavoriteSelectionPage,
  SettingsPage,
  VersionSelectionPage,
  InternetUsagePage,
};

function AppInner() {
  const { currentPage, settings } = useApp();

  // Apply dark/light mode and font size to <body>
  useEffect(() => {
    document.body.classList.toggle('light-mode', !settings.darkMode);
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add(`font-${settings.fontSize || 'medium'}`);
  }, [settings.darkMode, settings.fontSize]);

  const PageComponent = PAGE_MAP[currentPage.page];
  if (!PageComponent) {
    return (
      <div className="page">
        <div className="page-header"><span className="header-title">Error</span></div>
        <div className="page-content empty-state">Unknown page: {currentPage.page}</div>
        <SoftkeyBar />
      </div>
    );
  }

  return (
    <div className="app-root">
      <PageComponent {...currentPage.props} />
      <SoftkeyBar />
    </div>
  );
}

function App() {
  useEffect(() => {
    initDB().catch(err => console.error('DB init error:', err));
  }, []);

  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

export default App;
