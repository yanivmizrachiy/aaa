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
    if (Math.abs((ux * vx) + (uy * vy)) < 1e-9) {
      return [(ux * ux) + (uy * uy), (vx * vx) + (vy * vy)];
    }
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
  '## עמוד 5 — מושגים בסיסיים',
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
  'הניצב הארוך הוא',
  'הניצב הקצר הוא',
  'סמנו על השרטוט את הניצב הארוך וכתבו את שמו:',
  'שני הניצבים השווים הם',
  'סמנו על השרטוט את שני הניצבים.',
  'ציירו בכל מסגרת משולש ישר־זווית לפי הנתון.',
  'הניצב הארוך יהיה <strong dir="ltr">AB</strong> והניצב הקצר יהיה <strong dir="ltr">BC</strong>.',
  'הניצבים <strong dir="ltr">KL</strong> ו־<strong dir="ltr">LM</strong> יהיו שווים באורכם.',
  'קודקוד הזווית הישרה:',
  'בכל משולש מודגש ניצב אחד. הדגישו גם את הניצב השני.',
  'איזה זוג צלעות הוא זוג הניצבים?',
  'א. <span dir="ltr">AB</span> ו־<span dir="ltr">BC</span>',
]);
forbidTokens('עמוד 3', p3, [
  'היתר',
  'class="quick-fill-item"',
  'class="vertex-task"',
  'הניצב הארוך יותר:',
  'הניצב הקצר יותר:',
]);
const page3Counts = [
  ['leg-card', 4],
  ['construction-task', 2],
  ['build-canvas', 2],
  ['partner-leg-task', 3],
  ['mcq-choice', 4],
];
for (const [className, expected] of page3Counts) {
  const actual = count(p3, `class="${className}"`);
  if (actual === expected) pass(`עמוד 3: ${className} = ${expected}.`);
  else fail(`עמוד 3: ${className} צריך להיות ${expected}, נמצא ${actual}.`);
}
if (count(p3, 'class="given-leg"') === 3) pass('עמוד 3: בכל אחת משלוש משימות הניצב השני מודגש בדיוק ניצב נתון אחד.');
else fail('עמוד 3: משימת הניצב השני חייבת לכלול בדיוק שלושה ניצבים מודגשים — אחד בכל שרטוט.');

if (count(p3, 'הניצב הארוך הוא') === 1 && count(p3, 'הניצב הקצר הוא') === 1) {
  pass('עמוד 3: ניסוח הארוך/הקצר מופיע פעם אחת בלבד ואינו משוכפל בכרטיסים נוספים.');
} else {
  fail('עמוד 3: ניסוח הארוך/הקצר צריך להופיע פעם אחת בלבד כדי למנוע סעיפים זהים.');
}

const page3Legs = edgePathDsBetween(p3, 'legs-grid', 'vertex-section').map(parseTrianglePath).filter(Boolean);
if (page3Legs.length === 4 && page3Legs.every(isRightTriangle)) pass('עמוד 3: כל ארבעת משולשי הפתיחה ישרי־זווית מתמטית.');
else fail(`עמוד 3: משולשי הפתיחה אינם כולם ישרי־זווית מדויקים (${page3Legs.filter(isRightTriangle).length}/${page3Legs.length}).`);

const page3LegSquares = page3Legs.map(rightLegSquares);
if (page3LegSquares.length === 4 && page3LegSquares[2] && Math.abs(page3LegSquares[2][0] - page3LegSquares[2][1]) < 1e-9) {
  pass('עמוד 3: משולש הפתיחה השלישי כולל שני ניצבים שווים באורכם בדיוק.');
} else {
  fail('עמוד 3: המקרה של שני ניצבים שווים באורכם אינו מדויק גאומטרית.');
}
if (page3LegSquares[0] && page3LegSquares[1] && Math.abs(page3LegSquares[0][0] - page3LegSquares[0][1]) > 1e-9 && Math.abs(page3LegSquares[1][0] - page3LegSquares[1][1]) > 1e-9) {
  pass('עמוד 3: שני מקרי הארוך/הקצר משתמשים בניצבים באורכים שונים.');
} else {
  fail('עמוד 3: שני משולשי הפתיחה הראשונים חייבים להשתמש בניצבים באורכים שונים.');
}

