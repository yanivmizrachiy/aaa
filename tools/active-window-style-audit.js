const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const ok = [];
const pass = (m) => ok.push(m);
const fail = (m) => errors.push(m);

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
  'AAA Exact A4 Preview',
]) {
  truth.includes(token) ? pass(`מקור האמת כולל: ${token}`) : fail(`מקור האמת חסר כלל מחייב: ${token}`);
}

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

if (p(5).includes('שני הניצבים יוצרים את הזווית הישרה') && !p(5).includes('הניצבים נפגשים בזווית הישרה')) pass('עמוד 5: שני הניצבים יוצרים את הזווית הישרה בניסוח מתמטי מדויק.');
else fail('עמוד 5: חזר ניסוח שגוי שלפיו הניצבים נפגשים בזווית.');

const page6Fractions = ['\\left(\\frac{1}{2}\\right)^2=', '\\left(\\frac{3}{4}\\right)^2=', '\\left(\\frac{2}{3}\\right)^2=', '\\left(\\frac{5}{2}\\right)^2='];
const page6CleanBoxes = c(6).includes('.page-639 .foundation-fill') && c(6).includes('box-shadow: none;') && c(6).includes('background: #fff;') && c(6).includes('border-radius: 4px;');
if (c(6).includes('flex-direction: column;') && c(6).includes('.square-card:nth-child(-n+3) .square-fill') && p(6).includes('ניתן להיעזר במחשבון.') && page6Fractions.every((t) => p(6).includes(t)) && page6CleanBoxes) pass('עמוד 6: תוצאה מתחת, שברים, ניסוח מחשבון ותיבות נקיות נשמרים.');
else fail('עמוד 6: נפגעו תוצאה־מתחת, תרגילי השברים, ניסוח המחשבון או סגנון התיבות הנקי.');

if (p(7).includes('match-board') && p(7).includes('error-grid') && c(7).includes('flex-direction: column;')) pass('עמוד 7: גשר מגוון ותוצאה־מתחת נשמרים.');
else fail('עמוד 7: מבנה הגשר נפגע.');

if (['direct-root-grid','reverse-root-grid','perfect-square-grid','bridge-grid'].every((t) => p(8).includes(t)) && c(8).includes('flex-direction:column')) pass('עמוד 8: ארבע פעולות השורש נשמרות.');
else fail('עמוד 8: חוזה השורש נפגע.');

const page9Required = ['משוואה ריבועית מהצורה x²=a','solution-meaning-strip','case-grid','equation-case-grid','negative-root-rule','root-practice-grid','error-grid','\\(x^2=-5\\)','\\((-3)^2=\\)','\\(x^2=-7\\)','אין פתרון'];
if (page9Required.every((t) => p(9).includes(t))) pass('עמוד 9: שורש מול משוואה ושלושת המצבים נשמרים.');
else fail('עמוד 9: חוזה שורש/משוואה נפגע.');

if (['bounds-grid','calculator-grid','reasonableness-grid','error-grid','build-root-card'].every((t) => p(10).includes(t)) && !c(10).includes('pythagoras-power-practice.css')) pass('עמוד 10: תחימה, קירוב, סבירות, תיקון ובנייה נשמרים.');
else fail('עמוד 10: מגוון הקירוב נפגע.');

if (['page11-top-band','page11-example-steps','top-guided-practice','direct-solution-scaffold','build-solution-scaffold'].every((t) => p(11).includes(t)) && !p(11).includes('approx-pair')) pass('עמוד 11: הדוגמה והתרגול העליון נשמרים.');
else fail('עמוד 11: חזר מבנה אופקי/מבזבז מקום.');

const page12Required = ['answer-fit-one-digit','answer-fit-two-digit','answer-fit-symbol-square','מצלע לשטח','משטח לצלע','צלע של ריבוע היא באורך','שטח ריבוע הוא','איזה שטח מתאים לריבוע הזה?','אם שטח הריבוע הוא'];
const page12Forbidden = ['<strong>נתון:</strong>','<strong>המטרה:</strong>','שלב 1','שלב 2','מה כותבים בתיבה?','task-number','task-1','task-2','task-3','task-4'];
if (page12Required.every((t) => p(12).includes(t)) && page12Forbidden.every((t) => !p(12).includes(t)) && !c(12).includes('.task-number') && !c(12).includes('pythagoras-power-practice.css')) pass('עמוד 12: שפה טבעית, ללא מספור סעיפים, 2×2 ורוחבי תשובה חכמים נשמרים.');
else fail('עמוד 12: חזר ניסוח דמו/מספור סעיפים, או שהפריסה/רוחבי התשובה נפגעו.');

if (['page13-figure-task','page13-relation-task','page13-reverse-task','page13-generalize-task','result-below-card'].every((t) => p(13).includes(t))) pass('עמוד 13: רצף הגילוי והתוצאות מתחת נשמרים.');
else fail('עמוד 13: רצף הגילוי נפגע.');

if (['page14-definition-band','applicability-grid','structure-grid','final-check-grid'].every((t) => p(14).includes(t))) pass('עמוד 14: ניסוח המשפט, תנאי שימוש ותיקון נשמרים.');
else fail('עמוד 14: חוזה התוכן נפגע.');

if (['page15-rule-band','equation-diagram-grid','identify-grid','mistake-grid'].every((t) => p(15).includes(t))) pass('עמוד 15: בניית משוואה וזיהוי יתר נשמרים.');
else fail('עמוד 15: חוזה התוכן נפגע.');

if (['page16-example','equation-from-diagram','operation-task','full-solve-task','page16-final-task'].every((t) => p(16).includes(t)) && !p(16).includes('<span class="lhs"></span>')) pass('עמוד 16: פתרון אנכי מלא ללא צד שמאל ריק.');
else fail('עמוד 16: חזר צד שמאל ריק או חסר רכיב קנוני.');

const blankWorkRow = /<div class="work-row"><span><\/span><b>=<\/b>/u;
if (['page17-example','page17-practice-grid','page17-final-check','final-check-stack'].every((t) => p(17).includes(t)) && !blankWorkRow.test(p(17))) pass('עמוד 17: כל שורות הפתרון מפורשות והבדיקה הסופית אנכית.');
else fail('עמוד 17: חזר צד שמאל ריק או בדיקה אופקית.');

if (['page18-reminder','page18-grid','page18-compare'].every((t) => p(18).includes(t)) && (p(18).match(/page18-card/g) || []).length >= 6 && !blankWorkRow.test(p(18))) pass('עמוד 18: שישה תרגילי יתר עם scaffold מלא נשמרים.');
else fail('עמוד 18: scaffold מציאת היתר נפגע.');

if (['page19-reminder','page19-grid','page19-error'].every((t) => p(19).includes(t)) && (p(19).match(/page19-card/g) || []).length >= 6 && !blankWorkRow.test(p(19))) pass('עמוד 19: מציאת ניצב וסדר החיסור נשמרים.');
else fail('עמוד 19: scaffold מציאת הניצב נפגע.');

if (['page20-rule','page20-choice-grid','page20-grid','page20-final-grid'].every((t) => p(20).includes(t)) && (p(20).match(/page20-card/g) || []).length >= 6 && !blankWorkRow.test(p(20))) pass('עמוד 20: בחירת פעולה, פתרון מעורב וסיכום נשמרים.');
else fail('עמוד 20: חוזה התרגול המעורב נפגע.');

console.log('\n=== Active Window Style Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
