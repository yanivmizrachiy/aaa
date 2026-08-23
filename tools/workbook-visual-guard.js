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
  const required = {
    1: [
      '.page-634 > .header-container',
      '.header-container > .page-title',
      '.header-container > .page-number',
      '.page-634 .foundation-note-one-line',
      '.page-634 .final-build-task',
      '.page-634 .final-build-area',
      'border: 0 !important',
      '!important',
    ],
    2: [
      '.page-635 .question-block',
      'grid-template-rows: auto auto 86px 118px 168px minmax(0, 1fr)',
      '.page-635 .triangle-choice-grid',
      'repeat(6, minmax(0, 1fr))',
      '.page-635 .mc-triangle-grid',
      'repeat(5, minmax(0, 1fr))',
      '.page-635 .construction-task',
      '.page-635 .construction-grid',
      '.page-635 .hunt-section',
    ],
    3: [
      '.page-636 .question-block',
      '.page-636 .legs-grid',
      'repeat(4, minmax(0, 1fr))',
      '.page-636 .vertex-grid',
      'repeat(2, minmax(0, 1fr))',
      '.page-636 .quick-fill-grid',
      'repeat(3, minmax(0, 1fr))',
      '.page-636 .legs-mcq',
    ],
  };
  for (const [page, tokens] of Object.entries(required)) {
    const missing = tokens.filter((token) => !css.includes(token));
    if (missing.length) fail(`נעילת עמוד ${page} חסרה רכיבים: ${missing.join(', ')}`);
    else pass(`נעילת התצוגה הקנונית של עמוד ${page} מלאה.`);
  }
}

/* עמוד 7 נשבר בעבר בגלל חפיפה בין CSS מקומי לשכבת power-practice.
   הוא מוגן ישירות כאן: פריסה מקומית, ללא import מתחרה וללא הסתרת overflow. */
const page7CssPath = 'styles/pages/עמוד-640.css';
if (!exists(page7CssPath)) {
  fail('חסר CSS ייעודי לעמוד 7.');
} else {
  const page7css = read(page7CssPath);
  const requiredPage7 = [
    '@import url("../topics/pythagoras-foundations.css");',
    '.page-640 .question-block',
    'grid-template-rows: 40px 174px 242px 166px minmax(184px, 1fr);',
    '.page-640 .match-board',
    '.page-640 .mixed-grid',
    '.page-640 .error-grid',
    '.page-640 .final-grid',
    '.page-640 .final-observation',
  ];
  const missing = requiredPage7.filter((token) => !page7css.includes(token));
  if (missing.length) fail(`עמוד 7: פריסת ההגנה חסרה רכיבים: ${missing.join(', ')}`);
  else pass('עמוד 7: פריסת ה-A4 המקומית והמפורשת קיימת.');

  const forbiddenPage7 = ['pythagoras-power-practice.css', 'overflow: hidden', '@media (max-width:', '.power-sentence-grid', '.sentence-open-card'];
  const found = forbiddenPage7.filter((token) => page7css.includes(token));
  if (found.length) fail(`עמוד 7: חזרה תלות/פתרון שגרמו לרגרסיה: ${found.join(', ')}`);
  else pass('עמוד 7: אין שכבת power-practice מתחרה, overflow מוסתר או reflow מקומי.');
}

/* עמוד 8 מנצל את כל ה-A4 בפריסה מקומית, כדי שלא יחזור לחצי דף לבן
   וכדי ששכבת power-practice לא תשנה שוב את הגבהים. */
const page8CssPath = 'styles/pages/עמוד-641.css';
if (!exists(page8CssPath)) {
  fail('חסר CSS ייעודי לעמוד 8.');
} else {
  const page8css = read(page8CssPath);
  const requiredPage8 = [
    '@import url("../topics/pythagoras-foundations.css");',
    '.page-641 .question-block',
    'grid-template-rows: 42px 190px 178px 176px minmax(238px, 1fr);',
    '.page-641 .direct-root-grid',
    '.page-641 .reverse-root-grid',
    '.page-641 .perfect-square-grid',
    '.page-641 .bridge-grid',
    '.page-641 .error-strip',
  ];
  const missing = requiredPage8.filter((token) => !page8css.includes(token));
  if (missing.length) fail(`עמוד 8: פריסת ההגנה חסרה רכיבים: ${missing.join(', ')}`);
  else pass('עמוד 8: פריסת A4 מלאה ומקומית קיימת.');

  const forbiddenPage8 = ['pythagoras-power-practice.css', 'overflow: hidden', '@media (max-width:', '.root-results-grid', '.missing-root-grid'];
  const found = forbiddenPage8.filter((token) => page8css.includes(token));
  if (found.length) fail(`עמוד 8: חזרה תלות/מבנה ישן: ${found.join(', ')}`);
  else pass('עמוד 8: אין power-practice, overflow מוסתר, reflow מקומי או רשתות התרגול הישנות.');
}

if (!exists('index.html')) {
  fail('חסר index.html.');
} else {
  const html = read('index.html');
  const workbookPos = html.indexOf('styles/pythagoras-workbook.css');
  const lockPos = html.indexOf('styles/workbook-canonical-locks.css');
  const scriptPos = html.indexOf('pythagoras-workbook.js');
  if (workbookPos >= 0 && lockPos > workbookPos && scriptPos > lockPos) pass('index.html טוען נעילות אחרי CSS החוברת ולפני ה-loader.');
  else fail('index.html: סדר הטעינה אינו מבטיח שנעילות קנוניות ינצחו את שאר ה-CSS.');
}
if (exists('pythagoras-workbook.html')) fail('קיים entrypoint HTML כפול.');
else pass('יש entrypoint HTML יחיד בלבד.');

if (exists('pythagoras-workbook.js')) {
  const js = read('pythagoras-workbook.js');
  if (js.includes('workbookCss.before(link)')) pass('CSS דינמי של דפים נטען לפני שכבות החוברת והנעילות.');
  else fail('מיקום CSS הדפים השתנה; קיים סיכון ש-CSS של דף יעקוף את שכבת הנעילות.');
  if (js.includes("cache: 'no-store'") && js.includes('String(Date.now())')) pass('טעינת הדפים משתמשת בגרסה טרייה בכל פתיחה.');
  else fail('טעינת הדפים אינה מבטיחה גרסה טרייה.');
}

const sensitive = new Set([
  'header-container', 'page-title', 'page-number', 'question-block', 'q-main', 'q-sub',
]);
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

const topicDir = path.join(root, 'styles/topics');
if (fs.existsSync(topicDir)) {
  for (const file of fs.readdirSync(topicDir).filter((name) => name.endsWith('.css'))) {
    const rel = `styles/topics/${file}`;
    for (const selector of selectorHeaders(read(rel))) {
      const touched = [...sensitive].filter((name) => selector.includes(`.${name}`));
      if (!touched.length) continue;
      const firstClass = selector.match(/^\.([\w-]+)/u)?.[1] || null;
      const explicitlyScoped = firstClass && !touched.includes(firstClass);
      if (!explicitlyScoped) fail(`${rel}: selector מבני רגיש אינו תחום למשפחה מפורשת: ${selector}`);
    }
  }
  if (!errors.some((m) => m.includes('styles/topics/'))) pass('כל selectors המבניים הרגישים ב-styles/topics תחומים למשפחה מפורשת.');
}

console.log('\n=== Workbook Visual Guard ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
