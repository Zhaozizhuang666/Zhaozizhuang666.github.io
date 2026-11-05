import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');

function createDisclosure(open = true) {
  const descendants = new Set();
  const details = {
    open,
    isConnected: true,
    hovered: false,
    dialogOpen: false,
    contains: node => descendants.has(node),
    closest: selector => selector === 'details[open]' && details.open ? details : null,
    matches: selector => selector === ':hover' && details.hovered,
    querySelector: selector => {
      if (selector === 'dialog[open]' && details.dialogOpen) return {};
      if (selector === ':scope > summary') return {focus() {}};
      return null;
    }
  };
  const target = {
    closest: selector => selector === 'details[open]' && details.open ? details : null
  };
  return {details, target, descendants};
}

function setup({navigationType = 'navigate', initialDisclosures = []} = {}) {
  const listeners = new Map();
  const pageListeners = new Map();
  const timers = new Map();
  let timerId = 0;
  const delays = [];
  const document = {
    activeElement: null,
    querySelectorAll: () => initialDisclosures.filter(details => details.open),
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  };
  vm.runInNewContext(read('disclosures.js'), {
    document,
    performance: {getEntriesByType: () => [{type: navigationType}]},
    window: {
      performance: {getEntriesByType: () => [{type: navigationType}]},
      addEventListener: (type, callback) => pageListeners.set(type, callback),
      requestAnimationFrame: callback => callback()
    },
    requestAnimationFrame: callback => callback(),
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, callback);
      delays.push(delay);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    }
  });
  return {
    document,
    delays,
    dispatch(type, event) {
      listeners.get(type)(event);
    },
    pageshow(event = {persisted: false}) {
      pageListeners.get('pageshow')?.(event);
    },
    flushTimers() {
      for (const [id, callback] of timers) {
        timers.delete(id);
        callback();
      }
    }
  };
}

test('all public site pages load the shared disclosure controller', () => {
  for (const page of ['index.html', 'knowledge.html', 'guide.html']) {
    assert.match(read(page), /disclosures\.js\?v=20261105-hover-close1/);
  }
});

test('open disclosure closes only when a mouse pointer leaves its full content area', () => {
  const site = setup();
  const {details, target, descendants} = createDisclosure();
  const inside = {};
  descendants.add(inside);

  site.dispatch('pointerout', {pointerType: 'mouse', target, relatedTarget: inside});
  assert.equal(details.open, true, 'moving within the disclosure keeps it open');

  site.dispatch('pointerout', {pointerType: 'mouse', target, relatedTarget: {}});
  assert.equal(site.delays.at(-1), 240);
  assert.equal(details.open, true, 'briefly crossing a menu gap allows the pointer to reach its panel');
  site.dispatch('pointerover', {pointerType: 'mouse', target});
  site.flushTimers();
  assert.equal(details.open, true, 're-entering the disclosure cancels pending collapse');

  site.dispatch('pointerout', {pointerType: 'mouse', target, relatedTarget: {}});
  site.flushTimers();
  assert.equal(details.open, false, 'leaving the disclosure collapses it');
});

test('touch interaction is not collapsed by pointer exit', () => {
  const site = setup();
  const {details, target} = createDisclosure();

  site.dispatch('pointerout', {pointerType: 'touch', target, relatedTarget: null});
  site.flushTimers();
  assert.equal(details.open, true);
});

test('keyboard-open disclosure stays available to keyboard users', () => {
  const site = setup();
  const {details, target, descendants} = createDisclosure();
  const summary = {};
  descendants.add(summary);
  site.document.activeElement = summary;

  site.dispatch('keydown', {key: 'Tab'});
  site.dispatch('pointerout', {pointerType: 'mouse', target, relatedTarget: null});
  site.flushTimers();
  assert.equal(details.open, true);

  site.dispatch('pointermove', {pointerType: 'mouse'});
  site.dispatch('pointerout', {pointerType: 'mouse', target, relatedTarget: null});
  site.flushTimers();
  assert.equal(details.open, false, 'mouse exit still collapses the disclosure');
});

test('leaving nested disclosures closes each open disclosure that the pointer left', () => {
  const site = setup();
  const outer = createDisclosure();
  const inner = createDisclosure();
  inner.details.parentElement = outer.details;
  outer.details.parentElement = null;
  outer.descendants.add(inner.target);
  inner.target.closest = selector => selector === 'details[open]' ? inner.details : null;

  site.dispatch('pointerout', {pointerType: 'mouse', target: inner.target, relatedTarget: {}});
  site.flushTimers();
  assert.equal(inner.details.open, false);
  assert.equal(outer.details.open, false);
});

test('leaving a nested disclosure into its open parent closes only the nested disclosure', () => {
  const site = setup();
  const outer = createDisclosure();
  const inner = createDisclosure();
  inner.details.parentElement = outer.details;
  outer.details.parentElement = null;
  outer.descendants.add(inner.target);
  const outerContent = {};
  outer.descendants.add(outerContent);
  inner.target.closest = selector => selector === 'details[open]' ? inner.details : null;

  site.dispatch('pointerout', {pointerType: 'mouse', target: inner.target, relatedTarget: outerContent});
  site.flushTimers();
  assert.equal(inner.details.open, false);
  assert.equal(outer.details.open, true);
});

test('full-size image dialogs keep their containing disclosure open until closed', () => {
  const site = setup();
  const {details, target} = createDisclosure();
  details.dialogOpen = true;

  site.dispatch('pointerout', {pointerType: 'mouse', target, relatedTarget: null});
  site.flushTimers();
  assert.equal(details.open, true);

  details.dialogOpen = false;
  const dialog = {closest: () => details, matches: selector => selector === 'dialog', parentElement: null};
  site.dispatch('close', {target: dialog});
  site.flushTimers();
  assert.equal(details.open, false);
});

test('refresh resets browser-restored disclosures, while cached back navigation retains them', () => {
  const {details} = createDisclosure();
  const site = setup({navigationType: 'reload', initialDisclosures: [details]});
  assert.equal(details.open, false, 'initial parsing resets expanded state');
  details.open = true;
  site.pageshow();
  assert.equal(details.open, false, 'post-load restored state is reset');
  details.open = true;
  site.pageshow({persisted: true});
  assert.equal(details.open, true, 'returning via the back/forward cache keeps its state');
});

test('leaving the browser closes disclosures even when the browser retains a stale hover state', () => {
  const site = setup();
  const {details, target} = createDisclosure();
  details.hovered = true;
  site.dispatch('pointerout', {pointerType: 'mouse', target, relatedTarget: null});
  site.flushTimers();
  assert.equal(details.open, false);
});
