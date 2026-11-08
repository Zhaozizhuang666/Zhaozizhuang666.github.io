import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');

// Small DOM fixture: containment includes the node itself, closest walks parents,
// and queries see nested descendants, matching the contracts used by the browser.
class Node {
  constructor(tagName, parent = null, className = '') {
    this.tagName = tagName;
    this.parentElement = parent;
    this.className = className;
    this.children = [];
    this.open = false;
    this.isConnected = true;
    this.hovered = false;
    this.focusCalls = [];
    parent?.children.push(this);
  }
  contains(node) {
    for (let current = node; current; current = current.parentElement) if (current === this) return true;
    return false;
  }
  matches(selector) {
    if (selector === ':hover') return this.hovered;
    return selector.split(',').some(value => {
      const part = value.trim();
      if (part.endsWith('[open]')) return this.tagName === part.slice(0, -6) && this.open;
      if (part.startsWith('.')) return this.className.split(/\s+/).includes(part.slice(1));
      return this.tagName === part;
    });
  }
  closest(selector) {
    for (let current = this; current; current = current.parentElement) if (current.matches(selector)) return current;
    return null;
  }
  querySelector(selector) {
    if (selector === ':scope > summary') return this.children.find(node => node.tagName === 'summary') || null;
    for (const node of this.children) {
      if (node.matches(selector)) return node;
      const match = node.querySelector(selector);
      if (match) return match;
    }
    return null;
  }
  focus(options) {
    this.focusCalls.push(options);
    this.ownerDocument.activeElement = this;
  }
}

function setup({navigationType = 'navigate', initialOpen = false, legacyNavigation = false} = {}) {
  const listeners = new Map();
  const pageListeners = new Map();
  const timers = new Map();
  const scheduledDelays = [];
  let now = 0;
  let timerId = 0;
  const body = new Node('body');
  const document = {
    activeElement: null,
    querySelectorAll(selector) {
      const result = [];
      const visit = node => {
        if (node.matches(selector)) result.push(node);
        node.children.forEach(visit);
      };
      visit(body);
      return result;
    },
    addEventListener(type, listener) {
      const handlers = listeners.get(type) || [];
      handlers.push(listener);
      listeners.set(type, handlers);
    }
  };
  const element = (tag, parent = body, className = '') => {
    const node = new Node(tag, parent, className);
    node.ownerDocument = document;
    return node;
  };
  const disclosure = (parent = element('section'), open = false) => {
    const details = element('details', parent);
    details.open = open;
    const summary = element('summary', details);
    const label = element('span', summary);
    const content = element('div', details);
    const link = element('a', content);
    return {details, summary, label, content, link};
  };
  const initial = initialOpen ? disclosure(undefined, true) : null;
  const performance = legacyNavigation
    ? {navigation: {type: navigationType === 'reload' ? 1 : 0}}
    : {getEntriesByType: () => [{type: navigationType}]};
  vm.runInNewContext(read('disclosures.js'), {
    document,
    window: {
      performance,
      addEventListener: (type, callback) => pageListeners.set(type, callback),
      requestAnimationFrame: callback => callback()
    },
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, {callback, at: now + delay});
      scheduledDelays.push(delay);
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  });
  const dispatch = (type, event = {}) => {
    let prevented = false;
    const actualEvent = {preventDefault() { prevented = true; }, ...event};
    for (const listener of listeners.get(type) || []) listener(actualEvent);
    return {prevented};
  };
  return {
    document, element, disclosure, initial, body, scheduledDelays,
    dispatch,
    over(target, relatedTarget = null, pointerType = 'mouse') {
      dispatch('pointerover', {pointerType, target, relatedTarget});
    },
    out(target, relatedTarget = null, pointerType = 'mouse') {
      dispatch('pointerout', {pointerType, target, relatedTarget});
    },
    advance(ms) {
      const until = now + ms;
      let calls = 0;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= until)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        assert.ok(++calls < 1000, 'timers settle without looping');
        const [id, timer] = next;
        timers.delete(id);
        now = timer.at;
        timer.callback();
      }
      now = until;
    },
    pageshow(event = {persisted: false}) { pageListeners.get('pageshow')?.(event); }
  };
}

