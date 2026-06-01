// All 66 canonical Bible books with metadata
// id: helloao API book identifier
// chapters: total chapter count
// testament: 'OT' | 'NT'
// category: topical category for TopicalSelectionPage

export const BOOKS = [
  // Old Testament — Law
  { id: 'GEN', name: 'Genesis',        abbr: 'Gen', chapters: 50,  testament: 'OT', category: 'Law',      canonical: 1  },
  { id: 'EXO', name: 'Exodus',         abbr: 'Exo', chapters: 40,  testament: 'OT', category: 'Law',      canonical: 2  },
  { id: 'LEV', name: 'Leviticus',      abbr: 'Lev', chapters: 27,  testament: 'OT', category: 'Law',      canonical: 3  },
  { id: 'NUM', name: 'Numbers',         abbr: 'Num', chapters: 36,  testament: 'OT', category: 'Law',      canonical: 4  },
  { id: 'DEU', name: 'Deuteronomy',    abbr: 'Deu', chapters: 34,  testament: 'OT', category: 'Law',      canonical: 5  },
  // Old Testament — History
  { id: 'JOS', name: 'Joshua',         abbr: 'Jos', chapters: 24,  testament: 'OT', category: 'History',  canonical: 6  },
  { id: 'JDG', name: 'Judges',         abbr: 'Jdg', chapters: 21,  testament: 'OT', category: 'History',  canonical: 7  },
  { id: 'RUT', name: 'Ruth',           abbr: 'Rut', chapters: 4,   testament: 'OT', category: 'History',  canonical: 8  },
  { id: '1SA', name: '1 Samuel',       abbr: '1Sa', chapters: 31,  testament: 'OT', category: 'History',  canonical: 9  },
  { id: '2SA', name: '2 Samuel',       abbr: '2Sa', chapters: 24,  testament: 'OT', category: 'History',  canonical: 10 },
  { id: '1KI', name: '1 Kings',        abbr: '1Ki', chapters: 22,  testament: 'OT', category: 'History',  canonical: 11 },
  { id: '2KI', name: '2 Kings',        abbr: '2Ki', chapters: 25,  testament: 'OT', category: 'History',  canonical: 12 },
  { id: '1CH', name: '1 Chronicles',   abbr: '1Ch', chapters: 29,  testament: 'OT', category: 'History',  canonical: 13 },
  { id: '2CH', name: '2 Chronicles',   abbr: '2Ch', chapters: 36,  testament: 'OT', category: 'History',  canonical: 14 },
  { id: 'EZR', name: 'Ezra',           abbr: 'Ezr', chapters: 10,  testament: 'OT', category: 'History',  canonical: 15 },
  { id: 'NEH', name: 'Nehemiah',       abbr: 'Neh', chapters: 13,  testament: 'OT', category: 'History',  canonical: 16 },
  { id: 'EST', name: 'Esther',         abbr: 'Est', chapters: 10,  testament: 'OT', category: 'History',  canonical: 17 },
  // Old Testament — Wisdom / Poetry
  { id: 'JOB', name: 'Job',            abbr: 'Job', chapters: 42,  testament: 'OT', category: 'Wisdom',   canonical: 18 },
  { id: 'PSA', name: 'Psalms',         abbr: 'Psa', chapters: 150, testament: 'OT', category: 'Wisdom',   canonical: 19 },
  { id: 'PRO', name: 'Proverbs',       abbr: 'Pro', chapters: 31,  testament: 'OT', category: 'Wisdom',   canonical: 20 },
  { id: 'ECC', name: 'Ecclesiastes',   abbr: 'Ecc', chapters: 12,  testament: 'OT', category: 'Wisdom',   canonical: 21 },
  { id: 'SNG', name: 'Song of Solomon',abbr: 'Sng', chapters: 8,   testament: 'OT', category: 'Wisdom',   canonical: 22 },
  // Old Testament — Prophecy
  { id: 'ISA', name: 'Isaiah',         abbr: 'Isa', chapters: 66,  testament: 'OT', category: 'Prophecy', canonical: 23 },
  { id: 'JER', name: 'Jeremiah',       abbr: 'Jer', chapters: 52,  testament: 'OT', category: 'Prophecy', canonical: 24 },
  { id: 'LAM', name: 'Lamentations',   abbr: 'Lam', chapters: 5,   testament: 'OT', category: 'Prophecy', canonical: 25 },
  { id: 'EZK', name: 'Ezekiel',        abbr: 'Ezk', chapters: 48,  testament: 'OT', category: 'Prophecy', canonical: 26 },
  { id: 'DAN', name: 'Daniel',         abbr: 'Dan', chapters: 12,  testament: 'OT', category: 'Prophecy', canonical: 27 },
  { id: 'HOS', name: 'Hosea',          abbr: 'Hos', chapters: 14,  testament: 'OT', category: 'Prophecy', canonical: 28 },
  { id: 'JOL', name: 'Joel',           abbr: 'Jol', chapters: 3,   testament: 'OT', category: 'Prophecy', canonical: 29 },
  { id: 'AMO', name: 'Amos',           abbr: 'Amo', chapters: 9,   testament: 'OT', category: 'Prophecy', canonical: 30 },
  { id: 'OBA', name: 'Obadiah',        abbr: 'Oba', chapters: 1,   testament: 'OT', category: 'Prophecy', canonical: 31 },
  { id: 'JON', name: 'Jonah',          abbr: 'Jon', chapters: 4,   testament: 'OT', category: 'Prophecy', canonical: 32 },
  { id: 'MIC', name: 'Micah',          abbr: 'Mic', chapters: 7,   testament: 'OT', category: 'Prophecy', canonical: 33 },
  { id: 'NAH', name: 'Nahum',          abbr: 'Nah', chapters: 3,   testament: 'OT', category: 'Prophecy', canonical: 34 },
  { id: 'HAB', name: 'Habakkuk',       abbr: 'Hab', chapters: 3,   testament: 'OT', category: 'Prophecy', canonical: 35 },
  { id: 'ZEP', name: 'Zephaniah',      abbr: 'Zep', chapters: 3,   testament: 'OT', category: 'Prophecy', canonical: 36 },
  { id: 'HAG', name: 'Haggai',         abbr: 'Hag', chapters: 2,   testament: 'OT', category: 'Prophecy', canonical: 37 },
  { id: 'ZEC', name: 'Zechariah',      abbr: 'Zec', chapters: 14,  testament: 'OT', category: 'Prophecy', canonical: 38 },
  { id: 'MAL', name: 'Malachi',        abbr: 'Mal', chapters: 4,   testament: 'OT', category: 'Prophecy', canonical: 39 },
  // New Testament — Gospels
  { id: 'MAT', name: 'Matthew',        abbr: 'Mat', chapters: 28,  testament: 'NT', category: 'Gospel',   canonical: 40 },
  { id: 'MRK', name: 'Mark',           abbr: 'Mrk', chapters: 16,  testament: 'NT', category: 'Gospel',   canonical: 41 },
  { id: 'LUK', name: 'Luke',           abbr: 'Luk', chapters: 24,  testament: 'NT', category: 'Gospel',   canonical: 42 },
  { id: 'JHN', name: 'John',           abbr: 'Jhn', chapters: 21,  testament: 'NT', category: 'Gospel',   canonical: 43 },
  // New Testament — History
  { id: 'ACT', name: 'Acts',           abbr: 'Act', chapters: 28,  testament: 'NT', category: 'History',  canonical: 44 },
  // New Testament — Letters
  { id: 'ROM', name: 'Romans',         abbr: 'Rom', chapters: 16,  testament: 'NT', category: 'Letters',  canonical: 45 },
  { id: '1CO', name: '1 Corinthians',  abbr: '1Co', chapters: 16,  testament: 'NT', category: 'Letters',  canonical: 46 },
  { id: '2CO', name: '2 Corinthians',  abbr: '2Co', chapters: 13,  testament: 'NT', category: 'Letters',  canonical: 47 },
  { id: 'GAL', name: 'Galatians',      abbr: 'Gal', chapters: 6,   testament: 'NT', category: 'Letters',  canonical: 48 },
  { id: 'EPH', name: 'Ephesians',      abbr: 'Eph', chapters: 6,   testament: 'NT', category: 'Letters',  canonical: 49 },
  { id: 'PHP', name: 'Philippians',    abbr: 'Php', chapters: 4,   testament: 'NT', category: 'Letters',  canonical: 50 },
  { id: 'COL', name: 'Colossians',     abbr: 'Col', chapters: 4,   testament: 'NT', category: 'Letters',  canonical: 51 },
  { id: '1TH', name: '1 Thessalonians',abbr: '1Th', chapters: 5,   testament: 'NT', category: 'Letters',  canonical: 52 },
  { id: '2TH', name: '2 Thessalonians',abbr: '2Th', chapters: 3,   testament: 'NT', category: 'Letters',  canonical: 53 },
  { id: '1TI', name: '1 Timothy',      abbr: '1Ti', chapters: 6,   testament: 'NT', category: 'Letters',  canonical: 54 },
  { id: '2TI', name: '2 Timothy',      abbr: '2Ti', chapters: 4,   testament: 'NT', category: 'Letters',  canonical: 55 },
  { id: 'TIT', name: 'Titus',          abbr: 'Tit', chapters: 3,   testament: 'NT', category: 'Letters',  canonical: 56 },
  { id: 'PHM', name: 'Philemon',       abbr: 'Phm', chapters: 1,   testament: 'NT', category: 'Letters',  canonical: 57 },
  { id: 'HEB', name: 'Hebrews',        abbr: 'Heb', chapters: 13,  testament: 'NT', category: 'Letters',  canonical: 58 },
  { id: 'JAS', name: 'James',          abbr: 'Jas', chapters: 5,   testament: 'NT', category: 'Letters',  canonical: 59 },
  { id: '1PE', name: '1 Peter',        abbr: '1Pe', chapters: 5,   testament: 'NT', category: 'Letters',  canonical: 60 },
  { id: '2PE', name: '2 Peter',        abbr: '2Pe', chapters: 3,   testament: 'NT', category: 'Letters',  canonical: 61 },
  { id: '1JN', name: '1 John',         abbr: '1Jn', chapters: 5,   testament: 'NT', category: 'Letters',  canonical: 62 },
  { id: '2JN', name: '2 John',         abbr: '2Jn', chapters: 1,   testament: 'NT', category: 'Letters',  canonical: 63 },
  { id: '3JN', name: '3 John',         abbr: '3Jn', chapters: 1,   testament: 'NT', category: 'Letters',  canonical: 64 },
  { id: 'JUD', name: 'Jude',           abbr: 'Jud', chapters: 1,   testament: 'NT', category: 'Letters',  canonical: 65 },
  // New Testament — Apocalypse
  { id: 'REV', name: 'Revelation',     abbr: 'Rev', chapters: 22,  testament: 'NT', category: 'Apocalypse', canonical: 66 },
];

