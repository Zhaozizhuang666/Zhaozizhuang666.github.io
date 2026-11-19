(() => {
  const moreMenu = document.querySelector('.nav-more');
  moreMenu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { moreMenu.open = false; }));
  document.addEventListener('click', event => { if (moreMenu && !moreMenu.contains(event.target)) moreMenu.open = false; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && moreMenu?.open) { moreMenu.open = false; moreMenu.querySelector('summary').focus(); } });
  const navLinks = document.querySelectorAll('nav a[href^="#"]');
  const sections = [...navLinks].map(link => document.querySelector(link.getAttribute('href')));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) navLinks.forEach(link => {
          if (link.getAttribute('href') === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
    }, {rootMargin: '-10% 0px -60% 0px'});
    sections.forEach(section => { if (section) observer.observe(section); });
  }
})();