test('main public pages load the current shared hover-intent controller', () => {
  for (const page of ['index.html', 'knowledge.html', 'guide.html']) {
    assert.match(read(page), /disclosures\.js\?v=20261108-hover-intent1/);
  }
});

test('hovering the summary opens after 180ms, including a child label target', () => {
  const site = setup();
  const item = site.disclosure();
  site.over(item.label);
  site.advance(179);
  assert.equal(item.details.open, false);
  site.advance(1);
  assert.equal(item.details.open, true);
});

test('a brief pass over a summary does not open it later', () => {
  const site = setup();
  const item = site.disclosure();
  site.over(item.summary);
  site.advance(100);
  site.out(item.summary, site.body);
  site.advance(1000);
  assert.equal(item.details.open, false);
});

test('moving between summary children does not restart the hover delay', () => {
  const site = setup();
  const item = site.disclosure();
  const icon = site.element('span', item.summary);
  site.over(item.label);
  site.advance(100);
  site.out(item.label, icon);
  site.over(icon, item.label);
  site.advance(80);
  assert.equal(item.details.open, true);
});

test('hovering a closed disclosure content area does not open it', () => {
  const site = setup();
  const item = site.disclosure();
  site.over(item.content);
  site.advance(2000);
  assert.equal(item.details.open, false);
});

test('gallery and navigation summaries receive the same hover-open behavior', () => {
  const site = setup();
  for (const [parentTag, className] of [['section', 'gallery-disclosure'], ['nav', 'nav-more']]) {
    const item = site.disclosure(site.element(parentTag));
    item.details.className = className;
    site.over(item.summary);
    site.advance(180);
    assert.equal(item.details.open, true, className);
  }
});

test('leaving the whole area gives 1200ms before collapse', () => {
  const site = setup();
  const item = site.disclosure(undefined, true);
  site.out(item.link, site.body);
  site.advance(1199);
  assert.equal(item.details.open, true);
  site.advance(1);
  assert.equal(item.details.open, false);
});

test('moving within content never starts collapse and re-entry cancels a pending close', () => {
  const site = setup();
  const item = site.disclosure(undefined, true);
  site.out(item.summary, item.link);
  site.over(item.link, item.summary);
  site.advance(2000);
  assert.equal(item.details.open, true);
  site.out(item.link, site.body);
  site.advance(1000);
  site.over(item.content, site.body);
  site.advance(1000);
  assert.equal(item.details.open, true);
  site.out(item.content, site.body);
  site.advance(1200);
  assert.equal(item.details.open, false);
});

test('same-section adjacent disclosures keep earlier content stable until the group is left', () => {
  const site = setup();
  const section = site.element('section');
  const first = site.disclosure(section, true);
  const second = site.disclosure(section);
  site.out(first.link, second.label);
  site.over(second.label, first.link);
  site.advance(180);
  assert.equal(second.details.open, true);
  site.advance(2400);
  assert.equal(first.details.open, true, 'opening a neighbor must not shift the document by collapsing earlier content');
  site.out(second.link, site.body);
  site.advance(1199);
  assert.equal(first.details.open, true);
  assert.equal(second.details.open, true);
  site.advance(1);
  assert.equal(first.details.open, false);
  assert.equal(second.details.open, false);
});

test('an open disclosure in an unrelated section does not protect an earlier section', () => {
  const site = setup();
  const first = site.disclosure(undefined, true);
  const second = site.disclosure(undefined, true);
  site.out(first.link, second.link);
  site.over(second.link, first.link);
  site.advance(1200);
  assert.equal(first.details.open, false);
  assert.equal(second.details.open, true);
});

test('same-group grace starts again after leaving the neighbor instead of using an old timer', () => {
  const site = setup();
  const section = site.element('section');
  const first = site.disclosure(section, true);
  const second = site.disclosure(section, true);
  site.out(first.link, site.body);
  site.advance(900);
  site.over(second.link, site.body);
  site.advance(900);
  assert.equal(first.details.open, true);
  site.out(second.link, site.body);
  site.advance(1199);
  assert.equal(first.details.open, true);
  site.advance(1);
  assert.equal(first.details.open, false);
});

