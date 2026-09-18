// Readability formatting for lexicon definitions (BDB Hebrew / Abbott-Smith Greek).
//
// expandLexicon(raw)            -> a single expanded string (abbreviations resolved)
// parseLexiconDefinition(raw)   -> structured outline: [{ level, marker, text }]
// formatLexiconDefinition(raw)  -> expanded string with line breaks (legacy/simple)
//
// Book names are only expanded immediately before a digit, so the same letters
// inside ordinary words are never touched. Verse references like "13:35" keep
// their colon (no following space) and are never split.

// ── Book name -> abbreviation forms (BDB / Abbott-Smith) ──────────────────────
const BOOKS = [
  ['Matthew', ['Matt', 'Mat', 'Mt']],
  ['Mark', ['Mrk', 'Mar', 'Mr', 'Mk']],
  ['Luke', ['Luk', 'Lk']],
  ['John', ['Jhn', 'Joh', 'Jn']],
  ['Acts', ['Act', 'Ac']],
  ['Romans', ['Rom', 'Ro']],
  ['1 Corinthians', ['1Cor', '1Co', 'I Cor']],
  ['2 Corinthians', ['2Cor', '2Co', 'II Cor']],
  ['Galatians', ['Gal', 'Ga']],
  ['Ephesians', ['Eph']],
  ['Philippians', ['Phil', 'Php', 'Phi']],
  ['Colossians', ['Col']],
  ['1 Thessalonians', ['1Thess', '1Thes', '1Th', 'I Th']],
  ['2 Thessalonians', ['2Thess', '2Thes', '2Th', 'II Th']],
  ['1 Timothy', ['1Tim', '1Ti', 'I Tim']],
  ['2 Timothy', ['2Tim', '2Ti', 'II Tim']],
  ['Titus', ['Tit']],
  ['Philemon', ['Phlm', 'Phm']],
  ['Hebrews', ['Heb']],
  ['James', ['Jas', 'Jam']],
  ['1 Peter', ['1Pet', '1Pe', 'I Pe']],
  ['2 Peter', ['2Pet', '2Pe', 'II Pe']],
  ['1 John', ['1Jhn', '1Jn', '1Jo', 'I Jn']],
  ['2 John', ['2Jhn', '2Jn', '2Jo', 'II Jn']],
  ['3 John', ['3Jhn', '3Jn', '3Jo', 'III Jn']],
  ['Jude', ['Jude', 'Jud', 'Ju']],
  ['Revelation', ['Rev', 'Re']],
  ['Genesis', ['Gen', 'Ge']],
  ['Exodus', ['Exod', 'Exo', 'Ex']],
  ['Leviticus', ['Lev', 'Le']],
  ['Numbers', ['Num', 'Nu']],
  ['Deuteronomy', ['Deut', 'Deu', 'Dt']],
  ['Joshua', ['Josh', 'Jos']],
  ['Judges', ['Judg', 'Jdg']],
  ['Ruth', ['Ruth', 'Rut', 'Ru']],
  ['1 Samuel', ['1Sam', '1Sa', 'I Sa']],
  ['2 Samuel', ['2Sam', '2Sa', 'II Sa']],
  ['1 Kings', ['1Kgs', '1Ki', 'I Ki']],
  ['2 Kings', ['2Kgs', '2Ki', 'II Ki']],
  ['1 Chronicles', ['1Chr', '1Ch', 'I Ch']],
  ['2 Chronicles', ['2Chr', '2Ch', 'II Ch']],
  ['Ezra', ['Ezra', 'Ezr']],
  ['Nehemiah', ['Neh', 'Ne']],
  ['Esther', ['Esth', 'Est']],
  ['Job', ['Job', 'Jb']],
  ['Psalm', ['Psalm', 'Psa', 'Ps']],
  ['Proverbs', ['Prov', 'Pro', 'Pr']],
  ['Ecclesiastes', ['Eccl', 'Ecc', 'Ec']],
  ['Song of Songs', ['Song', 'Sng', 'Ct']],
  ['Isaiah', ['Isa', 'Is']],
  ['Jeremiah', ['Jer', 'Je']],
  ['Lamentations', ['Lam', 'La']],
  ['Ezekiel', ['Ezek', 'Ezk', 'Eze']],
  ['Daniel', ['Dan', 'Dn']],
  ['Hosea', ['Hos', 'Ho']],
  ['Joel', ['Joel', 'Jol', 'Joe']],
  ['Amos', ['Amos', 'Am']],
  ['Obadiah', ['Obad', 'Oba', 'Ob']],
  ['Jonah', ['Jonah', 'Jon']],
  ['Micah', ['Mic', 'Mi']],
  ['Nahum', ['Nah', 'Nam', 'Na']],
  ['Habakkuk', ['Hab', 'Hb']],
  ['Zephaniah', ['Zeph', 'Zep']],
  ['Haggai', ['Hag', 'Hg']],
  ['Zechariah', ['Zech', 'Zec', 'Zc']],
  ['Malachi', ['Mal']],
];

