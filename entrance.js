(() => {
  'use strict';

  const root = document.querySelector('.site-frame main');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!root || motion.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;

  const textSelector = [
    'h1', 'h2', 'h3', 'h4', 'p', 'figcaption',
    '.affiliations > div', '.social-links > *', '.detailed-profile > summary',
    '.work-points > li', '.project-side', '.project-links > a',
    '.initiative-grid > article > a', '.honors-list > li', '.media-source',
    '.learning-meta', '.section-note', '.contact-email', '.contact-links',
    '.library-index > div', '.library-index > a', '.library-tabs',
    '.library-controls', '.library-context > details', '.result-bar > span',
    '.library-pagination', '.directory-card-head', '.directory-card-footer'
  ].join(',');
  const imageSelector = 'img:not(.qr-details img), .hero-backdrop';
  const seen = new WeakSet();
  const waiting = new Set();
  const running = new Map();
  let observer, changes;

  // Only an active animation hides an item. Missing JavaScript or a runtime
  // failure therefore leaves the complete page visible and usable.
  function finishAll() {
    observer?.disconnect();
    changes?.disconnect();
    waiting.clear();
    for (const [element, animation] of running) {
      animation.cancel();
      element.classList.remove('entrance-running');
    }
    running.clear();
  }

  function play(element, delay) {
    const style = getComputedStyle(element);
    const x = parseFloat(style.getPropertyValue('--entrance-x')) || 0;
    const y = parseFloat(style.getPropertyValue('--entrance-y')) || 0;
    const duration = parseFloat(style.getPropertyValue('--entrance-duration')) || 560;
    element.classList.add('entrance-running');
    let animation;
    try {
      animation = element.animate([
        { opacity: 0, translate: `${x}px ${y}px` },
        { opacity: 1, translate: '0px 0px' }
      ], { duration, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    } catch (_) {
      element.classList.remove('entrance-running');
      return;
    }
    running.set(element, animation);
    const complete = () => {
      element.classList.remove('entrance-running');
      running.delete(element);
    };
    animation.onfinish = complete;
    animation.oncancel = complete;
  }

  function register(scope) {
    const elements = [...scope.querySelectorAll(`${textSelector},${imageSelector}`)];
    if (scope.matches?.(`${textSelector},${imageSelector}`)) elements.unshift(scope);
    for (const element of elements) {
      if (seen.has(element)) continue;
      // An outer text unit, such as the social-links popover, already includes
      // its text. Do not apply two motions to nested content.
      if (element.parentElement?.closest('.entrance-unit')) continue;
      seen.add(element);
      element.classList.add('entrance-unit', element.matches(imageSelector) ? 'entrance-image' : 'entrance-text');
      waiting.add(element);
      observer.observe(element);
    }
  }

  try {
    observer = new IntersectionObserver(entries => {
      try {
        const visible = entries.filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        visible.forEach((entry, index) => {
          observer.unobserve(entry.target);
          waiting.delete(entry.target);
          const imageOffset = entry.target.classList.contains('entrance-image') ? 85 : 0;
          play(entry.target, Math.min(index, 5) * 45 + imageOffset);
        });
      } catch (_) { finishAll(); }
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    register(root);

    // The knowledge directory is rendered after its data arrives, and again
    // after filtering. Give those results the same independent entrance.
    const results = document.getElementById('library-results');
    if (results && 'MutationObserver' in window) {
      changes = new MutationObserver(records => {
        try {
          for (const element of waiting) {
            if (!element.isConnected) { observer.unobserve(element); waiting.delete(element); }
          }
          for (const record of records) {
            for (const added of record.addedNodes) if (added.nodeType === 1) register(added);
          }
        } catch (_) { finishAll(); }
      });
      changes.observe(results, { childList: true });
    }

    const onMotionChange = event => { if (event.matches) finishAll(); };
    if (motion.addEventListener) motion.addEventListener('change', onMotionChange);
    else motion.addListener(onMotionChange);
    window.addEventListener('pagehide', finishAll, { once: true });
  } catch (_) { finishAll(); }
})();
