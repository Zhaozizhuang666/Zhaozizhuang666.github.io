/* An accessible, image-based archive. CSS supplies motion; original files remain untouched. */
(() => {
  'use strict';
  const mount = document.getElementById('achievement-gallery');
  if (!mount) return;
  const disclosure = mount.closest('details');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const words = {
    en: {eyebrow:'ARCHIVE IN MOTION', title:'Certificates & Records', intro:'Competition, research and learning — collected in one visual archive.', all:'All', competition:'Competition', research:'Research', learning:'Learning', record:'Archive', pause:'Pause', resume:'Resume', grid:'Grid view', motion:'Motion view', records:'records', categories:'Archive categories', open:'View record', close:'Close image', previous:'Previous image', next:'Next image', original:'Open full image', failed:'The image could not be loaded. Use “Open full image” to try again.', empty:'No records in this category.'},
    zh: {eyebrow:'实践影像档案', title:'证书与记录', intro:'以图像记录科创竞赛、研究与学习。', all:'全部', competition:'科创竞赛', research:'研究成果', learning:'学习交流', record:'其他记录', pause:'暂停动态', resume:'继续动态', grid:'网格浏览', motion:'动态浏览', records:'项记录', categories:'档案类别', open:'查看记录', close:'关闭图片', previous:'上一张', next:'下一张', original:'打开完整图片', failed:'图片暂未加载，请使用“打开完整图片”重试。', empty:'此分类暂无记录。'}
  };
  const language = () => document.documentElement.dataset.language === 'zh' ? 'zh' : 'en';
  const t = key => words[language()][key];
  const titleOf = item => language() === 'zh' ? item.titleZh || item.title : item.title;
  let renderedLanguage = language();
  let items = [], selected = 'all', grid = reducedMotion.matches, paused = false, visible = false, activeIndex = 0, previousFocus;
  let stage, status, filters, toggleMotion, toggleGrid, dialog, dialogImage, dialogTitle, imageLink, dialogCount, errorText;
  let keyboardNavigation = false, restoringFocus = false, oldRootOverflow = '';
  document.addEventListener('pointerdown', () => { keyboardNavigation = false; }, {capture:true, passive:true});
  document.addEventListener('keydown', event => { if (event.key === 'Tab') keyboardNavigation = true; }, true);
  const element = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const filtered = () => items.filter(item => selected === 'all' || item.category === selected);
  function updateRunning() {
    mount.dataset.running = String(visible && (!disclosure || disclosure.open) && !document.hidden && !paused && !grid && !reducedMotion.matches && !dialog.open);
    toggleMotion.disabled = grid || reducedMotion.matches;
    toggleMotion.setAttribute('aria-pressed', String(paused));
    toggleMotion.textContent = paused ? `▶ ${t('resume')}` : `Ⅱ ${t('pause')}`;
  }
  function card(item, clone = false) {
    const button = element('button', 'hg-card');
    button.type = 'button';
    button.dataset.recordId = item.id;
    button.setAttribute('aria-label', `${t('open')}: ${titleOf(item)}`);
    const image = element('img');
    image.src = item.thumbnail;
    image.alt = '';
    image.width = item.width;
    image.height = item.height;
    image.loading = 'lazy';
    image.decoding = 'async';
    const label = element('span', 'hg-card-title', titleOf(item));
    const type = element('span', 'hg-card-type', t(item.category));
    button.append(image, type, label);
    if (clone) { button.tabIndex = -1; button.setAttribute('aria-hidden', 'true'); }
    button.addEventListener('click', () => openImage(item.id, button));
    button.addEventListener('focus', () => {
      if (grid || clone || !keyboardNavigation || restoringFocus) return;
      grid = true;
      renderStage();
      [...stage.querySelectorAll('.hg-card')].find(node => node.dataset.recordId === item.id)?.focus({preventScroll:true});
    });
    return button;
  }
  function renderStage() {
    const list = filtered();
    stage.replaceChildren();
    stage.classList.toggle('hg-stage-grid', grid);
    mount.dataset.view = grid ? 'grid' : 'motion';
    status.textContent = `${list.length} ${t('records')}`;
    toggleGrid.textContent = grid ? `↔ ${t('motion')}` : `▦ ${t('grid')}`;
    toggleGrid.setAttribute('aria-pressed', String(grid));
    for (const button of filters.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.category === selected));
    if (!list.length) { stage.append(element('p', 'hg-empty', t('empty'))); updateRunning(); return; }
    if (grid) {
      const group = element('div', 'hg-grid');
      list.forEach(item => group.append(card(item)));
      stage.append(group);
    } else {
      const rows = [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)];
      rows.filter(row => row.length).forEach((row, i) => {
        const lane = element('div', `hg-lane hg-lane-${i}`);
        const track = element('div', 'hg-track');
        const group = element('div', 'hg-group');
        // A short category still fills a desktop strip. Only the first set is in the tab order.
        const repetitions = Math.max(1, Math.ceil(7 / row.length));
        for (let repeat = 0; repeat < repetitions; repeat++) row.forEach(item => group.append(card(item, repeat > 0)));
        const duplicate = element('div', 'hg-group');
        duplicate.setAttribute('aria-hidden', 'true');
        // Repeated cards stay pointer-accessible while being excluded from keyboard and screen-reader navigation.
        for (let repeat = 0; repeat < repetitions; repeat++) row.forEach(item => duplicate.append(card(item, true)));
        track.append(group, duplicate); lane.append(track); stage.append(lane);
      });
    }
    if (visible) stage.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    updateRunning();
  }
  function showImage() {
    const list = filtered();
    const item = list[activeIndex];
    if (!item) return;
    dialogTitle.textContent = titleOf(item);
    dialogCount.textContent = `${activeIndex + 1} / ${list.length}`;
    dialogImage.alt = titleOf(item);
    dialogImage.width = item.width;
    dialogImage.height = item.height;
    errorText.hidden = true;
    dialogImage.src = item.full;
    imageLink.href = item.full;
  }
  function openImage(id, trigger) {
    activeIndex = filtered().findIndex(item => item.id === id);
    previousFocus = trigger;
    showImage();
    if (typeof dialog.showModal === 'function') {
      oldRootOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      dialog.showModal();
    }
    else { window.open(imageLink.href, '_blank', 'noopener,noreferrer'); return; }
    updateRunning();
  }
  function moveImage(delta) {
    const length = filtered().length;
    activeIndex = (activeIndex + delta + length) % length;
    showImage();
  }
  function localize() {
    filters.setAttribute('aria-label', t('categories'));
    for (const node of mount.querySelectorAll('[data-hg-copy]')) node.textContent = t(node.dataset.hgCopy);
    for (const node of dialog.querySelectorAll('[data-hg-label]')) node.setAttribute('aria-label', t(node.dataset.hgLabel));
    renderStage();
    if (dialog.open) showImage();
  }
  function build() {
    mount.dataset.languageIgnore = '';
    const header = element('div', 'hg-header');
    const copy = element('div', 'hg-copy');
    for (const [tag, key, className] of [['p','eyebrow','hg-eyebrow'],['h3','title','hg-title'],['p','intro','hg-intro']]) {
      const node = element(tag, className, t(key)); node.dataset.hgCopy = key; copy.append(node);
    }
    status = element('span', 'hg-status'); status.setAttribute('role', 'status');
    header.append(copy, status);
    const toolbar = element('div', 'hg-toolbar');
    filters = element('div', 'hg-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', t('categories'));
    for (const category of ['all', 'competition', 'research', 'learning', 'record'].filter(value => value === 'all' || items.some(item => item.category === value))) {
      const button = element('button', 'hg-filter', t(category));
      button.type = 'button'; button.dataset.category = category; button.dataset.hgCopy = category;
      button.addEventListener('click', () => { selected = category; renderStage(); }); filters.append(button);
    }
    const actions = element('div', 'hg-actions');
    toggleMotion = element('button', 'hg-action'); toggleMotion.type = 'button'; toggleMotion.addEventListener('click', () => { paused = !paused; updateRunning(); });
    toggleGrid = element('button', 'hg-action'); toggleGrid.type = 'button'; toggleGrid.addEventListener('click', () => { grid = !grid; renderStage(); });
    actions.append(toggleMotion, toggleGrid); toolbar.append(filters, actions);
    stage = element('div', 'hg-stage');
    dialog = element('dialog', 'hg-dialog'); dialog.setAttribute('aria-labelledby', 'hg-dialog-title'); dialog.dataset.languageIgnore = '';
    const top = element('div', 'hg-dialog-top');
    dialogTitle = element('h3', 'hg-dialog-title'); dialogTitle.id = 'hg-dialog-title';
    const close = element('button', 'hg-dialog-close', '×'); close.type = 'button'; close.dataset.hgLabel = 'close'; close.setAttribute('aria-label', t('close')); close.addEventListener('click', () => dialog.close());
    top.append(dialogTitle, close);
    const picture = element('div', 'hg-picture');
    dialogImage = element('img'); dialogImage.decoding = 'async'; dialogImage.addEventListener('error', () => { errorText.hidden = false; });
    errorText = element('p', 'hg-image-error', t('failed')); errorText.dataset.hgCopy = 'failed'; errorText.hidden = true;
    picture.append(dialogImage, errorText);
    const bottom = element('div', 'hg-dialog-bottom');
    const previous = element('button', 'hg-step', '←'); previous.type = 'button'; previous.dataset.hgLabel = 'previous'; previous.setAttribute('aria-label', t('previous')); previous.addEventListener('click', () => moveImage(-1));
    const next = element('button', 'hg-step', '→'); next.type = 'button'; next.dataset.hgLabel = 'next'; next.setAttribute('aria-label', t('next')); next.addEventListener('click', () => moveImage(1));
    dialogCount = element('span', 'hg-dialog-count');
    imageLink = element('a', 'hg-original', t('original')); imageLink.dataset.hgCopy = 'original'; imageLink.target = '_blank'; imageLink.rel = 'noopener noreferrer';
    bottom.append(previous, dialogCount, next, imageLink); dialog.append(top, picture, bottom);
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); moveImage(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); moveImage(1); }
    });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => {
      document.documentElement.style.overflow = oldRootOverflow;
      updateRunning();
      if (previousFocus?.isConnected) {
        restoringFocus = true;
        // A repeated strip card is hidden from assistive navigation; restore a visible control instead.
        if (previousFocus.getAttribute('aria-hidden') === 'true') toggleGrid.focus({preventScroll:true});
        else previousFocus.focus({preventScroll:true});
        restoringFocus = false;
      }
    });
    mount.replaceChildren(header, toolbar, stage, dialog);
    renderStage();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        // Load the small, cached thumbnails once the archive is near view, so moving cards stay filled.
        if (visible) stage.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
        updateRunning();
      }, {rootMargin:'180px 0px', threshold:0.01}).observe(stage);
    } else { visible = true; updateRunning(); }
    document.addEventListener('visibilitychange', updateRunning);
    disclosure?.addEventListener('toggle', updateRunning);
    reducedMotion.addEventListener?.('change', () => { if (reducedMotion.matches) grid = true; renderStage(); });
    new MutationObserver(() => {
      const nextLanguage = language();
      if (nextLanguage === renderedLanguage) return;
      renderedLanguage = nextLanguage;
      localize();
    }).observe(document.documentElement, {attributes:true, attributeFilter:['data-language']});
  }
  fetch(new URL('data/achievements-gallery.json', document.baseURI)).then(response => {
    if (!response.ok) throw new Error('Gallery unavailable');
    return response.json();
  }).then(data => {
    const safePath = value => typeof value === 'string' && /^assets\/[a-z\d-]+\/[a-z\d-]+\.webp$/.test(value);
    items = (data.items || []).filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && ['competition','research','learning','record'].includes(item.category) && safePath(item.full) && safePath(item.thumbnail) && Number(item.width) > 0 && Number(item.height) > 0);
    if (items.length) build();
  }).catch(() => { /* Keep the server-rendered fallback readable. */ });
})();
