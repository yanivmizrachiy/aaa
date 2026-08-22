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

let manifest;
let profile;
let locks;
try { manifest = JSON.parse(read('WORKBOOK_MANIFEST.json')); }
catch (e) { fail(`WORKBOOK_MANIFEST.json אינו JSON תקין: ${e.message}`); }
try { profile = JSON.parse(read('STYLE_PROFILE.json')); }
catch (e) { fail(`STYLE_PROFILE.json אינו JSON תקין: ${e.message}`); }
try { locks = JSON.parse(read('meta/approved-page-locks.json')); }
catch (e) { fail(`meta/approved-page-locks.json אינו JSON תקין: ${e.message}`); }

if (manifest) {
  const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
  if (pages.length === 53) pass('המניפסט מכיל בדיוק 53 דפי פיתגורס.');
  else fail(`המניפסט מכיל ${pages.length} דפים במקום 53.`);

  const files = pages.map((p) => p.file);
  if (new Set(files).size === files.length) pass('אין דפי חוברת כפולים במניפסט.');
  else fail('נמצאו שמות קבצים כפולים במניפסט.');

  const missing = files.filter((file) => !exists(file));
  if (!missing.length) pass('כל דפי החוברת שמופיעים במניפסט קיימים בריפו.');
  else fail(`דפי חוברת חסרים: ${missing.join(', ')}`);

  for (const page of pages) {
    if (page.curriculumId && page.curriculumId !== 'g7.geo.pythagoras') {
      fail(`${page.file}: curriculumId אינו g7.geo.pythagoras.`);
    }
    if (!exists(page.file)) continue;
    const html = read(page.file);
    if (/עמוד\s+\d+\s*\/\s*53/.test(html)) pass(`${page.file}: מונה החוברת הוא /53.`);
    else fail(`${page.file}: מונה החוברת אינו מציג /53.`);
  }
}

if (profile) {
  if (profile.scope?.expectedWorkbookPages === 53) pass('פרופיל הסגנון נעול ל-53 דפים.');
  else fail('STYLE_PROFILE.json אינו נעול ל-53 דפים.');
  if (profile.scope?.curriculumId === 'g7.geo.pythagoras') pass('פרופיל הסגנון נעול לפיתגורס בלבד.');
  else fail('STYLE_PROFILE.json אינו נעול ל-curriculumId של פיתגורס.');
  if (Array.isArray(profile.styleRules) && profile.styleRules.some((r) => r.id === 'creative-high-order-practice')) {
    pass('כלל התרגול היצירתי ברמת חשיבה גבוהה קיים בפרופיל.');
  } else fail('חסר כלל creative-high-order-practice בפרופיל הסגנון.');
  if (profile.learningProtocol?.targetedEditPolicy) pass('מדיניות שינוי ממוקד ונעילת שאר התוכן קיימת.');
  else fail('חסרה מדיניות targetedEditPolicy בפרופיל הסגנון.');
}

if (!exists('SOURCE_OF_TRUTH.md')) fail('חסר SOURCE_OF_TRUTH.md.');
else {
  const truth = read('SOURCE_OF_TRUTH.md');
  if (truth.includes('פיתגורס בלבד')) pass('מקור האמת מגדיר את aaa כפיתגורס בלבד.');
  else fail('מקור האמת אינו מגדיר במפורש פיתגורס בלבד.');
  if (truth.includes('degree-answer-unit')) pass('כלל סימן המעלות קיים במקור האמת.');
  else fail('חסר כלל degree-answer-unit במקור האמת.');
  if (truth.includes('אזור המושג העליון חייב להיות שורה אחת קומפקטית בלבד')) {
    pass('מקור האמת נועל את שורת המושג של עמוד 1 לשורה אחת.');
  } else fail('מקור האמת אינו נועל את שורת המושג של עמוד 1.');
}

if (!exists('STYLE_ENGINE.md')) fail('חסר STYLE_ENGINE.md.');
else pass('מנגנון סיווג והפצת שינויי הסגנון קיים.');

if (!exists('styles/a4-base.css')) fail('חסר styles/a4-base.css.');
else {
  const base = read('styles/a4-base.css');
  if (/align-items:\s*(first\s+)?baseline/.test(base)) pass('נקודות ההוראה משתמשות ב-baseline טיפוגרפי.');
  else fail('לא נמצא מנגנון baseline משותף להוראות.');
}

