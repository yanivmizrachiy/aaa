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
forbidTokens('עמוד 1', p1, ['final-rectangle-svg', 'במלבן שלפניכם', 'שני ישרים נחתכים. אחת מארבע הזוויות']);
requireTokens('CSS עמוד 1', p1css, ['.page-634 .final-build-area', 'border: 0;', 'background: transparent;']);

/* עמוד 2 */
requireTokens('עמוד 2', p2, [
  '<h1 class="page-title">משפט פיתגורס – משולש ישר־זווית</h1>',
  'סמנו רק את המשולשים ישרי־הזווית, וסמנו את הזווית הישרה בכל אחד מהם.',
  'איזה מהמשולשים <strong>אינו</strong> משולש ישר־זווית? סמנו תשובה אחת.',
  'השלימו: שתי הצלעות שנפגשות בזווית הישרה הן',
  'סמנו בציור משולש ישר־זווית גדול אחד שנוצר מכמה משולשים קטנים, וסמנו בו את הזווית הישרה בריבוע קטן.',
]);
forbidTokens('עמוד 2', p2, ['מה הקשר בין שתי הצלעות שנפגשות בזווית הישרה?', 'הסבירו כיצד ידעתם', 'hunt-write-lines', 'אזורים']);
const identifyTriangles = pathDsBetween(p2, 'triangle-choice-grid', 'mc-triangle-section').map(parseTrianglePath).filter(Boolean);
if (identifyTriangles.length === 6 && identifyTriangles.filter(isRightTriangle).length === 3) pass('עמוד 2: 3 מתוך 6 משולשי הזיהוי ישרי־זווית.');
else fail('עמוד 2: מבנה משולשי הזיהוי השתנה.');
const mcTriangles = pathDsBetween(p2, 'mc-triangle-grid', '</section>').map(parseTrianglePath).filter(Boolean);
if (mcTriangles.length === 5 && mcTriangles.filter(isRightTriangle).length === 4) pass('עמוד 2: השאלה האמריקאית נשארה 4 ישרי־זווית ואחד שאינו.');
else fail('עמוד 2: מבנה השאלה האמריקאית השתנה.');
if (count(p2, 'class="construction-card"') === 2) pass('עמוד 2: שתי משימות בנייה.'); else fail('עמוד 2: חייבות להיות שתי משימות בנייה.');
requireTokens('CSS עמוד 2', p2css, ['.page-635 .construction-task', '.page-635 .hunt-total', '.page-635 .hunt-count-fill', 'grid-template-rows: auto minmax(0, 1fr) 28px 34px;']);

/* עמוד 3 */
requireTokens('עמוד 3', p3, [
  '<h1 class="page-title">משפט פיתגורס – הניצבים</h1>',
  'שתי הצלעות היוצרות את הזווית הישרה נקראות',
  'הניצב הארוך הוא', 'הניצב הקצר הוא', 'שני הניצבים השווים הם',
  'ציירו בכל מסגרת משולש ישר־זווית לפי הנתון.',
  'בכל משולש מודגש ניצב אחד. הדגישו גם את הניצב השני.',
  'איזה זוג צלעות הוא זוג הניצבים?',
]);
forbidTokens('עמוד 3', p3, ['היתר', 'class="quick-fill-item"', 'class="vertex-task"', 'הניצב הארוך יותר:', 'הניצב הקצר יותר:']);
for (const [className, expected] of [['leg-card', 4], ['construction-task', 2], ['build-canvas', 2], ['partner-leg-task', 3], ['mcq-choice', 4]]) {
  const actual = count(p3, `class="${className}"`);
  if (actual === expected) pass(`עמוד 3: ${className} = ${expected}.`); else fail(`עמוד 3: ${className} צריך להיות ${expected}, נמצא ${actual}.`);
}
if (count(p3, 'class="given-leg"') === 3) pass('עמוד 3: שלושה ניצבים נתונים.'); else fail('עמוד 3: נדרשים שלושה ניצבים נתונים.');
if (count(p3, 'הניצב הארוך הוא') === 1 && count(p3, 'הניצב הקצר הוא') === 1) pass('עמוד 3: הארוך/הקצר מופיע פעם אחת בלבד.'); else fail('עמוד 3: הארוך/הקצר חזר יותר מפעם אחת.');
const page3Legs = edgePathDsBetween(p3, 'legs-grid', 'vertex-section').map(parseTrianglePath).filter(Boolean);
if (page3Legs.length === 4 && page3Legs.every(isRightTriangle)) pass('עמוד 3: ארבעת משולשי הפתיחה ישרי־זווית.'); else fail('עמוד 3: משולשי הפתיחה אינם מדויקים.');
const page3LegSquares = page3Legs.map(rightLegSquares);
if (page3LegSquares[2] && Math.abs(page3LegSquares[2][0] - page3LegSquares[2][1]) < 1e-9) pass('עמוד 3: מקרה ניצבים שווים מדויק.'); else fail('עמוד 3: מקרה ניצבים שווים אינו מדויק.');
requireTokens('CSS עמוד 3', p3css, ['grid-template-columns: repeat(4, minmax(0, 1fr));', 'grid-template-columns: repeat(2, minmax(0, 1fr));', 'grid-template-columns: repeat(3, minmax(0, 1fr));', '.page-636 .construction-task', '.page-636 .build-canvas', '.page-636 .partner-leg-task', 'shape-rendering: geometricPrecision;']);

