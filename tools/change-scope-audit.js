const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const ok = [];

function pass(message) { ok.push(message); }
function fail(message) { errors.push(message); }
function changedFiles() {
  const base = process.env.BASE_SHA;
  if (!base || /^0+$/.test(base)) {
    console.warn('⚠ BASE_SHA לא זמין; בדיקת scope דיפרנציאלית דולגה.');
    return [];
  }
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}..HEAD`], { cwd: root, encoding: 'utf8' });
    return out.split(/\r?\n/u).map((s) => s.trim()).filter(Boolean);
  } catch (error) {
    fail(`לא ניתן לחשב git diff מול BASE_SHA: ${error.message}`);
    return [];
  }
}

function selectorHeaders(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const headers = [];
  const re = /([^{}]+)\{/g;
  let match;
  while ((match = re.exec(clean))) {
    const header = match[1].trim();
    if (!header || header.startsWith('@')) continue;
    if (/^(from|to|\d+(?:\.\d+)?%)$/u.test(header)) continue;
    headers.push(...header.split(',').map((part) => part.trim()).filter(Boolean));
  }
  return headers;
}

const changed = changedFiles();
if (!changed.length && !errors.length) pass('אין שינויי diff לבדיקה או שהבדיקה המקומית רצה ללא BASE_SHA.');

let locks = null;
if (exists('meta/approved-page-locks.json')) {
  try { locks = JSON.parse(read('meta/approved-page-locks.json')); }
  catch (error) { fail(`meta/approved-page-locks.json אינו JSON תקין: ${error.message}`); }
}
const lockFileChanged = changed.includes('meta/approved-page-locks.json');
const lockedPaths = new Set();
for (const pageLock of locks?.pages || []) {
  if (pageLock.status !== 'locked') continue;
  for (const item of pageLock.files || []) lockedPaths.add(item.path);
}

/* שינוי בקובץ של עמוד נעול חייב לעדכן את הנעילה באותו change-set. */
for (const file of changed) {
  if (lockedPaths.has(file) && !lockFileChanged) {
    fail(`${file} שייך לעמוד נעול, אך meta/approved-page-locks.json לא עודכן באותו שינוי.`);
  }
}

/* כל שכבה שיכולה לשנות runtime/פריסה של כמה דפים נחשבת משותפת. */
const sharedFiles = new Set([
  'index.html',
  'WORKBOOK_MANIFEST.json',
  'vercel.json',
  'styles/a4-base.css',
  'styles/pythagoras-workbook.css',
  'styles/workbook-canonical-locks.css',
  'pythagoras-workbook.js',
]);
const sharedChange = changed.some((file) => sharedFiles.has(file) || file.startsWith('styles/topics/'));
if (sharedChange && !lockFileChanged && (locks?.pages || []).some((page) => page.status === 'locked')) {
  fail('שינוי בשכבה משותפת בוצע בלי עדכון meta/approved-page-locks.json. יש לאמת מחדש כל עמוד נעול לפני פרסום.');
} else if (sharedChange) {
  pass('שינוי משותף כולל עדכון נעילות לאימות מחדש.');
}

/* CSS ייעודי לעמוד: כל selector חייב להיות תחום לשורש של אותו עמוד. */
for (const file of changed.filter((name) => /^styles\/pages\/עמוד-\d+\.css$/u.test(name))) {
  if (!exists(file)) continue;
  const match = file.match(/עמוד-(\d+)\.css$/u);
  const rootClass = `.page-${match[1]}`;
  for (const selector of selectorHeaders(read(file))) {
    if (selector === ':root' || selector === 'html' || selector === 'body') {
      fail(`${file}: אסור selector גלובלי בקובץ CSS ייעודי לעמוד: ${selector}`);
      continue;
    }
    if (!selector.includes(rootClass)) fail(`${file}: selector אינו תחום ל-${rootClass}: ${selector}`);
  }
}

/* תיקון עמוד אחד אינו רשאי לגרור שינוי לעמוד HTML אחר בלי הצדקה מפורשת. */
const changedPageHtml = changed.filter((name) => /^עמוד-\d+\.html$/u.test(name));
if (changedPageHtml.length > 1) {
  console.warn(`⚠ השתנו ${changedPageHtml.length} דפי HTML באותו change-set: ${changedPageHtml.join(', ')}. שינוי רוחבי כזה דורש הצדקה מפורשת.`);
}

console.log('\n=== Pythagoras Change Scope Audit ===');
ok.forEach((message) => console.log(`✓ ${message}`));
errors.forEach((message) => console.error(`✗ ${message}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
