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

/* סמכות יחידה + חוזה מובייל קנוני. */
if (!exists('SOURCE_OF_TRUTH.md')) {
  fail('חסר SOURCE_OF_TRUTH.md.');
} else {
  const truth = read('SOURCE_OF_TRUTH.md');
  if (truth.includes('הסמכות היחידה') && truth.includes('WORKBOOK_MANIFEST.json')) pass('מקור האמת והיררכיית הסמכות מוגדרים.');
  else fail('SOURCE_OF_TRUTH.md אינו מגדיר היררכיית סמכות ברורה.');
  if (truth.includes('AAA Exact A4 Preview') && truth.includes('aaa-exact-a4-preview')) pass('מקור האמת מגדיר Exact A4 Preview כסטנדרט המובייל.');
  else fail('SOURCE_OF_TRUTH.md חייב להגדיר AAA Exact A4 Preview ואת aaa-exact-a4-preview.');
  if (/responsive reflow קריא|mobile-first קריא ולא A4 מוקטן/u.test(truth)) fail('נשאר במקור האמת ניסוח מובייל ישן שסותר Exact A4 Preview.');
}

if (profile?.mobileReference?.id === 'aaa-exact-a4-preview' && profile?.mobileReference?.status === 'golden-reference') {
  pass('STYLE_PROFILE.json שומר Exact A4 Preview כ-golden reference.');
} else {
  fail('STYLE_PROFILE.json אינו שומר aaa-exact-a4-preview כ-golden reference.');
}
if (profile?.mobileReference?.contentReflow === 'forbidden' && profile?.mobileReference?.printLayout === 'A4-identical') {
  pass('פרופיל המובייל אוסר reflow ושומר זהות להדפסה.');
} else {
  fail('STYLE_PROFILE.json חייב לאסור reflow ולשמור A4-identical.');
}

