import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const initCode = fs.readFileSync(new URL('../theme-init.js', import.meta.url), 'utf8');
const themeCode = fs.readFileSync(new URL('../theme.js', import.meta.url), 'utf8');
const storageKey = 'zizhuang-theme-choice-v1';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const reads = [], writes = [];
  return {values, reads, writes,
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { writes.push(['set', key, value]); values.set(key, value); },
    removeItem(key) { writes.push(['remove', key]); values.delete(key); }};
}

function page({dark = false, storage = memoryStorage(), legacyMedia = false, blockedStorage = false} = {}) {
  const root = {dataset: {}, style: {}};
  const meta = {content: '#ffffff'};
  const systemListeners = new Set();
  const storageListeners = [];
  const clickListeners = [];
  const button = {textContent: '', title: '', attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, listener) { assert.equal(type, 'click'); clickListeners.push(listener); }};
  const media = {matches: dark};
  if (legacyMedia) media.addListener = listener => systemListeners.add(listener);
  else media.addEventListener = (type, listener) => { assert.equal(type, 'change'); systemListeners.add(listener); };
  let mediaQueries = 0, uiReady = false;
  const window = {
    get localStorage() { if (blockedStorage) throw Error('Storage blocked'); return storage; },
    matchMedia(query) { mediaQueries++; assert.equal(query, '(prefers-color-scheme: dark)'); return media; },
    addEventListener(type, listener) { assert.equal(type, 'storage'); storageListeners.push(listener); }
  };
  const sandbox = {
    document: {documentElement: root,
      querySelector(selector) { assert.equal(selector, 'meta[name="theme-color"]'); return meta; },
      getElementById(id) { assert.ok(uiReady, 'blocking init must run before the UI exists'); assert.equal(id, 'theme-toggle'); return button; }},
    window
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(initCode, context, {filename: 'theme-init.js'});
  return {root, meta, button, media, storage,
    start() { uiReady = true; vm.runInContext(themeCode, context, {filename: 'theme.js'}); },
    click() { for (const listener of clickListeners) listener(); },
    system(dark) { media.matches = dark; for (const listener of systemListeners) listener({matches: dark}); },
    storageEvent(key, newValue) { for (const listener of storageListeners) listener({key, newValue}); },
    get mediaQueries() { return mediaQueries; },
    get listenerCount() { return systemListeners.size; }};
}

function appearance(p, preference, resolved) {
  assert.equal(p.root.dataset.themePreference, preference);
  assert.equal(p.root.dataset.theme, resolved);
  assert.equal(p.root.style.colorScheme, resolved);
  assert.equal(p.meta.content, resolved === 'dark' ? '#0d131b' : '#ffffff');
}

for (const dark of [false, true]) {
  test(`without a saved deliberate choice, blocking initialization resolves system ${dark ? 'dark' : 'light'}`, () => {
    const p = page({dark});
    appearance(p, 'auto', dark ? 'dark' : 'light');
    p.start();
    appearance(p, 'auto', dark ? 'dark' : 'light');
    assert.equal(p.button.textContent, 'Auto');
    assert.equal(p.mediaQueries, 1, 'both phases share the same system media query');
    assert.equal(p.listenerCount, 1);
    assert.deepEqual(p.storage.reads, [storageKey]);
    assert.deepEqual(p.storage.writes, []);
  });
}

test('legacy theme-preference is never read and cannot override the system', () => {
  const storage = memoryStorage({'theme-preference': 'light'});
  const p = page({dark: true, storage});
  p.start();
  appearance(p, 'auto', 'dark');
  assert.deepEqual(storage.reads, [storageKey]);
  assert.deepEqual(storage.writes, []);
});

test('invalid values in the versioned key resolve to Auto without rewriting storage', () => {
  for (const saved of ['', 'auto', 'system', 'LIGHT', 'invalid']) {
    const storage = memoryStorage({[storageKey]: saved});
    const p = page({dark: true, storage});
    p.start();
    appearance(p, 'auto', 'dark');
    assert.deepEqual(storage.writes, []);
  }
});

test('blocking initialization restores saved Light or Dark before the UI and CSS', () => {
  for (const preference of ['light', 'dark']) {
    const p = page({dark: preference === 'light', storage: memoryStorage({[storageKey]: preference})});
    appearance(p, preference, preference);
    p.start();
    appearance(p, preference, preference);
    assert.equal(p.button.textContent.toLowerCase(), preference);
  }
});