test('nested summaries open independently and parent traversal keeps both available', () => {
  const site = setup();
  const outer = site.disclosure(undefined, true);
  const inner = site.disclosure(outer.content);
  site.over(inner.label);
  site.advance(180);
  assert.equal(inner.details.open, true);
  site.out(inner.link, outer.link);
  site.over(outer.link, inner.link);
  site.advance(2400);
  assert.equal(inner.details.open, true, 'reading another part of the same section keeps the layout stable');
  assert.equal(outer.details.open, true);
  site.out(outer.link, site.body);
  site.advance(1200);
  assert.equal(inner.details.open, false);
  assert.equal(outer.details.open, false);
});

test('leaving a nested disclosure and its parent closes both after the grace period', () => {
  const site = setup();
  const outer = site.disclosure(undefined, true);
  const inner = site.disclosure(outer.content, true);
  site.out(inner.link, site.body);
  site.advance(1200);
  assert.equal(inner.details.open, false);
  assert.equal(outer.details.open, false);
});

test('mouse click cancels pending hover so native activation is not reversed', () => {
  const site = setup();
  const item = site.disclosure();
  site.over(item.label);
  site.advance(100);
  site.dispatch('pointerdown', {pointerType: 'mouse', target: item.label});
  item.details.open = true; // Native summary activation remains the browser's responsibility.
  item.details.open = false; // A second click intentionally closes it before the old hover deadline.
  site.advance(2000);
  assert.equal(item.details.open, false);
});

test('touch and pen hover do not open disclosures; touch exit does not close native-open content', () => {
  const site = setup();
  const item = site.disclosure();
  site.over(item.label, null, 'touch');
  site.over(item.label, null, 'pen');
  site.advance(2000);
  assert.equal(item.details.open, false);
  site.dispatch('pointerdown', {pointerType: 'touch', target: item.summary});
  item.details.open = true;
  site.out(item.summary, null, 'touch');
  site.advance(2000);
  assert.equal(item.details.open, true);
});

test('touch activation also cancels a pending mouse hover', () => {
  const site = setup();
  const item = site.disclosure();
  site.over(item.summary);
  site.advance(100);
  site.dispatch('pointerdown', {pointerType: 'touch', target: item.label});
  site.advance(2000);
  assert.equal(item.details.open, false);
});

test('rapid native keyboard toggles cancel a pending hover without reopening content', () => {
  for (const key of ['Enter', ' ']) {
    const site = setup();
    const item = site.disclosure();
    site.over(item.label);
    site.advance(100);
    const first = site.dispatch('keydown', {key, target: item.summary});
    item.details.open = true;
    site.advance(20);
    const second = site.dispatch('keydown', {key, target: item.summary});
    item.details.open = false;
    site.advance(2000);
    assert.equal(item.details.open, false, key);
    assert.equal(first.prevented, false, 'native keyboard activation stays available');
    assert.equal(second.prevented, false, 'native keyboard activation stays available');
  }
});

test('Escape on a closed hover-pending summary cancels the pending opening', () => {
  const site = setup();
  const item = site.disclosure();
  site.over(item.label);
  site.advance(100);
  site.dispatch('keydown', {key: 'Escape', target: item.summary});
  site.advance(2000);
  assert.equal(item.details.open, false);
});

test('keyboard-focused content is protected until focus leaves, then receives the full grace period', () => {
  const site = setup();
  const item = site.disclosure(undefined, true);
  site.document.activeElement = item.link;
  site.dispatch('keydown', {key: 'Tab', target: item.link});
  site.out(item.link, null);
  site.advance(2400);
  assert.equal(item.details.open, true);
  site.document.activeElement = site.element('button');
  site.dispatch('focusin', {target: site.document.activeElement});
  site.advance(1199);
  assert.equal(item.details.open, true);
  site.advance(1);
  assert.equal(item.details.open, false);
});

