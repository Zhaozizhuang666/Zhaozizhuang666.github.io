import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../scroll-init.js', import.meta.url), 'utf8');

function page(type = 'reload') {
  const calls = [];
  const listeners = {};
  const raf = callback => { callback(); return 1; };
  const performance = {getEntriesByType: () => [{type}], navigation: {type: type === 'reload' ? 1 : 0}};
  const history = {scrollRestoration: 'auto'};
  const context = vm.createContext({
    performance,
    history,
    requestAnimationFrame: raf,
    window: {
      scrollTo: options => calls.push(options),
      addEventListener: (name, callback) => { listeners[name] = callback; },
    },
  });
  vm.runInContext(code, context);
  return {calls, listeners, history};
}

test('hard reload forces top after browser restoration and keeps manual restoration', () => {
  const pageState = page('reload');
  assert.equal(pageState.history.scrollRestoration, 'manual');
  assert.ok(pageState.calls.length >= 2);
  pageState.listeners.pageshow?.();
  assert.ok(pageState.calls.at(-1));
  assert.equal(pageState.calls.at(-1).top, 0);
});

test('normal navigation does not unexpectedly jump to top', () => {
  const pageState = page('navigate');
  assert.deepEqual(pageState.calls, []);
});
