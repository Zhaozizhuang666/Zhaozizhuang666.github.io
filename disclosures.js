(() => {
  const OPEN_DELAY = 180;
  const CLOSE_DELAY = 1200;
  const opening = new Map();
  const closing = new Map();
  const waiting = new Set();
  let keyboardNavigation = false;
  let pointerTarget = null;
  let pointerInWindow = true;
  const ancestors = (target, selector = 'details[open]') => {
    const result = [];
    for (let node = target?.closest?.(selector); node; node = node.parentElement?.closest(selector)) result.push(node);
    return result;
  };
  const group = disclosure => disclosure.closest('section, nav, aside, .library-context') || disclosure.parentElement;
  const cancelTimer = (timers, disclosure) => {
    clearTimeout(timers.get(disclosure));
    timers.delete(disclosure);
  };
  const cancelClose = disclosure => {
    cancelTimer(closing, disclosure);
    waiting.delete(disclosure);
  };
  const protectedFromClose = disclosure => {
    if (disclosure.querySelector('dialog[open]')) return true;
    if (keyboardNavigation && disclosure.contains(document.activeElement)) return true;
    if (!pointerInWindow) return false;
    if (disclosure.contains(pointerTarget)) return true;
    // Keep earlier content stable while reading another disclosure in the same section.
    return ancestors(pointerTarget).some(peer => group(peer) === group(disclosure));
  };
  const reconcile = () => {
    for (const disclosure of waiting) {
      if (!disclosure.isConnected || !disclosure.open) {
        cancelClose(disclosure);
      } else if (protectedFromClose(disclosure)) {
        cancelTimer(closing, disclosure);
      } else if (!closing.has(disclosure)) {
        closing.set(disclosure, setTimeout(() => {
          closing.delete(disclosure);
          if (protectedFromClose(disclosure)) return;
          cancelClose(disclosure);
          if (!disclosure.isConnected || !disclosure.open) return;
          if (disclosure.contains(document.activeElement)) {
            disclosure.querySelector(':scope > summary')?.focus({preventScroll: true});
          }
          disclosure.open = false;
        }, CLOSE_DELAY));
      }
    }
  };

  document.addEventListener('keydown', event => {
    if (['Tab', 'Enter', ' ', 'Home', 'End'].includes(event.key) || event.key.startsWith('Arrow')) keyboardNavigation = true;
    if (['Enter', ' ', 'Escape'].includes(event.key)) {
      ancestors(event.target, 'details').forEach(disclosure => cancelTimer(opening, disclosure));
    }
    if (event.key === 'Escape') {
      const disclosure = ancestors(event.target)[0];
      if (!disclosure || disclosure.querySelector('dialog[open]')) return;
      cancelTimer(opening, disclosure);
      cancelClose(disclosure);
      disclosure.open = false;
      disclosure.querySelector(':scope > summary')?.focus({preventScroll: true});
      event.preventDefault();
    }
  }, true);

  document.addEventListener('pointerdown', event => {
    keyboardNavigation = event.pointerType !== 'mouse';
    // A pending hover must not reverse an intentional click or touch activation.
    ancestors(event.target, 'details').forEach(disclosure => cancelTimer(opening, disclosure));
  }, true);

  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') keyboardNavigation = false;
  }, {capture: true, passive: true});

  document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    pointerInWindow = true;
    pointerTarget = event.target;
    ancestors(event.target).forEach(cancelClose);
    const summary = event.target.closest?.('summary');
    const disclosure = summary?.parentElement;
    if (disclosure?.matches('details') && !disclosure.open && !summary.contains(event.relatedTarget)) {
      cancelTimer(opening, disclosure);
      opening.set(disclosure, setTimeout(() => {
        opening.delete(disclosure);
        if (!pointerInWindow || !disclosure.isConnected || !summary.contains(pointerTarget)) return;
        disclosure.open = true;
        cancelClose(disclosure);
        reconcile();
      }, OPEN_DELAY));
    }
    reconcile();
  }, true);

  document.addEventListener('pointerout', event => {
    if (event.pointerType !== 'mouse') return;
    pointerTarget = event.relatedTarget;
    pointerInWindow = event.relatedTarget !== null;
    const summary = event.target.closest?.('summary');
    if (summary && !summary.contains(event.relatedTarget)) cancelTimer(opening, summary.parentElement);
    for (const disclosure of ancestors(event.target)) {
      if (!disclosure.contains(event.relatedTarget)) waiting.add(disclosure);
    }
    reconcile();
  }, true);

  document.addEventListener('focusin', reconcile, true);
  document.addEventListener('close', event => {
    if (event.target.matches?.('dialog')) {
      ancestors(event.target).forEach(disclosure => waiting.add(disclosure));
      reconcile();
    }
  }, true);

  const reset = () => {
    for (const disclosure of opening.keys()) cancelTimer(opening, disclosure);
    for (const disclosure of closing.keys()) cancelClose(disclosure);
    waiting.clear();
    document.querySelectorAll('details[open]').forEach(disclosure => { disclosure.open = false; });
  };
  let navigationType = '';
  try {
    navigationType = window.performance?.getEntriesByType?.('navigation')[0]?.type || '';
  } catch (_) {}
  if (!navigationType) {
    try { navigationType = window.performance?.navigation?.type === 1 ? 'reload' : ''; } catch (_) {}
  }
  // Browsers may restore native details state after parsing, even without an open attribute.
  reset();
  if (navigationType === 'reload') window.addEventListener('pageshow', event => {
    if (event.persisted) return;
    reset();
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(reset);
  }, {once: true});
})();
