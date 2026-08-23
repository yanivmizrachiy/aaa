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

function rightLegSquares(points) {
  if (!points) return null;
  for (let i = 0; i < 3; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % 3];
    const c = points[(i + 2) % 3];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    if (Math.abs((ux * vx) + (uy * vy)) < 1e-9) return [(ux * ux) + (uy * uy), (vx * vx) + (vy * vy)];
  }
  return null;
}

function segment(html, startToken, endToken) {
  const start = html.indexOf(startToken);
  const end = html.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0) return '';
  return html.slice(start, end);
}

function pathDsBetween(html, startToken, endToken) {
  return [...segment(html, startToken, endToken).matchAll(/<path[^>]*\sd="([^"]+)"[^>]*>/g)].map((m) => m[1]);
}

function edgePathDsBetween(html, startToken, endToken) {
  return [...segment(html, startToken, endToken).matchAll(/<path[^>]*class="edge"[^>]*\sd="([^"]+)"[^>]*>/g)].map((m) => m[1]);
}

const truth = read('SOURCE_OF_TRUTH.md');
const p1 = read('עמוד-634.html');
const p1css = read('styles/pages/עמוד-634.css');
const p2 = read('עמוד-635.html');
const p2css = read('styles/pages/עמוד-635.css');
const p3 = read('עמוד-636.html');
const p3css = read('styles/pages/עמוד-636.css');
const p4 = read('עמוד-637.html');
const p4css = read('styles/pages/עמוד-637.css');
const p5 = read('עמוד-638.html');
const p5css = read('styles/pages/עמוד-638.css');

requireTokens('SOURCE_OF_TRUTH', truth, [
  '## עמוד 1 — מושגים בסיסיים',
  '## עמוד 2 — משולש ישר־זווית',
  '## עמוד 3 — הניצבים',
  '## עמוד 4 — היתר',
  '## עמוד 5 — ניצבים ויתר: מיישמים',
  'AAA Exact A4 Preview',
  'index.html` הוא **נקודת הכניסה היחידה**',
]);

/* עמוד 1 */
requireTokens('עמוד 1', p1, [
  '<h1 class="page-title">מושגים בסיסיים</h1>',
  'foundation-note-one-line',
  'ציירו מרובע שיש בו <strong>בדיוק שתי זוויות ישרות</strong>',
  'class="final-build-area"',
]);
forbidTokens('עמוד 1', p1, ['final-rectangle-svg', 'במלבן שלפניכם', 'שני ישרים נחתכים. אחת מארבע הזוויות']);
requireTokens('CSS עמוד 1', p1css, ['.page-634 .final-build-area', 'background: transparent;']);

/* עמוד 2 */
requireTokens('עמוד 2', p2, [
  '<h1 class="page-title">משפט פיתגורס – משולש ישר־זווית</h1>',
  'סמנו רק את המשולשים ישרי־הזווית',
  'איזה מהמשולשים <strong>אינו</strong>',
  'השלימו: שתי הצלעות שנפגשות בזווית הישרה הן',
]);
const identifyTriangles = pathDsBetween(p2, 'triangle-choice-grid', 'mc-triangle-section').map(parseTrianglePath).filter(Boolean);
if (identifyTriangles.length === 6 && identifyTriangles.filter(isRightTriangle).length === 3) pass('עמוד 2: 3 מתוך 6 משולשי הזיהוי ישרי־זווית.');
else fail('עמוד 2: מבנה משולשי הזיהוי השתנה.');
if (count(p2, 'class="construction-card"') === 2) pass('עמוד 2: שתי משימות בנייה.'); else fail('עמוד 2: חייבות להיות שתי משימות בנייה.');
requireTokens('CSS עמוד 2', p2css, ['.page-635 .construction-task', '.page-635 .hunt-total']);

/* עמוד 3 */
requireTokens('עמוד 3', p3, [
  '<h1 class="page-title">משפט פיתגורס – הניצבים</h1>',
  'שתי הצלעות היוצרות את הזווית הישרה נקראות',
  'הניצב הארוך הוא', 'הניצב הקצר הוא', 'שני הניצבים השווים הם',
  'ציירו בכל מסגרת משולש ישר־זווית לפי הנתון.',
]);
forbidTokens('עמוד 3', p3, ['היתר', 'class="quick-fill-item"', 'class="vertex-task"']);
for (const [className, expected] of [['leg-card', 4], ['construction-task', 2], ['build-canvas', 2], ['partner-leg-task', 3]]) {
  const actual = count(p3, `class="${className}"`);
  if (actual === expected) pass(`עמוד 3: ${className} = ${expected}.`); else fail(`עמוד 3: ${className} צריך להיות ${expected}, נמצא ${actual}.`);
}
const page3Legs = edgePathDsBetween(p3, 'legs-grid', 'vertex-section').map(parseTrianglePath).filter(Boolean);
if (page3Legs.length === 4 && page3Legs.every(isRightTriangle)) pass('עמוד 3: ארבעת משולשי הפתיחה ישרי־זווית.'); else fail('עמוד 3: משולשי הפתיחה אינם מדויקים.');
const page3LegSquares = page3Legs.map(rightLegSquares);
if (page3LegSquares[2] && Math.abs(page3LegSquares[2][0] - page3LegSquares[2][1]) < 1e-9) pass('עמוד 3: מקרה ניצבים שווים מדויק.'); else fail('עמוד 3: מקרה ניצבים שווים אינו מדויק.');
requireTokens('CSS עמוד 3', p3css, ['.page-636 .construction-task', '.page-636 .partner-leg-task', 'shape-rendering: geometricPrecision;']);

