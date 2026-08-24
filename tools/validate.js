#!/usr/bin/env node
/**
 * בדיקת תקינות החוברת — השער האוטומטי היחיד.
 *
 * SOURCE_OF_TRUTH.md הוא מקור הסמכות היחיד לדרישות הפרויקט.
 * WORKBOOK_MANIFEST.json הוא רישום runtime לסדר, זהות ומספור הדפים.
 * הבדיקה מוודאת שמבנה החוברת, הדפים, ה-CSS ומעטפת הטעינה עקביים ושהחוברת תיטען בדפדפן.
 *
 *   node tools/validate.js   →  יוצא 0 אם תקין, 1 אם יש שגיאה.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const errors = [];
const warnings = [];
let checks = 0;
const fail = (m) => errors.push(m);
const check = (cond, m) => { checks += 1; if (!cond) errors.push(m); };
const softCheck = (cond, m) => { checks += 1; if (!cond) warnings.push(m); };

const CURRICULUM_ID = 'g7.geo.pythagoras';
const PRIMARY_TOPIC = 'משפט פיתגורס';

/* קובצי הליבה שהחוברת וממשל הדרישות לא יכולים לרוץ בלעדיהם. */
for (const f of [
  'SOURCE_OF_TRUTH.md',
  'README.md',
  'DESIGN.md',
  'index.html',
  'pythagoras-workbook.js',
  'WORKBOOK_MANIFEST.json',
  'vercel.json',
  'styles/a4-base.css',
  'styles/pythagoras-workbook.css',
  'styles/topics/pythagoras.css',
]) check(exists(f), `חסר קובץ ליבה: ${f}`);

/* אכיפת מקור אמת יחיד: מסמכי העזר חייבים להפנות אליו ולא להציג סמכות עצמאית. */
if (exists('SOURCE_OF_TRUTH.md')) {
  const truth = read('SOURCE_OF_TRUTH.md');
  check(truth.includes('מקור האמת היחיד'), 'SOURCE_OF_TRUTH.md אינו מצהיר במפורש שהוא מקור האמת היחיד.');
  check(truth.includes('ריבועי אורכי הניצבים'), 'SOURCE_OF_TRUTH.md חסר כלל הדיוק בין אורך לריבוע אורך.');
}
if (exists('README.md')) {
  check(read('README.md').includes('SOURCE_OF_TRUTH.md'), 'README.md אינו מפנה ל-SOURCE_OF_TRUTH.md.');
}
if (exists('DESIGN.md')) {
  check(read('DESIGN.md').includes('SOURCE_OF_TRUTH.md'), 'DESIGN.md אינו כפוף במפורש ל-SOURCE_OF_TRUTH.md.');
}

/* המניפסט — רישום runtime לסדר ולזהות הדפים. */
let manifest = null;
try { manifest = JSON.parse(read('WORKBOOK_MANIFEST.json')); }
catch (e) { fail(`WORKBOOK_MANIFEST.json אינו JSON תקין: ${e.message}`); }

const pages = manifest && Array.isArray(manifest.pages) ? manifest.pages : [];
if (manifest) {
  check(manifest.id === 'pythagoras', 'המניפסט: id צריך להיות "pythagoras".');
  check(pages.length >= 1, 'המניפסט: אין דפים.');
  const declared = Number(manifest.totalPages);
  check(declared === pages.length, `המניפסט: totalPages (${manifest.totalPages}) אינו תואם למספר הדפים בפועל (${pages.length}).`);
  const files = pages.map((p) => p && p.file).filter(Boolean);
  check(new Set(files).size === files.length, 'המניפסט: קיימים קובצי דף כפולים.');
}

