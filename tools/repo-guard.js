const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const warnings = [];
const ok = [];

function pass(message) { ok.push(message); }
function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }
function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  const header = Buffer.from(`blob ${body.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header, body])).digest('hex');
}
function readJson(file) {
  try { return JSON.parse(read(file)); }
  catch (error) { fail(`${file} אינו JSON תקין: ${error.message}`); return null; }
}

const manifest = readJson('WORKBOOK_MANIFEST.json');
const locks = readJson('meta/approved-page-locks.json');

/* מקור runtime יחיד. */
if (!exists('pythagoras-workbook.js')) {
  fail('חסר pythagoras-workbook.js.');
} else {
  const loader = read('pythagoras-workbook.js');
  if (loader.includes("const MANIFEST_URL = 'WORKBOOK_MANIFEST.json'")) {
    pass('ה-loader משתמש ב-WORKBOOK_MANIFEST.json כמקור runtime.');
  } else fail('ה-loader אינו מצביע ישירות על WORKBOOK_MANIFEST.json.');
  if (loader.includes('meta/topics.json') || loader.includes('buildPythagorasWorkbook')) {
    fail('נמצא מקור runtime חלופי או fallback ישן.');
  } else pass('אין fallback runtime ל-meta/topics.json או למודל בנייה ישן.');
}

if (exists('pythagoras-workbook-model.js')) fail('pythagoras-workbook-model.js הישן חזר לריפו.');
else pass('אין מודל runtime כפול.');

/* שני entrypoints מותרים רק כל עוד הם זהים לחלוטין. */
if (exists('index.html') && exists('pythagoras-workbook.html')) {
  if (read('index.html') === read('pythagoras-workbook.html')) pass('שני entrypoints זהים ואינם מתפצלים.');
  else fail('index.html ו-pythagoras-workbook.html התפצלו; אסור להחזיק שתי גרסאות שונות של החוברת.');
}

/* המניפסט קובע רק את החוברת הפעילה; שדות legacy אינם רשאים להשפיע על runtime. */
if (manifest) {
  const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
  if (pages.length === 53) pass('המניפסט מכיל 53 דפים.');
  else fail(`המניפסט מכיל ${pages.length} דפים במקום 53.`);
  const files = pages.map((page) => page.file).filter(Boolean);
  if (new Set(files).size === files.length) pass('אין קובצי דף כפולים במניפסט.');
  else fail('נמצאו קובצי דף כפולים במניפסט.');
  if (manifest.source === 'meta/topics.json') {
    warn('WORKBOOK_MANIFEST.json עדיין מכיל metadata היסטורי source=meta/topics.json; ה-loader אינו משתמש בו. יש להסירו במיגרציית metadata נפרדת ולא תוך תיקון דף.');
  }
}

/* נעילה עמוקה: גם קובצי הדף וגם כל תלות משותפת חייבים להישאר בדיוק בגרסה שאומתה. */
if (locks) {
  if (locks.authority !== 'SOURCE_OF_TRUTH.md') fail('קובץ הנעילות אינו נגזר מ-SOURCE_OF_TRUTH.md.');
  else pass('סמכות הנעילות היא SOURCE_OF_TRUTH.md בלבד.');

  for (const pageLock of locks.pages || []) {
    if (pageLock.status !== 'locked') continue;
    const allLocks = [
      ...(pageLock.files || []).map((item) => ({ ...item, kind: 'page' })),
      ...(pageLock.sharedDependencies || []).map((item) => ({ ...item, kind: 'shared' })),
    ];
    if (!(pageLock.sharedDependencies || []).length) {
      fail(`עמוד ${pageLock.workbookPage}: נעילה ללא sharedDependencies אינה מגינה מפני שינוי רוחבי.`);
    }
    for (const item of allLocks) {
      if (!exists(item.path)) {
        fail(`עמוד ${pageLock.workbookPage}: קובץ ${item.kind === 'shared' ? 'משותף' : 'נעול'} חסר: ${item.path}`);
        continue;
      }
      const actual = gitBlobSha(read(item.path));
      if (actual === item.gitBlobSha) {
        pass(`עמוד ${pageLock.workbookPage}: ${item.path} תואם לנעילה.`);
      } else {
        fail(`עמוד ${pageLock.workbookPage}: ${item.path} השתנה מאז האימות. אסור לפרסם לפני אימות מחדש ועדכון הנעילה.`);
      }
    }
  }
}

/* CSS של עמוד חייב להיות מקומי. בדיקה זו חלה על מבני ליבה רגישים במיוחד. */
const sensitiveClasses = [
  'page-title', 'header-container', 'question-block', 'q-main', 'q-sub',
  'gz-footer', 'foundation-note', 'foundation-grid', 'foundation-card',
];

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

if (manifest) {
  for (const page of manifest.pages || []) {
    const file = page.file;
    if (!file) continue;
    const match = file.match(/עמוד-(\d+)\.html$/u);
    if (!match) continue;
    const sourceNumber = match[1];
    const cssPath = `styles/pages/עמוד-${sourceNumber}.css`;
    if (!exists(cssPath)) continue;
    const rootClass = `.page-${sourceNumber}`;
    for (const selector of selectorHeaders(read(cssPath))) {
      const touchesSensitive = sensitiveClasses.some((name) => selector.includes(`.${name}`));
      if (touchesSensitive && !selector.includes(rootClass)) {
        fail(`${cssPath}: selector רגיש אינו תחום ל-${rootClass}: ${selector}`);
      }
    }
  }
}

console.log('\n=== Pythagoras Repo Guard ===');
ok.forEach((message) => console.log(`✓ ${message}`));
warnings.forEach((message) => console.warn(`⚠ ${message}`));
errors.forEach((message) => console.error(`✗ ${message}`));
console.log(`\n${ok.length} תקין | ${warnings.length} אזהרות | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
