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
  '## מערכת למידת הסגנון — חוזה מחייב',
  '**אין כפל סעיפים:**',
  '**אין להשאיר שטח A4 גדול ריק ללא מטרה.**',
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

/* תלות power-practice נשארת בחלון 1–13 רק בעמוד 6 שבו היא חלק מהתרגול הקנוני. */
const allowedPowerPractice = new Set([6]);
for (let n = start; n <= end; n += 1) {
  const meta = pages[n - 1];
  if (!meta?.file) continue;
  const cssPath = `styles/pages/${meta.file.replace(/\.html$/u, '.css')}`;
  if (!exists(cssPath)) continue;
  const css = read(cssPath);
  const importsPower = css.includes('pythagoras-power-practice.css');
  if (importsPower && !allowedPowerPractice.has(n)) fail(`עמוד ${n}: תלות power-practice אינה נדרשת ועלולה ליצור זליגת סגנון.`);
}

/* חוזים פדגוגיים ממוקדים שנולדו מתיקוני המשתמש ואסור שיחזרו אחורה. */
const p7 = read(pages[6].file);
const p8 = read(pages[7].file);
const p9 = read(pages[8].file);
const p10 = read(pages[9].file);
const p10css = read(`styles/pages/${pages[9].file.replace(/\.html$/u, '.css')}`);
const p11 = read(pages[10].file);
const p12css = read(`styles/pages/${pages[11].file.replace(/\.html$/u, '.css')}`);
const p13 = read(pages[12].file);

if (!p7.includes('power-sentence-grid') && p7.includes('match-board') && p7.includes('error-grid')) pass('עמוד 7: הגשר ריבוע↔שורש נשאר מגוון.');
else fail('עמוד 7: חזרה מבנית לגרסה החזרתית הישנה.');

if (p8.includes('direct-root-grid') && p8.includes('reverse-root-grid') && p8.includes('perfect-square-grid') && p8.includes('bridge-grid')) pass('עמוד 8: ארבע פעולות שונות נשמרות.');
else fail('עמוד 8: חסר מגוון פדגוגי קנוני.');

if (!p9.includes('equation-practice-grid') && p9.includes('direct-solution-grid') && p9.includes('reverse-solution-grid') && p9.includes('error-solution-grid')) pass('עמוד 9: אין חזרה ל-12 כרטיסים זהים.');
else fail('עמוד 9: חזרה לתרגול אחיד מדי.');

if (!p10.includes('approximation-grid') && p10.includes('bounds-grid') && p10.includes('calculator-grid') && p10.includes('reasonableness-grid') && p10.includes('error-grid') && p10.includes('build-root-card')) pass('עמוד 10: תחימה, קירוב, סבירות, תיקון ובנייה נשמרים במקום רצף חזרתי.');
else fail('עמוד 10: מגוון הקירוב נפגע או חזרה רשת החישובים הישנה.');
if (!p10css.includes('pythagoras-power-practice.css')) pass('עמוד 10: CSS מקומי ואינו תלוי בשכבת power-practice.');
else fail('עמוד 10: חזרה תלות power-practice שעלולה ליצור זליגת סגנון.');

if (!p11.includes('page-11-practice-grid') && p11.includes('direct-approx-grid') && p11.includes('bounds-grid') && p11.includes('approx-error-grid') && p11.includes('build-approx-card')) pass('עמוד 11: חישוב, תחימה, תיקון ובנייה נשמרים במקום 10 סעיפים זהים.');
else fail('עמוד 11: חזרה לגרסת 10 הכרטיסים הזהים או אובדן מגוון.');

if (!p12css.includes('pythagoras-power-practice.css') && !/@media\s*(?:screen\s+and\s*)?\([^)]*(?:max-width|min-width)[^)]*\)/iu.test(p12css)) pass('עמוד 12: 2×2 נשמר בכל מכשיר ללא תלות משותפת מיותרת.');
else fail('עמוד 12: חזרה ל-reflow או לתלות CSS מיותרת.');

if (p13.includes('page13-figure-task') && p13.includes('page13-relation-task') && p13.includes('page13-reverse-task') && p13.includes('page13-generalize-task')) pass('עמוד 13: גילוי, קשר, כיוון הפוך והכללה נשמרים.');
else fail('עמוד 13: חסר רצף הגילוי המגוון שאושר.');

console.log('\n=== First 13 Style Learning Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
