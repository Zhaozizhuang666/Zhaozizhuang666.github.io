import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../xiaoyi.js', import.meta.url), 'utf8');
function mapper(href) {
  const context = vm.createContext({URL, window: {location: {href}}});
  const start = source.indexOf('  function referenceUrl(');
  const end = source.indexOf('  function richText(', start);
  vm.runInContext(source.slice(start, end), context);
  return value => context.referenceUrl(value);
}

test('Xiaoyi citations stay on the current mirror, including saved sources', () => {
  const map = mapper('https://student-site.example/knowledge.html');
  for (const path of ['/#experience', '/guide.html#theme', '/knowledge.html#learning', '/resources/vla-guide/docs/m5-01/', '/assets/documents/chuangxiang-business-model.pdf']) {
    assert.equal(map('https://zhaozizhuang666.github.io' + path), 'https://student-site.example' + path);
  }
  assert.equal(map('https://zhaozizhuang666.github.io/guide.html?v=1#usage'), 'https://student-site.example/guide.html?v=1#usage');
  assert.match(source, /a\.href=referenceUrl\(m\[2\]\|\|m\[3\]\)/);
  assert.match(source, /a\.href=referenceUrl\(s\.website\|\|s\.url\)/);
});

test('mirror mapping preserves independent projects and external sources', () => {
  const map = mapper('https://student-site.example/');
  for (const url of ['https://zhaozizhuang666.github.io/vla-guide/', 'https://zhaozizhuang666.github.io/other-project/', 'https://github.com/Spirit-AI-Team/spirit-v1.5', 'https://zhaozizhuang666.github.io.evil.example/guide.html', 'not-a-url']) {
    assert.equal(map(url), url);
  }
  const fileMap = mapper('file:///tmp/index.html');
  assert.equal(fileMap('https://zhaozizhuang666.github.io/guide.html'), 'https://zhaozizhuang666.github.io/guide.html');
});

test('all three main pages use the locally licensed Outfit font', () => {
  for (const page of ['index.html', 'knowledge.html', 'guide.html']) {
    const text = fs.readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /fonts\.(?:googleapis|gstatic)\.com/);
  }
  const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /url\('assets\/fonts\/outfit-latin-wght-normal\.woff2'\)/);
  assert.ok(fs.statSync(new URL('../assets/fonts/outfit-latin-wght-normal.woff2', import.meta.url)).size > 10000);
  assert.match(fs.readFileSync(new URL('../assets/fonts/OFL-Outfit.txt', import.meta.url), 'utf8'), /SIL OPEN FONT LICENSE/);
});
