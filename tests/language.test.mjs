import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const initCode = read('language-init.js');
const copyCode = read('language-copy.js');
const code = read('language.js');
const key = 'zizhuang-language-v1';

class Text {
  constructor(value) { this.nodeType = 3; this.nodeValue = value; this.parentElement = null; }
}
class Element {
  constructor(tag, attributes = {}, ...children) {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attributes = {...attributes}; this.childNodes = []; this.dataset = {}; this.listeners = {};
    this.append(...children);
  }
  append(...children) { for (const child of children) { const node = typeof child === 'string' ? new Text(child) : child; node.parentElement = this; this.childNodes.push(node); } }
  get textContent() { return this.childNodes.map(node => node.nodeType === 3 ? node.nodeValue : node.textContent).join(''); }
  set textContent(value) { this.childNodes = []; this.append(String(value)); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return name in this.attributes; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  click() { for (const listener of this.listeners.click || []) listener(); }
  matches(selector) {
    if (selector[0] === '#') return this.attributes.id === selector.slice(1);
    if (selector[0] === '.') return (this.attributes.class || '').split(' ').includes(selector.slice(1));
    if (selector[0] === '[') return this.hasAttribute(selector.slice(1, -1));
    return this.tagName.toLowerCase() === selector;
  }
  closest(selectors) { for (let node = this; node; node = node.parentElement) if (selectors.split(',').some(selector => node.matches(selector))) return node; return null; }
  querySelectorAll(selectors) {
    const results = [];
    const visit = element => { for (const child of element.childNodes) if (child.nodeType === 1) { if (selectors.split(',').some(selector => child.matches(selector))) results.push(child); visit(child); } };
    visit(this); return results;
  }
}
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {values, getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, value), removeItem: name => values.delete(name)};
}
function page({saved = storage(), blocked = false} = {}) {
  const root = new Element('html');
  const button = new Element('button', {id: 'language-toggle'}, '中文');
  const anchor = new Element('a', {href: 'https://www.spirit-ai.com/about', target: '_blank', rel: 'noopener noreferrer'}, 'Spirit AI (千寻智能)');
  const role = new Element('strong', {}, 'Robotics End-to-End Evaluation Engineer');
  const intro = new Element('p', {}, 'I am a ', role, ' at ', anchor, '. My work focuses on evaluating robot behavior in real-world scenarios, visual perception, and vision-language-action (VLA) systems. I also explore ');
  const originalChinese = new Element('p', {lang: 'zh-CN'}, '知识库');
  const navigation = new Element('nav', {'aria-label': 'Main navigation'}, new Element('a', {href: '#experience'}, 'Experience'));
  const theme = new Element('button', {'aria-label': 'Theme: Auto. Activate to switch to Light.', title: 'Theme: Auto'}, 'Auto');
  const input = new Element('input', {placeholder: 'Search competitions, organizers, or keywords…'}); input.value = 'do not change my query';
  const picture = new Element('img', {src: 'assets/profile.jpg', alt: 'Zizhuang Zhao by a mountain lake'});
  const dynamic = new Element('div', {id: 'library-results'});
  const chat = new Element('aside', {id: 'xiaoyi-panel'}, new Element('div', {}, 'Experience'), new Element('textarea', {}, 'I am a'));
  const frame = new Element('div', {class: 'site-frame'}, button, navigation, intro, originalChinese, theme, input, picture, dynamic, chat);
  const windowListeners = {}, scheduled = [], observers = [];
  const window = {requestAnimationFrame(callback) { scheduled.push(callback); }, setTimeout(callback) { scheduled.push(callback); }, addEventListener(name, listener) { (windowListeners[name] ||= []).push(listener); }};
  Object.defineProperty(window, 'localStorage', {get() { if (blocked) throw Error('Storage blocked'); return saved; }});
  class Observer {
    constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  const context = vm.createContext({window, MutationObserver: Observer, document: {documentElement: root, body: frame, querySelector: selector => selector === '.site-frame' ? frame : null, getElementById: name => name === 'language-toggle' ? button : null}});
  vm.runInContext(initCode, context);
  const initialLanguage = root.lang;
  vm.runInContext(copyCode, context);
  vm.runInContext(code, context);
  return {root, frame, button, anchor, role, intro, originalChinese, navigation, theme, input, picture, dynamic, chat, saved, api: window.__siteLanguage, copy: window.__siteLanguageCopy, initialLanguage,
    mutate() { observers.filter(observer => observer.active).forEach(observer => observer.callback([])); while (scheduled.length) scheduled.shift()(); },
    storageEvent(name, value) { for (const listener of windowListeners.storage || []) listener({key: name, newValue: value}); }};
}

test('English-first defaults do not infer a language from system appearance or unrelated preferences', () => {
  for (const value of [undefined, '', 'en', 'ZH', 'fr', 'invalid']) {
    const p = page({saved: storage(value === undefined ? {'zizhuang-theme-choice-v1': 'dark'} : {[key]: value})});
    assert.equal(p.initialLanguage, 'en');
    assert.equal(p.root.lang, 'en');
    assert.equal(p.button.textContent, '中文');
    assert.equal(p.intro.textContent.startsWith('I am a '), true);
    assert.equal(p.originalChinese.textContent, '知识库', 'existing Chinese context is not reverse-translated');
    assert.equal(p.root.getAttribute('translate'), 'yes');
  }
});

test('native toggle translates a paragraph around nested links and restores original nodes exactly', () => {
  const p = page();
  const original = p.intro.textContent;
  const nodes = [...p.intro.childNodes];
  for (let pass = 0; pass < 3; pass++) {
    p.button.click();
    assert.equal(p.root.lang, 'zh-CN');
    assert.equal(p.button.textContent, 'EN');
    assert.equal(p.role.textContent, '机器人端到端评测工程师');
    assert.match(p.intro.textContent, /我目前担任/);
    assert.equal(p.anchor.textContent, 'Spirit AI (千寻智能)');
    assert.equal(p.anchor.getAttribute('href'), 'https://www.spirit-ai.com/about');
    assert.equal(p.anchor.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(p.originalChinese.textContent, '知识库');
    assert.equal(p.chat.textContent, 'ExperienceI am a', 'conversation and user text are untouched');
    p.button.click();
    assert.equal(p.intro.textContent, original);
    assert.deepEqual(p.intro.childNodes, nodes, 'roundtrip does not recreate links, listeners, or child nodes');
    assert.equal(p.navigation.childNodes[0].getAttribute('href'), '#experience');
  }
});

test('a deliberate choice survives a new page, while EN resets the saved override', () => {
  const saved = storage();
  const home = page({saved});
  home.button.click();
  assert.equal(saved.values.get(key), 'zh');
  const library = page({saved});
  assert.equal(library.initialLanguage, 'zh-CN', 'blocking initializer reads choice before content scripts');
  assert.equal(library.role.textContent, '机器人端到端评测工程师');
  library.button.click();
  assert.equal(saved.values.has(key), false);
  assert.equal(page({saved}).root.lang, 'en');
});

test('blocked local storage still permits current-page language changes', () => {
  const p = page({blocked: true});
  assert.equal(p.root.lang, 'en');
  p.button.click();
  assert.equal(p.root.lang, 'zh-CN');
  p.button.click();
  assert.equal(p.root.lang, 'en');
});

test('new library results and theme changes are translated without editing source names or input values', () => {
  const p = page({saved: storage({[key]: 'zh'})});
  p.dynamic.append(new Element('span', {}, '1,234 results · 6,430 source records'), new Element('span', {}, 'Page 2 / 10'), new Element('span', {}, 'Campus B1'), new Element('a', {href: 'https://example.com/verified'}, 'Official website / 官方网站 ↗'), new Element('h3', {}, 'Advances in Meteorological Science and Technology气象科技进展（英文）'));
  p.theme.textContent = 'Dark';
  p.theme.setAttribute('aria-label', 'Theme: Dark. Activate to switch to Auto.');
  p.mutate();
  assert.match(p.dynamic.textContent, /1,234 个结果 · 6,430 条来源记录/);
  assert.match(p.dynamic.textContent, /第 2 \/ 10 页/);
  assert.match(p.dynamic.textContent, /校内 B1 类/);
  assert.match(p.dynamic.textContent, /Advances in Meteorological Science and Technology气象科技进展（英文）/);
  assert.equal(p.theme.textContent, '深色');
  assert.equal(p.theme.getAttribute('aria-label'), '主题：深色。点击切换为自动。');
  assert.equal(p.input.getAttribute('placeholder'), '搜索竞赛、主办单位或关键词…');
  assert.equal(p.input.value, 'do not change my query');
  assert.equal(p.picture.getAttribute('alt'), '赵子状在山间湖畔的照片');
  p.button.click();
  assert.match(p.dynamic.textContent, /1,234 results · 6,430 source records/);
  assert.equal(p.theme.textContent, 'Dark');
  assert.equal(p.theme.getAttribute('aria-label'), 'Theme: Dark. Activate to switch to Auto.');
  assert.equal(p.input.getAttribute('placeholder'), 'Search competitions, organizers, or keywords…');
});

test('storage events update open pages without treating theme events as language changes', () => {
  const p = page();
  p.storageEvent('zizhuang-theme-choice-v1', 'dark');
  assert.equal(p.root.lang, 'en');
  p.storageEvent(key, 'zh');
  assert.equal(p.role.textContent, '机器人端到端评测工程师');
  p.storageEvent(key, null);
  assert.equal(p.role.textContent, 'Robotics End-to-End Evaluation Engineer');
});

test('all pages wire one language control after the early initializer, and allow browser translation', () => {
  for (const name of ['index.html', 'knowledge.html', 'guide.html']) {
    const html = read(name);
    assert.equal((html.match(/id="language-toggle"/g) || []).length, 1, `${name}: exactly one toggle`);
    assert.ok(html.indexOf('src="language-init.js"') < html.indexOf('rel="stylesheet"'), `${name}: restore language before stylesheets`);
    assert.ok(html.indexOf('src="language-copy.js') < html.indexOf('src="language.js"'), `${name}: load dictionary first`);
    assert.doesNotMatch(html, /class="[^"]*\bnotranslate\b|translate="no"|name="google"\s+content="notranslate"/);
  }
});

test('long English site prose is covered by editorial translations rather than an external service', () => {
  const p = page();
  const entities = text => text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  for (const name of ['index.html', 'knowledge.html', 'guide.html']) {
    const html = read(name).replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/g, '');
    for (const match of html.matchAll(/>([^<>]+)</g)) {
      const text = entities(match[1]);
      if (text.length < 80 || !/^[A-Za-z.,→]/.test(text) || !/[a-z]{3}/.test(text) || /^Synergistic Research/.test(text)) continue;
      assert.ok(p.copy[text], `${name}: untranslated prose: ${text}`);
    }
  }
  assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|innerHTML\s*=/, 'native language switch does not transmit content or replace markup');
});
