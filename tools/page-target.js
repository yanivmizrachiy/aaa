const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(readText(file));
const exists = (file) => fs.existsSync(path.join(root, file));

function fail(message) {
  console.error(message);
  process.exit(1);
}

const requested = Number(process.argv[2]);
if (!Number.isInteger(requested)) fail('שימוש: node tools/page-target.js <מספר עמוד בחוברת>');

const manifest = readJson('WORKBOOK_MANIFEST.json');
const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
if (pages.length !== 53) fail(`המניפסט אינו תקין: נמצאו ${pages.length} דפים במקום 53.`);
if (requested < 1 || requested > pages.length) fail(`מספר עמוד חייב להיות בין 1 ל-${pages.length}.`);

const page = pages[requested - 1];
if (!page?.file) fail(`לעמוד ${requested} אין file במניפסט.`);
const html = page.file;
const css = `styles/pages/${html.replace(/\.html$/u, '.css')}`;
if (!exists(html)) fail(`קובץ HTML חסר: ${html}`);
if (!exists(css)) fail(`קובץ CSS חסר: ${css}`);

const htmlText = readText(html);
const h1 = htmlText.match(/<h1[^>]*class=["'][^"']*page-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/iu)?.[1]
  ?.replace(/<[^>]+>/g, '')
  ?.trim() || null;

const locks = exists('meta/approved-page-locks.json') ? readJson('meta/approved-page-locks.json') : { pages: [] };
const lock = (locks.pages || []).find((item) => item.workbookPage === requested && item.status === 'locked') || null;
const sharedDependencies = (lock?.sharedDependencies || []).map((item) => item.path);

const result = {
  authority: 'SOURCE_OF_TRUTH.md',
  runtimeIndex: 'WORKBOOK_MANIFEST.json',
  workbookPage: requested,
  sourceNumber: page.sourceNumber ?? null,
  title: h1,
  html,
  css,
  locked: Boolean(lock),
  lockReason: lock?.reason ?? null,
  readBeforeEdit: [
    'SOURCE_OF_TRUTH.md',
    'WORKBOOK_MANIFEST.json',
    html,
    css,
    ...(lock ? ['meta/approved-page-locks.json', ...sharedDependencies] : []),
  ],
  defaultWriteSet: [html, css],
  conditionalWriteSet: lock
    ? ['meta/approved-page-locks.json — רק לאחר שינוי מפורש בעמוד ואימות התוצאה']
    : [],
  forbiddenByDefault: [
    'כל קובץ HTML של עמוד אחר',
    'styles/a4-base.css',
    'styles/topics/*',
    'styles/pythagoras-workbook.css',
    'styles/workbook-canonical-locks.css',
    'pythagoras-workbook.js',
    'index.html',
    'WORKBOOK_MANIFEST.json',
    'vercel.json',
  ],
  rule: 'שינוי מקומי קודם. עוברים לשכבה משותפת רק אם הדרישה באמת רוחבית ולא ניתן להשיג אותה בבטחה בקובצי העמוד.',
};

console.log(JSON.stringify(result, null, 2));
