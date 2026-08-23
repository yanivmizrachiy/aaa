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
if (!exists(lockPath)) fail('חסר styles/workbook-canonical-locks.css.');
else {
  const css = read(lockPath);
  const required = {
    1: ['.page-634 > .header-container','.header-container > .page-title','.header-container > .page-number','.page-634 .foundation-note-one-line','.page-634 .final-build-task','.page-634 .final-build-area','border: 0 !important','!important'],
    2: ['.page-635 .question-block','.page-635 .triangle-choice-grid','repeat(6, minmax(0, 1fr))','.page-635 .mc-triangle-grid','repeat(5, minmax(0, 1fr))','.page-635 .construction-task','.page-635 .construction-grid','.page-635 .hunt-section'],
    3: ['.page-636 .question-block','.page-636 .legs-grid','repeat(4, minmax(0, 1fr))','.page-636 .vertex-grid','repeat(2, minmax(0, 1fr))','.page-636 .quick-fill-grid','repeat(3, minmax(0, 1fr))','.page-636 .legs-mcq'],
  };
  for (const [page, tokens] of Object.entries(required)) {
    const missing = tokens.filter((t) => !css.includes(t));
    missing.length ? fail(`נעילת עמוד ${page} חסרה: ${missing.join(', ')}`) : pass(`נעילת עמוד ${page} מלאה.`);
  }
}

function guardPage(page, cssPath, required, forbidden = []) {
  if (!exists(cssPath)) { fail(`עמוד ${page}: חסר ${cssPath}.`); return; }
  const css = read(cssPath);
  const missing = required.filter((t) => !css.includes(t));
  const found = forbidden.filter((t) => css.includes(t));
  if (missing.length) fail(`עמוד ${page}: חסרים רכיבי פריסה: ${missing.join(', ')}`);
  else pass(`עמוד ${page}: רכיבי הפריסה הקנוניים קיימים.`);
  if (found.length) fail(`עמוד ${page}: חזרו רכיבים אסורים: ${found.join(', ')}`);
  else pass(`עמוד ${page}: אין רכיבי רגרסיה ידועים.`);
}

guardPage(7, 'styles/pages/עמוד-640.css', [
  '@import url("../topics/pythagoras-foundations.css");',
  '.page-640 .question-block',
  'grid-template-rows: 40px 174px 242px 166px minmax(184px, 1fr)',
  '.page-640 .match-board', '.page-640 .mixed-grid', '.page-640 .error-grid', '.page-640 .final-grid',
  '.page-640 .mixed-card:nth-child(1)', 'flex-direction: column;'
], ['pythagoras-power-practice.css','overflow: hidden','@media (max-width:','.power-sentence-grid','.sentence-open-card']);

guardPage(8, 'styles/pages/עמוד-641.css', [
  '@import url("../topics/pythagoras-foundations.css");',
  '.page-641 .question-block',
  'grid-template-rows: 42px 190px 178px 176px minmax(238px, 1fr)',
  '.page-641 .direct-root-grid', '.page-641 .reverse-root-grid', '.page-641 .perfect-square-grid', '.page-641 .bridge-grid',
  '.page-641 .root-card { flex-direction:column;', '.root-card:nth-child(-n+4) .root-fill'
], ['pythagoras-power-practice.css','overflow: hidden','@media (max-width:','.root-results-grid','.missing-root-grid']);

guardPage(9, 'styles/pages/עמוד-651.css', [
  '.page-651 .question-block', '.page-651 .solution-meaning-strip', '.page-651 .negative-root-rule',
  '.page-651 .case-grid', '.page-651 .equation-case-grid', '.page-651 .root-practice-grid',
  '.page-651 .root-practice-card { display:flex; flex-direction:column;'
], ['pythagoras-power-practice.css','@media (max-width:','.reverse-solution-grid','.build-equation-card']);

guardPage(10, 'styles/pages/עמוד-642.css', [
  '.page-642 .question-block', '.page-642 .bounds-grid', '.page-642 .calculator-grid', '.page-642 .reasonableness-grid', '.page-642 .error-grid', '.page-642 .build-root-card',
  '.page-642 .calculator-card { display:flex; flex-direction:column;'
], ['pythagoras-power-practice.css','@media (max-width:','.approximation-grid']);

guardPage(11, 'styles/pages/עמוד-652.css', [
  '.page-652 .page11-top-band',
  'grid-template-columns: minmax(210px, .9fr) minmax(0, 2.1fr)',
  '.page-652 .top-guided-practice', '.page-652 .direct-solution-scaffold', '.page-652 .build-solution-scaffold'
], ['@media (max-width:','.approx-pair']);

guardPage(12, 'styles/pages/עמוד-643.css', [
  '.page-643 .square-task-grid', 'grid-template-columns:repeat(2,minmax(0,1fr))',
  '.page-643 .math-work { min-height:64px; display:grid;',
  '.page-643 .answer-fit-one-digit { width:34px; }', '.page-643 .answer-fit-two-digit { width:46px; }', '.page-643 .answer-fit-symbol-square { width:50px; }'
], ['pythagoras-power-practice.css','@media (max-width:']);

guardPage(13, 'styles/pages/עמוד-644.css', [
  '.page-644 .question-block', 'grid-template-rows: 285px 225px 245px minmax(230px, 1fr)',
  '.page-644 .result-below-card', '.page-644 .relation-workbench', '.page-644 .reverse-workbench', '.page-644 .generalize-workbench'
], ['@media (max-width:']);

if (!exists('index.html')) fail('חסר index.html.');
else {
  const html = read('index.html');
  const workbookPos = html.indexOf('styles/pythagoras-workbook.css');
  const lockPos = html.indexOf('styles/workbook-canonical-locks.css');
  const scriptPos = html.indexOf('pythagoras-workbook.js');
  (workbookPos >= 0 && lockPos > workbookPos && scriptPos > lockPos) ? pass('index.html טוען נעילות בסדר הנכון.') : fail('סדר הטעינה ב-index.html אינו בטוח.');
}
exists('pythagoras-workbook.html') ? fail('קיים entrypoint HTML כפול.') : pass('יש entrypoint HTML יחיד בלבד.');

if (exists('pythagoras-workbook.js')) {
  const js = read('pythagoras-workbook.js');
  js.includes('workbookCss.before(link)') ? pass('CSS דינמי נטען לפני שכבות החוברת.') : fail('מיקום CSS דינמי מסוכן.');
  (js.includes("cache: 'no-store'") && js.includes('String(Date.now())')) ? pass('טעינת הדפים טרייה בכל פתיחה.') : fail('טעינת הדפים אינה מבטיחה freshness.');
}

const sensitive = new Set(['header-container','page-title','page-number','question-block','q-main','q-sub']);
function selectorHeaders(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const headers = [];
  const re = /([^{}]+)\{/g;
  let match;
  while ((match = re.exec(clean))) {
    const header = match[1].trim();
    if (!header || header.startsWith('@') || /^(from|to|\d+(?:\.\d+)?%)$/u.test(header)) continue;
    headers.push(...header.split(',').map((x) => x.trim()).filter(Boolean));
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
      if (!(firstClass && !touched.includes(firstClass))) fail(`${rel}: selector רגיש אינו תחום למשפחה: ${selector}`);
    }
  }
  if (!errors.some((m) => m.includes('styles/topics/'))) pass('selectors רגישים ב-styles/topics תחומים למשפחה.');
}

console.log('\n=== Workbook Visual Guard ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
