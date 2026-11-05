/* Resolve appearance before CSS: reload follows this device, links preserve a deliberate choice. */
(() => {
  const root = document.documentElement;
  const storageKey = 'zizhuang-theme-choice-v1';
  let navigationType = '';
  try {
    navigationType = window.performance?.getEntriesByType?.('navigation')[0]?.type || '';
  } catch (_) {}
  if (!navigationType) {
    try { navigationType = window.performance?.navigation?.type === 1 ? 'reload' : ''; } catch (_) {}
  }
  let preference = 'auto';
  try {
    if (navigationType === 'reload') window.localStorage.removeItem(storageKey);
    else {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') preference = saved;
    }
  } catch (_) {}
  let media = {matches: false};
  try {
    if (typeof window.matchMedia === 'function') media = window.matchMedia('(prefers-color-scheme: dark)');
  } catch (_) {}
  const dark = preference === 'dark' || (preference === 'auto' && Boolean(media.matches));
  root.dataset.themePreference = preference;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#0d131b' : '#ffffff';
  window.__siteThemeMedia = media;
})();
