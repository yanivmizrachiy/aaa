const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const warnings = [];
const ok = [];
const pass = (m) => ok.push(m);
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function json(file) {
  try { return JSON.parse(read(file)); }
  catch (error) { fail(`${file} אינו JSON תקין: ${error.message}`); return null; }
}

for (const file of [
  'SOURCE_OF_TRUTH.md',
  'WORKBOOK_MANIFEST.json',
  'STYLE_PROFILE.json',
  'STYLE_ENGINE.md',
  'styles/a4-base.css',
  'styles/topics/pythagoras-inline-units.css',
  'meta/approved-page-locks.json',
]) {
  if (exists(file)) pass(`${file} קיים.`);
  else fail(`חסר ${file}.`);
}

const truth = exists('SOURCE_OF_TRUTH.md') ? read('SOURCE_OF_TRUTH.md') : '';
const manifest = exists('WORKBOOK_MANIFEST.json') ? json('WORKBOOK_MANIFEST.json') : null;
const profile = exists('STYLE_PROFILE.json') ? json('STYLE_PROFILE.json') : null;
const locks = exists('meta/approved-page-locks.json') ? json('meta/approved-page-locks.json') : null;

if (truth) {
  const required = [
    'הסמכות היחידה',
    'מקור ה־runtime היחיד',
    'index.html` הוא **נקודת הכניסה היחידה**',
    'שינוי ממוקד נשאר מקומי כברירת מחדל',
    'תיבה בתוך תיבה',
    'degree-answer-unit',
    '## עמוד 1 — מושגים בסיסיים',
    '## עמוד 2 — משולש ישר־זווית',
    '## עמוד 3 — הניצבים',
  ];
  const missing = required.filter((token) => !truth.includes(token));
  if (missing.length) fail(`SOURCE_OF_TRUTH.md חסר כללים מרכזיים: ${missing.join(' | ')}`);
  else pass('SOURCE_OF_TRUTH.md כולל את כל כללי היסוד והעמודים המאושרים 1–3.');
}

if (manifest) {
  if (manifest.authority === 'SOURCE_OF_TRUTH.md') pass('המניפסט כפוף למקור האמת היחיד.');
  else fail('המניפסט אינו כפוף ל-SOURCE_OF_TRUTH.md.');
  if (manifest.totalPages === 53 && Array.isArray(manifest.pages) && manifest.pages.length === 53) pass('המניפסט נעול ל-53 דפים.');
  else fail('המניפסט אינו מכיל בדיוק 53 דפים.');
  const files = (manifest.pages || []).map((p) => p.file);
  if (files.length === new Set(files).size) pass('אין קובצי דף כפולים במניפסט.');
  else fail('נמצאו קובצי דף כפולים במניפסט.');

  for (const page of manifest.pages || []) {
    if (!exists(page.file)) fail(`קובץ פעיל חסר: ${page.file}`);
    if (page.curriculumId !== 'g7.geo.pythagoras') fail(`${page.file}: curriculumId אינו פיתגורס.`);
  }

  for (const page of (manifest.pages || []).slice(0, 10)) {
    if (!exists(page.file)) continue;
    const html = read(page.file);
    if (!/עמוד\s+\d+\s*\/\s*53/u.test(html)) fail(`${page.file}: מונה הניווט של אחד מעשרת הדפים המאושרים אינו /53.`);
  }
  if (!errors.some((m) => m.includes('מונה הניווט'))) pass('עשרת הדפים הראשונים המאושרים מציגים /53.');
}

if (profile) {
  if (profile.authority === 'SOURCE_OF_TRUTH.md') pass('STYLE_PROFILE.json כפוף למקור האמת היחיד.');
  else fail('STYLE_PROFILE.json אינו מצהיר על SOURCE_OF_TRUTH.md כסמכות.');
  if (profile.scope?.expectedWorkbookPages === 53) pass('פרופיל הסגנון מכיר 53 דפים.');
  else fail('STYLE_PROFILE.json אינו נעול ל-53 דפים.');
  if (profile.scope?.curriculumId === 'g7.geo.pythagoras') pass('פרופיל הסגנון מוגבל לפיתגורס.');
  else fail('STYLE_PROFILE.json אינו מוגבל לפיתגורס.');
  if (profile.learningProtocol?.targetedEditPolicy) pass('מדיניות שינוי ממוקד קיימת בפרופיל.');
  else fail('חסרה targetedEditPolicy ב-STYLE_PROFILE.json.');
}

if (locks) {
  if (locks.authority === 'SOURCE_OF_TRUTH.md') pass('קובץ הנעילות הוא נגזרת של מקור האמת.');
  else fail('קובץ הנעילות אינו כפוף למקור האמת.');
  const lockedPages = (locks.pages || []).filter((p) => p.status === 'locked').map((p) => p.workbookPage);
  for (const page of [1, 2, 3]) {
    if (!lockedPages.includes(page)) fail(`עמוד ${page} אינו נעול למרות שאושר.`);
  }
  if ([1, 2, 3].every((p) => lockedPages.includes(p))) pass('עמודים 1–3 מוגנים בנעילות נגזרות.');
}

if (exists('styles/a4-base.css')) {
  const base = read('styles/a4-base.css');
  if (/align-items:\s*(first\s+)?baseline/u.test(base)) pass('נקודות הוראה משתמשות ב-baseline משותף.');
  else fail('לא נמצא baseline משותף לנקודות הוראה.');
}

if (exists('styles/topics/pythagoras-inline-units.css')) {
  const units = read('styles/topics/pythagoras-inline-units.css');
  if (units.includes('.degree-answer-unit') && units.includes('unicode-bidi: isolate')) pass('סימן המעלות מבודד נכון ב-RTL/LTR.');
  else fail('degree-answer-unit אינו מוגדר באופן תקין.');
}

/* דפים מאוחרים שעדיין מכילים מונה legacy אינם runtime של החוברת המאוחדת; מדווחים בלבד. */
if (manifest) {
  const legacyCounters = (manifest.pages || []).slice(10).filter((page) => exists(page.file) && !/עמוד\s+\d+\s*\/\s*53/u.test(read(page.file)));
  if (legacyCounters.length) warn(`${legacyCounters.length} דפים מאוחרים עדיין כוללים מונה ניווט standalone ישן; אין לכך השפעה על runtime החוברת המאוחדת.`);
}

console.log('\n=== Pythagoras Style Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
warnings.forEach((m) => console.warn(`⚠ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${warnings.length} אזהרות | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
