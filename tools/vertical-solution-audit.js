const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const errors = [];
const ok = [];
const pass = (m) => ok.push(m);
const fail = (m) => errors.push(m);
const count = (text, token) => text.split(token).length - 1;

const truth = read('SOURCE_OF_TRUTH.md');
const profile = JSON.parse(read('STYLE_PROFILE.json'));
const pages = [
  ['עמוד 16', read('עמוד-647.html'), read('styles/pages/עמוד-647.css'), 'page16-solve-card', 4],
  ['עמוד 17', read('עמוד-653.html'), read('styles/pages/עמוד-653.css'), 'page17-card', 6],
  ['עמוד 18', read('עמוד-648.html'), read('styles/pages/עמוד-648.css'), 'page18-card', 6],
  ['עמוד 19', read('עמוד-649.html'), read('styles/pages/עמוד-649.css'), 'page19-card', 6],
  ['עמוד 20', read('עמוד-650.html'), read('styles/pages/עמוד-650.css'), 'page20-card', 6],
];

for (const token of [
  '**שטח עבודה לבן גדול אינו נחשב ניצול של הדף רק מפני שאפשר לכתוב בו.**',
  '**פתרון רב־שלבי נכתב אנכית.**',
  'אותו כלל חל גם על **דוגמאות פתורות** וגם על **המקום שהתלמיד משלים**',
  '## עמוד 18 — מציאת היתר',
  '## עמוד 19 — מציאת ניצב',
  '## עמוד 20 — תרגול מעורב',
]) {
  if (truth.includes(token)) pass(`מקור האמת כולל כלל/חוזה: ${token}`);
  else fail(`מקור האמת חסר כלל/חוזה: ${token}`);
}

const verticalRule = (profile.styleRules || []).find((r) => r.id === 'vertical-equation-solution');
if (verticalRule?.scope === 'global' && verticalRule?.status === 'locked') pass('STYLE_PROFILE: כלל פתרון אנכי גלובלי ונעול.');
else fail('STYLE_PROFILE: חסר כלל vertical-equation-solution גלובלי ונעול.');

for (const [label, html, css, cardClass, expectedCards] of pages) {
  if (!html.includes('full-solution-space') && !html.includes('student-final-answer')) pass(`${label}: אין שטח פתרון לבן גדול או תשובה אופקית ישנה.`);
  else fail(`${label}: חזר full-solution-space או student-final-answer הישן.`);

  const cards = count(html, `class="${cardClass}"`);
  if (cards === expectedCards) pass(`${label}: מספר תרגילי הפתרון הוא ${expectedCards}.`);
  else fail(`${label}: צריכים להיות ${expectedCards} תרגילי פתרון, נמצאו ${cards}.`);

  if (html.includes('class="work-row final-row"') || html.includes('final-solution-row')) pass(`${label}: קיימת שורת תשובה סופית אנכית.`);
  else fail(`${label}: חסרה שורת תשובה סופית אנכית.`);

  if (!html.includes('5=x') && !html.includes('3=x') && !html.includes('10=x')) pass(`${label}: לא חזרה כתיבת תשובה הפוכה מסוג 5=x.`);
  else fail(`${label}: נמצאה כתיבת תשובה הפוכה; יש לכתוב x=...`);

  const responsive = /@media\s*(?:screen\s+and\s*)?\([^)]*(?:max-width|min-width)[^)]*\)/iu.test(css);
  if (!responsive) pass(`${label}: אין responsive reflow מקומי.`);
  else fail(`${label}: נמצא breakpoint מקומי שסותר Exact A4.`);
}

const p16 = pages[0][1];
if (count(p16, 'class="operation-card"') === 4 && p16.includes('aligned-solution example-solution')) pass('עמוד 16: דוגמה אנכית + ארבע החלטות פעולה נשמרו.');
else fail('עמוד 16: מבנה הדוגמה/החלטות הפעולה נפגע.');

const p17 = pages[1][1];
if (p17.includes('aligned-solution') && count(p17, 'class="work-row final-row"') === 6) pass('עמוד 17: הדוגמה והתרגול משתמשים באותו פורמט אנכי.');
else fail('עמוד 17: הדוגמה ותרגילי התלמיד אינם באותו פורמט אנכי.');

const p20 = pages[4][1];
if (count(p20, 'class="choice-card"') === 4 && count(p20, 'class="final-card"') === 2) pass('עמוד 20: 4 החלטות פעולה + 2 משימות סיום שונות נשמרו.');
else fail('עמוד 20: מבנה התרגול המעורב נפגע.');

console.log('\n=== Vertical Solution + Print Density Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
