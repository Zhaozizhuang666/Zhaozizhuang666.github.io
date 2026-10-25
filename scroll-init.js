/* Keep a hard refresh predictable: a reload returns the homepage to its top. */
(() => {
  let navigationType = '';
  try {
    navigationType = performance.getEntriesByType('navigation')[0]?.type || '';
    if (!navigationType && performance.navigation) navigationType = performance.navigation.type === 1 ? 'reload' : '';
  } catch (_) {}
  if (navigationType !== 'reload') return;
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (_) {}

  const toTop = () => window.scrollTo({top: 0, left: 0, behavior: 'instant'});
  // The browser can restore its previous offset after the document and hash load;
  // run across the first paint and pageshow so that restoration cannot win.
  toTop();
  window.addEventListener('DOMContentLoaded', toTop, {once: true});
  window.addEventListener('pageshow', toTop, {once: true});
  window.addEventListener('pagehide', () => { try { history.scrollRestoration = 'auto'; } catch (_) {} }, {once: true});
  requestAnimationFrame(() => requestAnimationFrame(toTop));
})();
