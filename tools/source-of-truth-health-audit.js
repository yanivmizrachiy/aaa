const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const ok = [];
const pass = (m) => ok.push(m);
const fail = (m) => errors.push(m);

for (const file of ['SOURCE_OF_TRUTH.md', 'STYLE_PROFILE.json', 'WORKBOOK_MANIFEST.json', 'meta/approved-page-locks.json', 'vercel.json', 'tools/active-window-style-audit.js']) {
  if (!exists(file)) fail(`חסר ${file}.`);
}
if (errors.length) {
  errors.forEach((m) => console.error(`✗ ${m}`));
  process.exit(1);
}

const truth = read('SOURCE_OF_TRUTH.md');
const profile = JSON.parse(read('STYLE_PROFILE.json'));
const manifest = JSON.parse(read('WORKBOOK_MANIFEST.json'));
const locks = JSON.parse(read('meta/approved-page-locks.json'));
const vercel = read('vercel.json');
const pages = manifest.pages || [];
const locked = (locks.pages || []).filter((p) => p.status === 'locked').sort((a, b) => a.workbookPage - b.workbookPage);
const protectedEnd = locked.length ? locked[locked.length - 1].workbookPage : 0;
const activeStart = profile.learningProtocol?.activeAuditWindow?.startPage;
const activeEnd = profile.learningProtocol?.activeAuditWindow?.endPage;
const declaredProtectedEnd = Number(truth.match(/חומת ההגנה הרציפה כרגע היא עמודים \*\*1–(\d+)\*\*/u)?.[1] || 0);

const requiredTruth = [
  '# מקור האמת — חוברת משפט פיתגורס',
  '## חוזה עריכה אטומי — חובה בכל שינוי',
  '## חומת רגרסיה — דברים שתוקנו אינם חוזרים',
  '## AAA Exact A4 Preview',
  '## מערכת למידת הסגנון — חוזה מחייב',
  '**Production קורא רק מענף `release`.**',
  '**אין שתי אמיתות במקביל.**',
  '**אין להשאיר שטח A4 גדול ריק ללא מטרה.**',
  '**ניצול דף חכם קודם למרכוז.**',
  '**שטח תשובה מותאם לתשובה הצפויה:**',
  '**תוצאת חישוב נמצאת מתחת לתרגיל.**',
  '**פתרון רב־שלבי נכתב אנכית:**',
  '**הצד השמאלי אינו נעלם באמצע פתרון:**',
  'tools/active-window-style-audit.js',
];
for (const token of requiredTruth) truth.includes(token) ? pass(`מקור האמת כולל: ${token}`) : fail(`מקור האמת חסר: ${token}`);

const headingMatches = [...truth.matchAll(/^## עמוד (\d+) —/gmu)].map((m) => Number(m[1]));
const seen = new Map();
for (const n of headingMatches) seen.set(n, (seen.get(n) || 0) + 1);
for (const [n, count] of seen) if (count !== 1) fail(`עמוד ${n}: יש ${count} סעיפים במקור האמת במקום סעיף קנוני יחיד.`);
for (let n = 1; n <= Math.max(protectedEnd, activeEnd || 0); n += 1) {
  if ((seen.get(n) || 0) === 1) pass(`עמוד ${n}: סעיף קנוני יחיד במקור האמת.`);
  else fail(`עמוד ${n}: חסר סעיף קנוני יחיד במקור האמת.`);
}

for (const forbidden of [
  'המובייל המאושר הוא responsive reflow',
  'mobile-first קריא ולא A4 מוקטן',
  'עמוד 14 / 47',
  'עמוד 15 / 47',
  'tools/first-13-style-audit.js',
  'טווח הביקורת הפעיל כרגע הוא עמודים **1–13**',
]) {
  if (truth.includes(forbidden)) fail(`מקור האמת מכיל ניסוח legacy אסור: ${forbidden}`);
}

if (profile.authority === 'SOURCE_OF_TRUTH.md' && manifest.authority === 'SOURCE_OF_TRUTH.md' && locks.authority === 'SOURCE_OF_TRUTH.md') pass('כל הנגזרות כפופות למקור האמת היחיד.');
else fail('נמצאה נגזרת שאינה כפופה ל-SOURCE_OF_TRUTH.md.');

if (profile.productionGate?.workBranch === 'main' && profile.productionGate?.productionBranch === 'release' && profile.productionGate?.productionReadsOnly === 'release') pass('STYLE_PROFILE מגדיר release כשער Production יחיד.');
else fail('STYLE_PROFILE אינו מגדיר במדויק main→release כשער Production.');

if (vercel.includes('yanivmizrachiy/aaa/release/index.html') && vercel.includes('yanivmizrachiy/aaa/release/$1') && !vercel.includes('yanivmizrachiy/aaa/main/index.html')) pass('Vercel מפנה ל-release בלבד.');
else fail('vercel.json אינו מבודד Production מ-main.');

if (activeStart === 1 && activeEnd === 20) pass('חלון הלמידה הפעיל הוא 1–20.');
else fail(`חלון הלמידה צריך להיות 1–20, נמצא ${activeStart}–${activeEnd}.`);

if (pages.length === 53 && manifest.totalPages === 53) pass('המניפסט מכיל בדיוק 53 דפים.');
else fail('המניפסט אינו מכיל בדיוק 53 דפים.');

const lockNumbers = locked.map((p) => p.workbookPage);
if (lockNumbers.length === new Set(lockNumbers).size) pass('אין נעילות כפולות לאותו עמוד.');
else fail('נמצאו נעילות כפולות לאותו עמוד.');
for (let n = 1; n <= protectedEnd; n += 1) {
  if (lockNumbers.includes(n)) pass(`עמוד ${n}: מוגן בנעילה.`);
  else fail(`עמוד ${n}: חור בחומת הנעילות.`);
}

if (protectedEnd === activeEnd && declaredProtectedEnd === activeEnd) {
  pass(`חומת הנעילות, חלון הלמידה ומקור האמת מסונכרנים עד עמוד ${activeEnd}.`);
} else {
  fail(`פער מסוכן בחומת הרגרסיה: locks עד ${protectedEnd}, מקור האמת מצהיר עד ${declaredProtectedEnd}, חלון פעיל עד ${activeEnd}. שלושתם חייבים להיות זהים.`);
}

for (const lock of locked) {
  const meta = pages[lock.workbookPage - 1];
  if (!meta?.file) { fail(`עמוד ${lock.workbookPage}: חסר במניפסט.`); continue; }
  const expectedCss = `styles/pages/${meta.file.replace(/\.html$/u, '.css')}`;
  const paths = (lock.files || []).map((f) => f.path);
  if (paths.includes(meta.file) && paths.includes(expectedCss) && paths.length === 2) pass(`עמוד ${lock.workbookPage}: הנעילה מצביעה בדיוק ל-HTML ול-CSS הקנוניים.`);
  else fail(`עמוד ${lock.workbookPage}: הנעילה אינה תואמת לקבצים הקנוניים במניפסט.`);
  if (!String(lock.reason || '').trim()) fail(`עמוד ${lock.workbookPage}: חסר נימוק נעילה.`);
}

if (truth.includes(`עמודים **1–${protectedEnd}**`) || truth.includes(`עמודים 1–${protectedEnd}`)) pass(`מקור האמת מכיר בחומת ההגנה 1–${protectedEnd}.`);
else fail(`מקור האמת אינו מצהיר במפורש על חומת ההגנה 1–${protectedEnd}.`);

console.log('\n=== Source of Truth Health Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
