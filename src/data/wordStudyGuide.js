// Educational content shown from the lexicon (SoftRight → Guide). Plain data so
// it renders the same in light/dark themes. Each section is a heading + lines.

const WORD_STUDY_GUIDE = [
  {
    heading: 'What a lexicon entry shows',
    lines: [
      'Lemma — the dictionary (root) form of the word, in Greek or Hebrew.',
      'Transliteration — the sound of the word in English letters.',
      "Strong's number — a stable ID (G#### Greek, H#### Hebrew) for cross-referencing.",
      'Part of speech / parsing — noun, verb, adjective, and its grammatical form.',
      'Gloss — a quick one- or two-word meaning.',
      'Definition — the full range of meanings with examples.',
      'Referenced verses — every place the word occurs, so you can see real usage.',
    ],
  },
  {
    heading: 'How to do a word study',
    lines: [
      '1. Read the verse in context first. The surrounding passage controls meaning more than any dictionary.',
      '2. Note the full range of meaning. A word can mean several things; the context selects one — do not pile every sense onto one verse.',
      '3. Look at usage. Scroll the referenced verses and notice how the same author and other writers use the word.',
      '4. Watch the grammar. Tense, voice, and mood (for Greek verbs) or stem (for Hebrew) can change the force of a word.',
      '5. Compare translations. Differences often reveal where the meaning is debated.',
      '6. Beware common errors: the "root fallacy" (assuming a word means the sum of its parts) and reading a later or technical meaning back into an older text.',
    ],
  },
  {
    heading: 'Greek words',
    lines: [
      'Greek is precise about verbs. Tense often signals kind of action (ongoing vs. completed) more than time.',
      'Voice matters: active (subject acts), middle (subject acts on/for itself), passive (subject is acted upon).',
      'Word order and the article ("the") add emphasis and definiteness that English cannot always show.',
      'The Septuagint (the Greek Old Testament) shaped how New Testament writers used many words — entries often cite it.',
    ],
  },
  {
    heading: 'Hebrew words',
    lines: [
      'Hebrew is built on three-letter roots; related words share a root and a field of meaning.',
      'Verbs use stems (Qal, Niphal, Piel, Hiphil, etc.) that shift meaning between simple, intensive, and causative action.',
      'Hebrew is concrete and pictorial — abstract ideas are often expressed through physical images.',
      'Hebrew poetry works by parallel lines; the second line restates or sharpens the first.',
    ],
  },
  {
    heading: 'Common abbreviations',
    lines: [
      'Septuagint — the ancient Greek translation of the Old Testament (was "LXX").',
      'Masoretic Text — the standard Hebrew text (was "MT").',
      'absolute / construct — Hebrew noun states (independent vs. "X of Y").',
      'compare (was "cf."), that is (was "i.e."), for example (was "e.g."), namely (was "viz./sc.").',
      'and following (was "f./ff.") — the meaning continues into the next verses.',
      'Names like Blass, Thayer, Deissmann, Moulton-Milligan are scholars/reference works the entry cites.',
    ],
  },
];

export default WORD_STUDY_GUIDE;
