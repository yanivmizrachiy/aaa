const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const ok = [];
const pass = (m) => ok.push(m);
const fail = (m) => errors.push(m);
const count = (text, token) => text.split(token).length - 1;

const truth = read('SOURCE_OF_TRUTH.md');
const profile = JSON.parse(read('STYLE_PROFILE.json'));
const manifest = JSON.parse(read('WORKBOOK_MANIFEST.json'));
const pages = manifest.pages || [];
const start = profile.learningProtocol?.activeAuditWindow?.startPage || 1;
const end = profile.learningProtocol?.activeAuditWindow?.endPage || 20;

for (const token of [
  '## חוזה עריכה אטומי — חובה בכל שינוי',
  '## חומת רגרסיה — דברים שתוקנו אינם חוזרים',
  '## מערכת למידת הסגנון — חוזה מחייב',
  '**אין כפל סעיפים:**',
  '**אין להשאיר שטח A4 גדול ריק ללא מטרה.**',
  '**ניצול דף חכם קודם למרכוז.**',
  '**שטח תשובה מותאם לתשובה הצפויה:**',
  '**תוצאת חישוב נמצאת מתחת לתרגיל.**',
  '**פתרון רב־שלבי נכתב אנכית:**',
  '**הצד השמאלי אינו נעלם באמצע פתרון:**',
  '**הסבר מושגי הוא מודרך ואקטיבי:**',
  '**הוראה לתלמיד חייבת להיות טבעית וברורה, לא ניסוח דמו.**',
  '**מונחי זווית מדויקים:**',
  '**משולשים אינם מוצגים כולם באותה תנוחה.**',
  '**סימון מחשבון עקבי:**',
  'AAA Exact A4 Preview',
]) truth.includes(token) ? pass(`מקור האמת כולל: ${token}`) : fail(`מקור האמת חסר כלל מחייב: ${token}`);

if (start === 1 && end === 20) pass('חלון הבדיקה הפעיל הוא 1–20.');
else fail(`חלון הבדיקה צריך להיות 1–20, נמצא ${start}–${end}.`);

const pageHtml = {};
const pageCss = {};
for (let n = start; n <= end; n += 1) {
  const meta = pages[n - 1];
  if (!meta?.file) { fail(`עמוד ${n}: חסרה רשומה במניפסט.`); continue; }
  const htmlPath = meta.file;
  const cssPath = `styles/pages/${htmlPath.replace(/\.html$/u, '.css')}`;
  if (!exists(htmlPath) || !exists(cssPath)) { fail(`עמוד ${n}: חסר HTML או CSS ייעודי.`); continue; }
  const html = read(htmlPath);
  const css = read(cssPath);
  pageHtml[n] = html;
  pageCss[n] = css;
  const rootClass = htmlPath.replace(/^עמוד-/u, 'page-').replace(/\.html$/u, '');

  truth.includes(`## עמוד ${n} —`) ? pass(`עמוד ${n}: יש סעיף קנוני במקור האמת.`) : fail(`עמוד ${n}: חסר סעיף קנוני במקור האמת.`);
  html.includes(`עמוד ${n} / 53`) ? pass(`עמוד ${n}: מונה /53 תקין.`) : fail(`עמוד ${n}: מונה הניווט אינו /53.`);
  html.includes(`<div class="page-number">${n}</div>`) ? pass(`עמוד ${n}: מספר פנימי תקין.`) : fail(`עמוד ${n}: מספר פנימי שגוי.`);
  (html.includes(`a4-page ${rootClass}`) || html.includes(`${rootClass} pythagoras`)) ? pass(`עמוד ${n}: root class קנוני.`) : fail(`עמוד ${n}: root class חסר.`);

  const localResponsive = /@media\s*(?:screen\s+and\s*)?\([^)]*(?:max-width|min-width)[^)]*\)/iu.test(css);
  !localResponsive ? pass(`עמוד ${n}: אין reflow מקומי.`) : fail(`עמוד ${n}: breakpoint מקומי סותר Exact A4.`);
}

const allowedPowerPractice = new Set([6]);
for (let n = start; n <= end; n += 1) {
  const css = pageCss[n] || '';
  if (css.includes('pythagoras-power-practice.css') && !allowedPowerPractice.has(n)) fail(`עמוד ${n}: תלות power-practice אסורה.`);
}

const p = (n) => pageHtml[n] || '';
const c = (n) => pageCss[n] || '';
const requireAll = (n, tokens, label) => tokens.every((t) => p(n).includes(t)) ? pass(label) : fail(`${label} — חסרים: ${tokens.filter((t) => !p(n).includes(t)).join(' | ')}`);

requireAll(1, ['class="final-build-area"','בדיוק שתי זוויות ישרות'], 'עמוד 1: משימת הסיום ושטח הציור הגדול נשמרים.');
if (c(1).includes('.page-634 .final-build-area') && c(1).includes('min-height:94px')) pass('עמוד 1: שטח הציור נשאר גדול וברור.'); else fail('עמוד 1: שטח הציור הסופי הצטמצם.');

