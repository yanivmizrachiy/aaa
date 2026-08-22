const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const errors = [];
const ok = [];
const pass = (m) => ok.push(m);
const fail = (m) => errors.push(m);
const count = (text, token) => text.split(token).length - 1;

function requireTokens(label, text, tokens) {
  const missing = tokens.filter((token) => !text.includes(token));
  if (missing.length) fail(`${label}: חסרים רכיבים מאושרים: ${missing.join(' | ')}`);
  else pass(`${label}: כל הרכיבים המאושרים קיימים.`);
}

function forbidTokens(label, text, tokens) {
  const found = tokens.filter((token) => text.includes(token));
  if (found.length) fail(`${label}: חזרו רכיבים שנאסרו: ${found.join(' | ')}`);
  else pass(`${label}: לא חזרו רכיבים ישנים/אסורים.`);
}

function parseTrianglePath(d) {
  const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (nums.length < 6) return null;
  return [[nums[0], nums[1]], [nums[2], nums[3]], [nums[4], nums[5]]];
}

function isRightTriangle(points) {
  if (!points) return false;
  for (let i = 0; i < 3; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % 3];
    const c = points[(i + 2) % 3];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    if (Math.abs((ux * vx) + (uy * vy)) < 1e-9) return true;
  }
  return false;
}

function pathDsBetween(html, startToken, endToken) {
  const start = html.indexOf(startToken);
  const end = html.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0) return [];
  const segment = html.slice(start, end);
  return [...segment.matchAll(/<path[^>]*\sd="([^"]+)"[^>]*>/g)].map((m) => m[1]);
}

const truth = read('SOURCE_OF_TRUTH.md');
const p1 = read('עמוד-634.html');
const p1css = read('styles/pages/עמוד-634.css');
const p2 = read('עמוד-635.html');
const p2css = read('styles/pages/עמוד-635.css');
const p3 = read('עמוד-636.html');
const p3css = read('styles/pages/עמוד-636.css');

requireTokens('SOURCE_OF_TRUTH', truth, [
  '## עמוד 1 — מושגים בסיסיים',
  '## עמוד 2 — משולש ישר־זווית',
  '## עמוד 3 — הניצבים',
  'index.html` הוא **נקודת הכניסה היחידה**',
  'cache-busting אוטומטי',
  'תיבה בתוך תיבה',
]);

/* עמוד 1 */
requireTokens('עמוד 1', p1, [
  '<h1 class="page-title">מושגים בסיסיים</h1>',
  'foundation-note-one-line',
  'ציירו מרובע שיש בו <strong>בדיוק שתי זוויות ישרות</strong>, וסמנו את שתי הזוויות הישרות.',
  'class="final-build-area"',
]);
forbidTokens('עמוד 1', p1, [
  'final-rectangle-svg',
  'במלבן שלפניכם',
  'שני ישרים נחתכים. אחת מארבע הזוויות',
]);
requireTokens('CSS עמוד 1', p1css, [
  '.page-634 .final-build-area',
  'border: 0;',
  'background: transparent;',
]);

/* עמוד 2 */
requireTokens('עמוד 2', p2, [
  '<h1 class="page-title">משפט פיתגורס – משולש ישר־זווית</h1>',
  'סמנו רק את המשולשים ישרי־הזווית, וסמנו את הזווית הישרה בכל אחד מהם.',
  'איזה מהמשולשים <strong>אינו</strong> משולש ישר־זווית? סמנו תשובה אחת.',
  'השלימו: שתי הצלעות שנפגשות בזווית הישרה הן',
  'סמנו בציור משולש ישר־זווית גדול אחד שנוצר מכמה משולשים קטנים, וסמנו בו את הזווית הישרה בריבוע קטן.',
]);
forbidTokens('עמוד 2', p2, [
  'מה הקשר בין שתי הצלעות שנפגשות בזווית הישרה?',
  'הסבירו כיצד ידעתם',
  'hunt-write-lines',
  'אזורים',
]);

const identifyPaths = pathDsBetween(p2, 'triangle-choice-grid', 'mc-triangle-section');
const identifyTriangles = identifyPaths.map(parseTrianglePath).filter(Boolean);
const identifyRight = identifyTriangles.filter(isRightTriangle).length;
if (identifyTriangles.length === 6 && identifyRight === 3) pass('עמוד 2: ששת משולשי הזיהוי הם בדיוק 3 ישרי־זווית ו־3 שאינם.');
else fail(`עמוד 2: משולשי הזיהוי אינם בחוזה המאושר (סה״כ ${identifyTriangles.length}, ישרי־זווית ${identifyRight}).`);

const mcPaths = pathDsBetween(p2, 'mc-triangle-grid', '</section>');
const mcTriangles = mcPaths.map(parseTrianglePath).filter(Boolean);
const mcRight = mcTriangles.filter(isRightTriangle).length;
if (mcTriangles.length === 5 && mcRight === 4) pass('עמוד 2: השאלה האמריקאית כוללת 4 ישרי־זווית ואחד שאינו.');
else fail(`עמוד 2: אפשרויות השאלה האמריקאית אינן בחוזה המאושר (סה״כ ${mcTriangles.length}, ישרי־זווית ${mcRight}).`);

if (count(p2, 'class="construction-card"') === 2) pass('עמוד 2: משימת AB כוללת בדיוק שתי מסגרות שרטוט.');
else fail('עמוד 2: משימת AB אינה כוללת בדיוק שתי מסגרות שרטוט.');
requireTokens('CSS עמוד 2', p2css, [
  '.page-635 .construction-task',
  '.page-635 .hunt-total',
  '.page-635 .hunt-count-fill',
  'grid-template-rows: auto minmax(0, 1fr) 28px 34px;',
]);

/* עמוד 3 */
requireTokens('עמוד 3', p3, [
  '<h1 class="page-title">משפט פיתגורס – הניצבים</h1>',
  'שתי הצלעות היוצרות את הזווית הישרה נקראות',
  'הן הניצבים.',
  'קודקוד הזווית הישרה:',
  'איזה זוג צלעות הוא זוג הניצבים?',
]);
forbidTokens('עמוד 3', p3, ['היתר']);
const page3Counts = [
  ['leg-card', 4],
  ['vertex-task', 2],
  ['quick-fill-item', 3],
  ['mcq-choice', 4],
];
for (const [className, expected] of page3Counts) {
  const actual = count(p3, `class="${className}"`);
  if (actual === expected) pass(`עמוד 3: ${className} = ${expected}.`);
  else fail(`עמוד 3: ${className} צריך להיות ${expected}, נמצא ${actual}.`);
}
requireTokens('CSS עמוד 3', p3css, [
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  'shape-rendering: geometricPrecision;',
]);

console.log('\n=== Approved Content Contracts ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
