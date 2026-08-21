const BUILD_VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';
const { buildPythagorasWorkbook } = await import(`./pythagoras-workbook-model.js?v=${encodeURIComponent(BUILD_VERSION)}`);

const META_URL = 'meta/topics.json';
const workbookRoot = document.querySelector('#workbook');
const toolbar = document.querySelector('.workbook-toolbar');
const statusEl = document.querySelector('#workbook-status');
const jumpInput = document.querySelector('#page-jump');
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
const sourceFile = (number) => `עמוד-${number}.html`;
const cssFile = (number) => `styles/pages/עמוד-${number}.css`;
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
  const sourceNumber = pageMeta.sourceNumber;
  const localNumber = pageMeta.workbookNumber;
  main.classList.add('pythagoras', 'pythagoras-workbook-page');
  main.dataset.sourcePage = String(sourceNumber);
  main.dataset.workbookPage = String(localNumber);
  main.dataset.primaryTopic = pageMeta.primaryTopic || '';
  main.setAttribute('aria-label', `משפט פיתגורס — עמוד ${localNumber} מתוך ${total}`);

  const visibleNumber = main.querySelector('.page-number');
  if (visibleNumber) visibleNumber.textContent = String(localNumber);

  /* דף רשאי להישאר שייך גם לחוברת/נושא אחר במקור. בתוך חוברת פיתגורס
     הכותרת המקומית משקפת את ההקשר בלי לשנות את קובץ המקור. */
  if (pageMeta.primaryTopic !== 'משפט פיתגורס') {
    const pageTitle = main.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = 'משפט פיתגורס';
  }

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
  const sourceNumber = pageMeta.sourceNumber;
  const localNumber = pageMeta.workbookNumber;
  try {
    await addStylesheet(cssFile(sourceNumber));
    const response = await fetch(versioned(sourceFile(sourceNumber)), { cache: 'no-cache' });
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
    message.textContent = `שגיאה בטעינת עמוד ${localNumber} (${sourceFile(sourceNumber)}): ${error.message}`;
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

async function boot() {
  const metaResponse = await fetch(versioned(META_URL), { cache: 'no-cache' });
  if (!metaResponse.ok) throw new Error(`לא ניתן לקרוא ${META_URL}`);
  const meta = await metaResponse.json();
  const workbook = buildPythagorasWorkbook(meta);
  const pages = workbook.pages;
  if (!pages.length) throw new Error('חוברת פיתגורס אינה מכילה דפים');

  totalPages = pages.length;
  loadedPages = 0;
  failedPages = 0;
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