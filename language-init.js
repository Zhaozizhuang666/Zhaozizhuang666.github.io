/* Restore the deliberate site language before the page scripts and styles run. */
(() => {
  'use strict';
  let language = 'en';
  try {
    if (window.localStorage.getItem('zizhuang-language-v1') === 'zh') language = 'zh';
  } catch (_) {}
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.language = language;
  document.documentElement.setAttribute('translate', 'yes');
})();
