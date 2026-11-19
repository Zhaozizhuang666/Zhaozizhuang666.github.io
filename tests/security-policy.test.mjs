import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'; upgrade-insecure-requests";

function pages() {
  const found = ['index.html', 'knowledge.html', 'guide.html'].map(name => path.join(root, name));
  const visit = directory => {
    for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
      const target = path.join(directory, item.name);
      if (item.isDirectory()) visit(target);
      else if (item.isFile() && item.name.endsWith('.html')) found.push(target);
    }
  };
  visit(path.join(root, 'resources'));
  return found;
}

function inspect(source) {
  const state = {policy: null, scripts: [], handlers: []};
  const tagPattern = /<(meta|script)\b([^>]*)>/gi;
  for (const match of source.matchAll(tagPattern)) {
    const tag = match[1].toLowerCase();
    const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map(item => [item[1].toLowerCase(), item[3]]));
    if (tag === 'meta' && attrs['http-equiv']?.toLowerCase() === 'content-security-policy') state.policy = attrs.content;
    if (tag === 'script') state.scripts.push(attrs);
    state.handlers.push(...Object.keys(attrs).filter(name => /^on[a-z]+$/i.test(name)));
  }
  return state;
}

test('every public HTML page carries the same restrictive browser policy', () => {
  for (const page of pages()) {
    const source = fs.readFileSync(page, 'utf8');
    const state = inspect(source);
    assert.equal(state.policy, policy, path.relative(root, page));
    assert.match(state.policy, /object-src 'none'/);
    assert.match(state.policy, /connect-src 'self'/);
    assert.match(state.policy, /frame-src 'self'/);
    assert.doesNotMatch(state.policy, /script-src[^;]*(?:unsafe-inline|unsafe-eval|\*)/);
    assert.deepEqual(state.handlers, [], path.relative(root, page));
    for (const script of state.scripts) {
      if (script.src) assert.doesNotMatch(script.src, /^(?:https?:)?\/\//, path.relative(root, page));
      else {
        assert.equal(script.type, 'application/json', path.relative(root, page));
        assert.equal(script.id, 'vla-config', path.relative(root, page));
        assert.doesNotThrow(() => JSON.parse(source.match(/<script type="application\/json" id="vla-config">([\s\S]*?)<\/script>/)?.[1] || 'null'));
      }
    }
  }
});

test('the homepage navigation runs from a same-origin file instead of inline JavaScript', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /<script src="navigation\.js" defer><\/script>/);
  assert.doesNotMatch(home, /<script\s*>/i);
  assert.ok(fs.statSync(path.join(root, 'navigation.js')).size > 0);
});

test('resource synchronization preserves strict script policy and inert VLA configuration', () => {
  const sync = fs.readFileSync(path.join(root, 'scripts/sync-learning-resources.py'), 'utf8');
  const policy = fs.readFileSync(path.join(root, 'scripts/site_security.py'), 'utf8');
  assert.match(sync, /secure_html\(content, vla_config=True\)/);
  assert.match(sync, /return secure_html\(content\)/);
  assert.match(policy, /script-src 'self'/);
  assert.match(policy, /type="application\/json" id="vla-config"/);
});
