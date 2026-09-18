/**
 * package-kaios.js
 * Builds the app and zips the build/ directory contents for KaiStore submission.
 *
 * Usage:  node scripts/package-kaios.js
 *    or:  npm run package
 *
 * Output: agape-study-bible-<version>.zip (contents at ZIP root, not inside a folder)
 */

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');
const { makeZip }  = require('./make-zip');

const ROOT    = path.join(__dirname, '..');
const BUILD   = path.join(ROOT, 'build');

// Read version from manifest
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public', 'manifest.webmanifest'), 'utf8')
);
const version = manifest?.b2g_features?.version || '1.0.0';
const OUT     = path.join(ROOT, `agape-study-bible-${version}.zip`);

// ── Step 1: Verify required icons exist ───────────────────────────────────────
const icon56  = path.join(ROOT, 'public', 'icons', 'icon-56.png');
const icon112 = path.join(ROOT, 'public', 'icons', 'icon-112.png');
const missing = [icon56, icon112].filter((p) => !fs.existsSync(p));
if (missing.length) {
  console.error('\n[1/3] Missing required icon(s):');
  missing.forEach((p) => console.error('   - ' + path.relative(ROOT, p)));
  console.error('\nAdd 56×56 and 112×112 PNG icons to public/icons/ before packaging.');
  process.exit(1);
}
console.log('\n[1/3] Icons present.');

// ── Step 2: Build ─────────────────────────────────────────────────────────────
console.log('\n[2/3] Building…');
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

// ── Step 3: Zip build/ contents ───────────────────────────────────────────────
console.log('\n[3/3] Packaging…');
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

// Use our own ZIP writer (forward-slash entry names) — NOT Compress-Archive,
// which writes backslash separators that KaiStore can't resolve.
const { count } = makeZip(BUILD, OUT);
console.log(`  Wrote ${count} files with forward-slash paths.`);

// ── Report ────────────────────────────────────────────────────────────────────
const stats    = fs.statSync(OUT);
const sizeMB   = (stats.size / 1024 / 1024).toFixed(1);

console.log(`\nDone!  →  ${path.relative(ROOT, OUT)}  (${sizeMB} MB)`);

if (parseFloat(sizeMB) > 50) {
  console.warn('\nWARNING: Package exceeds the KaiStore 50 MB limit!');
  console.warn('Consider removing unused translation data or audio files.');
} else if (parseFloat(sizeMB) > 5) {
  console.warn('\nNOTE: Package is > 5 MB — may not run on 256 MB low-memory devices.');
  console.warn('KaiStore recommends testing on both 256 MB and 512 MB devices.');
}

console.log('\nBefore submitting to KaiStore:');
console.log('  1. Update developer.url in manifest.webmanifest and manifest.en-US.webmanifest');
console.log('  2. Prepare a marketing banner (1240×624 px) and 3–5 screenshots (240×320 px)');
console.log('  3. Submit at https://developer.kaiostech.com/devlogin/');
