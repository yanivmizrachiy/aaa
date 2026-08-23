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
const end = profile.learningProtocol?.activeAuditWindow?.endPage || 13;

for (const token of [
  '## חוזה עריכה אטומי — חובה בכל שינוי',
  '## מערכת למידת הסגנון — חוזה מחייב',
  '**אין כפל סעיפים:**',
  '**אין להשאיר שטח A4 גדול ריק ללא מטרה.**',
  '**ניצול דף חכם קודם למרכוז.**',
  '**שטח תשובה מותאם לתשובה הצפויה:**',
  '**תוצאת חישוב נמצאת מתחת לתרגיל.**',
  '**הסבר מושגי הוא מודרך ואקטיבי:**',
  '**מושג "פתרון של משוואה" נלמד דרך הצבה.**',
  'AAA Exact A4 Preview',
]) {
  if (truth.includes(token)) pass(`מקור האמת כולל: ${token}`);
  else fail(`מקור האמת חסר כלל סגנון מחייב: ${token}`);
}

if (start === 1 && end === 13) pass('חלון הבדיקה הפעיל הוא עמודים 1–13.');
else fail(`חלון הבדיקה הפעיל צריך להיות 1–13, נמצא ${start}–${end}.`);

for (let n = start; n <= end; n += 1) {
  const meta = pages[n - 1];
  if (!meta?.file) {
    fail(`עמוד ${n}: חסרה רשומה ב-WORKBOOK_MANIFEST.json.`);
    continue;
  }
  const htmlPath = meta.file;
  const cssPath = `styles/pages/${htmlPath.replace(/\.html$/u, '.css')}`;
  if (!exists(htmlPath) || !exists(cssPath)) {
    fail(`עמוד ${n}: חסר HTML או CSS ייעודי.`);
    continue;
  }

  const html = read(htmlPath);
  const css = read(cssPath);
  const rootClass = htmlPath.replace(/^עמוד-/u, 'page-').replace(/\.html$/u, '');

  if (truth.includes(`## עמוד ${n} —`)) pass(`עמוד ${n}: יש סעיף מפורש במקור האמת.`);
  else fail(`עמוד ${n}: חסר סעיף מפורש במקור האמת.`);

  if (html.includes(`עמוד ${n} / 53`)) pass(`עמוד ${n}: מונה החוברת הוא /53.`);
  else fail(`עמוד ${n}: מונה הניווט אינו /53.`);

  if (html.includes(`<div class="page-number">${n}</div>`)) pass(`עמוד ${n}: מספר העמוד הפנימי תקין.`);
  else fail(`עמוד ${n}: מספר העמוד הפנימי אינו תואם למניפסט.`);

  if (html.includes(`a4-page ${rootClass}`) || html.includes(`${rootClass} pythagoras`)) pass(`עמוד ${n}: root class קנוני קיים.`);
  else fail(`עמוד ${n}: root class קנוני חסר או השתנה.`);

  const localResponsive = /@media\s*(?:screen\s+and\s*)?\([^)]*(?:max-width|min-width)[^)]*\)/iu.test(css);
  if (!localResponsive) pass(`עמוד ${n}: אין responsive reflow מקומי.`);
  else fail(`עמוד ${n}: נמצא breakpoint מקומי שסותר AAA Exact A4 Preview.`);
}

const allowedPowerPractice = new Set([6]);
for (let n = start; n <= end; n += 1) {
  const meta = pages[n - 1];
  if (!meta?.file) continue;
  const cssPath = `styles/pages/${meta.file.replace(/\.html$/u, '.css')}`;
  if (!exists(cssPath)) continue;
  const css = read(cssPath);
  if (css.includes('pythagoras-power-practice.css') && !allowedPowerPractice.has(n)) fail(`עמוד ${n}: תלות power-practice אינה נדרשת ועלולה ליצור זליגת סגנון.`);
}

const p7 = read(pages[6].file);
const p8 = read(pages[7].file);
const p9 = read(pages[8].file);
const p9css = read(`styles/pages/${pages[8].file.replace(/\.html$/u, '.css')}`);
const p10 = read(pages[9].file);
const p10css = read(`styles/pages/${pages[9].file.replace(/\.html$/u, '.css')}`);
const p11 = read(pages[10].file);
const p11css = read(`styles/pages/${pages[10].file.replace(/\.html$/u, '.css')}`);
const p12 = read(pages[11].file);
const p12css = read(`styles/pages/${pages[11].file.replace(/\.html$/u, '.css')}`);
const p13 = read(pages[12].file);
const p13css = read(`styles/pages/${pages[12].file.replace(/\.html$/u, '.css')}`);

if (!p7.includes('power-sentence-grid') && p7.includes('match-board') && p7.includes('error-grid')) pass('עמוד 7: הגשר ריבוע↔שורש נשאר מגוון.');
else fail('עמוד 7: חזרה מבנית לגרסה החזרתית הישנה.');

