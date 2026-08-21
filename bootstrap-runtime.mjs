import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const SOURCE = 'https://raw.githubusercontent.com/yanivmizrachiy/pythagoras/52e8f54425bdbe66ec30859cdd9b81628514c90f/pythagoras-bootstrap.tar.gz';
const repoRoot = process.cwd();

function run(cmd, args, cwd = process.cwd()) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } });
  if (r.status !== 0) throw new Error(`${cmd} failed with exit code ${r.status}`);
}
async function fetchBytes(url) {
  const r = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} while fetching ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
function findPackageRoot(root) {
  if (fs.existsSync(path.join(root, 'package.json'))) return root;
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const c = path.join(root, e.name);
    if (fs.existsSync(path.join(c, 'package.json'))) return c;
  }
  throw new Error('package.json not found');
}
function walkHtml(root, current = root, out = []) {
  for (const e of fs.readdirSync(current, { withFileTypes: true })) {
    const f = path.join(current, e.name);
    if (e.isDirectory()) walkHtml(root, f, out);
    else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) out.push(path.relative(root, f).replaceAll(path.sep, '/'));
  }
  return out;
}
function ensureRootIndex(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) return;
  const html = walkHtml(distDir).filter((p) => p !== 'index.html');
  if (!html.length) throw new Error('Build produced no HTML files');
  const score = (p) => {
    const lower = p.toLowerCase();
    if (lower.endsWith('/workbook.html') || lower === 'workbook.html') return 0;
    if (lower.endsWith('/main.html') || lower === 'main.html') return 1;
    return 2;
  };
  html.sort((a,b) => score(a) - score(b) || a.localeCompare(b, 'en'));
  const target = html[0];
  fs.writeFileSync(indexPath, `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${target}"><title>משפט פיתגורס</title></head><body><a href="${target}">פתיחת דפי משפט פיתגורס</a></body></html>`, 'utf8');
}
function enhanceHtml(distDir) {
  const css = `<style id="aaa-workbook-ui">html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}body{font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}button,a,[role="button"],input,select,textarea{touch-action:manipulation}button,[role="button"],input[type="button"],input[type="submit"]{min-height:42px;border-radius:10px}input,select,textarea{max-width:100%;font:inherit}input:focus,select:focus,textarea:focus,button:focus-visible,a:focus-visible{outline:3px solid rgba(31,95,139,.28);outline-offset:2px}img,svg,canvas{max-width:100%;height:auto}@media(max-width:720px){body{overflow-x:hidden}button,[role="button"],input[type="button"],input[type="submit"]{min-height:46px}}@media print{html,body{background:#fff!important}*{animation:none!important;transition:none!important}}</style>`;
  for (const rel of walkHtml(distDir)) {
    const file = path.join(distDir, rel);
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes('id="aaa-workbook-ui"')) continue;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${css}</head>`) : `${css}${html}`;
    fs.writeFileSync(file, html, 'utf8');
  }
}

const archive = await fetchBytes(SOURCE);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aaa-pythagoras-'));
const archivePath = path.join(tmp, 'source.tar.gz');
const sourceDir = path.join(tmp, 'source');
fs.mkdirSync(sourceDir);
fs.writeFileSync(archivePath, archive);
run('tar', ['-xzf', archivePath, '-C', sourceDir]);
const projectRoot = findPackageRoot(sourceDir);
if (!fs.existsSync(path.join(projectRoot, 'SOURCE_OF_TRUTH.md'))) throw new Error('SOURCE_OF_TRUTH.md missing');
const pagesRoot = path.join(projectRoot, 'src', 'pages');
const pageCount = fs.existsSync(pagesRoot) ? walkHtml(pagesRoot).filter((p) => p.endsWith('main.html')).length : 0;
if (pageCount !== 53) throw new Error(`Expected 53 pages, found ${pageCount}`);
console.log('VERIFIED CONTENT: 53 PAGES');
run('npm', ['install', '--no-audit', '--no-fund'], projectRoot);
run('npm', ['run', 'check'], projectRoot);
run('npm', ['run', 'build'], projectRoot);
const builtDist = path.join(projectRoot, 'dist');
if (!fs.existsSync(builtDist)) throw new Error('dist missing');
const targetDist = path.join(repoRoot, 'dist');
fs.rmSync(targetDist, { recursive: true, force: true });
fs.cpSync(builtDist, targetDist, { recursive: true });
ensureRootIndex(targetDist);
enhanceHtml(targetDist);
console.log('AAA PYTHAGORAS READY');
