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
const p16 = read('עמוד-647.html');
const p16css = read('styles/pages/עמוד-647.css');
const p17 = read('עמוד-653.html');
const p17css = read('styles/pages/עמוד-653.css');

for (const token of [
  '**שטח עבודה לבן גדול אינו נחשב ניצול של הדף רק מפני שאפשר לכתוב בו.**',
  '**פתרון רב־שלבי נכתב אנכית.**',
  'אותו כלל חל גם על **דוגמאות פתורות** וגם על **המקום שהתלמיד משלים**',
]) {
  if (truth.includes(token)) pass(`מקור האמת כולל כלל: ${token}`);
  else fail(`מקור האמת חסר כלל: ${token}`);
}

const verticalRule = (profile.styleRules || []).find((r) => r.id === 'vertical-equation-solution');
if (verticalRule?.scope === 'global' && verticalRule?.status === 'locked') pass('STYLE_PROFILE: כלל פתרון אנכי גלובלי ונעול.');
else fail('STYLE_PROFILE: חסר כלל vertical-equation-solution גלובלי ונעול.');

if (!p16.includes('full-solution-space') && !p16.includes('student-final-answer')) pass('עמוד 16: אין שטח פתרון לבן גדול או תשובה אופקית ישנה.');
else fail('עמוד 16: חזר full-solution-space או student-final-answer הישן.');
if (count(p16, 'class="page16-solve-card"') === 4) pass('עמוד 16: ארבעה פתרונות מלאים.');
else fail('עמוד 16: צריכים להיות בדיוק 4 פתרונות מלאים.');
if (count(p16, 'class="operation-card"') === 4) pass('עמוד 16: ארבע החלטות +/−.');
else fail('עמוד 16: צריכים להיות בדיוק 4 כרטיסי פעולה.');
if (p16.includes('aligned-solution') && p16.includes('final-solution-row') && p16.includes('x²</span><span class="eq">=')) pass('עמוד 16: דוגמה ופתרונות משתמשים בשוויון אנכי מיושר.');
else fail('עמוד 16: פורמט הפתרון האנכי נפגע.');

if (!p17.includes('full-solution-space') && !p17.includes('equation-practice-grid') && !p17.includes('5=x')) pass('עמוד 17: אין תבנית פתרון ישנה או 5=x.');
else fail('עמוד 17: חזרה לתבנית הישנה/הפוכה.');
if (count(p17, 'class="page17-card"') === 6) pass('עמוד 17: שישה תרגילי פתרון צפופים.');
else fail('עמוד 17: צריכים להיות 6 תרגילים.');
if (p17.includes('aligned-solution') && p17.includes('final-solution-row') && count(p17, 'class="work-row final-row"') === 6) pass('עמוד 17: דוגמה ותלמיד באותו פורמט אנכי.');
else fail('עמוד 17: הדוגמה ותרגילי התלמיד אינם באותו פורמט אנכי.');

for (const [label, css] of [['עמוד 16', p16css], ['עמוד 17', p17css]]) {
  const responsive = /@media\s*(?:screen\s+and\s*)?\([^)]*(?:max-width|min-width)[^)]*\)/iu.test(css);
  if (!responsive) pass(`${label}: אין responsive reflow מקומי.`);
  else fail(`${label}: נמצא breakpoint מקומי שסותר Exact A4.`);
}

console.log('\n=== Vertical Solution + Print Density Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
