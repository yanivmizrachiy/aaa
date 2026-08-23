const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const json = (p) => JSON.parse(read(p));

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function imports(css) {
  return [...css.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
}

function mainClasses(html) {
  const raw = html.match(/<main[^>]*class=["']([^"']+)["']/iu)?.[1] || '';
  return raw.split(/\s+/u).filter(Boolean);
}

function pageCssPath(file) {
  return `styles/pages/${file.replace(/\.html$/u, '.css')}`;
}

function run(script, env = process.env) {
  console.log(`\n▶ ${script}`);
  execFileSync(process.execPath, [path.join(root, script)], { cwd: root, env, stdio: 'inherit' });
}

const args = process.argv.slice(2);
const ciMode = args.includes('--ci');
const checkMode = args.includes('--check') || ciMode;
const pageArg = args.find((arg) => /^\d+$/u.test(arg));

for (const required of ['SOURCE_OF_TRUTH.md', 'STYLE_PROFILE.json', 'WORKBOOK_MANIFEST.json']) {
  if (!exists(required)) fail(`חסר ${required}`);
}

const manifest = json('WORKBOOK_MANIFEST.json');
const profile = json('STYLE_PROFILE.json');
const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
if (pages.length !== 53) fail(`נמצאו ${pages.length} דפים במקום 53.`);
if (profile.authority !== 'SOURCE_OF_TRUTH.md') fail('STYLE_PROFILE.json אינו כפוף למקור האמת היחיד.');

if (pageArg) {
  const requested = Number(pageArg);
  if (requested < 1 || requested > pages.length) fail(`מספר עמוד חייב להיות בין 1 ל-${pages.length}.`);

  const target = pages[requested - 1];
  const htmlPath = target.file;
  const cssPath = pageCssPath(htmlPath);
  if (!exists(htmlPath) || !exists(cssPath)) fail(`קובצי עמוד ${requested} חסרים.`);

  const targetHtml = read(htmlPath);
  const targetCss = read(cssPath);
  const targetImports = new Set(imports(targetCss));
  const ignoredClasses = new Set(['a4-page', 'pythagoras']);
  const targetClasses = new Set(mainClasses(targetHtml).filter((c) => !ignoredClasses.has(c) && !/^page-\d+$/u.test(c)));

  const related = [];
  pages.forEach((page, index) => {
    if (index === requested - 1 || !page.file || !exists(page.file)) return;
    const otherCssPath = pageCssPath(page.file);
    const otherHtml = read(page.file);
    const otherCss = exists(otherCssPath) ? read(otherCssPath) : '';
    const sharedImports = imports(otherCss).filter((item) => targetImports.has(item));
    const sharedClasses = mainClasses(otherHtml).filter((c) => targetClasses.has(c));
    const signals = [...new Set([...sharedImports.map((x) => `import:${x}`), ...sharedClasses.map((x) => `class:${x}`)])];
    if (signals.length) related.push({ workbookPage: index + 1, file: page.file, signals });
  });

  const title = targetHtml.match(/<h1[^>]*class=["'][^"']*page-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/iu)?.[1]
    ?.replace(/<[^>]+>/gu, '').trim() || null;

  const output = {
    authority: 'SOURCE_OF_TRUTH.md',
    target: { workbookPage: requested, file: htmlPath, css: cssPath, title },
    safeWriteSet: [htmlPath, cssPath, 'SOURCE_OF_TRUTH.md'],
    reviewBeforeWrite: related,
    propagationRule: 'דפים קשורים נבדקים להתאמה, אך אינם נערכים אוטומטית. עורכים אותם רק כאשר הדרישה עצמה משותפת ולאחר בדיקת השפעה.',
    learningRule: 'דרישה חוזרת או כלל שניתן להכללה נרשמים פעם אחת במקור האמת ומקבלים כלל נגזר ב-STYLE_PROFILE.json במקום ליצור תיקונים סותרים.',
    speedRule: 'ממפים יעד וקשרים תחילה, מבצעים שינוי מינימלי, ואז מריצים בדיקות מרוכזות.',
  };
  console.log(JSON.stringify(output, null, 2));
}

if (!pageArg && !ciMode) {
  fail('שימוש: node tools/smart-edit.js <מספר עמוד> [--check] או node tools/smart-edit.js --ci');
}

if (checkMode) {
  run('tools/style-audit.js');
  run('tools/repo-guard.js');
  run('tools/content-contracts.js');
  run('tools/workbook-visual-guard.js');
  if (process.env.BASE_SHA && !/^0+$/u.test(process.env.BASE_SHA)) run('tools/change-scope-audit.js', process.env);
  else console.log('\nℹ BASE_SHA לא זמין — בדיקת diff תתבצע ב-CI.');
}
