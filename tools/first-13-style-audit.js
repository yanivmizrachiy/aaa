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
  '**פתרון רב־שלבי נכתב אנכית:**',
  '**הסבר מושגי הוא מודרך ואקטיבי:**',
  '**מושג "פתרון של משוואה" נלמד דרך הצבה:**',
  'AAA Exact A4 Preview',
]) {
  truth.includes(token) ? pass(`מקור האמת כולל: ${token}`) : fail(`מקור האמת חסר כלל מחייב: ${token}`);
}

if (start === 1 && end === 13) pass('חלון הבדיקה הפעיל הוא 1–13.');
else fail(`חלון הבדיקה צריך להיות 1–13, נמצא ${start}–${end}.`);

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

  truth.includes(`## עמוד ${n} —`) ? pass(`עמוד ${n}: יש סעיף במקור האמת.`) : fail(`עמוד ${n}: חסר סעיף במקור האמת.`);
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

const p6 = pageHtml[6] || '', c6 = pageCss[6] || '';
const p7 = pageHtml[7] || '', c7 = pageCss[7] || '';
const p8 = pageHtml[8] || '', c8 = pageCss[8] || '';
const p9 = pageHtml[9] || '', c9 = pageCss[9] || '';
const p10 = pageHtml[10] || '', c10 = pageCss[10] || '';
const p11 = pageHtml[11] || '', c11 = pageCss[11] || '';
const p12 = pageHtml[12] || '', c12 = pageCss[12] || '';
const p13 = pageHtml[13] || '', c13 = pageCss[13] || '';

if (c6.includes('.page-639 .square-card,\n.page-639 .hard-square-card,\n.page-639 .pattern-expression { flex-direction: column; }') &&
    c6.includes('.square-card:nth-child(-n+3) .square-fill') &&
    c6.includes('.hard-square-card:nth-child(8) .hard-square-fill')) pass('עמוד 6: תוצאות חישוב מתחת ורוחבים מותאמים.');
else fail('עמוד 6: תוצאה־מתחת או התאמת רוחב נשברו.');

if (!p7.includes('power-sentence-grid') && p7.includes('match-board') && p7.includes('error-grid') &&
    c7.includes('.page-640 .mixed-card:nth-child(1),') && c7.includes('flex-direction: column;') &&
    c7.includes('.mixed-card:nth-child(5) .mixed-fill')) pass('עמוד 7: מגוון נשמר וחישובים קדימה יורדים שורה.');
else fail('עמוד 7: מבנה/תוצאה־מתחת נפגעו.');

if (p8.includes('direct-root-grid') && p8.includes('reverse-root-grid') && p8.includes('perfect-square-grid') && p8.includes('bridge-grid') &&
    c8.includes('.page-641 .root-card { flex-direction:column;') &&
    c8.includes('.root-card:nth-child(-n+4) .root-fill')) pass('עמוד 8: חישובי שורש מתחת ורוחבים חכמים.');
else fail('עמוד 8: חוזה שורש/תוצאה־מתחת נפגע.');

const page9Required = [
  'משוואה ריבועית מהצורה x²=a', 'solution-meaning-strip', 'meaning-line', 'case-grid',
  'equation-case-grid', 'negative-root-rule', 'root-practice-grid', 'error-grid',
  '\\(x^2=-5\\)', '\\((-3)^2=\\)', 'מתקבלת תוצאה', '\\(x^2=-7\\)', 'אין פתרון'
];
if (page9Required.every((t) => p9.includes(t)) && c9.includes('.page-651 .root-practice-card { display:flex; flex-direction:column;') &&
    c9.includes('.page-651 .negative-root-rule')) pass('עמוד 9: הצבה, שלושת המצבים, שורש שלילי ותוצאה־מתחת נשמרים.');
else fail('עמוד 9: חוזה ההצבה/שורש שלילי/שלושת המצבים נפגע.');

if (!p10.includes('approximation-grid') && p10.includes('bounds-grid') && p10.includes('calculator-grid') && p10.includes('reasonableness-grid') && p10.includes('error-grid') && p10.includes('build-root-card') &&
    !c10.includes('pythagoras-power-practice.css') && c10.includes('.page-642 .calculator-card { display:flex; flex-direction:column;')) pass('עמוד 10: מגוון וקירוב עם תוצאה מתחת נשמרים.');
else fail('עמוד 10: מגוון/קירוב/תוצאה־מתחת נפגעו.');

const page11Required = ['page11-top-band','page11-example-steps','top-guided-practice','direct-solution-scaffold','build-solution-scaffold','bounds-grid','approx-error-grid','\\(x^2=14\\)','\\(x^2=45\\)'];
if (page11Required.every((t) => p11.includes(t)) && !p11.includes('approx-pair') && c11.includes('grid-template-columns: minmax(210px, .9fr) minmax(0, 2.1fr)')) pass('עמוד 11: דוגמה צמודה לימין והשטח העליון מנוצל.');
else fail('עמוד 11: הדוגמה חזרה לרוחב מלא או התרגול העליון נעלם.');

const page12Fit = ['answer-fit-one-digit','answer-fit-two-digit','answer-fit-symbol-square'];
if (page12Fit.every((t) => p12.includes(t)) && !c12.includes('pythagoras-power-practice.css') &&
    c12.includes('.page-643 .math-work { min-height:64px; display:grid;') &&
    c12.includes('.page-643 .answer-fit-one-digit { width:34px; }') &&
    c12.includes('.page-643 .answer-fit-two-digit { width:46px; }') &&
    c12.includes('.page-643 .answer-fit-symbol-square { width:50px; }')) pass('עמוד 12: 2×2, תוצאות מתחת ורוחבים מותאמים.');
else fail('עמוד 12: פריסה/תוצאה־מתחת/רוחבי תשובה נפגעו.');

const page13Required = ['page13-figure-task','page13-relation-task','page13-reverse-task','page13-generalize-task','result-below-card','relation-workbench','reverse-workbench','generalize-workbench','\\(6^2+8^2=\\)','\\(10^2-8^2=\\)','\\(7^2+24^2=\\)'];
const count13 = (p13.match(/result-below-card/g) || []).length;
if (page13Required.every((t) => p13.includes(t)) && count13 >= 10 && c13.includes('.page-644 .result-below-card') && c13.includes('grid-template-rows: 285px 225px 245px minmax(230px, 1fr)')) pass('עמוד 13: תוצאות מתחת וה-A4 מנוצל ברצף גילוי מלא.');
else fail('עמוד 13: תוצאה אופקית/אובדן תרגול/ניצול A4 נפגעו.');

console.log('\n=== First 13 Style Learning Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