/* עמוד 4 */
requireTokens('עמוד 4', p4, [
  '<h1 class="page-title">משפט פיתגורס – היתר</h1>', 'class="hyp-summary"',
  'היתר נמצא מול הזווית הישרה', 'היתר הוא הצלע הארוכה ביותר במשולש ישר־זווית',
  'כתבו מתחת לכל משולש את שם היתר.', 'באותו משולש ABC הזווית הישרה משנה מקום.',
  'בכל שרטוט הודגשה צלע. סמנו אם הודגש היתר; אם לא, כתבו את שם היתר הנכון.',
  'הקיפו את האורך שיכול להיות היתר.', 'סמנו בדיוק שני משפטים שתמיד נכונים במשולש ישר־זווית.',
]);
forbidTokens('עמוד 4', p4, ['<h1 class="page-title">מושגים בסיסיים</h1>', 'class="foundation-note hyp-concept"', 'foundation-fill hyp-fill-short', 'hyp-poster']);
for (const [className, expected] of [['hyp-card', 4], ['switch-card', 3], ['error-card', 3], ['number-card', 4], ['hyp-statement', 4]]) {
  const actual = count(p4, `class="${className}"`);
  if (actual === expected) pass(`עמוד 4: ${className} = ${expected}.`); else fail(`עמוד 4: ${className} צריך להיות ${expected}, נמצא ${actual}.`);
}
const page4VisualTriangles = edgePathDsBetween(p4, 'hyp-visual-grid', 'hyp-switch-task').map(parseTrianglePath).filter(Boolean);
if (page4VisualTriangles.length === 4 && page4VisualTriangles.every(isRightTriangle)) pass('עמוד 4: ארבעת משולשי הזיהוי מדויקים.'); else fail('עמוד 4: משולשי הזיהוי אינם מדויקים.');
const page4ErrorTriangles = edgePathDsBetween(p4, 'hyp-error-grid', 'hyp-number-task').map(parseTrianglePath).filter(Boolean);
if (page4ErrorTriangles.length === 3 && page4ErrorTriangles.every(isRightTriangle)) pass('עמוד 4: שלושת משולשי בדיקת הטעות מדויקים.'); else fail('עמוד 4: משולשי בדיקת הטעות אינם מדויקים.');
requireTokens('CSS עמוד 4', p4css, ['.page-637 .question-block', '.page-637 .hyp-summary', '.page-637 .hyp-visual-grid', '.page-637 .hyp-switch-grid', '.page-637 .hyp-error-grid', '.page-637 .hyp-number-grid', '.page-637 .hyp-statements', 'shape-rendering: geometricPrecision;']);
if (!fs.existsSync(path.join(root, 'assets/pythagoras/vector/page-04.svg'))) pass('עמוד 4: נכס SVG היסטורי לא חזר.'); else fail('עמוד 4: נכס SVG היסטורי חזר.');

/* עמוד 5 — שילוב בלי כפילות */
requireTokens('עמוד 5', p5, [
  '<h1 class="page-title">משפט פיתגורס – ניצבים ויתר: מיישמים</h1>',
  'class="page5-summary"',
  'היתר כבר מודגש',
  'סמנו את קודקוד הזווית הישרה',
  'תמר כתבה:',
  'תקנו רק את הדרוש:',
  'במשולש <span dir="ltr">ABC</span>, הצלעות <span dir="ltr">AB</span> ו־<span dir="ltr">BC</span> הן הניצבים.',
  'במשולש <span dir="ltr">PQR</span>, הצלע <span dir="ltr">PR</span> היא היתר.',
  'במשולש <span dir="ltr">XYZ</span> נתון:',
  'עכשיו בנו בעצמכם.',
  'ציירו משולש <span dir="ltr">ABC</span> שבו <span dir="ltr">AB</span> ו־<span dir="ltr">BC</span> הם הניצבים.',
  'ציירו משולש ישר־זווית שבו <span dir="ltr">PR</span> הוא היתר.',
]);
forbidTokens('עמוד 5', p5, [
  'בכל משולש כתבו את שמות שני הניצבים ואת שם היתר.',
  'היעזרו בכלל: במשולש ישר־זווית היתר הוא הצלע הארוכה ביותר.',
  'דנה טוענת:',
  'השלימו: היתר תמיד',
  'class="triangle-card"',
  'class="length-card"',
  'class="claim-check"',
  'class="concept-half"',
]);
for (const [className, expected] of [['inverse-card', 4], ['logic-card', 3], ['construction-card', 2], ['page5-error-task', 1]]) {
  const actual = count(p5, `class="${className}"`);
  if (actual === expected) pass(`עמוד 5: ${className} = ${expected}.`); else fail(`עמוד 5: ${className} צריך להיות ${expected}, נמצא ${actual}.`);
}
const page5InverseTriangles = edgePathDsBetween(p5, 'inverse-hyp-grid', 'page5-error-task').map(parseTrianglePath).filter(Boolean);
if (page5InverseTriangles.length === 4 && page5InverseTriangles.every(isRightTriangle)) pass('עמוד 5: ארבעת משולשי ההסקה ההפוכה ישרי־זווית מדויקים.');
else fail(`עמוד 5: משולשי ההסקה ההפוכה אינם מדויקים (${page5InverseTriangles.filter(isRightTriangle).length}/${page5InverseTriangles.length}).`);
requireTokens('CSS עמוד 5', p5css, [
  '.page-638 .question-block > *',
  '.page-638 .page5-summary',
  '.page-638 .inverse-hyp-grid',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '.page-638 .page5-error-task',
  '.page-638 .logic-grid',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.page-638 .construction-grid',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  'shape-rendering: geometricPrecision;',
]);
forbidTokens('CSS עמוד 5', p5css, ['.page-638 .page5-concept-line', '.page-638 .length-cards', '.page-638 .claim-check', 'margin-inline-start: auto;', '@media (max-width: 760px)']);

console.log('\n=== Approved Content Contracts ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
