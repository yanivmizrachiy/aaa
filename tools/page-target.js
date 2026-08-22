const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

const requested = Number(process.argv[2]);
if (!Number.isInteger(requested)) {
  fail('שימוש: node tools/page-target.js <מספר עמוד בחוברת>');
}

const manifest = readJson('WORKBOOK_MANIFEST.json');
const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
if (pages.length !== 53) fail(`המניפסט אינו תקין: נמצאו ${pages.length} דפים במקום 53.`);
if (requested < 1 || requested > pages.length) fail(`מספר עמוד חייב להיות בין 1 ל-${pages.length}.`);

const page = pages[requested - 1];
if (!page?.file) fail(`לעמוד ${requested} אין file במניפסט.`);

const css = `styles/pages/${page.file.replace(/\.html$/u, '.css')}`;
const locksPath = path.join(root, 'meta/approved-page-locks.json');
let lock = null;
if (fs.existsSync(locksPath)) {
  const locks = readJson('meta/approved-page-locks.json');
  lock = (locks.pages || []).find((item) => item.workbookPage === requested && item.status === 'locked') || null;
}

const result = {
  workbookPage: requested,
  html: page.file,
  css,
  sourceNumber: page.sourceNumber ?? page.number ?? null,
  title: page.title ?? page.h1 ?? null,
  locked: Boolean(lock),
  lockReason: lock?.reason ?? null,
  rule: lock
    ? 'העמוד נעול. משנים אותו רק בעקבות בקשה מפורשת של המשתמש לעמוד הזה, ואז מעדכנים את הנעילה לאחר האימות.'
    : 'משנים רק את קבצי היעד הנדרשים; דפים אחרים נשארים מחוץ להיקף השינוי.',
};

console.log(JSON.stringify(result, null, 2));