if (count(p3, 'הניצב הארוך יהיה') === 1 && count(p3, 'הניצב הקצר יהיה') === 1 && count(p3, 'יהיו שווים באורכם') === 1) {
  pass('עמוד 3: שתי משימות הבנייה שונות — אחת ארוך/קצר ואחת עם ניצבים שווים.');
} else {
  fail('עמוד 3: משימות הבנייה צריכות להיות שונות: ארוך/קצר מול ניצבים שווים.');
}

const page3PartnerLegs = edgePathDsBetween(p3, 'quick-fill-grid', 'legs-mcq').map(parseTrianglePath).filter(Boolean);
if (page3PartnerLegs.length === 3 && page3PartnerLegs.every(isRightTriangle)) pass('עמוד 3: שלוש משימות הניצב השני משתמשות במשולשים ישרי־זווית מדויקים.');
else fail(`עמוד 3: משימות הניצב השני אינן מדויקות מתמטית (${page3PartnerLegs.filter(isRightTriangle).length}/${page3PartnerLegs.length}).`);

const page3Mcq = edgePathDsBetween(p3, 'mcq-triangle', '</svg>').map(parseTrianglePath).filter(Boolean);
if (page3Mcq.length === 1 && isRightTriangle(page3Mcq[0])) pass('עמוד 3: משולש השאלה האמריקאית ישר־זווית מדויק.');
else fail('עמוד 3: משולש השאלה האמריקאית אינו ישר־זווית מדויק.');

requireTokens('CSS עמוד 3', p3css, [
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.page-636 .construction-task',
  '.page-636 .build-canvas',
  '.page-636 .partner-leg-task',
  '.page-636 .quick-leg-svg .given-leg',
  'shape-rendering: geometricPrecision;',
]);

/* עמוד 4 */
requireTokens('עמוד 4', p4, [
  '<h1 class="page-title">משפט פיתגורס – היתר</h1>',
  'class="foundation-note hyp-concept"',
  'כתבו מתחת לכל משולש את שם היתר.',
  'באותו משולש ABC הזווית הישרה משנה מקום.',
  'בכל שרטוט הודגשה צלע. סמנו אם הודגש היתר; אם לא, כתבו את שם היתר הנכון.',
  'הקיפו את האורך שיכול להיות היתר.',
  'סמנו בדיוק שני משפטים שתמיד נכונים במשולש ישר־זווית.',
  'היתר נמצא מול הזווית הישרה.',
  'היתר הוא הצלע הארוכה ביותר.',
]);
forbidTokens('עמוד 4', p4, [
  '<h1 class="page-title">מושגים בסיסיים</h1>',
  'hyp-poster',
  'שמונה משולשים ישרי־זווית',
]);

const page4Counts = [
  ['hyp-card', 4],
  ['switch-card', 3],
  ['error-card', 3],
  ['number-card', 4],
  ['hyp-statement', 4],
];
for (const [className, expected] of page4Counts) {
  const actual = count(p4, `class="${className}"`);
  if (actual === expected) pass(`עמוד 4: ${className} = ${expected}.`);
  else fail(`עמוד 4: ${className} צריך להיות ${expected}, נמצא ${actual}.`);
}

const page4VisualTriangles = edgePathDsBetween(p4, 'hyp-visual-grid', 'hyp-switch-task').map(parseTrianglePath).filter(Boolean);
if (page4VisualTriangles.length === 4 && page4VisualTriangles.every(isRightTriangle)) pass('עמוד 4: כל ארבעת משולשי הזיהוי ישרי־זווית מדויקים מתמטית.');
else fail(`עמוד 4: משולשי הזיהוי אינם כולם ישרי־זווית מדויקים (${page4VisualTriangles.filter(isRightTriangle).length}/${page4VisualTriangles.length}).`);

