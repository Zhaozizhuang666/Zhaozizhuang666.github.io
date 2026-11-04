/* Preview only visible official demos; retain posters for reduced motion. */
(() => {
  const videos = [...document.querySelectorAll('.research-section video')];
  const toggle = document.querySelector('.preview-toggle');
  if (!videos.length || !toggle || !window.IntersectionObserver) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = preference.matches;
  const visible = new Set();
  const update = () => {
    toggle.hidden = false;
    toggle.setAttribute('aria-pressed', String(paused));
    // The editorial translation controller observes this text change.
    toggle.textContent = paused ? 'Play previews' : 'Pause previews';
    for (const video of videos) {
      const disclosure = video.closest('details');
      if (!paused && visible.has(video) && (!disclosure || disclosure.open)) {
        video.play().catch(() => {});
      } else video.pause();
    }
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    update();
  }, { threshold: .12 });
  videos.forEach(video => observer.observe(video));
  toggle.addEventListener('click', () => { paused = !paused; update(); });
  document.querySelectorAll('.paper-more').forEach(details => details.addEventListener('toggle', update));
  preference.addEventListener?.('change', event => { paused = event.matches; update(); });
})();