const BOOK_RULES = BOOKS.map(([name, abbrs]) => {
  const alts = abbrs
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, '\\s'));
  return [new RegExp(`\\b(?:${alts.join('|')})\\.?\\s*(?=\\d)`, 'g'), name + ' '];
});

// ── Scholarly + grammatical shorthand ─────────────────────────────────────────
// Case-sensitive first (source names / canon labels), then general (case-insensitive).
const ABBREV_RULES = [
  // section markers and page/following refs (numbers kept)
  [/§\s*/g, 'section '],
  [/\$(?=\s?\d)/g, 'section '],
  [/(\d)\s*ff\./g, '$1 and following'],
  [/(\d)\s*f\./g, '$1 and the following'],
  [/\bff\./g, 'and following'],

  // canon / corpora (case-sensitive)
  [/\bLXX\b/g, 'Septuagint'],
  [/\bMT\b/g, 'Masoretic Text'],
  [/\bNT\b/g, 'New Testament'],
  [/\bOT\b/g, 'Old Testament'],
  [/\bMSS\b/g, 'manuscripts'],
  [/\bMS\b/g, 'manuscript'],

  // scholars / standard works (case-sensitive)
  [/\bWH\b/g, 'Westcott & Hort'],
  [/\bBl\./g, 'Blass'],
  [/\bWM\b/g, 'Winer-Moulton'],
  [/\bMM\b/g, 'Moulton-Milligan'],
  [/\bVGT\b/g, 'Vocabulary of the Greek Testament'],
  [/\bDB\b/g, 'Dictionary of the Bible'],
  [/\bDCG\b/g, 'Dictionary of Christ and the Gospels'],
  [/\bICC\b/g, 'International Critical Commentary'],
  [/\bExp\.?\s?Times\b/g, 'Expository Times'],
  [/\bDeiss\./g, 'Deissmann'],
  [/\bLAE\b/g, 'Light from the Ancient East'],
  [/\bLft\b\.?/g, 'Lightfoot'],
  [/\bThayer\b/g, 'Thayer'],
  [/\bCremer\b/g, 'Cremer'],
  [/\bApp\./g, 'Appendix'],

  // general scholarly (case-insensitive)
  [/\bcf\./gi, 'compare'],
  [/\be\.g\./gi, 'for example'],
  [/\bi\.e\./gi, 'that is'],
  [/\bviz\./gi, 'namely'],
  [/\bsc\./gi, 'namely'],
  [/\bq\.\s?v\./gi, 'which see'],
  [/\bs\.\s?v\./gi, 'under the word'],
  [/\bet\s?al\./gi, 'and others'],
  [/\bibid\.?/gi, 'in the same place'],
  [/\bib\./g, 'in the same place'],
  [/\bSYN\.:?/g, 'Synonym:'],
  [/\besp\./gi, 'especially'],
  [/\bprob\./gi, 'probably'],
  [/\busu\./gi, 'usually'],
  [/\bopp\./gi, 'opposed to'],
  [/\bfreq\./gi, 'frequently'],
  [/\bfoll\.?\s?by\b/gi, 'followed by'],
  [/\bfig\./gi, 'figuratively'],
  [/\blit\./gi, 'literally'],
  [/\bGk\./g, 'Greek'],
  [/\bAram\./g, 'Aramaic'],
  [/\bSyr\./g, 'Syriac'],
  [/\bHb\.\b/g, 'Hebrew'],

  // grammar / parts of speech (case-insensitive)
  [/\badv\./gi, 'adverb'],
  [/\badj\./gi, 'adjective'],
  [/\bsubst\./gi, 'substantive'],
  [/\bprep\./gi, 'preposition'],
  [/\bconj\./gi, 'conjunction'],
  [/\binterj\./gi, 'interjection'],
  [/\bpron\./gi, 'pronoun'],
  [/\bptcp\./gi, 'participle'],
  [/\bpartic\./gi, 'participle'],
  [/\binf\./gi, 'infinitive'],
  [/\bimpf\./gi, 'imperfect'],
  [/\bimpv\./gi, 'imperative'],
  [/\bimper\./gi, 'imperative'],
  [/\bind\./gi, 'indicative'],
  [/\bindic\./gi, 'indicative'],
  [/\bsubj\./gi, 'subjunctive'],
  [/\bopt\./gi, 'optative'],
  [/\baor\./gi, 'aorist'],
  [/\bperf\./gi, 'perfect'],
  [/\bfut\./gi, 'future'],
  [/\bpres\./gi, 'present'],
  [/\bpass\./gi, 'passive'],
  [/\bmid\./gi, 'middle'],
  [/\bact\./gi, 'active'],
  [/\bcogn\./gi, 'cognate'],
  [/\baccus\./gi, 'accusative'],
  [/\bacc\./gi, 'accusative'],
  [/\bnom\./gi, 'nominative'],
  [/\bdat\./gi, 'dative'],
  [/\bvoc\./gi, 'vocative'],
  [/\bgen\./gi, 'genitive'],
  [/\bmasc\./gi, 'masculine'],
  [/\bfem\./gi, 'feminine'],
  [/\bneut\./gi, 'neuter'],
  [/\bsing\./gi, 'singular'],
  [/\bsg\./gi, 'singular'],
  [/\bplur\./gi, 'plural'],
  [/\bpl\./gi, 'plural'],
  [/\bdu\./gi, 'dual'],
  [/\bcoll\./gi, 'collective'],
  [/\babs\./gi, 'absolute'],
  [/\bconstr?\./gi, 'construct'],
  [/\bcstr\./gi, 'construct'],
  [/\bsuff\./gi, 'suffix'],
];