/* לכל דף: קיים, מכיל main.a4-page, ויש לו CSS ייעודי תחום לשורש שלו. */
const SENSITIVE = ['page-title', 'header-container', 'question-block', 'q-main', 'q-sub', 'gz-footer', 'foundation-note', 'foundation-grid', 'foundation-card'];
function selectors(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(clean))) {
    const header = m[1].trim();
    if (!header || header.startsWith('@') || /^(from|to|\d+(?:\.\d+)?%)$/u.test(header)) continue;
    out.push(...header.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

function inlineMathExpressions(html) {
  const expressions = [];
  const re = /\\\(([\s\S]*?)\\\)/gu;
  let match;
  while ((match = re.exec(html))) expressions.push(match[1]);
  return expressions;
}

pages.forEach((page, index) => {
  const n = index + 1;
  const file = page && page.file;
  if (!file) { fail(`עמוד ${n}: חסר שדה "file" במניפסט.`); return; }

  check(page.workbookNumber === n, `${file}: workbookNumber צריך להיות ${n} (רציף).`);
  check(page.curriculumId === CURRICULUM_ID, `${file}: curriculumId צריך להיות "${CURRICULUM_ID}".`);
  check(page.primaryTopic === PRIMARY_TOPIC, `${file}: primaryTopic צריך להיות "${PRIMARY_TOPIC}".`);

  if (!exists(file)) { fail(`עמוד ${n}: קובץ ה-HTML חסר: ${file}`); return; }
  const html = read(file);
  check(/<main[^>]*class=["'][^"']*\ba4-page\b/u.test(html), `${file}: חסר <main class="a4-page"> — ה-loader מחלץ בדיוק אותו.`);

  /* שומרי רינדור מתמטי: תקלות שכבר גרמו בפועל ל-DOM שבור/סימנים תלושים. */
  const inlineMath = inlineMathExpressions(html);
  check(!inlineMath.some((expr) => /<[A-Za-z]/u.test(expr)), `${file}: נמצא < לפני אות בתוך MathJax; הדפדפן עלול לפרש זאת כתג HTML. יש להשתמש ב-\\lt.`);
  check(!inlineMath.some((expr) => /^\\(?:lt|gt)$/u.test(expr.trim())), `${file}: נמצא אופרטור MathJax בודד (\\lt/\\gt). יש להצמיד את הסימן לשורה כטקסט בטוח כדי שלא יתנתק ברינדור.`);
  check(!html.includes('\\times'), `${file}: נמצא \\times; לפי SOURCE_OF_TRUTH.md סימן הכפל בפרויקט הוא \\cdot.`);
  check(!html.includes('×'), `${file}: נמצא ×; לפי SOURCE_OF_TRUTH.md סימן הכפל בפרויקט הוא · / \\cdot.`);

  const match = file.match(/עמוד-(\d+)\.html$/u);
  if (!match) return;
  const cssPath = `styles/pages/עמוד-${match[1]}.css`;
  if (!exists(cssPath)) { fail(`עמוד ${n}: חסר CSS ייעודי: ${cssPath}`); return; }

  const rootClass = `.page-${match[1]}`;
  for (const sel of selectors(read(cssPath))) {
    if (sel === ':root' || sel === 'html' || sel === 'body') {
      fail(`${cssPath}: אסור selector גלובלי בקובץ CSS של עמוד: "${sel}".`);
    } else if (SENSITIVE.some((c) => sel.includes(`.${c}`)) && !sel.includes(rootClass)) {
      fail(`${cssPath}: selector רגיש אינו תחום ל-${rootClass}: "${sel}".`);
    }
  }
});

/* דפי HTML בשורש שאינם במניפסט — מנותקים מה-runtime (אזהרה בלבד). */
if (manifest) {
  const active = new Set(pages.map((p) => p && p.file));
  const orphans = fs.readdirSync(root).filter((f) => /^עמוד-\d+\.html$/u.test(f) && !active.has(f));
  softCheck(orphans.length === 0, `${orphans.length} דפי HTML אינם במניפסט ומנותקים מה-runtime: ${orphans.join(', ')}`);
}

/* מעטפת הטעינה וצינור הפרסום. */
if (exists('index.html')) {
  const idx = read('index.html');
  check(idx.includes('pythagoras-workbook.js'), 'index.html אינו טוען את pythagoras-workbook.js.');
  check(/<main[^>]*id=["']workbook["']/u.test(idx), 'index.html: חסר <main id="workbook"> שאליו נטענים הדפים.');
}
if (exists('pythagoras-workbook.js')) {
  check(read('pythagoras-workbook.js').includes('WORKBOOK_MANIFEST.json'), 'ה-loader אינו מפנה ל-WORKBOOK_MANIFEST.json.');
}
if (exists('vercel.json')) {
  try {
    const vercel = JSON.parse(read('vercel.json'));
    const rules = [...(vercel.rewrites || []), ...(vercel.redirects || [])];
    check(rules.some((r) => String(r.destination || '').includes('/release/')), 'vercel.json אינו מפנה לענף release.');
  } catch (e) { fail(`vercel.json אינו JSON תקין: ${e.message}`); }
}

/* דו"ח. */
console.log('=== בדיקת תקינות חוברת פיתגורס ===');
warnings.forEach((w) => console.warn(`⚠ ${w}`));
errors.forEach((e) => console.error(`✗ ${e}`));
if (!errors.length) console.log(`✓ הכל תקין — ${checks} בדיקות עברו, ${pages.length} דפים מסונכרנים עם המניפסט ומקור האמת.`);
console.log(`\n${checks} בדיקות · ${warnings.length} אזהרות · ${errors.length} שגיאות`);
process.exit(errors.length ? 1 : 0);