/* עמוד 4 — היתר: אין סדרות של אותו סעיף */
requireTokens('עמוד 4', p4, [
  '<h1 class="page-title">משפט פיתגורס – היתר</h1>',
  'class="hyp-summary"',
  'שלושה שרטוטים, שלושה כיוונים.',
  'שני הרמזים',
  'האלכסון <span dir="ltr">AC</span> מחלק את המלבן לשני משולשים ישרי־זווית.',
  'ללא חישוב פיתגורס:',
  'נסמן את שני הניצבים ב־<span dir="ltr">a, b</span> ואת היתר ב־<span dir="ltr">c</span>.',
  'class="hyp-clue-grid"',
  'class="rectangle-work"',
  'class="number-reasoning-grid"',
  'class="symbol-row"',
]);
forbidTokens('עמוד 4', p4, [
  'באותו משולש ABC הזווית הישרה משנה מקום.',
  'בכל שרטוט הודגשה צלע. סמנו אם הודגש היתר',
  'בכל משולש ישר־זווית נתונים שלושה אורכי צלעות. הקיפו את האורך שיכול להיות היתר.',
  'סמנו בדיוק שני משפטים שתמיד נכונים במשולש ישר־זווית.',
  'class="switch-card"',
  'class="error-card"',
  'class="number-card"',
  'class="hyp-statement"',
]);
if (count(p4, 'class="hyp-card"') === 3) pass('עמוד 4: זיהוי ישיר מוגבל לשלושה שרטוטים.'); else fail('עמוד 4: צריכים להיות בדיוק 3 שרטוטי זיהוי ישיר.');
if (count(p4, 'class="clue-card') === 6) pass('עמוד 4: שישה רמזים למיון.'); else fail('עמוד 4: צריכים להיות 6 רמזים למיון.');
if (count(p4, 'class="reasoning-card"') === 4) pass('עמוד 4: ארבע טענות בהסקה המספרית.'); else fail('עמוד 4: צריכים להיות 4 כרטיסי הסקה מספרית.');
const page4VisualTriangles = edgePathDsBetween(p4, 'hyp-visual-grid', 'hyp-clue-task').map(parseTrianglePath).filter(Boolean);
if (page4VisualTriangles.length === 3 && page4VisualTriangles.every(isRightTriangle)) pass('עמוד 4: שלושת משולשי הזיהוי מדויקים.'); else fail('עמוד 4: משולשי הזיהוי אינם מדויקים.');
requireTokens('CSS עמוד 4', p4css, [
  '.page-637 .question-block > *',
  '.page-637 .hyp-visual-grid',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.page-637 .hyp-clue-grid',
  '.page-637 .rectangle-work',
  '.page-637 .number-reasoning-grid',
  '.page-637 .hyp-symbol-task',
  'shape-rendering: geometricPrecision;',
]);
forbidTokens('CSS עמוד 4', p4css, ['.page-637 .hyp-switch-grid', '.page-637 .hyp-error-grid', '.page-637 .hyp-number-grid', '.page-637 .hyp-statements', '@media (max-width:']);
if (!fs.existsSync(path.join(root, 'assets/pythagoras/vector/page-04.svg'))) pass('עמוד 4: נכס SVG היסטורי לא חזר.'); else fail('עמוד 4: נכס SVG היסטורי חזר.');

/* עמוד 5 — שילוב בלי כפילות */
requireTokens('עמוד 5', p5, [
  '<h1 class="page-title">משפט פיתגורס – ניצבים ויתר: מיישמים</h1>',
  'class="page5-summary"',
  'היתר כבר מודגש',
  'תמר כתבה:',
  'עכשיו בנו בעצמכם.',
]);
forbidTokens('עמוד 5', p5, ['class="triangle-card"', 'class="length-card"', 'class="claim-check"', 'class="concept-half"']);
for (const [className, expected] of [['inverse-card', 4], ['logic-card', 3], ['construction-card', 2], ['page5-error-task', 1]]) {
  const actual = count(p5, `class="${className}"`);
  if (actual === expected) pass(`עמוד 5: ${className} = ${expected}.`); else fail(`עמוד 5: ${className} צריך להיות ${expected}, נמצא ${actual}.`);
}
const page5InverseTriangles = edgePathDsBetween(p5, 'inverse-hyp-grid', 'page5-error-task').map(parseTrianglePath).filter(Boolean);
if (page5InverseTriangles.length === 4 && page5InverseTriangles.every(isRightTriangle)) pass('עמוד 5: ארבעת משולשי ההסקה ההפוכה ישרי־זווית מדויקים.'); else fail('עמוד 5: משולשי ההסקה ההפוכה אינם מדויקים.');
requireTokens('CSS עמוד 5', p5css, ['.page-638 .inverse-hyp-grid', '.page-638 .page5-error-task', '.page-638 .logic-grid', '.page-638 .construction-grid', 'shape-rendering: geometricPrecision;']);
forbidTokens('CSS עמוד 5', p5css, ['.page-638 .page5-concept-line', '.page-638 .length-cards', '.page-638 .claim-check', '@media (max-width: 760px)']);

console.log('\n=== Approved Content Contracts ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
