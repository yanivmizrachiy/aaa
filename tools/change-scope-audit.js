const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const warnings = [];
const ok = [];

function pass(message) { ok.push(message); }
function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }
function changedFiles(base) {
  if (!base || /^0+$/.test(base)) {
    warn('BASE_SHA לא זמין; בדיקת scope דיפרנציאלית דולגה.');
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
function readBase(base, file) {
  if (!base || /^0+$/.test(base)) return null;
  try { return execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8' }); }
  catch { return null; }
}
function parseJson(text, label) {
  if (!text) return null;
  try { return JSON.parse(text); }
  catch (error) { fail(`${label} אינו JSON תקין: ${error.message}`); return null; }
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
function stableRecord(record) {
  if (!record) return null;
  return JSON.stringify(record);
}

const base = process.env.BASE_SHA;
const changed = changedFiles(base);
if (!changed.length && !errors.length && !warnings.length) pass('אין שינויי diff לבדיקה.');

const truthChanged = changed.includes('SOURCE_OF_TRUTH.md');
const lockFile = 'meta/approved-page-locks.json';
const lockFileChanged = changed.includes(lockFile);
const pageImplementationChanged = changed.some((file) => /^עמוד-\d+\.html$/u.test(file) || /^styles\/pages\/עמוד-\d+\.css$/u.test(file));

const manifest = parseJson(exists('WORKBOOK_MANIFEST.json') ? read('WORKBOOK_MANIFEST.json') : null, 'WORKBOOK_MANIFEST.json');
const currentLocks = parseJson(exists(lockFile) ? read(lockFile) : null, lockFile);
const oldLocks = parseJson(readBase(base, lockFile), `${lockFile} בבסיס`);
const pages = manifest?.pages || [];

const pathToPage = new Map();
pages.forEach((page, index) => {
  if (!page?.file) return;
  pathToPage.set(page.file, index + 1);
  pathToPage.set(`styles/pages/${page.file.replace(/\.html$/u, '.css')}`, index + 1);
});
const changedPageNumbers = new Set(changed.map((file) => pathToPage.get(file)).filter(Boolean));

if (pageImplementationChanged && !truthChanged) fail('שונה דף פעיל או CSS ייעודי בלי לעדכן SOURCE_OF_TRUTH.md באותו change-set.');
else if (pageImplementationChanged) pass('שינויי העמוד מלווים בעדכון מקור האמת.');

const currentLockMap = new Map((currentLocks?.pages || []).map((p) => [p.workbookPage, p]));
const oldLockMap = new Map((oldLocks?.pages || []).map((p) => [p.workbookPage, p]));

/* נעילה שאושרה בעבר אינה יכולה להיעלם או להפוך ללא-נעולה. */
for (const [page, oldLock] of oldLockMap) {
  if (oldLock.status !== 'locked') continue;
  const current = currentLockMap.get(page);
  if (!current || current.status !== 'locked') fail(`עמוד ${page}: נעילה מאושרת הוסרה או הוחלשה.`);
}

/* שינוי בעמוד נעול חייב לעדכן את lock שלו; עמוד שלא השתנה אסור שיקבל refresh עיוור. */
for (const page of changedPageNumbers) {
  const wasLocked = oldLockMap.get(page)?.status === 'locked' || currentLockMap.get(page)?.status === 'locked';
  if (wasLocked && !lockFileChanged) fail(`עמוד ${page} נעול השתנה בלי לעדכן ${lockFile}.`);
}

if (lockFileChanged && oldLocks && currentLocks) {
  for (const [page, oldLock] of oldLockMap) {
    const current = currentLockMap.get(page);
    if (!current) continue;
    if (!changedPageNumbers.has(page) && stableRecord(oldLock) !== stableRecord(current)) {
      fail(`עמוד ${page}: lock השתנה למרות שקובצי העמוד לא השתנו. אסור refresh עיוור של חתימות.`);
    }
    if (changedPageNumbers.has(page) && oldLock.status === 'locked') {
      const oldPaths = (oldLock.files || []).map((x) => x.path).sort().join('|');
      const newPaths = (current.files || []).map((x) => x.path).sort().join('|');
      if (oldPaths !== newPaths) fail(`עמוד ${page}: נתיבי הנעילה השתנו. שינוי נתיב דורש החלטת מקור אמת מפורשת, לא refresh חתימה.`);
      if (current.status !== 'locked') fail(`עמוד ${page}: אסור להחליש status: locked בזמן עריכה.`);
      if (!String(current.reason || '').trim()) fail(`עמוד ${page}: חסר reason לאחר עדכון נעילה.`);
    }
  }

  const oldNumbers = new Set((oldLocks.pages || []).map((p) => p.workbookPage));
  for (const current of currentLocks.pages || []) {
    if (!oldNumbers.has(current.workbookPage)) {
      if (!truthChanged) fail(`עמוד ${current.workbookPage}: נוספה נעילה חדשה בלי עדכון SOURCE_OF_TRUTH.md.`);
      if (current.status !== 'locked') fail(`עמוד ${current.workbookPage}: נעילה חדשה חייבת להתחיל ב-status: locked רק לאחר אימות.`);
    }
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
if (sharedChange && !lockFileChanged && (currentLocks?.pages || []).some((page) => page.status === 'locked')) {
  fail('שינוי בשכבה משותפת בוצע בלי עדכון ואימות מחדש של חומת הנעילות.');
} else if (sharedChange) pass('שינוי משותף כולל עדכון חומת נעילות.');

if (lockFileChanged && !pageImplementationChanged && !sharedChange && !truthChanged) {
  fail('קובץ הנעילות השתנה לבדו בלי שינוי עמוד, שכבה משותפת או מקור אמת.');
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

const changedPageHtml = changed.filter((name) => /^עמוד-\d+\.html$/u.test(name));
if (changedPageHtml.length > 1) warn(`השתנו ${changedPageHtml.length} דפי HTML באותו change-set: ${changedPageHtml.join(', ')}. שינוי רוחבי חייב להיות מוצדק בכלל משותף במקור האמת.`);

console.log('\n=== Pythagoras Change Scope Audit ===');
ok.forEach((message) => console.log(`✓ ${message}`));
warnings.forEach((message) => console.warn(`⚠ ${message}`));
errors.forEach((message) => console.error(`✗ ${message}`));
console.log(`\n${ok.length} תקין | ${warnings.length} אזהרות | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