if (!exists('styles/topics/pythagoras-inline-units.css')) fail('חסר רכיב יחידות מתמטיות משותף.');
else {
  const units = read('styles/topics/pythagoras-inline-units.css');
  if (units.includes('.degree-answer-unit') && units.includes('unicode-bidi: isolate')) {
    pass('רכיב המעלות מבודד RTL/LTR באופן משותף.');
  } else fail('רכיב degree-answer-unit אינו מוגדר באופן תקין.');
}

/* נעילת דפים שאושרו: שינוי רוחבי אינו רשאי לגעת בהם. */
if (locks) {
  if (locks.authority === 'SOURCE_OF_TRUTH.md') pass('קובץ הנעילות מוגדר כנגזרת של מקור האמת היחיד.');
  else fail('קובץ הנעילות אינו מצביע על SOURCE_OF_TRUTH.md כסמכות היחידה.');

  for (const pageLock of locks.pages || []) {
    if (pageLock.status !== 'locked') continue;
    for (const fileLock of pageLock.files || []) {
      if (!exists(fileLock.path)) {
        fail(`עמוד ${pageLock.workbookPage}: קובץ נעול חסר: ${fileLock.path}`);
        continue;
      }
      const actual = gitBlobSha(read(fileLock.path));
      if (actual === fileLock.gitBlobSha) {
        pass(`עמוד ${pageLock.workbookPage}: ${fileLock.path} תואם בדיוק לגרסה הנעולה.`);
      } else {
        fail(`עמוד ${pageLock.workbookPage}: ${fileLock.path} השתנה בניגוד לנעילה. שינוי מותר רק בעקבות בקשה מפורשת לעמוד זה.`);
      }
    }
  }
}

/* חוזה עמוד 1 — שכבת הגנה נוספת מפני regression responsive. */
if (exists('עמוד-634.html') && exists('styles/pages/עמוד-634.css')) {
  const page1 = read('עמוד-634.html');
  const css1 = read('styles/pages/עמוד-634.css');
  if (page1.includes('foundation-note-one-line') && page1.includes('זווית ישרה היא בת')) {
    pass('עמוד 1 שומר את שורת המושג המאושרת.');
  } else fail('עמוד 1 איבד את שורת המושג המאושרת.');
  if (css1.includes('@media (max-width: 520px)') && css1.includes('flex-wrap: nowrap')) {
    pass('עמוד 1 נשאר שורה אחת בטאבלט ונשבר רק בטלפון קטן.');
  } else fail('כלל ה-responsive של שורת המושג בעמוד 1 אינו מוגן.');
}

if (exists('עמוד-635.html')) {
  const page2 = read('עמוד-635.html');
  if (page2.includes('geometry-hunt-card') && page2.includes('triangle-hunt-svg')) {
    pass('עמוד 2 מכיל את חידת הגאומטריה הגדולה.');
  } else fail('עמוד 2 אינו מכיל את חידת הגאומטריה שנקבעה.');
  if (page2.includes('כמה משולשים ישרי־זווית מצאתם?')) {
    pass('עמוד 2 מכיל את שאלת הספירה שנקבעה.');
  } else fail('חסרה בעמוד 2 שאלת הספירה שנקבעה.');
  if (page2.includes('איזה מהמשולשים <strong>אינו</strong> משולש ישר־זווית?')) {
    pass('עמוד 2 מכיל את השאלה האמריקאית המאושרת.');
  } else fail('חסרה בעמוד 2 השאלה האמריקאית המאושרת.');
}

if (manifest) {
  for (const page of manifest.pages || []) {
    if (!exists(page.file)) continue;
    const html = read(page.file);
    const banned = ['<strong>זיהוי:</strong>', '<strong>מיון:</strong>', '<strong>בנייה:</strong>', '<strong>חשיבה:</strong>', '<strong>מילוי:</strong>'];
    const hits = banned.filter((token) => html.includes(token));
    if (hits.length) warn(`${page.file}: נמצאו תוויות מטא ישנות: ${hits.join(', ')}`);
  }
}

console.log('\n=== Pythagoras Style Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
warnings.forEach((m) => console.warn(`⚠ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${warnings.length} אזהרות | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
