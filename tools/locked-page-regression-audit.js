const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const ok = [];
const pass = (m) => ok.push(m);
const fail = (m) => errors.push(m);

function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  const header = Buffer.from(`blob ${body.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header, body])).digest('hex');
}

const locks = JSON.parse(read('meta/approved-page-locks.json'));
const manifest = JSON.parse(read('WORKBOOK_MANIFEST.json'));
const pages = manifest.pages || [];
const locked = (locks.pages || []).filter((p) => p.status === 'locked').sort((a, b) => a.workbookPage - b.workbookPage);

for (const lock of locked) {
  const n = lock.workbookPage;
  const meta = pages[n - 1];
  if (!meta?.file) { fail(`עמוד ${n}: חסר במניפסט.`); continue; }
  const htmlPath = meta.file;
  const cssPath = `styles/pages/${htmlPath.replace(/\.html$/u, '.css')}`;
  const fileLocks = new Map((lock.files || []).map((item) => [item.path, item.gitBlobSha]));

  for (const p of [htmlPath, cssPath]) {
    if (!exists(p)) { fail(`עמוד ${n}: חסר ${p}.`); continue; }
    const expected = fileLocks.get(p);
    if (!expected) { fail(`עמוד ${n}: ${p} אינו נעול.`); continue; }
    const actual = gitBlobSha(read(p));
    if (actual === expected) pass(`עמוד ${n}: ${p} תואם לנעילה.`);
    else fail(`עמוד ${n}: ${p} השתנה בלי נעילה תואמת — רגרסיה חסומה.`);
  }

  if (exists(htmlPath)) {
    const html = read(htmlPath);
    if (html.includes(`עמוד ${n} / 53`)) pass(`עמוד ${n}: מונה /53 נשמר.`);
    else fail(`עמוד ${n}: מונה החוברת חזר לגרסה ישנה.`);
    if (html.includes(`<div class="page-number">${n}</div>`)) pass(`עמוד ${n}: מספר פנימי נשמר.`);
    else fail(`עמוד ${n}: מספר פנימי השתנה.`);
    if (/עמוד\s+\d+\s*\/\s*47/u.test(html)) fail(`עמוד ${n}: חזר מונה legacy /47.`);
  }

  if (exists(cssPath)) {
    const css = read(cssPath);
    const responsive = /@media\s*(?:screen\s+and\s*)?\([^)]*(?:max-width|min-width)[^)]*\)/iu.test(css);
    if (!responsive) pass(`עמוד ${n}: אין breakpoint מקומי שמשנה A4.`);
    else fail(`עמוד ${n}: חזר responsive reflow מקומי.`);
  }
}

const requiredPageContracts = {
  6: ['page6-thinking-zone', 'pattern-row'],
  7: ['match-board', 'mixed-grid', 'error-grid', 'final-grid'],
  8: ['direct-root-grid', 'reverse-root-grid', 'perfect-square-grid', 'bridge-grid'],
  9: ['solution-meaning-strip', 'case-grid', 'equation-case-grid', 'negative-root-rule', 'root-practice-grid'],
  10: ['bounds-grid', 'calculator-grid', 'reasonableness-grid', 'error-grid', 'build-root-card'],
  11: ['page11-top-band', 'page11-example-steps', 'top-guided-practice', 'direct-solution-scaffold'],
  12: ['square-task-grid', 'answer-fit-one-digit', 'answer-fit-two-digit', 'answer-fit-symbol-square'],
  13: ['page13-figure-task', 'page13-relation-task', 'page13-reverse-task', 'page13-generalize-task'],
  14: ['page14-definition-band', 'applicability-grid', 'structure-grid', 'final-check-grid'],
  15: ['page15-rule-band', 'equation-diagram-grid', 'identify-grid', 'mistake-grid'],
  16: ['page16-example', 'equation-from-diagram', 'operation-task', 'full-solve-task', 'page16-final-task'],
  17: ['page17-example', 'page17-practice-grid', 'page17-final-check', 'final-check-stack'],
  18: ['page18-reminder', 'page18-grid', 'page18-compare'],
  19: ['page19-reminder', 'page19-grid', 'page19-error'],
  20: ['page20-rule', 'page20-choice-grid', 'page20-grid', 'page20-final-grid'],
};
for (const [nRaw, tokens] of Object.entries(requiredPageContracts)) {
  const n = Number(nRaw);
  const meta = pages[n - 1];
  if (!meta?.file || !exists(meta.file)) continue;
  const html = read(meta.file);
  const missing = tokens.filter((t) => !html.includes(t));
  if (!missing.length) pass(`עמוד ${n}: החוזה הפדגוגי המוגן נשמר.`);
  else fail(`עמוד ${n}: חסרו רכיבים שכבר אושרו: ${missing.join(', ')}`);

  if (n === 16 && html.includes('<span class="lhs"></span>')) fail('עמוד 16: חזר צד שמאל ריק באמצע פתרון.');
  if (n >= 17 && n <= 20 && /<div class="work-row"><span><\/span><b>=<\/b>/u.test(html)) fail(`עמוד ${n}: חזר צד שמאל ריק באמצע פתרון.`);
}

for (const item of locks.sharedDependencies || []) {
  if (!exists(item.path)) { fail(`תלות משותפת חסרה: ${item.path}.`); continue; }
  const actual = gitBlobSha(read(item.path));
  if (actual === item.gitBlobSha) pass(`תלות משותפת נעולה: ${item.path}.`);
  else fail(`תלות משותפת השתנתה בלי רענון מאומת של חומת הנעילות: ${item.path}.`);
}

console.log('\n=== Locked Page Regression Audit ===');
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
console.log(`\n${ok.length} תקין | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
