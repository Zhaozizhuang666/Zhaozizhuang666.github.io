/* A real reload starts at the top; ordinary links and browser history keep their anchors. */
(() => {
  let navigationType = '';
  try {
    navigationType = window.performance?.getEntriesByType?.('navigation')[0]?.type || '';
  } catch (_) {}
  if (!navigationType) {
    try { navigationType = window.performance?.navigation?.type === 1 ? 'reload' : ''; } catch (_) {}
  }
  if (navigationType !== 'reload') return;
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (_) {}

  // Remove a stale fragment before the parser finds its target and scrolls to it.
  // Keep the query string and the current history entry, without causing another navigation.
  try {
    if (window.location.hash) {
      history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
    }
  } catch (_) {}

  const toTop = () => {
    try { window.scrollTo({top: 0, left: 0, behavior: 'instant'}); }
    catch (_) { try { window.scrollTo(0, 0); } catch (_) {} }
  };
  // The browser can restore its previous offset after the document and hash load;
  // run across the first paint and pageshow so that restoration cannot win.
  toTop();
  window.addEventListener('DOMContentLoaded', toTop, {once: true});
  window.addEventListener('pageshow', toTop, {once: true});
  window.addEventListener('pagehide', () => { try { history.scrollRestoration = 'auto'; } catch (_) {} }, {once: true});
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => window.requestAnimationFrame(toTop));
  }
})();
