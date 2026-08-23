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

const truth = read('SOURCE_OF_TRUTH.md');
const html = {};
const css = {};
const mapping = {1:'634',2:'635',3:'636',4:'637',5:'638',6:'639',7:'640',8:'641',9:'651',10:'642',11:'652'};
for (const [nRaw, id] of Object.entries(mapping)) {
  const n = Number(nRaw);
  html[n] = read(`עמוד-${id}.html`);
  css[n] = read(`styles/pages/עמוד-${id}.css`);
}

requireTokens('SOURCE_OF_TRUTH', truth, [
  '## עמוד 1 — מושגים בסיסיים','## עמוד 2 — משולש ישר־זווית','## עמוד 3 — הניצבים','## עמוד 4 — היתר',
  '## עמוד 5 — ניצבים ויתר: מיישמים','## עמוד 6 — ריבוע של מספר','## עמוד 7 — ריבועים ושורשים',
  '## עמוד 8 — שורש ריבועי ומספר אי־שלילי','## עמוד 9 — משוואות מהצורה x²=a',
  '## עמוד 10 — קירוב שורשים בעזרת ריבועים מושלמים','## עמוד 11 — משוואה ריבועית וקירוב פתרונות',
  'AAA Exact A4 Preview','**אין כפל סעיפים:**','**תוצאת חישוב נמצאת מתחת לתרגיל.**','**פתרון רב־שלבי נכתב אנכית:**'
]);

requireTokens('עמוד 1', html[1], ['<h1 class="page-title">מושגים בסיסיים</h1>','class="final-build-area"','בדיוק שתי זוויות ישרות']);
requireTokens('CSS עמוד 1', css[1], ['.page-634 .final-build-area','min-height:94px']);
forbidTokens('עמוד 1', html[1], ['שני ישרים נחתכים. אחת מארבע הזוויות']);

requireTokens('עמוד 2', html[2], ['triangle-choice-grid','construction-grid','hunt-total','כמה משולשים ישרי־זווית הצלחתם למצוא?','יוצרות את הזווית הישרה']);
if (count(html[2], 'כמה משולשים ישרי־זווית הצלחתם למצוא?') === 1) pass('עמוד 2: שאלת הסיום יחידה.'); else fail('עמוד 2: שאלת הסיום כפולה או חסרה.');
if (count(html[2], 'class="construction-card"') === 2) pass('עמוד 2: שתי משימות בנייה.'); else fail('עמוד 2: מספר משימות הבנייה שגוי.');

requireTokens('עמוד 3', html[3], ['הניצב הגדול הוא','הניצב הקטן הוא','שווה־שוקיים','סמנו בשרטוט את הצלע שאינה ניצב','single-partner-section','rotated-triangle','legs-mcq']);
if (count(html[3], 'class="leg-card"') === 3 && count(html[3], 'class="partner-leg-task"') === 1) pass('עמוד 3: אין חזרתיות של אותה פעולת זיהוי.'); else fail('עמוד 3: חזרה חזרתיות שנאסרה.');
forbidTokens('עמוד 3', html[3], ['class="quick-fill-item"','class="vertex-task"']);

requireTokens('עמוד 4', html[4], ['class="hyp-summary"','כתבו בכל משולש את שם היתר.','vertex-name-grid','AC</strong> יהיה היתר','AB</strong> יהיה היתר','10 ס״מ, 24 ס״מ ו־26 ס״מ','בכל סעיף השלימו את הסימן המתאים','symbol-triangle']);
if (count(html[4], 'class="hyp-card"') === 3) pass('עמוד 4: שלושה שרטוטי זיהוי ישיר בלבד.'); else fail('עמוד 4: מספר שרטוטי הזיהוי הישיר שגוי.');
forbidTokens('עמוד 4', html[4], ['שני הרמזים','אופקי','אנכי','class="hyp-clue-grid"']);