// Lookup helpers
export const BOOK_BY_ID = Object.fromEntries(BOOKS.map(b => [b.id, b]));
export const BOOK_BY_CANONICAL = Object.fromEntries(BOOKS.map(b => [b.canonical, b]));

/** Try to find a book by partial name, abbreviation, or canonical number */
export function findBook(query) {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  // Exact id match
  const byId = BOOKS.find(b => b.id.toLowerCase() === q);
  if (byId) return byId;
  // Canonical number
  const num = parseInt(q, 10);
  if (!isNaN(num) && num >= 1 && num <= 66) return BOOK_BY_CANONICAL[num];
  // Exact name / abbr
  const exact = BOOKS.find(b =>
    b.name.toLowerCase() === q || b.abbr.toLowerCase() === q
  );
  if (exact) return exact;
  // Prefix match on name
  return BOOKS.find(b => b.name.toLowerCase().startsWith(q)) || null;
}

/** Topical tree structure for TopicalSelectionPage */
export const TOPICAL_TREE = [
  {
    label: 'Old Testament',
    children: [
      { label: 'Law',      books: BOOKS.filter(b => b.testament === 'OT' && b.category === 'Law')      },
      { label: 'History',  books: BOOKS.filter(b => b.testament === 'OT' && b.category === 'History')  },
      { label: 'Wisdom',   books: BOOKS.filter(b => b.testament === 'OT' && b.category === 'Wisdom')   },
      { label: 'Prophecy', books: BOOKS.filter(b => b.testament === 'OT' && b.category === 'Prophecy') },
    ],
  },
  {
    label: 'New Testament',
    children: [
      { label: 'Gospel',     books: BOOKS.filter(b => b.testament === 'NT' && b.category === 'Gospel')    },
      { label: 'History',    books: BOOKS.filter(b => b.testament === 'NT' && b.category === 'History')   },
      { label: 'Letters',    books: BOOKS.filter(b => b.testament === 'NT' && b.category === 'Letters')   },
      { label: 'Apocalypse', books: BOOKS.filter(b => b.testament === 'NT' && b.category === 'Apocalypse')},
    ],
  },
];