/* entrypoint יחיד, מטמון, ומנגנון התאמה חיצוני של A4. */
if (!exists('index.html')) {
  fail('חסר index.html.');
} else {
  const index = read('index.html');
  if (index.includes('pythagoras-workbook.js') && index.includes('styles/workbook-canonical-locks.css')) pass('index.html טוען את החוברת ואת שכבת הנעילות.');
  else fail('index.html אינו טוען את מנגנון החוברת המלא.');

  const hasNoCacheMeta = /Cache-Control[^>]*no-cache[^>]*no-store/is.test(index)
    && /Pragma[^>]*no-cache/is.test(index)
    && /Expires[^>]*0/is.test(index);
  if (hasNoCacheMeta) pass('index.html כולל no-cache/no-store.');
  else fail('index.html חייב לכלול no-cache/no-store/Pragma/Expires.');

  const exactPreviewTokens = [
    "classList.toggle('mobile-print-preview'",
    "classList.remove('mobile-reader')",
    'fitPrintedPages',
    'const canonicalWidth = page.offsetWidth',
    'const canonicalHeight = page.offsetHeight',
    'const scale = Math.min(1, available / canonicalWidth)',
    'const left = Math.max(0, (available - scaledWidth) / 2)',
    "page.style.transformOrigin = 'top left'",
    'page.style.transform = `scale(${scale})`',
  ];
  const missing = exactPreviewTokens.filter((token) => !index.includes(token));
  if (!missing.length) pass('index.html מקיים את חוזה Exact A4 Preview הממורכז.');
  else fail(`index.html חסר רכיבי Exact A4 Preview: ${missing.join(' | ')}`);

  const coreAssetPatterns = [
    /styles\/a4-base\.css\?v=([^"']+)/u,
    /styles\/topics\/pythagoras\.css\?v=([^"']+)/u,
    /styles\/pythagoras-workbook\.css\?v=([^"']+)/u,
    /styles\/workbook-canonical-locks\.css\?v=([^"']+)/u,
    /pythagoras-workbook\.js\?v=([^"']+)/u,
  ];
  const versions = coreAssetPatterns.map((pattern) => index.match(pattern)?.[1]).filter(Boolean);
  if (versions.length === coreAssetPatterns.length && new Set(versions).size === 1) pass(`נכסי הליבה משתמשים במזהה גרסה אחיד: ${versions[0]}.`);
  else fail('כל נכסי הליבה ב-index.html חייבים לקבל ?v= עם מזהה גרסה אחיד.');
}
if (exists('pythagoras-workbook.html')) fail('אסור entrypoint כפול: pythagoras-workbook.html.');
else pass('אין entrypoint HTML כפול.');

/* runtime יחיד ורענן. */
if (!exists('pythagoras-workbook.js')) {
  fail('חסר pythagoras-workbook.js.');
} else {
  const loader = read('pythagoras-workbook.js');
  if (loader.includes("const MANIFEST_URL = 'WORKBOOK_MANIFEST.json'")) pass('ה-loader משתמש במניפסט כמקור runtime יחיד.');
  else fail('ה-loader אינו מצביע על WORKBOOK_MANIFEST.json.');
  if (loader.includes('meta/topics.json') || loader.includes('buildPythagorasWorkbook')) fail('נמצא fallback runtime ישן.');
  else pass('אין fallback runtime ישן.');
  if (loader.includes('const BUILD_VERSION = String(Date.now())')) pass('cache-busting אוטומטי פעיל ב-loader.');
  else fail('ה-loader אינו משתמש ב-cache-busting אוטומטי.');
  const noStoreCount = (loader.match(/cache:\s*'no-store'/g) || []).length;
  if (noStoreCount >= 2) pass('HTML והמניפסט נטענים עם cache:no-store.');
  else fail('טעינות runtime אינן משתמשות כולן ב-cache:no-store.');
}

/* מעטפת החוברת חייבת למנוע גלילה אופקית; אין דרישה ל-reflow פנימי. */
if (!exists('styles/pythagoras-workbook.css')) {
  fail('חסר styles/pythagoras-workbook.css.');
} else {
  const css = read('styles/pythagoras-workbook.css');
  if (css.includes('overflow-x: hidden') && css.includes('touch-action: pan-y pinch-zoom')) pass('מעטפת החוברת מונעת גלילה אופקית ומשאירה pinch-zoom.');
  else fail('מעטפת החוברת חייבת למנוע overflow אופקי ולאפשר pinch-zoom.');
}

/* פרסום: no-store לכל נכסי העבודה. */
if (!exists('vercel.json')) {
  fail('חסר vercel.json.');
} else {
  const vercel = readJson('vercel.json');
  if (vercel) {
    const redirects = Array.isArray(vercel.redirects) ? vercel.redirects : [];
    if (redirects.some((r) => String(r.destination || '').includes('pythagoras-workbook.html'))) fail('Vercel מפנה ל-entrypoint חלופי.');
    else pass('Vercel אינו מגדיר entrypoint חלופי.');
    const headers = Array.isArray(vercel.headers) ? vercel.headers : [];
    const runtimePatterns = ['/', '/(.*)\\.html', '/(.*)\\.css', '/(.*)\\.js', '/(.*)\\.json', '/(.*)\\.svg'];
    for (const pattern of runtimePatterns) {
      const rule = headers.find((h) => h.source === pattern);
      const cache = rule?.headers?.find((h) => h.key.toLowerCase() === 'cache-control')?.value || '';
      if (!/no-store/i.test(cache)) fail(`vercel.json: ${pattern} אינו מוגדר no-store.`);
    }
  }
}

/* מניפסט קנוני. */
if (manifest) {
  if (manifest.schemaVersion !== 2) fail('schemaVersion של המניפסט חייב להיות 2.');
  if (manifest.authority !== 'SOURCE_OF_TRUTH.md') fail('המניפסט אינו מצביע על SOURCE_OF_TRUTH.md.');
  if (manifest.totalPages !== 53) fail('totalPages במניפסט חייב להיות 53.');
  const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
  if (pages.length === 53) pass('המניפסט מכיל בדיוק 53 דפים.');
  else fail(`המניפסט מכיל ${pages.length} דפים במקום 53.`);
  const files = pages.map((page) => page.file).filter(Boolean);
  if (new Set(files).size === files.length) pass('אין קובצי דף כפולים במניפסט.');
  else fail('נמצאו קובצי דף כפולים במניפסט.');
  pages.forEach((page, index) => {
    if (page.workbookNumber !== index + 1) fail(`${page.file || `עמוד ${index + 1}`}: workbookNumber אינו רציף.`);
    if (page.curriculumId !== 'g7.geo.pythagoras') fail(`${page.file || `עמוד ${index + 1}`}: curriculumId שגוי.`);
    if (page.primaryTopic !== 'משפט פיתגורס') fail(`${page.file || `עמוד ${index + 1}`}: primaryTopic שגוי.`);
    if (!exists(page.file)) fail(`${page.file || `עמוד ${index + 1}`}: קובץ הדף חסר.`);
  });
  const active = new Set(files);
  const rootHtml = fs.readdirSync(root).filter((name) => /^עמוד-\d+\.html$/u.test(name));
  const inactive = rootHtml.filter((name) => !active.has(name));
  if (inactive.length) warn(`${inactive.length} קובצי עמוד היסטוריים אינם במניפסט ומנותקים מה-runtime.`);
}

/* נעילות עמוקות. */
if (locks) {
  if (locks.authority !== 'SOURCE_OF_TRUTH.md') fail('קובץ הנעילות אינו נגזר מ-SOURCE_OF_TRUTH.md.');
  else pass('סמכות הנעילות היא SOURCE_OF_TRUTH.md בלבד.');
  for (const pageLock of locks.pages || []) {
    if (pageLock.status !== 'locked') continue;
    const allLocks = [
      ...(pageLock.files || []).map((item) => ({ ...item, kind: 'page' })),
      ...(pageLock.sharedDependencies || []).map((item) => ({ ...item, kind: 'shared' })),
    ];
    for (const item of allLocks) {
      if (!exists(item.path)) {
        fail(`עמוד ${pageLock.workbookPage}: קובץ חסר: ${item.path}`);
        continue;
      }
      const actual = gitBlobSha(read(item.path));
      if (actual !== item.gitBlobSha) fail(`עמוד ${pageLock.workbookPage}: ${item.path} השתנה מאז האימות.`);
    }
  }
}

/* CSS של עמוד חייב להיות מקומי. */
const sensitiveClasses = ['page-title', 'header-container', 'question-block', 'q-main', 'q-sub', 'gz-footer', 'foundation-note', 'foundation-grid', 'foundation-card'];
function selectorHeaders(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const headers = [];
  const re = /([^{}]+)\{/g;
  let match;
  while ((match = re.exec(clean))) {
    const header = match[1].trim();
    if (!header || header.startsWith('@') || /^(from|to|\d+(?:\.\d+)?%)$/u.test(header)) continue;
    headers.push(...header.split(',').map((part) => part.trim()).filter(Boolean));
  }
  return headers;
}
if (manifest) {
  for (const page of manifest.pages || []) {
    const match = String(page.file || '').match(/עמוד-(\d+)\.html$/u);
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
