const BUILD_VERSION = String(Date.now());
const MANIFEST_URL = 'WORKBOOK_MANIFEST.json';
const workbookRoot = document.querySelector('#workbook');
const toolbar = document.querySelector('.workbook-toolbar');
const statusEl = document.querySelector('#workbook-status');
const jumpInput = document.querySelector('#page-jump');
const pageTotalLabel = document.querySelector('#page-total-label');
const progressBar = document.querySelector('#workbook-progress-bar');
const prevButton = document.querySelector('#prev-page');
const nextButton = document.querySelector('#next-page');
const printButton = document.querySelector('#print-workbook');
const workbookCss = [...document.querySelectorAll('link[rel="stylesheet"]')]
  .find((link) => new URL(link.href, document.baseURI).pathname.endsWith('/styles/pythagoras-workbook.css'));
const stylesheetPromises = new Map();

let totalPages = 0;
let activePage = 1;
let loadedPages = 0;
let failedPages = 0;

const pageId = (local) => `workbook-page-${local}`;
const sourceFile = (pageMeta) => pageMeta.file;
const cssFile = (pageMeta) => `styles/pages/${pageMeta.file.replace(/\.html$/u, '.css')}`;
const versioned = (href) => {
  const url = new URL(href, document.baseURI);
  url.searchParams.set('v', BUILD_VERSION);
  return url.href;
};

function addStylesheet(href) {
  const absolute = versioned(href);
  if (stylesheetPromises.has(absolute)) return stylesheetPromises.get(absolute);

  const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .find((link) => link.href === absolute);
  if (existing) {
    const ready = Promise.resolve(existing);
    stylesheetPromises.set(absolute, ready);
    return ready;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = absolute;
  link.dataset.workbookCss = href;
  const ready = new Promise((resolve, reject) => {
    link.addEventListener('load', () => resolve(link), { once: true });
    link.addEventListener('error', () => reject(new Error(`טעינת CSS נכשלה: ${href}`)), { once: true });
  });
  stylesheetPromises.set(absolute, ready);
  if (workbookCss) workbookCss.before(link);
  else document.head.append(link);
  return ready;
}

function namespaceSvgIds(root, prefix) {
  const idMap = new Map();
  for (const el of root.querySelectorAll('[id]')) {
    const oldId = el.id;
    const newId = `${prefix}-${oldId}`;
    idMap.set(oldId, newId);
    el.id = newId;
  }
  if (!idMap.size) return;

  const urlRefAttrs = [
    'href', 'xlink:href', 'fill', 'stroke', 'filter', 'clip-path', 'mask',
    'marker-start', 'marker-mid', 'marker-end',
  ];
  const tokenRefAttrs = [
    'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'headers',
  ];
  const singleRefAttrs = [
    'for', 'form', 'list', 'aria-activedescendant', 'aria-details', 'aria-errormessage',
  ];

  for (const el of root.querySelectorAll('*')) {
    for (const attr of urlRefAttrs) {
      if (!el.hasAttribute(attr)) continue;
      let value = el.getAttribute(attr);
      for (const [oldId, newId] of idMap) value = value.replaceAll(`#${oldId}`, `#${newId}`);
      el.setAttribute(attr, value);
    }
    for (const attr of tokenRefAttrs) {
      if (!el.hasAttribute(attr)) continue;
      const value = el.getAttribute(attr)
        .split(/\s+/u)
        .map((id) => idMap.get(id) ?? id)
        .join(' ');
      el.setAttribute(attr, value);
    }
    for (const attr of singleRefAttrs) {
      if (!el.hasAttribute(attr)) continue;
      const value = el.getAttribute(attr);
      el.setAttribute(attr, idMap.get(value) ?? value);
    }
  }
}

function normalizePage(main, pageMeta, total) {
  const sourceNumber = pageMeta.sourceNumber ?? pageMeta.number;
  const localNumber = pageMeta.workbookNumber;
  main.classList.add('pythagoras', 'pythagoras-workbook-page');
  main.dataset.sourcePage = String(sourceNumber);
  main.dataset.workbookPage = String(localNumber);
  main.dataset.primaryTopic = pageMeta.primaryTopic || 'משפט פיתגורס';
  main.setAttribute('aria-label', `משפט פיתגורס — עמוד ${localNumber} מתוך ${total}`);

  const visibleNumber = main.querySelector('.page-number');
  if (visibleNumber) visibleNumber.textContent = String(localNumber);

  namespaceSvgIds(main, `pyt-${localNumber}`);
  return main;
}

function updateLoadStatus(total) {
  if (failedPages > 0) {
    statusEl.textContent = `${loadedPages} / ${total} דפים נטענו · ${failedPages} נכשלו`;
  } else {
    statusEl.textContent = `${loadedPages} / ${total} דפים נטענו`;
  }
}

function updateNavigationDisplay(page) {
  if (pageTotalLabel) pageTotalLabel.textContent = `מתוך ${totalPages || 53}`;
  if (progressBar) {
    const progress = totalPages ? Math.max(0, Math.min(100, (page / totalPages) * 100)) : 0;
    progressBar.style.width = `${progress}%`;
  }
}

function installToolbarOffset() {
  const sync = () => {
    const height = toolbar?.getBoundingClientRect().height ?? 0;
    document.documentElement.style.setProperty('--pythagoras-toolbar-offset', `${Math.ceil(height + 8)}px`);
  };

  sync();
  if (!toolbar) return;

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(sync);
    observer.observe(toolbar);
  } else {
    window.addEventListener('resize', sync);
  }
}