test('mouse resumes delayed close and returns hidden content focus to the summary', () => {
  const site = setup();
  const item = site.disclosure(undefined, true);
  site.document.activeElement = item.link;
  site.dispatch('keydown', {key: 'Tab', target: item.link});
  site.dispatch('pointermove', {pointerType: 'mouse'});
  site.out(item.link, null);
  site.advance(1200);
  assert.equal(item.details.open, false);
  assert.equal(site.document.activeElement, item.summary);
  assert.equal(item.summary.focusCalls.length, 1);
  assert.equal(item.summary.focusCalls[0].preventScroll, true);
});

test('an open gallery dialog protects its parent, then closing it starts a fresh grace period', () => {
  const site = setup();
  const item = site.disclosure(undefined, true);
  const dialog = site.element('dialog', item.content);
  dialog.open = true;
  site.out(item.link, null);
  site.advance(2400);
  assert.equal(item.details.open, true);
  dialog.open = false;
  site.dispatch('close', {target: dialog});
  site.advance(1199);
  assert.equal(item.details.open, true);
  site.advance(1);
  assert.equal(item.details.open, false);
});

test('Escape closes only the innermost open disclosure and focuses its summary', () => {
  const site = setup();
  const outer = site.disclosure(undefined, true);
  const inner = site.disclosure(outer.content, true);
  const {prevented} = site.dispatch('keydown', {key: 'Escape', target: inner.link});
  assert.equal(inner.details.open, false);
  assert.equal(outer.details.open, true);
  assert.equal(site.document.activeElement, inner.summary);
  assert.equal(prevented, true);
});

test('Escape leaves an open gallery dialog to its own dismissal control', () => {
  const site = setup();
  const item = site.disclosure(undefined, true);
  const dialog = site.element('dialog', item.content);
  dialog.open = true;
  const result = site.dispatch('keydown', {key: 'Escape', target: dialog});
  assert.equal(item.details.open, true);
  assert.equal(result.prevented, false);
});

test('disconnected disclosures do not open or collapse after timer expiration', () => {
  const site = setup();
  const opening = site.disclosure();
  site.over(opening.summary);
  opening.details.isConnected = false;
  site.advance(180);
  assert.equal(opening.details.open, false);
  const closing = site.disclosure(undefined, true);
  site.out(closing.link, site.body);
  closing.details.isConnected = false;
  site.advance(1200);
  assert.equal(closing.details.open, true);
});

test('leaving the browser closes content despite a stale browser hover state', () => {
  const site = setup();
  const item = site.disclosure(undefined, true);
  item.details.hovered = true;
  site.out(item.link, null);
  site.advance(1200);
  assert.equal(item.details.open, false);
});

test('an in-window pointer exit closes content despite stale CSS hover state', () => {
  const site = setup();
  const item = site.disclosure(undefined, true);
  site.over(item.link);
  item.details.hovered = true;
  site.out(item.link, site.body);
  site.advance(1199);
  assert.equal(item.details.open, true);
  site.advance(1);
  assert.equal(item.details.open, false);
});

test('initial parsing and actual refresh reset native expanded state and pending hover timers', () => {
  const site = setup({navigationType: 'reload', initialOpen: true});
  assert.equal(site.initial.details.open, false);
  site.initial.details.open = true;
  const pending = site.disclosure();
  site.over(pending.summary);
  site.pageshow();
  site.advance(2400);
  assert.equal(site.initial.details.open, false);
  assert.equal(pending.details.open, false);
});

test('BFCache return retains the current disclosure state', () => {
  const site = setup({navigationType: 'reload'});
  const item = site.disclosure(undefined, true);
  site.pageshow({persisted: true});
  assert.equal(item.details.open, true);
});

test('legacy reload navigation detection also resets restored state on pageshow', () => {
  const site = setup({navigationType: 'reload', legacyNavigation: true});
  const item = site.disclosure(undefined, true);
  site.pageshow();
  assert.equal(item.details.open, false);
});
