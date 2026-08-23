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

for (const file of ['SOURCE_OF_TRUTH.md','WORKBOOK_MANIFEST.json','STYLE_PROFILE.json','STYLE_ENGINE.md','styles/a4-base.css','styles/topics/pythagoras-inline-units.css','meta/approved-page-locks.json']) {
  exists(file) ? pass(`${file} קיים.`) : fail(`חסר ${file}.`);
}

const truth = exists('SOURCE_OF_TRUTH.md') ? read('SOURCE_OF_TRUTH.md') : '';
const manifest = exists('WORKBOOK_MANIFEST.json') ? json('WORKBOOK_MANIFEST.json') : null;
const profile = exists('STYLE_PROFILE.json') ? json('STYLE_PROFILE.json') : null;
const locks = exists('meta/approved-page-locks.json') ? json('meta/approved-page-locks.json') : null;
const activeEnd = 20;

if (truth) {
  const required = [
    'הסמכות היחידה',
    'WORKBOOK_MANIFEST.json',
    'index.html` הוא **נקודת הכניסה היחידה**',
    '## חוזה עריכה אטומי — חובה בכל שינוי',
    '## מערכת למידת הסגנון — חוזה מחייב',
    '**אין להשאיר שטח A4 גדול ריק ללא מטרה.**',
    '**ניצול דף חכם קודם למרכוז.**',
    '**שטח תשובה מותאם לתשובה הצפויה:**',
    '**תוצאת חישוב נמצאת מתחת לתרגיל.**',
    '**פתרון רב־שלבי נכתב אנכית:**',
    'תיבה בתוך תיבה',
    'AAA Exact A4 Preview',
  ];
  for (let p = 1; p <= activeEnd; p += 1) required.push(`## עמוד ${p} —`);
  const missing = required.filter((token) => !truth.includes(token));
  if (missing.length) fail(`SOURCE_OF_TRUTH.md חסר כללים מרכזיים: ${missing.join(' | ')}`);
  else pass(`SOURCE_OF_TRUTH.md כולל חוזה יחיד, כללי סגנון ועמודים 1–${activeEnd}.`);
}

if (manifest) {
  manifest.authority === 'SOURCE_OF_TRUTH.md' ? pass('המניפסט כפוף למקור האמת היחיד.') : fail('המניפסט אינו כפוף למקור האמת.');
  (manifest.totalPages === 53 && Array.isArray(manifest.pages) && manifest.pages.length === 53) ? pass('המניפסט נעול ל-53 דפי התוכן הקנוניים.') : fail('המניפסט אינו מכיל בדיוק 53 דפי תוכן קנוניים.');
  const files = (manifest.pages || []).map((p) => p.file);
  files.length === new Set(files).size ? pass('אין קובצי דף כפולים במניפסט.') : fail('נמצאו קובצי דף כפולים במניפסט.');
  for (const page of manifest.pages || []) {
    if (!exists(page.file)) fail(`קובץ פעיל חסר: ${page.file}`);
    if (page.curriculumId !== 'g7.geo.pythagoras') fail(`${page.file}: curriculumId אינו פיתגורס.`);
  }
  for (const page of (manifest.pages || []).slice(0, activeEnd)) {
    if (!exists(page.file)) continue;
    if (!/עמוד\s+\d+\s*\/\s*53/u.test(read(page.file))) fail(`${page.file}: מונה הניווט של אחד מ-${activeEnd} הדפים הראשונים אינו /53.`);
  }
  if (!errors.some((m) => m.includes('מונה הניווט'))) pass(`עמודים 1–${activeEnd} מציגים /53.`);
}

if (profile) {
  profile.authority === 'SOURCE_OF_TRUTH.md' ? pass('STYLE_PROFILE.json כפוף למקור האמת היחיד.') : fail('STYLE_PROFILE.json אינו כפוף למקור האמת.');
  profile.scope?.expectedWorkbookPages === 53 ? pass('פרופיל הסגנון מכיר 53 דפי תוכן.') : fail('STYLE_PROFILE.json אינו נעול ל-53 דפי תוכן.');
  profile.scope?.curriculumId === 'g7.geo.pythagoras' ? pass('פרופיל הסגנון מוגבל לפיתגורס.') : fail('STYLE_PROFILE.json אינו מוגבל לפיתגורס.');
  const window = profile.learningProtocol?.activeAuditWindow;
  (window?.startPage === 1 && window?.endPage === activeEnd) ? pass(`פרופיל הסגנון מפעיל ביקורת 1–${activeEnd}.`) : fail(`חלון הביקורת בפרופיל אינו 1–${activeEnd}.`);
}

if (locks) {
  locks.authority === 'SOURCE_OF_TRUTH.md' ? pass('קובץ הנעילות הוא נגזרת של מקור האמת.') : fail('קובץ הנעילות אינו כפוף למקור האמת.');
  const lockedPages = new Set((locks.pages || []).filter((p) => p.status === 'locked').map((p) => p.workbookPage));
  for (let page = 1; page <= activeEnd; page += 1) if (!lockedPages.has(page)) fail(`עמוד ${page} אינו נעול למרות שהוא בחומת 1–${activeEnd}.`);
  if (Array.from({length: activeEnd}, (_, i) => i + 1).every((p) => lockedPages.has(p))) pass(`עמודים 1–${activeEnd} מוגנים בנעילות נגזרות.`);
}

if (exists('styles/a4-base.css')) {
  const base = read('styles/a4-base.css');
  /align-items:\s*(first\s+)?baseline/u.test(base) ? pass('נקודות הוראה משתמשות ב-baseline משותף.') : fail('לא נמצא baseline משותף לנקודות הוראה.');
}
if (exists('styles/topics/pythagoras-inline-units.css')) {
  const units = read('styles/topics/pythagoras-inline-units.css');
  (units.includes('.degree-answer-unit') && units.includes('unicode-bidi: isolate')) ? pass('סימן המעלות מבודד נכון ב-RTL/LTR.') : fail('degree-answer-unit אינו מוגדר באופן תקין.');
}

if (manifest) {
  const legacyCounters = (manifest.pages || []).slice(activeEnd).filter((page) => exists(page.file) && !/עמוד\s+\d+\s*\/\s*53/u.test(read(page.file)));
  if (legacyCounters.length) warn(`${legacyCounters.length} דפים מאוחרים עדיין כוללים מונה standalone ישן; זהו debt מחוץ לחלון 1–${activeEnd}.`);
}

console.log('\n=== Pythagoras Style Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
warnings.forEach((m) => console.warn(`⚠ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${warnings.length} אזהרות | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