requireAll(2, ['triangle-choice-grid','construction-grid','hunt-total','כמה משולשים ישרי־זווית הצלחתם למצוא?'], 'עמוד 2: זיהוי, בנייה ושאלת הסיום נשמרים.');
if (count(p(2), 'כמה משולשים ישרי־זווית הצלחתם למצוא?') === 1) pass('עמוד 2: שאלת התחתית מופיעה פעם אחת בלבד.'); else fail('עמוד 2: שאלת התחתית כפולה או חסרה.');

requireAll(3, ['הניצב הגדול הוא','הניצב הקטן הוא','שווה־שוקיים','סמנו בשרטוט את הצלע שאינה ניצב','single-partner-section','rotated-triangle','legs-mcq'], 'עמוד 3: הגיוון הפדגוגי והחזותי נשמרים.');
if (count(p(3), 'class="leg-card"') === 3 && count(p(3), 'class="partner-leg-task"') === 1) pass('עמוד 3: אין חזרתיות של אותה משימת ניצבים.'); else fail('עמוד 3: חזרו משימות ניצבים כפולות.');

requireAll(4, ['class="hyp-summary"','היתר הוא הצלע ה','vertex-name-grid','AC</strong> יהיה היתר','AB</strong> יהיה היתר','10 ס״מ, 24 ס״מ ו־26 ס״מ','בכל סעיף השלימו את הסימן המתאים','symbol-triangle'], 'עמוד 4: השלמות, שמות קודקודים, יחידות ויחסים נשמרים.');
if (!p(4).includes('שני הרמזים') && !p(4).includes('אופקי') && !p(4).includes('אנכי')) pass('עמוד 4: לא חזרו הרמזים הישנים או שפת כיוון אסורה.'); else fail('עמוד 4: חזר תוכן שנאסר.');

requireAll(5, ['page5-discovery','שם היתר:','<strong>AC</strong><span>&gt;</span>','logic-grid','construction-grid','הזווית הישרה היא <span dir="ltr">B</span>'], 'עמוד 5: זיהוי היתר והשוואתו לשני הניצבים נשמרים.');
if (count(p(5), 'math-comparison') === 2 && !p(5).includes('logic-number')) pass('עמוד 5: שתי השוואות מתמטיות וללא מספור 1–3.'); else fail('עמוד 5: ההשוואות או ביטול המספור נפגעו.');

const page6Fractions = ['\\left(\\frac{1}{2}\\right)^2=', '\\left(\\frac{3}{4}\\right)^2=', '\\left(\\frac{2}{3}\\right)^2=', '\\left(\\frac{5}{2}\\right)^2='];
requireAll(6, ['ניתן להיעזר במחשבון.','compare-example','\\(9^2=\\)','לאיזה מהביטויים יש תוצאה גדולה יותר?','\\(6^2=6\\times2\\)','\\(5^2+3^2=10+6\\)','power-error-grid','pattern-row'], 'עמוד 6: דוגמת השוואה, תפיסה שגויה, תיקון ודפוס נשמרים.');
if (page6Fractions.every((t) => p(6).includes(t)) && c(6).includes('box-shadow: none;') && c(6).includes('background: #fff;')) pass('עמוד 6: ארבעת השברים והתיבות הנקיות נשמרים.'); else fail('עמוד 6: נפגעו השברים או סגנון התיבות.');

requireAll(7, ['העלאה בריבוע והוצאת שורש הן פעולות הפוכות.','\\(\\sqrt{49}=7\\)','inverse-pair-grid','symbolic-pair','mixed-grid','error-grid','final-pair-grid'], 'עמוד 7: פעולות הפוכות, זוגות והשלמות מגוונות נשמרים.');

requireAll(8, ['מספר אי־שלילי','מספר שהוא <strong>חיובי או 0</strong>','התוצאה של פעולת השורש היא תמיד מספר אי־שלילי','direct-root-grid','inference-grid','result-check-grid','bridge-grid','\\(\\sqrt{81}\\ne-9\\)'], 'עמוד 8: אי־שלילי, שורשים, הסקה וגשר לעמוד 9 נשמרים.');
if (!p(8).includes('סימן שורש')) pass('עמוד 8: הניסוח המטעה "סימן שורש" אינו קיים.'); else fail('עמוד 8: חזר הניסוח "סימן שורש".');

requireAll(9, ['משוואות מהצורה x²=a','page9-distinction','case-grid','equation-practice-grid','page9-true-false','page9-final-rule','\\(x^2=-25\\)','אין פתרון ממשי'], 'עמוד 9: שלושת מקרי המשוואה ותרגול נכון/לא נכון נשמרים.');
if (!p(9).includes('correction-slot') && !p(9).includes('solution-meaning-strip') && c(9).includes('.page-651 .correction-line')) pass('עמוד 9: הפריסה החדשה שטוחה ושורות התיקון פתוחות.'); else fail('עמוד 9: חזר מבנה ישן או תיבת תיקון מקוננת.');

