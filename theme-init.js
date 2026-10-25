/* Resolve the chosen appearance before stylesheets load; legacy preferences are ignored. */
(() => {
  const root = document.documentElement;
  const storageKey = 'zizhuang-theme-choice-v1';
  let preference = 'auto';
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') preference = saved;
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