requireTokens('עמוד 5', html[5], ['page5-discovery','שם היתר:','<strong>AC</strong><span>&gt;</span>','page5-error-task','logic-grid','construction-grid']);
if (count(html[5], 'math-comparison') === 2 && count(html[5], 'class="logic-card"') === 3 && count(html[5], 'class="construction-card"') === 2) pass('עמוד 5: שתי השוואות, שלוש הסקות ושתי בניות.'); else fail('עמוד 5: מבנה המשימות השתנה.');
forbidTokens('עמוד 5', html[5], ['היתר כבר מודגש','logic-number']);

requireTokens('עמוד 6', html[6], ['ניתן להיעזר במחשבון.','compare-example','לאיזה מהביטויים יש תוצאה גדולה יותר?','\\(6^2=6\\times2\\)','\\(5^2+3^2=10+6\\)','hard-square-grid','power-error-grid','pattern-row']);
if (count(html[6], 'class="square-card"') === 12 && count(html[6], 'class="hard-square-card') === 8) pass('עמוד 6: 12 חישובי יסוד ו־8 מאתגרים.'); else fail('עמוד 6: כמות התרגול נפגעה.');
for (const token of ['\\left(\\frac{1}{2}\\right)^2=','\\left(\\frac{3}{4}\\right)^2=','\\left(\\frac{2}{3}\\right)^2=','\\left(\\frac{5}{2}\\right)^2=']) if (!html[6].includes(token)) fail(`עמוד 6: חסר שבר ${token}`);
requireTokens('CSS עמוד 6', css[6], ['box-shadow: none','background: #fff']);

requireTokens('עמוד 7', html[7], ['העלאה בריבוע והוצאת שורש הן פעולות הפוכות.','\\(\\sqrt{49}=7\\)','inverse-pair-grid','symbolic-pair','mixed-grid','error-grid','final-pair-grid']);
if (count(html[7], 'class="mixed-card"') === 8 && count(html[7], 'class="error-card"') === 3) pass('עמוד 7: 8 השלמות ו־3 בדיקות.'); else fail('עמוד 7: מבנה התרגול השתנה.');
forbidTokens('CSS עמוד 7', css[7], ['pythagoras-power-practice.css','@media (max-width:']);

requireTokens('עמוד 8', html[8], ['מספר אי־שלילי','מספר שהוא <strong>חיובי או 0</strong>','התוצאה של פעולת השורש היא תמיד מספר אי־שלילי','direct-root-grid','inference-grid','result-check-grid','bridge-grid','\\(\\sqrt{81}\\ne-9\\)']);
forbidTokens('עמוד 8', html[8], ['סימן שורש']);
forbidTokens('CSS עמוד 8', css[8], ['pythagoras-power-practice.css','@media (max-width:']);

requireTokens('עמוד 9', html[9], ['משוואות מהצורה x²=a','page9-distinction','case-grid','equation-practice-grid','page9-true-false','page9-final-rule','\\(x^2=-25\\)','אין פתרון ממשי']);
forbidTokens('עמוד 9', html[9], ['solution-meaning-strip','correction-slot']);
requireTokens('CSS עמוד 9', css[9], ['.page-651 .correction-line','border-block: 1px solid var(--border-light)']);

requireTokens('עמוד 10', html[10], ['page10-worked-example','\\(\\sqrt{16}=4\\)','\\(\\sqrt{25}=5\\)','\\(16<20<25\\)','\\(4<\\sqrt{20}<5\\)','guided-grid','independent-grid','calculator-grid','final-work']);
forbidTokens('CSS עמוד 10', css[10], ['pythagoras-power-practice.css','@media (max-width:']);

requireTokens('עמוד 11', html[11], ['page11-top-band','page11-example-steps','top-guided-practice','direct-solution-scaffold','build-solution-scaffold']);
requireTokens('CSS עמוד 11', css[11], ['border-radius: 0','border-block: 1px solid var(--border-light)']);
forbidTokens('עמוד 11', html[11], ['approx-pair']);

console.log('\n=== Approved Content Contracts ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
