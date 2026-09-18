/**
 * bump-version.js
 * Increments the patch (last) number of the KaiOS app version in both manifests
 *   public/manifest.webmanifest   and   public/manifest.en-US.webmanifest
 * e.g. 3.0.2 -> 3.0.3.
 *
 * Uses a targeted string replace so the rest of each manifest stays byte-for-byte
 * identical. Prints ONLY the new version to stdout (so a caller can capture it).
 *
 * Usage:  node scripts/bump-version.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT  = path.join(__dirname, '..');
const FILES = [
  path.join(ROOT, 'public', 'manifest.webmanifest'),
  path.join(ROOT, 'public', 'manifest.en-US.webmanifest'),
];

const RE = /("version"\s*:\s*")(\d+)\.(\d+)\.(\d+)(")/;

const first = fs.readFileSync(FILES[0], 'utf8');
const m = first.match(RE);
if (!m) {
  console.error('bump-version: could not find a "version": "X.Y.Z" field in', FILES[0]);
  process.exit(1);
}

const major = m[2];
const minor = m[3];
const patch = parseInt(m[4], 10) + 1;
const next  = `${major}.${minor}.${patch}`;

for (const file of FILES) {
  const src = fs.readFileSync(file, 'utf8');
  if (!RE.test(src)) {
    console.error('bump-version: no version field in', file);
    process.exit(1);
  }
  fs.writeFileSync(file, src.replace(RE, `$1${next}$5`));
}

// stdout = just the new version (for the .bat to capture); status goes to stderr.
console.error(`bump-version: ${m[2]}.${m[3]}.${m[4]} -> ${next}`);
process.stdout.write(next);
