import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../scroll-init.js', import.meta.url), 'utf8');

function page(type = 'reload', {hash = '#research', search = '?localmode=1', legacy = false, blockedHistory = false, unavailableNavigation = false, rafAvailable = true} = {}) {
  const calls = [];
  const listeners = {};
  const raf = callback => { callback(); return 1; };
  const performance = {getEntriesByType: () => [{type}], navigation: {type: type === 'reload' ? 1 : 0}};
  if (legacy) performance.getEntriesByType = () => { throw Error('Navigation entries unavailable'); };
  if (unavailableNavigation) { delete performance.getEntriesByType; delete performance.navigation; }
  const replacements = [];
  const originalState = {section: 'research'};
  const location = {hash, pathname: '/index.html', search};
  const history = {scrollRestoration: 'auto', state: originalState,
    replaceState(state, unused, url) {
      if (blockedHistory) throw Error('History unavailable');
      replacements.push({state, url});
      location.hash = '';
    }};
  const context = vm.createContext({
    performance,
    history,
    requestAnimationFrame: raf,
    window: {
      performance, location, requestAnimationFrame: rafAvailable ? raf : undefined,
      scrollTo: options => calls.push(options),
      addEventListener: (name, callback) => { listeners[name] = callback; },
    },
  });
  vm.runInContext(code, context);
  return {calls, listeners, history, replacements, location, originalState};
}

test('hard reload forces top after browser restoration and keeps manual restoration', () => {
  const pageState = page('reload');
  assert.equal(pageState.history.scrollRestoration, 'manual');
  assert.ok(pageState.calls.length >= 2);
  pageState.listeners.pageshow?.();
  assert.ok(pageState.calls.at(-1));
  assert.equal(pageState.calls.at(-1).top, 0);
  assert.equal(pageState.location.hash, '');
  assert.equal(pageState.replacements.length, 1);
  assert.equal(pageState.replacements[0].url, '/index.html?localmode=1');
  assert.equal(pageState.replacements[0].state, pageState.originalState);
  pageState.listeners.pagehide?.();
  assert.equal(pageState.history.scrollRestoration, 'auto');
});

test('normal navigation does not unexpectedly jump to top', () => {
  const pageState = page('navigate');
  assert.deepEqual(pageState.calls, []);
  assert.deepEqual(pageState.replacements, []);
  assert.equal(pageState.location.hash, '#research');
  assert.equal(pageState.history.scrollRestoration, 'auto');
});

test('browser back/forward preserves its anchor and native restoration', () => {
  const pageState = page('back_forward');
  assert.deepEqual(pageState.calls, []);
  assert.equal(pageState.location.hash, '#research');
  assert.equal(pageState.history.scrollRestoration, 'auto');
});

test('legacy navigation detection still resets reload when modern timing is unavailable', () => {
  const pageState = page('reload', {legacy: true});
  assert.equal(pageState.history.scrollRestoration, 'manual');
  assert.equal(pageState.location.hash, '');
  assert.equal(pageState.calls.at(-1).top, 0);
});

test('missing navigation timing does not mistake an ordinary link for a reload', () => {
  const pageState = page('reload', {unavailableNavigation: true});
  assert.deepEqual(pageState.calls, []);
  assert.deepEqual(pageState.replacements, []);
});

test('blocked history or absent animation frames does not interrupt reload initialization', () => {
  const pageState = page('reload', {blockedHistory: true, rafAvailable: false});
  assert.equal(pageState.calls.at(-1).top, 0);
  pageState.listeners.pageshow?.();
  assert.equal(pageState.calls.at(-1).top, 0);
});

test('a reload with no fragment does not rewrite its URL', () => {
  const pageState = page('reload', {hash: ''});
  assert.deepEqual(pageState.replacements, []);
  assert.equal(pageState.calls.at(-1).top, 0);
});