test('the control cycles Auto → Light → Dark → Auto, persists explicit choices, and removes Auto', () => {
  const p = page({dark: true});
  p.start();
  const states = [
    ['auto', 'dark', 'Auto', 'Light', null],
    ['light', 'light', 'Light', 'Dark', 'light'],
    ['dark', 'dark', 'Dark', 'Auto', 'dark'],
    ['auto', 'dark', 'Auto', 'Light', null]
  ];
  states.forEach(([preference, resolved, label, next, stored], index) => {
    appearance(p, preference, resolved);
    assert.equal(p.button.textContent, label);
    assert.equal(p.button.title, `Theme: ${label}`);
    assert.equal(p.button.attributes['aria-label'], `Theme: ${label}. Activate to switch to ${next}.`);
    assert.equal(p.storage.values.get(storageKey) ?? null, stored);
    if (index < states.length - 1) p.click();
  });
  assert.deepEqual(p.storage.writes, [['set', storageKey, 'light'], ['set', storageKey, 'dark'], ['remove', storageKey]]);
});

test('system changes update Auto while saved explicit Light and Dark remain fixed', () => {
  const p = page({dark: false});
  p.start();
  p.system(true);
  appearance(p, 'auto', 'dark');
  p.system(false);
  appearance(p, 'auto', 'light');
  p.click();
  p.system(true);
  appearance(p, 'light', 'light');
  p.click();
  p.system(false);
  appearance(p, 'dark', 'dark');
  p.click();
  appearance(p, 'auto', 'light');
  p.system(true);
  appearance(p, 'auto', 'dark');
});

for (const preference of ['light', 'dark']) {
  test(`manual ${preference} survives main → knowledge navigation and a reload`, () => {
    const storage = memoryStorage();
    const main = page({dark: true, storage});
    main.start();
    main.click();
    if (preference === 'dark') main.click();
    appearance(main, preference, preference);
    const knowledge = page({dark: preference === 'light', storage});
    appearance(knowledge, preference, preference);
    knowledge.start();
    appearance(knowledge, preference, preference);
    const reloaded = page({dark: preference === 'light', storage});
    reloaded.start();
    appearance(reloaded, preference, preference);
  });
}

test('choosing Auto clears the saved override and remains Auto across navigation and reload', () => {
  const storage = memoryStorage({[storageKey]: 'dark', 'theme-preference': 'light'});
  const main = page({dark: false, storage});
  main.start();
  main.click();
  appearance(main, 'auto', 'light');
  assert.ok(!storage.values.has(storageKey));
  const knowledge = page({dark: true, storage});
  knowledge.start();
  appearance(knowledge, 'auto', 'dark');
  const reloaded = page({dark: false, storage});
  reloaded.start();
  appearance(reloaded, 'auto', 'light');
});

test('storage events synchronize other pages without writing back or accepting the legacy key', () => {
  const p = page({dark: true});
  p.start();
  p.storageEvent('theme-preference', 'light');
  appearance(p, 'auto', 'dark');
  p.storageEvent(storageKey, 'light');
  appearance(p, 'light', 'light');
  p.storageEvent(storageKey, 'dark');
  appearance(p, 'dark', 'dark');
  p.storageEvent(storageKey, null);
  appearance(p, 'auto', 'dark');
  p.storageEvent(storageKey, 'light');
  p.storageEvent(null, null);
  appearance(p, 'auto', 'dark');
  assert.deepEqual(p.storage.writes, []);
});

test('unavailable localStorage still permits system Auto and interactive overrides', () => {
  const p = page({dark: true, blockedStorage: true});
  p.start();
  appearance(p, 'auto', 'dark');
  p.click();
  appearance(p, 'light', 'light');
  p.click();
  appearance(p, 'dark', 'dark');
  p.click();
  appearance(p, 'auto', 'dark');
});

test('legacy MediaQueryList.addListener still tracks system appearance in Auto', () => {
  const p = page({dark: false, legacyMedia: true});
  p.start();
  assert.equal(p.listenerCount, 1);
  p.system(true);
  appearance(p, 'auto', 'dark');
  p.click();
  p.system(false);
  p.system(true);
  appearance(p, 'light', 'light');
});

test('both pages load the same blocking initializer before CSS and one deferred controller', () => {
  for (const name of ['index.html', 'knowledge.html']) {
    const html = fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    const init = html.indexOf('<script src="theme-init.js"></script>');
    const firstStyle = html.indexOf('rel="stylesheet"');
    assert.ok(init > html.indexOf('name="theme-color"'), `${name}: theme-color meta exists before initialization`);
    assert.ok(init < firstStyle, `${name}: theme is resolved before any stylesheet`);
    assert.equal((html.match(/src="theme-init\.js"/g) || []).length, 1);
    assert.equal((html.match(/<script src="theme\.js" defer><\/script>/g) || []).length, 1);
    assert.ok(!html.includes("localStorage.getItem('theme-preference')"), `${name}: no stale inline storage resolver`);
  }
});
