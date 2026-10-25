(() => {
  const root = document.documentElement;
  const button = document.getElementById('theme-toggle');
  const meta = document.querySelector('meta[name="theme-color"]');
  const media = window.__siteThemeMedia || window.matchMedia('(prefers-color-scheme: dark)');
  const storageKey = 'zizhuang-theme-choice-v1';
  const next = {auto: 'light', light: 'dark', dark: 'auto'};
  const labels = {auto: 'Auto', light: 'Light', dark: 'Dark'};
  // The blocking initializer restores only a deliberate choice made with the new key.
  let preference = ['light', 'dark'].includes(root.dataset.themePreference) ? root.dataset.themePreference : 'auto';

  function render() {
    const dark = preference === 'dark' || (preference === 'auto' && media.matches);
    root.dataset.themePreference = preference;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
    if (meta) meta.content = dark ? '#0d131b' : '#ffffff';
    if (button) {
      button.textContent = labels[preference];
      button.setAttribute('aria-label', `Theme: ${labels[preference]}. Activate to switch to ${labels[next[preference]]}.`);
      button.title = `Theme: ${labels[preference]}`;
    }
  }

  button?.addEventListener('click', () => {
    preference = next[preference];
    try {
      if (preference === 'auto') window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, preference);
    } catch (_) {}
    render();
  });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'auto';
    render();
  });
  const handleSystemChange = () => { if (preference === 'auto') render(); };
  if (media.addEventListener) media.addEventListener('change', handleSystemChange);
  else if (media.addListener) media.addListener(handleSystemChange);
  render();
})();