function unlockWorkbookActions() {
  jumpInput.disabled = false;
  printButton.disabled = failedPages > 0;
}

async function loadSourcePage(pageMeta, total, wrapper) {
  const localNumber = pageMeta.workbookNumber;
  const htmlFile = sourceFile(pageMeta);
  try {
    await addStylesheet(cssFile(pageMeta));
    const response = await fetch(versioned(htmlFile), { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const sourceMain = parsed.querySelector('main.a4-page');
    if (!sourceMain) throw new Error('לא נמצא main.a4-page');

    const main = document.importNode(sourceMain, true);
    normalizePage(main, pageMeta, total);
    wrapper.replaceChildren(main);
    loadedPages += 1;
    updateLoadStatus(total);
    return true;
  } catch (error) {
    failedPages += 1;
    const message = document.createElement('div');
    message.className = 'workbook-error';
    message.setAttribute('role', 'alert');
    message.textContent = `שגיאה בטעינת עמוד ${localNumber} (${htmlFile}): ${error.message}`;
    wrapper.replaceChildren(message);
    updateLoadStatus(total);
    console.error(`Pythagoras workbook page ${localNumber} failed`, error);
    return false;
  }
}

async function runPool(tasks, concurrency = 6) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next++;
      await tasks[index]();
    }
  });
  await Promise.all(workers);
}

function syncUrlPage(localNumber) {
  const url = new URL(location.href);
  url.searchParams.set('page', String(localNumber));
  history.replaceState(null, '', url);
}

function setActivePage(localNumber, { syncUrl = false } = {}) {
  if (!totalPages) return 1;
  const numeric = Number(localNumber);
  const integer = Number.isFinite(numeric) ? Math.trunc(numeric) : 1;
  const target = Math.max(1, Math.min(totalPages, integer || 1));
  activePage = target;
  jumpInput.value = String(target);
  prevButton.disabled = target <= 1;
  nextButton.disabled = target >= totalPages;
  updateNavigationDisplay(target);
  if (syncUrl) syncUrlPage(target);
  return target;
}

function goToPage(localNumber, behavior = 'smooth') {
  if (!totalPages) return;
  const target = setActivePage(localNumber, { syncUrl: true });
  document.getElementById(pageId(target))?.scrollIntoView({ behavior, block: 'start' });
}

function installNavigation() {
  jumpInput.max = String(totalPages);
  setActivePage(1);
  prevButton.addEventListener('click', () => goToPage(activePage - 1));
  nextButton.addEventListener('click', () => goToPage(activePage + 1));
  jumpInput.addEventListener('change', () => goToPage(jumpInput.value));
  jumpInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      jumpInput.blur();
      goToPage(jumpInput.value);
    }
  });
  printButton.addEventListener('click', () => window.print());

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const local = Number(visible.target.dataset.localPage);
    if (Number.isFinite(local) && local !== activePage) {
      setActivePage(local, { syncUrl: true });
    }
  }, { threshold: [0.25, 0.5, 0.75] });

  for (const wrapper of document.querySelectorAll('.workbook-page-wrap')) observer.observe(wrapper);
}

