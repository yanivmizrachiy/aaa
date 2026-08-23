const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const errors = [];
const warnings = [];
const ok = [];

function pass(message) { ok.push(message); }
function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }
function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  const header = Buffer.from(`blob ${body.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header, body])).digest('hex');
}
function readJson(file) {
  try { return JSON.parse(read(file)); }
  catch (error) { fail(`${file} אינו JSON תקין: ${error.message}`); return null; }
}

const manifest = readJson('WORKBOOK_MANIFEST.json');
const locks = readJson('meta/approved-page-locks.json');
const profile = readJson('STYLE_PROFILE.json');

/* סמכות יחידה. */
if (!exists('SOURCE_OF_TRUTH.md')) fail('חסר SOURCE_OF_TRUTH.md.');
else {
  const truth = read('SOURCE_OF_TRUTH.md');
  if (truth.includes('הסמכות היחידה') && truth.includes('WORKBOOK_MANIFEST.json')) pass('מקור האמת והיררכיית הסמכות מוגדרים.');
  else fail('SOURCE_OF_TRUTH.md אינו מגדיר היררכיית סמכות ברורה.');
  if (truth.includes('AAA Mobile Reader') && truth.includes('aaa-mobile-reader-approved')) pass('מקור האמת מגדיר את סטנדרט המובייל המאושר ואת מזהה הייחוס.');
  else fail('SOURCE_OF_TRUTH.md חייב להגדיר את AAA Mobile Reader ואת aaa-mobile-reader-approved.');
}

if (profile?.mobileReference?.id === 'aaa-mobile-reader-approved' && profile?.mobileReference?.status === 'golden-reference') {
  pass('STYLE_PROFILE.json שומר את AAA Mobile Reader כ-golden reference.');
} else {
  fail('STYLE_PROFILE.json אינו שומר את AAA Mobile Reader כ-golden reference.');
}

/* כניסה אחת בלבד לחוברת + חוזה מובייל מוקדם + גרסאות נכסים. */
if (!exists('index.html')) fail('חסר index.html — נקודת הכניסה היחידה לחוברת.');
else {
  const index = read('index.html');
  if (index.includes('pythagoras-workbook.js') && index.includes('styles/workbook-canonical-locks.css')) pass('index.html טוען את ה-loader ואת שכבת הנעילות.');
  else fail('index.html אינו טוען את מנגנון החוברת המלא.');

  const hasNoCacheMeta = /Cache-Control[^>]*no-cache[^>]*no-store/is.test(index)
    && /Pragma[^>]*no-cache/is.test(index)
    && /Expires[^>]*0/is.test(index);
  if (hasNoCacheMeta) pass('index.html כולל no-cache/no-store למניעת HTML ישן בצד הלקוח.');
  else fail('index.html חייב לכלול no-cache/no-store/Pragma/Expires כדי לצמצם שימוש ב-HTML ישן.');

  const bootstrapAt = index.indexOf("classList.toggle('mobile-reader'");
  const headerAt = index.indexOf('<header');
  const hasImmediateMobileBootstrap = bootstrapAt >= 0
    && headerAt >= 0
    && bootstrapAt < headerAt
    && index.includes('window.visualViewport?.width')
    && index.includes("width <= 720");
  if (hasImmediateMobileBootstrap) pass('mobile-reader מופעל מיד ב-entrypoint לפי visual viewport לפני תוכן החוברת.');
  else fail('index.html חייב להפעיל mobile-reader מיד, לפי visual viewport ועד 720px, לפני טעינת תוכן החוברת.');

  const coreAssetPatterns = [
    /styles\/a4-base\.css\?v=([^"']+)/u,
    /styles\/topics\/pythagoras\.css\?v=([^"']+)/u,
    /styles\/pythagoras-workbook\.css\?v=([^"']+)/u,
    /styles\/workbook-canonical-locks\.css\?v=([^"']+)/u,
    /pythagoras-workbook\.js\?v=([^"']+)/u,
  ];
  const versions = coreAssetPatterns.map((pattern) => index.match(pattern)?.[1]).filter(Boolean);
  if (versions.length === coreAssetPatterns.length && new Set(versions).size === 1) {
    pass(`נכסי הליבה משתמשים במזהה גרסה אחיד: ${versions[0]}.`);
  } else {
    fail('כל נכסי הליבה ב-index.html חייבים לקבל ?v= עם מזהה גרסה אחיד כדי למנוע מטמון מעורב.');
  }
}
if (exists('pythagoras-workbook.html')) fail('pythagoras-workbook.html חזר לריפו. יש entrypoint HTML יחיד בלבד: index.html.');
else pass('אין entrypoint HTML כפול.');

/* runtime יחיד ורענן. */
if (!exists('pythagoras-workbook.js')) {
  fail('חסר pythagoras-workbook.js.');
} else {
  const loader = read('pythagoras-workbook.js');
  if (loader.includes("const MANIFEST_URL = 'WORKBOOK_MANIFEST.json'")) pass('ה-loader משתמש ב-WORKBOOK_MANIFEST.json כמקור runtime.');
  else fail('ה-loader אינו מצביע ישירות על WORKBOOK_MANIFEST.json.');
  if (loader.includes('meta/topics.json') || loader.includes('buildPythagorasWorkbook')) fail('נמצא מקור runtime חלופי או fallback ישן.');
  else pass('אין fallback runtime למקור ישן.');
  if (loader.includes('const BUILD_VERSION = String(Date.now())')) pass('cache-busting אוטומטי פעיל בכל טעינת חוברת.');
  else fail('ה-loader אינו משתמש ב-cache-busting אוטומטי.');
  const noStoreCount = (loader.match(/cache:\s*'no-store'/g) || []).length;
  if (noStoreCount >= 2) pass('HTML והמניפסט נטענים עם cache:no-store.');
  else fail('טעינות runtime אינן משתמשות כולן ב-cache:no-store.');
  if (loader.includes("classList.toggle('mobile-reader'") && loader.includes('window.visualViewport?.width')) {
    pass('ה-loader ממשיך לסנכרן mobile-reader לאחר ה-bootstrap הראשוני.');
  } else {
    fail('pythagoras-workbook.js חייב להמשיך לסנכרן mobile-reader לפי visual viewport.');
  }
}

/* חוזה AAA Mobile Reader בשכבות התצוגה. */
if (!exists('styles/pythagoras-workbook.css')) {
  fail('חסר styles/pythagoras-workbook.css.');
} else {
  const css = read('styles/pythagoras-workbook.css');
  const requiredMobileTokens = [
    '.pythagoras-workbook-shell.mobile-reader',
    'width: 100% !important',
    'height: auto !important',
    'min-width: 0 !important',
    'transform: none !important',
    'overflow-x: hidden !important',
    'max-width: 100% !important',
  ];
  const missing = requiredMobileTokens.filter((token) => !css.includes(token));
  if (!missing.length) pass('שכבת החוברת מקיימת את חוזה responsive reflow של AAA Mobile Reader.');
  else fail(`styles/pythagoras-workbook.css חסר רכיבי חוזה מובייל: ${missing.join(' | ')}`);
}

if (!exists('styles/workbook-canonical-locks.css')) {
  fail('חסר styles/workbook-canonical-locks.css.');
} else {
  const canonical = read('styles/workbook-canonical-locks.css');
  if (canonical.includes('.pythagoras-workbook-shell.mobile-reader')
      && canonical.includes('grid-template-columns: 1fr !important')
      && canonical.includes('overflow: visible !important')) {
    pass('נעילות A4 משתחררות במובייל כדי לאפשר reflow קריא.');
  } else {
    fail('workbook-canonical-locks.css חייב לכלול overrides מפורשים ל-mobile-reader שמונעים קיבוע A4 בנייד.');
  }
}

if (exists('pythagoras-workbook-model.js')) fail('pythagoras-workbook-model.js הישן חזר לריפו.');
else pass('אין מודל runtime כפול.');
if (exists('meta/topics.json')) fail('meta/topics.json חזר לריפו ועלול ליצור מקור metadata מתחרה.');
else pass('אין meta/topics.json ישן בריפו הפעיל.');

/* פרסום: נתיב ציבורי יחיד + no-store לקבצי עבודה. */
if (!exists('vercel.json')) fail('חסר vercel.json.');
else {
  const vercel = readJson('vercel.json');
  if (vercel) {
    const redirects = Array.isArray(vercel.redirects) ? vercel.redirects : [];
    const alternateWorkbookRedirect = redirects.some((r) => String(r.destination || '').includes('pythagoras-workbook.html'));
    if (alternateWorkbookRedirect) fail('vercel.json מפנה ל-entrypoint חלופי של החוברת.');
    else pass('Vercel אינו מגדיר entrypoint חלופי לחוברת.');

    const headers = Array.isArray(vercel.headers) ? vercel.headers : [];
    const runtimePatterns = ['/', '/(.*)\\.html', '/(.*)\\.css', '/(.*)\\.js', '/(.*)\\.json', '/(.*)\\.svg'];
    for (const pattern of runtimePatterns) {
      const rule = headers.find((h) => h.source === pattern);
      const cache = rule?.headers?.find((h) => h.key.toLowerCase() === 'cache-control')?.value || '';
      if (!/no-store/i.test(cache)) fail(`vercel.json: ${pattern} אינו מוגדר no-store.`);
    }
    if (!errors.some((m) => m.startsWith('vercel.json:'))) pass('כל קבצי העבודה מוגדרים no-store ב-Vercel.');
  }
}

/* מניפסט קנוני וסגור: runtime בלבד, ללא metadata legacy. */
if (manifest) {
  const allowedRootKeys = ['schemaVersion', 'id', 'name', 'authority', 'totalPages', 'pages'];
  const allowedPageKeys = ['file', 'sourceNumber', 'workbookNumber', 'curriculumId', 'primaryTopic'];
  const forbiddenRootKeys = Object.keys(manifest).filter((key) => !allowedRootKeys.includes(key));
  if (forbiddenRootKeys.length) fail(`שדות לא מורשים במניפסט: ${forbiddenRootKeys.join(', ')}`);
  else pass('המניפסט מכיל רק שדות runtime קנוניים.');

  if (manifest.schemaVersion !== 2) fail('schemaVersion של המניפסט חייב להיות 2.');
  if (manifest.authority !== 'SOURCE_OF_TRUTH.md') fail('המניפסט אינו מצביע על SOURCE_OF_TRUTH.md כסמכות היחידה.');
  if (manifest.totalPages !== 53) fail('totalPages במניפסט חייב להיות 53.');
  const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
  if (pages.length === 53) pass('המניפסט מכיל בדיוק 53 דפים.');
  else fail(`המניפסט מכיל ${pages.length} דפים במקום 53.`);

  const files = pages.map((page) => page.file).filter(Boolean);
  if (new Set(files).size === files.length) pass('אין קובצי דף כפולים במניפסט.');
  else fail('נמצאו קובצי דף כפולים במניפסט.');

  pages.forEach((page, index) => {
    const extra = Object.keys(page).filter((key) => !allowedPageKeys.includes(key));
    if (extra.length) fail(`${page.file || `עמוד ${index + 1}`}: שדות legacy במניפסט: ${extra.join(', ')}`);
    if (page.workbookNumber !== index + 1) fail(`${page.file || `עמוד ${index + 1}`}: workbookNumber אינו רציף.`);
    if (page.curriculumId !== 'g7.geo.pythagoras') fail(`${page.file || `עמוד ${index + 1}`}: curriculumId שגוי.`);
    if (page.primaryTopic !== 'משפט פיתגורס') fail(`${page.file || `עמוד ${index + 1}`}: primaryTopic אינו משפט פיתגורס.`);
    if (!exists(page.file)) fail(`${page.file || `עמוד ${index + 1}`}: קובץ הדף חסר.`);
  });

  const active = new Set(files);
  const rootHtml = fs.readdirSync(root).filter((name) => /^עמוד-\d+\.html$/u.test(name));
  const inactive = rootHtml.filter((name) => !active.has(name));
  if (inactive.length) warn(`${inactive.length} קובצי עמוד היסטוריים אינם במניפסט; הם מנותקים מה-runtime ולא יימחקו אוטומטית.`);
}

/* נעילה עמוקה: קובצי הדף וכל תלות משותפת חייבים להתאים לגרסה שאומתה. */
if (locks) {
  if (locks.authority !== 'SOURCE_OF_TRUTH.md') fail('קובץ הנעילות אינו נגזר מ-SOURCE_OF_TRUTH.md.');
  else pass('סמכות הנעילות היא SOURCE_OF_TRUTH.md בלבד.');

  for (const pageLock of locks.pages || []) {
    if (pageLock.status !== 'locked') continue;
    if (/מוקטן|scale|zoom/u.test(String(pageLock.reason || ''))) {
      fail(`עמוד ${pageLock.workbookPage}: reason של הנעילה מכיל ניסוח מובייל ישן שסותר AAA Mobile Reader.`);
    }
    const allLocks = [
      ...(pageLock.files || []).map((item) => ({ ...item, kind: 'page' })),
      ...(pageLock.sharedDependencies || []).map((item) => ({ ...item, kind: 'shared' })),
    ];
    if (!(pageLock.sharedDependencies || []).length) fail(`עמוד ${pageLock.workbookPage}: נעילה ללא sharedDependencies אינה מגינה מפני שינוי רוחבי.`);
    for (const item of allLocks) {
      if (!exists(item.path)) {
        fail(`עמוד ${pageLock.workbookPage}: קובץ ${item.kind === 'shared' ? 'משותף' : 'נעול'} חסר: ${item.path}`);
        continue;
      }
      const actual = gitBlobSha(read(item.path));
      if (actual === item.gitBlobSha) pass(`עמוד ${pageLock.workbookPage}: ${item.path} תואם לנעילה.`);
      else fail(`עמוד ${pageLock.workbookPage}: ${item.path} השתנה מאז האימות. אסור לפרסם לפני אימות מחדש ועדכון הנעילה.`);
    }
  }
}

/* CSS של עמוד חייב להיות מקומי. */
const sensitiveClasses = [
  'page-title', 'header-container', 'question-block', 'q-main', 'q-sub',
  'gz-footer', 'foundation-note', 'foundation-grid', 'foundation-card',
];
function selectorHeaders(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const headers = [];
  const re = /([^{}]+)\{/g;
  let match;
  while ((match = re.exec(clean))) {
    const header = match[1].trim();
    if (!header || header.startsWith('@')) continue;
    if (/^(from|to|\d+(?:\.\d+)?%)$/u.test(header)) continue;
    headers.push(...header.split(',').map((part) => part.trim()).filter(Boolean));
  }
  return headers;
}

if (manifest) {
  for (const page of manifest.pages || []) {
    const file = page.file;
    if (!file) continue;
    const match = file.match(/עמוד-(\d+)\.html$/u);
    if (!match) continue;
    const sourceNumber = match[1];
    const cssPath = `styles/pages/עמוד-${sourceNumber}.css`;
    if (!exists(cssPath)) continue;
    const rootClass = `.page-${sourceNumber}`;
    for (const selector of selectorHeaders(read(cssPath))) {
      const touchesSensitive = sensitiveClasses.some((name) => selector.includes(`.${name}`));
      if (touchesSensitive && !selector.includes(rootClass)) fail(`${cssPath}: selector רגיש אינו תחום ל-${rootClass}: ${selector}`);
    }
  }
}

console.log('\n=== Pythagoras Repo Guard ===');
ok.forEach((message) => console.log(`✓ ${message}`));
warnings.forEach((message) => console.warn(`⚠ ${message}`));
errors.forEach((message) => console.error(`✗ ${message}`));
console.log(`\n${ok.length} תקין | ${warnings.length} אזהרות | ${errors.length} שגיאות`);
if (errors.length) process.exit(1);
