/* Small, local EN/中文 switch for the static site. It never calls a translation service. */
(() => {
  'use strict';
  const STORAGE_KEY = 'zizhuang-language-v1';
  const copy = window.__siteLanguageCopy || {};
  const root = document.documentElement;
  const frame = document.querySelector('.site-frame') || document.body;
  const button = document.getElementById('language-toggle');
  const originals = new WeakMap();
  const originalAttributes = new WeakMap();
  let language = root.dataset.language === 'zh' ? 'zh' : 'en';
  let rendering = false;
  let scheduled = false;
  let observer;
  const observerOptions = {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder', 'alt']};

  function normalized(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function replaceMapped(text, target) {
    if (target !== 'zh') return String(text || '');
    const key = normalized(text);
    let next = copy[key];
    if (target === 'zh' && typeof next !== 'string') {
      const count = key.match(/^([\d,]+) results · ([\d,]+) source records$/);
      const page = key.match(/^Page (\d+) \/ (\d+)$/);
      const campus = key.match(/^Campus (A|B1|B2)$/);
      const theme = key.match(/^Theme: (Auto|Light|Dark)(?:\. Activate to switch to (Auto|Light|Dark)\.)?$/);
      if (count) next = `${count[1]} 个结果 · ${count[2]} 条来源记录`;
      if (page) next = `第 ${page[1]} / ${page[2]} 页`;
      if (campus) next = `校内 ${campus[1]} 类`;
      if (theme) next = `主题：${copy[theme[1]]}${theme[2] ? `。点击切换为${copy[theme[2]]}。` : ''}`;
    }
    if (typeof next !== 'string' || !key) return null;
    const leading = String(text).match(/^\s*/)?.[0] || '';
    const trailing = String(text).match(/\s*$/)?.[0] || '';
    return leading + next + trailing;
  }

  function excluded(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return Boolean(element?.closest?.('script,style,template,noscript,textarea,.xiaoyi-dock,#xiaoyi-panel,#language-toggle,[data-language-ignore]'));
  }

  function textNodes(container) {
    const found = [];
    if (!container) return found;
    const walker = document.createTreeWalker?.(container, 4);
    if (walker) {
      let node;
      while ((node = walker.nextNode())) if (!excluded(node)) found.push(node);
      return found;
    }
    const visit = element => {
      for (const node of element.childNodes || []) {
        if (node.nodeType === 3 && !excluded(node)) found.push(node);
        else if (node.nodeType === 1 && !excluded(node)) visit(node);
      }
    };
    visit(container);
    return found;
  }

  function translateAttributes(target) {
    for (const element of frame.querySelectorAll?.('[aria-label],[title],[placeholder],[alt]') || []) {
      if (excluded(element)) continue;
      for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
        if (!element.hasAttribute(attribute)) continue;
        const value = element.getAttribute(attribute);
        let attributes = originalAttributes.get(element);
        if (!attributes) { attributes = new Map(); originalAttributes.set(element, attributes); }
        let record = attributes.get(attribute);
        if (!record || value !== record.rendered) record = {source: value, rendered: value};
        const next = replaceMapped(record.source, target) ?? record.source;
        if (next !== value) element.setAttribute(attribute, next);
        record.rendered = next; attributes.set(attribute, record);
      }
    }
  }

  function render(next = language) {
    language = next === 'zh' ? 'zh' : 'en';
    rendering = true;
    observer?.disconnect();
    try {
      for (const node of textNodes(frame)) {
        let record = originals.get(node);
        if (!record || node.nodeValue !== record.rendered) record = {source: node.nodeValue, rendered: node.nodeValue};
        const nextText = replaceMapped(record.source, language) ?? record.source;
        if (nextText !== node.nodeValue) node.nodeValue = nextText;
        record.rendered = nextText; originals.set(node, record);
      }
      translateAttributes(language);
      root.dataset.language = language;
      root.lang = language === 'zh' ? 'zh-CN' : 'en';
      if (button) {
        button.textContent = language === 'zh' ? 'EN' : '中文';
        button.setAttribute('aria-label', language === 'zh' ? '切换为英文' : 'Switch site language to Chinese');
        button.title = language === 'zh' ? 'Switch to English' : '切换为中文';
      }
      try {
        if (language === 'zh') window.localStorage.setItem(STORAGE_KEY, 'zh');
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
    } finally {
      rendering = false;
      observer?.observe(frame, observerOptions);
    }
  }

  function schedule() {
    if (scheduled || rendering) return;
    scheduled = true;
    const flush = () => { scheduled = false; render(language); };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(flush);
    else window.setTimeout(flush, 0);
  }

  button?.addEventListener('click', () => render(language === 'zh' ? 'en' : 'zh'));
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    render(event.newValue === 'zh' ? 'zh' : 'en');
  });
  if (typeof MutationObserver === 'function' && frame) {
    observer = new MutationObserver(() => { if (!rendering) schedule(); });
    observer.observe(frame, observerOptions);
  }
  window.__siteLanguage = Object.freeze({
    key: STORAGE_KEY,
    get: () => language,
    set: value => render(value),
    normalize: normalized,
    translate: (value, valueLanguage = language) => replaceMapped(value, valueLanguage === 'zh' ? 'zh' : 'en') ?? value
  });
  render(language);
})();
