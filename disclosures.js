(() => {
  const pending = new Map();
  let keyboardNavigation = false;
  let pointerInWindow = true;
  const ancestors = target => {
    const result = [];
    for (let node = target?.closest?.('details[open]'); node; node = node.parentElement?.closest('details[open]')) result.push(node);
    return result;
  };
  const cancel = disclosure => {
    clearTimeout(pending.get(disclosure));
    pending.delete(disclosure);
  };
  const schedule = disclosure => {
    cancel(disclosure);
    pending.set(disclosure, setTimeout(() => {
      pending.delete(disclosure);
      if (!disclosure.isConnected || !disclosure.open || (pointerInWindow && disclosure.matches(':hover'))) return;
      // A full-size gallery image remains available until its dialog is dismissed.
      if (disclosure.querySelector('dialog[open]')) return;
      if (keyboardNavigation && disclosure.contains(document.activeElement)) return;
      if (disclosure.contains(document.activeElement)) {
        disclosure.querySelector(':scope > summary')?.focus({preventScroll: true});
      }
      disclosure.open = false;
    }, 240));
  };

  document.addEventListener('keydown', event => {
    if (['Tab', 'Enter', ' ', 'Home', 'End'].includes(event.key) || event.key.startsWith('Arrow')) keyboardNavigation = true;
  }, true);

  document.addEventListener('pointerdown', () => {
    keyboardNavigation = false;
  }, true);

  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') keyboardNavigation = false;
  }, {capture: true, passive: true});

  document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    pointerInWindow = true;
    ancestors(event.target).forEach(cancel);
  }, true);

  document.addEventListener('pointerout', event => {
    if (event.pointerType !== 'mouse') return;
    if (event.relatedTarget === null) pointerInWindow = false;
    for (const disclosure of ancestors(event.target)) {
      if (!disclosure.contains(event.relatedTarget)) schedule(disclosure);
    }
  }, true);

  document.addEventListener('close', event => {
    if (event.target.matches?.('dialog')) ancestors(event.target).forEach(schedule);
  }, true);

  const reset = () => {
    document.querySelectorAll('details[open]').forEach(disclosure => {
      cancel(disclosure);
      disclosure.open = false;
    });
  };
  let reloaded = false;
  let navigationType = '';
  try {
    navigationType = window.performance?.getEntriesByType?.('navigation')[0]?.type || '';
  } catch (_) {}
  if (!navigationType) {
    try { navigationType = window.performance?.navigation?.type === 1 ? 'reload' : ''; } catch (_) {}
  }
  reloaded = navigationType === 'reload';
  // Browsers may restore native details state after parsing, even without an open attribute.
  reset();
  if (reloaded) window.addEventListener('pageshow', event => {
    if (event.persisted) return;
    reset();
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(reset);
  }, {once: true});
})();