/** Parse an address string like "John 3:16", "jhn 3 16", "43 3 16" → { book, chapter, verse } | null */
export function parseAddress(input) {
  if (!input) return null;
  const s = input.trim();

  // Try "BOOK CHAPTER:VERSE" or "BOOK CHAPTER VERSE"
  const m = s.match(/^([a-z0-9 ]+?)\s+(\d+)(?:[: ](\d+))?$/i);
  if (!m) return null;
  const bookQuery = m[1].trim();
  const chapter   = parseInt(m[2], 10);
  const verse     = m[3] ? parseInt(m[3], 10) : 1;

  const book = findBook(bookQuery);
  if (!book) return null;
  if (chapter < 1 || chapter > book.chapters) return null;
  return { book: book.id, chapter, verse };
}

/** Returns the next location in canonical order, or null if at the end */
export function nextLocation(book, chapter) {
  const b = BOOK_BY_ID[book];
  if (!b) return null;
  if (chapter < b.chapters) return { book, chapter: chapter + 1 };
  const next = BOOK_BY_CANONICAL[b.canonical + 1];
  if (!next) return null;
  return { book: next.id, chapter: 1 };
}

/** Returns the previous location, or null if at Genesis 1 */
export function prevLocation(book, chapter) {
  const b = BOOK_BY_ID[book];
  if (!b) return null;
  if (chapter > 1) return { book, chapter: chapter - 1 };
  const prev = BOOK_BY_CANONICAL[b.canonical - 1];
  if (!prev) return null;
  return { book: prev.id, chapter: prev.chapters };
}

export const HIGHLIGHT_COLORS = [
  '#FFFF00', '#FFD700', '#FFA500', '#FF6B6B',
  '#90EE90', '#87CEEB', '#DDA0DD', '#F0E68C',
];

export const BOOKMARK_COLORS = [
  '#E53935', '#FB8C00', '#FDD835', '#43A047',
  '#00ACC1', '#1E88E5', '#8E24AA', '#F06292',
];