function expand(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.replace(/\s+/g, ' ').trim();
  for (const [re, repl] of BOOK_RULES) text = text.replace(re, repl);
  for (const [re, repl] of ABBREV_RULES) text = text.replace(re, repl);
  // strip BDB/AS formatting artifacts (stray backslashes used as layout markers)
  text = text.replace(/\\+/g, ' ');
  // tidy doubled spaces / stray space before punctuation
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+([,;:.])/g, '$1');
  return text;
}

export function expandLexicon(raw) {
  return expand(raw);
}

// Legacy: expanded text with a hard break after ',', ';', ':' followed by space.
export function formatLexiconDefinition(raw) {
  const text = expand(raw);
  return text
    .replace(/([,;:])\s+/g, '$1\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

// ── Structured outline ────────────────────────────────────────────────────────
// Splits the expanded text into an indented outline. Explicit sense numbers
// ("1.", "2.") are level-0 headings; explicit "(a)/(b)" are level-1; every other
// comma/semicolon/colon break becomes an auto-numbered sub-item one level deeper
// than its parent.
function intToMarker(level, n) {
  if (level <= 0) return n + '.';                 // 1. 2. 3.
  if (level === 1) return String.fromCharCode(96 + ((n - 1) % 26 + 1)) + '.'; // a. b. c.
  const romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
    'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
  return (romans[(n - 1) % romans.length]) + '.';  // i. ii. iii.
}

export function parseLexiconDefinition(raw) {
  const text = expand(raw);
  if (!text) return [];

  // Split into pieces: after ';' or ':' followed by whitespace, and also *before*
  // a sense marker ("1.", "(a)") or an em/en dash, so senses that follow a period
  // (common in Abbott-Smith) start their own item. Commas are kept inline so
  // comma-separated lists stay on one line. Verse refs ("13:35") have no following
  // space, so they stay whole.
  const pieces = text
    .split(/(?<=[;:])\s+|\s+(?=\d{1,2}\.\s)|\s+(?=\([a-h]\)\s)|\s+(?=[—–]\s)/)
    .map((p) => (p || '').trim())
    .filter(Boolean);

  const items = [];
  const counters = [0, 0, 0, 0]; // auto-numbering per level
  let parentLevel = -1;          // level of the most recent explicit marker

  const bump = (level) => {
    counters[level] = (counters[level] || 0) + 1;
    for (let i = level + 1; i < counters.length; i++) counters[i] = 0;
    return counters[level];
  };

  for (const piece of pieces) {
    // Strip leading layout junk (em/en dashes, hyphens, spaces) before testing
    // for a sense marker — BDB writes senses like "— 1. a. …".
    let p = piece.replace(/^[\s—–-]+/, '').trim();
    if (!p) continue;
    let m;
    if ((m = p.match(/^(\d{1,2})\.\s*(.*)$/s)) && m[2]) {
      // explicit top-level sense. It may be immediately followed by a sub-letter
      // ("1. a. …"); if so, split the heading from the sub-item.
      counters[0] = parseInt(m[1], 10);
      for (let i = 1; i < counters.length; i++) counters[i] = 0;
      parentLevel = 0;
      let rest = m[2].trim();
      const sub = rest.match(/^\(?([a-h])\)?\.\s+(.*)$/s);
      if (sub && sub[2]) {
        items.push({ level: 0, marker: m[1] + '.', text: '' });
        items.push({ level: 1, marker: intToMarker(1, bump(1)), text: sub[2].trim() });
        parentLevel = 1;
      } else {
        items.push({ level: 0, marker: m[1] + '.', text: rest });
      }
    } else if ((m = p.match(/^\(?([a-h])\)?\.\s+(.*)$/s)) && m[2]) {
      // explicit sub-sense (a)/(b)
      const n = bump(1);
      items.push({ level: 1, marker: intToMarker(1, n), text: m[2].trim() });
      parentLevel = 1;
    } else {
      // implicit break -> one level below the current parent
      const level = Math.min(parentLevel + 1, 3);
      const n = bump(level);
      const marker = level === 0 ? '' : intToMarker(level, n);
      items.push({ level, marker, text: p });
    }
  }
  return items;
}