requireAll(10, ['page10-worked-example','\\(\\sqrt{16}=4\\)','\\(\\sqrt{25}=5\\)','\\(16<20<25\\)','\\(4<\\sqrt{20}<5\\)','guided-grid','independent-grid','calculator-grid','final-work'], 'עמוד 10: תחימת שורשים שורה־אחר־שורה נשמרת.');
if (!c(10).includes('pythagoras-power-practice.css')) pass('עמוד 10: CSS מקומי בלבד.'); else fail('עמוד 10: חזרה תלות אסורה.');

requireAll(11, ['page11-top-band','page11-example-steps','top-guided-practice','direct-solution-scaffold','build-solution-scaffold'], 'עמוד 11: הדוגמה והפתרונות האנכיים נשמרים.');
if (!p(11).includes('approx-pair') && c(11).includes('border-radius: 0;') && c(11).includes('border-block: 1px solid var(--border-light);')) pass('עמוד 11: ההיררכיה השטוחה ללא כרטיסים מקוננים נשמרת.'); else fail('עמוד 11: חזר מבנה אופקי/מקונן.');

const page12Required = ['answer-fit-one-digit','answer-fit-two-digit','answer-fit-symbol-square','מצלע לשטח','משטח לצלע','צלע של ריבוע היא באורך','שטח ריבוע הוא','איזה שטח מתאים לריבוע הזה?','אם שטח הריבוע הוא'];
const page12Forbidden = ['<strong>נתון:</strong>','<strong>המטרה:</strong>','שלב 1','שלב 2','מה כותבים בתיבה?','task-number','task-1','task-2','task-3','task-4'];
if (page12Required.every((t) => p(12).includes(t)) && page12Forbidden.every((t) => !p(12).includes(t)) && !c(12).includes('.task-number') && !c(12).includes('pythagoras-power-practice.css')) pass('עמוד 12: שפה טבעית, ללא מספור סעיפים, 2×2 ורוחבי תשובה חכמים נשמרים.');
else fail('עמוד 12: חזר ניסוח דמו/מספור סעיפים, או שהפריסה/רוחבי התשובה נפגעו.');

if (['page13-figure-task','page13-relation-task','page13-reverse-task','page13-generalize-task','result-below-card'].every((t) => p(13).includes(t))) pass('עמוד 13: רצף הגילוי והתוצאות מתחת נשמרים.'); else fail('עמוד 13: רצף הגילוי נפגע.');
if (['page14-definition-band','applicability-grid','structure-grid','final-check-grid'].every((t) => p(14).includes(t))) pass('עמוד 14: ניסוח המשפט, תנאי שימוש ותיקון נשמרים.'); else fail('עמוד 14: חוזה התוכן נפגע.');
if (['page15-rule-band','equation-diagram-grid','identify-grid','mistake-grid'].every((t) => p(15).includes(t))) pass('עמוד 15: בניית משוואה וזיהוי יתר נשמרים.'); else fail('עמוד 15: חוזה התוכן נפגע.');
if (['page16-example','equation-from-diagram','operation-task','full-solve-task','page16-final-task'].every((t) => p(16).includes(t)) && !p(16).includes('<span class="lhs"></span>')) pass('עמוד 16: פתרון אנכי מלא ללא צד שמאל ריק.'); else fail('עמוד 16: חזר צד שמאל ריק או חסר רכיב קנוני.');

const blankWorkRow = /<div class="work-row"><span><\/span><b>=<\/b>/u;
const page17Typography = c(17).includes("font-family: 'Rubik', sans-serif;") && !c(17).includes("'PytTeX'");
if (['page17-example','page17-practice-grid','page17-final-check','final-check-stack'].every((t) => p(17).includes(t)) && !blankWorkRow.test(p(17)) && page17Typography) pass('עמוד 17: scaffold אנכי והטיפוגרפיה האחידה נשמרים.'); else fail('עמוד 17: חזר צד שמאל ריק/בדיקה אופקית או גופן מקומי שונה.');
if (['page18-reminder','page18-grid','page18-compare'].every((t) => p(18).includes(t)) && (p(18).match(/page18-card/g) || []).length >= 6 && !blankWorkRow.test(p(18))) pass('עמוד 18: שישה תרגילי יתר עם scaffold מלא נשמרים.'); else fail('עמוד 18: scaffold מציאת היתר נפגע.');
if (['page19-reminder','page19-grid','page19-error'].every((t) => p(19).includes(t)) && (p(19).match(/page19-card/g) || []).length >= 6 && !blankWorkRow.test(p(19))) pass('עמוד 19: מציאת ניצב וסדר החיסור נשמרים.'); else fail('עמוד 19: scaffold מציאת הניצב נפגע.');
if (['page20-rule','page20-choice-grid','page20-grid','page20-final-grid'].every((t) => p(20).includes(t)) && (p(20).match(/page20-card/g) || []).length >= 6 && !blankWorkRow.test(p(20))) pass('עמוד 20: בחירת פעולה, פתרון מעורב וסיכום נשמרים.'); else fail('עמוד 20: חוזה התרגול המעורב נפגע.');

console.log('\n=== Active Window Style Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