const page4ErrorTriangles = edgePathDsBetween(p4, 'hyp-error-grid', 'hyp-number-task').map(parseTrianglePath).filter(Boolean);
if (page4ErrorTriangles.length === 3 && page4ErrorTriangles.every(isRightTriangle)) pass('עמוד 4: כל שלושת משולשי בדיקת הטעות ישרי־זווית מדויקים מתמטית.');
else fail(`עמוד 4: משולשי בדיקת הטעות אינם כולם ישרי־זווית מדויקים (${page4ErrorTriangles.filter(isRightTriangle).length}/${page4ErrorTriangles.length}).`);

requireTokens('CSS עמוד 4', p4css, [
  '.page-637 .question-block',
  'grid-template-rows: 42px 250px 116px 176px 96px minmax(104px, 1fr);',
  '.page-637 .hyp-visual-grid',
  '.page-637 .hyp-switch-grid',
  '.page-637 .hyp-error-grid',
  '.page-637 .hyp-number-grid',
  '.page-637 .hyp-statements',
  'shape-rendering: geometricPrecision;',
]);

if (!fs.existsSync(path.join(root, 'assets/pythagoras/vector/page-04.svg'))) pass('עמוד 4: נכס SVG היסטורי מנותק הוסר מהריפו.');
else fail('עמוד 4: assets/pythagoras/vector/page-04.svg הישן חזר ועלול להתחרות במימוש הפעיל.');

/* עמוד 5 */
requireTokens('עמוד 5', p5, [
  '<h1 class="page-title">משפט פיתגורס – מושגים בסיסיים</h1>',
  'page5-concept-line',
  'השלימו: במשולש ישר־זווית שתי הצלעות היוצרות את הזווית הישרה נקראות',
  'בכל משולש כתבו את שמות שני הניצבים ואת שם היתר.',
  'היעזרו בכלל: במשולש ישר־זווית היתר הוא הצלע הארוכה ביותר.',
  'דנה טוענת: „היתר יכול להיות שווה באורכו לאחד הניצבים.”',
  'השלימו: היתר תמיד',
]);
forbidTokens('עמוד 5', p5, [
  'התחילו תמיד מאיתור הזווית הישרה.',
  'האם היא צודקת? נמקו.',
  'reason-space',
]);

if (count(p5, 'triangle-card"') === 4) pass('עמוד 5: ארבעה כרטיסי משולשים בשורה הראשונה.');
else fail(`עמוד 5: נדרשים 4 כרטיסי משולשים, נמצאו ${count(p5, 'triangle-card"')}.`);
if (count(p5, 'class="length-card"') === 3) pass('עמוד 5: שלושה כרטיסי אורכים מגוונים.');
else fail(`עמוד 5: נדרשים 3 כרטיסי אורכים, נמצאו ${count(p5, 'class="length-card"')}.`);
if (count(p5, 'class="claim-option"') === 2) pass('עמוד 5: שתי אפשרויות סגורות נכון/לא נכון.');
else fail('עמוד 5: בדיקת הטענה חייבת לכלול בדיוק נכון/לא נכון.');

const page5Triangles = edgePathDsBetween(p5, 'page5-triangle-grid', 'length-cards').map(parseTrianglePath).filter(Boolean);
if (page5Triangles.length === 4 && page5Triangles.every(isRightTriangle)) pass('עמוד 5: כל ארבעת המשולשים ישרי־זווית מדויקים מתמטית.');
else fail(`עמוד 5: משולשי הזיהוי אינם כולם ישרי־זווית מדויקים (${page5Triangles.filter(isRightTriangle).length}/${page5Triangles.length}).`);

requireTokens('CSS עמוד 5', p5css, [
  '.page-638 .foundation-note-one-line',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '.page-638 .length-cards',
  '.page-638 .claim-check',
  'shape-rendering: geometricPrecision;',
]);

console.log('\n=== Approved Content Contracts ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
