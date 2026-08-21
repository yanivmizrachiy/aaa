import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const SOURCE_BASE = 'https://raw.githubusercontent.com/yanivmizrachiy/pythagoras/405696a512417922e09eb7720400157782a13399/.canonical';
const PARTS = ['part-000','part-001','part-002','part-003'];
const EXPECTED_SHA = '1a5fff4b9c4c845eeb36c1f2d9a4743cd4e8a8bf7f45a27230abf50f3e06a8bb';
const repoRoot = process.cwd();

function run(cmd, args, cwd = process.cwd()) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } });
  if (result.status !== 0) throw new Error(`${cmd} failed with exit code ${result.status}`);
}
async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response.text();
}
function findPackageRoot(root) {
  if (fs.existsSync(path.join(root, 'package.json'))) return root;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(root, entry.name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  throw new Error('package.json not found in canonical Pythagoras project');
}
function walkHtml(root, current = root, out = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walkHtml(root, full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(path.relative(root, full).replaceAll(path.sep, '/'));
  }
  return out;
}
function countWorkbookPages(projectRoot) {
  const pagesRoot = path.join(projectRoot, 'src', 'pages');
  if (!fs.existsSync(pagesRoot)) return 0;
  return walkHtml(pagesRoot).filter((p) => p.endsWith('main.html')).length;
}
function ensureRootIndex(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) return;
  const html = walkHtml(distDir).filter((p) => p !== 'index.html');
  if (!html.length) throw new Error('Build produced no HTML files');
  const score = (p) => {
    const lower = p.toLowerCase();
    if (lower.endsWith('/workbook.html') || lower === 'workbook.html') return 0;
    if (/((^|\/)(page[-_ ]?0*1|0*1)(\/|$))/.test(lower)) return 1;
    if (lower.endsWith('/main.html') || lower === 'main.html') return 2;
    return 3;
  };
  html.sort((a, b) => score(a) - score(b) || a.localeCompare(b, 'en'));
  const target = html[0];
  const escaped = target.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  fs.writeFileSync(indexPath, `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${escaped}"><title>משפט פיתגורס</title></head><body><p><a href="${escaped}">פתיחת דפי משפט פיתגורס</a></p></body></html>`, 'utf8');
}
function enhanceHtml(distDir) {
  const css = `<style id="aaa-workbook-ui">html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}body{font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}button,a,[role="button"],input,select,textarea{touch-action:manipulation}button,[role="button"],input[type="button"],input[type="submit"]{min-height:42px;border-radius:10px}input,select,textarea{max-width:100%;font:inherit}input:focus,select:focus,textarea:focus,button:focus-visible,a:focus-visible{outline:3px solid rgba(31,95,139,.28);outline-offset:2px}img,svg,canvas{max-width:100%;height:auto}@media(max-width:720px){body{overflow-x:hidden}button,[role="button"],input[type="button"],input[type="submit"]{min-height:46px}}@media print{html,body{background:#fff!important}*{animation:none!important;transition:none!important}}</style>`;
  let count = 0;
  for (const rel of walkHtml(distDir)) {
    const file = path.join(distDir, rel);
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes('id="aaa-workbook-ui"')) continue;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${css}</head>`) : `${css}${html}`;
    fs.writeFileSync(file, html, 'utf8');
    count++;
  }
  console.log(`Enhanced ${count} HTML files`);
}

const decodedParts = [];
for (const part of PARTS) {
  const text = (await fetchText(`${SOURCE_BASE}/${part}`)).replace(/\s+/g, '');
  decodedParts.push(Buffer.from(text, 'base64'));
}
const archive = Buffer.concat(decodedParts);
const sha = crypto.createHash('sha256').update(archive).digest('hex');
if (sha !== EXPECTED_SHA) throw new Error(`Canonical archive SHA mismatch: ${sha}`);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aaa-pythagoras-'));
const archivePath = path.join(tempRoot, 'source.tar.gz');
const sourceDir = path.join(tempRoot, 'source');
fs.mkdirSync(sourceDir);
fs.writeFileSync(archivePath, archive);
run('tar', ['-xzf', archivePath, '-C', sourceDir]);
const projectRoot = findPackageRoot(sourceDir);
if (!fs.existsSync(path.join(projectRoot, 'SOURCE_OF_TRUTH.md'))) throw new Error('SOURCE_OF_TRUTH.md missing from canonical project');
const pageCount = countWorkbookPages(projectRoot);
if (pageCount !== 53) throw new Error(`Expected 53 workbook pages, found ${pageCount}`);
console.log('Verified 53 Pythagoras pages');
run('npm', ['install', '--no-audit', '--no-fund'], projectRoot);
run('npm', ['run', 'check'], projectRoot);
run('npm', ['run', 'build'], projectRoot);
const builtDist = path.join(projectRoot, 'dist');
if (!fs.existsSync(builtDist)) throw new Error('dist directory missing after build');
const targetDist = path.join(repoRoot, 'dist');
fs.rmSync(targetDist, { recursive: true, force: true });
fs.cpSync(builtDist, targetDist, { recursive: true });
ensureRootIndex(targetDist);
enhanceHtml(targetDist);
console.log(`aaa Pythagoras production ready: ${pageCount} pages`);