function installResponsiveScaling() {
  let lastWidth = -1;
  const resize = () => {
    const currentWidth = document.documentElement.clientWidth;
    if (currentWidth === lastWidth) return;
    lastWidth = currentWidth;
    const available = Math.max(1, Math.min(currentWidth - 8, 900));
    for (const wrapper of document.querySelectorAll('.workbook-page-wrap')) {
      const page = wrapper.querySelector('.a4-page');
      if (!page) continue;
      page.style.transform = '';
      wrapper.style.width = '';
      wrapper.style.height = '';
      const rect = page.getBoundingClientRect();
      if (!rect.width || rect.width <= available) continue;
      const scale = available / rect.width;
      page.style.transformOrigin = 'top center';
      page.style.transform = `scale(${scale})`;
      wrapper.style.width = `${rect.width * scale}px`;
      wrapper.style.height = `${rect.height * scale}px`;
    }
  };

  const observer = new ResizeObserver(resize);
  observer.observe(document.documentElement);
  window.addEventListener('beforeprint', () => {
    for (const wrapper of document.querySelectorAll('.workbook-page-wrap')) {
      const page = wrapper.querySelector('.a4-page');
      if (page) page.style.transform = '';
      wrapper.style.width = '';
      wrapper.style.height = '';
    }
  });
  window.addEventListener('afterprint', () => {
    lastWidth = -1;
    resize();
  });
  resize();
}

async function typesetMath() {
  if (window.MathJax?.startup?.promise) await window.MathJax.startup.promise;
  if (window.MathJax?.typesetPromise) await window.MathJax.typesetPromise([workbookRoot]);
}

function validateManifest(manifest) {
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : [];
  if (pages.length !== 53) throw new Error(`WORKBOOK_MANIFEST.json חייב להכיל בדיוק 53 דפים; נמצאו ${pages.length}`);
  const files = new Set();
  return pages.map((page, index) => {
    if (!page?.file || typeof page.file !== 'string') throw new Error(`חסר file לעמוד ${index + 1} במניפסט`);
    if (files.has(page.file)) throw new Error(`קובץ כפול במניפסט: ${page.file}`);
    files.add(page.file);
    return {
      ...page,
      workbookNumber: index + 1,
      sourceNumber: page.sourceNumber ?? page.number,
      primaryTopic: page.primaryTopic || 'משפט פיתגורס',
    };
  });
}

async function boot() {
  const manifestResponse = await fetch(versioned(MANIFEST_URL), { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error(`לא ניתן לקרוא ${MANIFEST_URL}`);
  const manifest = await manifestResponse.json();
  const pages = validateManifest(manifest);

  totalPages = pages.length;
  loadedPages = 0;
  failedPages = 0;
  updateNavigationDisplay(1);
  statusEl.textContent = `0 / ${totalPages} דפים נטענו`;

  const tasks = pages.map((pageMeta) => {
    const localNumber = pageMeta.workbookNumber;
    const wrapper = document.createElement('section');
    wrapper.className = 'workbook-page-wrap';
    wrapper.id = pageId(localNumber);
    wrapper.dataset.localPage = String(localNumber);
    wrapper.dataset.sourcePage = String(pageMeta.sourceNumber);
    workbookRoot.append(wrapper);
    return () => loadSourcePage(pageMeta, totalPages, wrapper);
  });

  await runPool(tasks, 6);
  await typesetMath();
  unlockWorkbookActions();
  installToolbarOffset();
  installNavigation();
  installResponsiveScaling();
  statusEl.textContent = failedPages > 0
    ? `${loadedPages} / ${totalPages} דפים נטענו · ${failedPages} נכשלו`
    : `${totalPages} דפים · חוברת מלאה`;

  const requested = Number(new URL(location.href).searchParams.get('page')) || 1;
  requestAnimationFrame(() => goToPage(requested, 'auto'));
}

boot().catch((error) => {
  statusEl.textContent = 'טעינת החוברת נכשלה';
  const message = document.createElement('div');
  message.className = 'workbook-error';
  message.setAttribute('role', 'alert');
  message.textContent = error.message;
  workbookRoot.prepend(message);
  console.error(error);
});