if (p8.includes('direct-root-grid') && p8.includes('reverse-root-grid') && p8.includes('perfect-square-grid') && p8.includes('bridge-grid')) pass('עמוד 8: ארבע פעולות שונות נשמרות.');
else fail('עמוד 8: חסר מגוון פדגוגי קנוני.');

const page9Required = [
  'משוואה ריבועית מהצורה x²=a',
  'solution-meaning-strip',
  'meaning-line',
  'case-grid',
  'equation-case-grid',
  'root-practice-grid',
  'error-grid',
  '\\(x^2=-5\\)',
  '\\((-3)^2=\\)',
  'הפתרון ה',
  'מתקבלת תוצאה',
  '\\(x^2=-7\\)',
  'אין פתרון',
];
if (page9Required.every((token) => p9.includes(token)) && p9css.includes('.page-651 .solution-meaning-strip') && !p9.includes('reverse-solution-grid') && !p9.includes('build-equation-card')) pass('עמוד 9: משוואה ריבועית x²=a נלמדת דרך הצבה, שני פתרונות/פתרון יחיד/אין פתרון והבחנה משורש.');
else fail('עמוד 9: נפגע חוזה ההצבה, שלושת המצבים או ההבחנה בין שורש למשוואה ריבועית.');

if (!p10.includes('approximation-grid') && p10.includes('bounds-grid') && p10.includes('calculator-grid') && p10.includes('reasonableness-grid') && p10.includes('error-grid') && p10.includes('build-root-card')) pass('עמוד 10: תחימה, קירוב, סבירות, תיקון ובנייה נשמרים.');
else fail('עמוד 10: מגוון הקירוב נפגע.');
if (!p10css.includes('pythagoras-power-practice.css')) pass('עמוד 10: CSS מקומי ואינו תלוי בשכבת power-practice.');
else fail('עמוד 10: חזרה תלות power-practice.');

const page11Required = ['page11-top-band','page11-example-steps','top-guided-practice','direct-solution-scaffold','build-solution-scaffold','bounds-grid','approx-error-grid','\\(x^2=14\\)','\\(x^2=45\\)'];
if (page11Required.every((token) => p11.includes(token)) && !p11.includes('approx-pair') && p11css.includes('grid-template-columns: minmax(210px, .9fr) minmax(0, 2.1fr)')) pass('עמוד 11: הדוגמה צמודה לימין והשטח העליון מנוצל לתרגול נוסף.');
else fail('עמוד 11: הדוגמה חזרה למרכוז/רוחב מלא או שהתרגול העליון נעלם.');

if (!p12css.includes('pythagoras-power-practice.css') && !/@media\s*(?:screen\s+and\s*)?\([^)]*(?:max-width|min-width)[^)]*\)/iu.test(p12css)) pass('עמוד 12: 2×2 נשמר בכל מכשיר ללא תלות משותפת מיותרת.');
else fail('עמוד 12: חזרה ל-reflow או לתלות CSS מיותרת.');

const page12FitClasses = ['answer-fit-one-digit', 'answer-fit-two-digit', 'answer-fit-symbol-square'];
if (page12FitClasses.every((token) => p12.includes(token)) && !p12.includes('compact-expression') && p12css.includes('.page-643 .answer-fit-one-digit { width: 34px; }') && p12css.includes('.page-643 .answer-fit-two-digit { width: 46px; }') && p12css.includes('.page-643 .answer-fit-symbol-square { width: 50px; }')) pass('עמוד 12: רוחב כל תשובה מותאם לתוכן הצפוי.');
else fail('עמוד 12: שטחי התשובה חזרו לרוחב קבוע/גדול שאינו מתאים לתוכן.');

const page13Required = [
  'page13-figure-task',
  'page13-relation-task',
  'page13-reverse-task',
  'page13-generalize-task',
  'result-below-card',
  'relation-workbench',
  'reverse-workbench',
  'generalize-workbench',
  '\\(6^2+8^2=\\)',
  '\\(10^2-8^2=\\)',
  '\\(7^2+24^2=\\)',
];
const page13ResultBelowCount = (p13.match(/result-below-card/g) || []).length;
if (page13Required.every((token) => p13.includes(token)) && page13ResultBelowCount >= 10 && p13css.includes('.page-644 .result-below-card') && p13css.includes('grid-template-rows: 285px 225px 245px minmax(230px, 1fr)')) pass('עמוד 13: תוצאות מתחת לתרגילים וה-A4 מנוצל ברצף גילוי מלא.');
else fail('עמוד 13: חזרה תוצאה אופקית, אובדן תרגול או פגיעה בניצול ה-A4.');

console.log('\n=== First 13 Style Learning Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
