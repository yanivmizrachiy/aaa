const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const ok = [];
const pass = (m) => ok.push(m);
const fail = (m) => errors.push(m);

const lockPath = 'styles/workbook-canonical-locks.css';
if (!exists(lockPath)) {
  fail('חסר styles/workbook-canonical-locks.css.');
} else {
  const css = read(lockPath);
  const required = [
    '.page-634 > .header-container',
    '.header-container > .page-title',
    '.header-container > .page-number',
    '.page-634 .foundation-note-one-line',
    '.page-634 .mcq-options',
    '!important',
  ];
  const missing = required.filter((token) => !css.includes(token));
  if (missing.length) fail(`נעילת עמוד 1 חסרה רכיבים: ${missing.join(', ')}`);
  else pass('נעילת התצוגה הקנונית של עמוד 1 מלאה.');
}

for (const entry of ['index.html', 'pythagoras-workbook.html']) {
  if (!exists(entry)) {
    fail(`חסר ${entry}.`);
    continue;
  }
  const html = read(entry);
  const workbookPos = html.indexOf('styles/pythagoras-workbook.css');
  const lockPos = html.indexOf('styles/workbook-canonical-locks.css');
  const scriptPos = html.indexOf('pythagoras-workbook.js');
  if (workbookPos >= 0 && lockPos > workbookPos && scriptPos > lockPos) {
    pass(`${entry}: קובץ הנעילות נטען אחרי CSS החוברת ולפני ה-loader.`);
  } else {
    fail(`${entry}: סדר הטעינה אינו מבטיח שנעילות קנוניות ינצחו את שאר ה-CSS.`);
  }
}

if (exists('index.html') && exists('pythagoras-workbook.html')) {
  if (read('index.html') === read('pythagoras-workbook.html')) pass('שני entrypoints זהים.');
  else fail('index.html ו-pythagoras-workbook.html אינם זהים.');
}

if (exists('pythagoras-workbook.js')) {
  const js = read('pythagoras-workbook.js');
  if (js.includes('workbookCss.before(link)')) {
    pass('CSS דינמי של דפים נטען לפני שכבות החוברת והנעילות.');
  } else {
    fail('מיקום CSS הדפים השתנה; קיים סיכון ש-CSS של דף יעקוף את שכבת הנעילות.');
  }
}

console.log('\n=== Workbook Visual Guard ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
