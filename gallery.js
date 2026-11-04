/* An accessible, image-based archive. CSS supplies motion; original files remain untouched. */
(() => {
  'use strict';
  function initArchive(mount) {
  if (!mount) return;
  const activities = mount.dataset.galleryKind === 'activities';
  const disclosure = mount.closest('details');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const words = {
    en: {eyebrow:'ARCHIVE IN MOTION', title:'Certificates & Records', intro:'Award certificates, learning records, and research or project documentation.', all:'All', competition:'Competition Awards', research:'Research Records', learning:'Learning Records', record:'Project Records', pause:'Pause', resume:'Resume', grid:'Grid view', motion:'Motion view', records:'records', categories:'Archive categories', open:'View record', close:'Close image', previous:'Previous image', next:'Next image', original:'Open full image', article:'Read event report', failed:'The image could not be loaded. Use “Open full image” to try again.', empty:'No records in this category.'},
    zh: {eyebrow:'实践影像档案', title:'证书与成果凭证', intro:'分类展示竞赛获奖、学习记录、研究成果与项目凭证。', all:'全部', competition:'竞赛奖项', research:'研究凭证', learning:'学习凭证', record:'项目凭证', pause:'暂停动态', resume:'继续动态', grid:'网格浏览', motion:'动态浏览', records:'项记录', categories:'档案类别', open:'查看记录', close:'关闭图片', previous:'上一张', next:'下一张', original:'打开完整图片', article:'阅读活动报道', failed:'图片暂未加载，请使用“打开完整图片”重试。', empty:'此分类暂无记录。'}
  };
  if (activities) {
    Object.assign(words.en, {eyebrow:'ACTIVITIES & FIELD NOTES', title:'Learning, Practice & Community', intro:'Selected photographs from conferences, competitions, fieldwork, and community learning.', awards:'Ceremonies', conferences:'Conferences', practice:'Project Practice', social:'Social Practice', community:'Community', exhibitions:'Technology Exhibitions', sports:'Running & Sports'});
    Object.assign(words.zh, {eyebrow:'活动影像', title:'学习、实践与交流', intro:'会议研修、科创竞赛、社会实践与社区学习的现场记录。', awards:'颁奖典礼', conferences:'会议研修', practice:'科创实践', social:'社会实践', community:'社区学习', exhibitions:'技术展会', sports:'马拉松与运动'});
  }
  const language = () => document.documentElement.dataset.language === 'zh' ? 'zh' : 'en';
  const t = key => words[language()][key];
  const titleOf = item => language() === 'zh' ? item.titleZh || item.title : item.title;
  const awardOf = item => language() === 'zh' ? item.awardZh || item.award || '' : item.award || '';
  const roleOf = item => language() === 'zh' ? item.roleZh || item.role || '' : item.role || '';
  const detailOf = item => [awardOf(item), roleOf(item)].filter(Boolean).join(' · ');
  let renderedLanguage = language();
  let items = [], selected = 'all', grid = activities || reducedMotion.matches, paused = false, visible = false, activeIndex = 0, previousFocus;
  let stage, status, filters, toggleMotion, toggleGrid, dialog, dialogImage, dialogTitle, imageLink, reportLink, dialogCount, errorText;
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
    if (activities) {
      // Let a portrait photograph occupy a portrait-sized card, without letterboxing.
      button.style.setProperty('--hg-photo-ratio', String(item.width / item.height));
    }
    button.setAttribute('aria-label', `${t('open')}: ${titleOf(item)}${detailOf(item) ? ` · ${detailOf(item)}` : ''}`);
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
    if (detailOf(item)) button.append(element('span', 'hg-card-award', detailOf(item)));
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
    stage.classList.remove('hg-stage-single');
    mount.dataset.view = grid ? 'grid' : 'motion';
    status.textContent = `${list.length} ${t('records')}`;
    toggleGrid.textContent = grid ? `↔ ${t('motion')}` : `▦ ${t('grid')}`;
    toggleGrid.setAttribute('aria-pressed', String(grid));
    for (const button of filters.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.category === selected));
    if (!list.length) { stage.append(element('p', 'hg-empty', t('empty'))); updateRunning(); return; }
    if (grid) {
      for (const category of [...new Set(list.map(item => item.category))]) {
        const records = list.filter(item => item.category === category);
        const section = element('section', 'hg-category-section');
        const heading = element('h4', 'hg-category-title', `${t(category)} · ${records.length}`);
        const group = element('div', 'hg-grid');
        records.forEach(item => group.append(card(item)));
        section.append(heading, group);
        stage.append(section);
      }
    } else {
      // Keep adjacent records together rather than alternating them between lanes.
      const midpoint = Math.ceil(list.length / 2);
      const boundaries = [];
      for (let index = 1; index < list.length; index++) {
        if (list[index - 1].group !== list[index].group || list[index - 1].event !== list[index].event) boundaries.push(index);
      }
      const splitAt = boundaries.length
        ? boundaries.reduce((best, index) => Math.abs(index - midpoint) < Math.abs(best - midpoint) ? index : best)
        : list.length;
      const rows = [list.slice(0, splitAt), list.slice(splitAt)].filter(row => row.length);
      stage.classList.toggle('hg-stage-single', rows.length === 1);
      rows.forEach((row, i) => {
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
    dialogTitle.textContent = `${titleOf(item)}${detailOf(item) ? ` · ${detailOf(item)}` : ''}`;
    dialogCount.textContent = `${activeIndex + 1} / ${list.length}`;
    dialogImage.alt = titleOf(item);
    dialogImage.width = item.width;
    dialogImage.height = item.height;
    errorText.hidden = true;
    dialogImage.src = item.full;
    imageLink.href = item.full;
    reportLink.hidden = !item.sourceUrl;
    if (item.sourceUrl) reportLink.href = item.sourceUrl;
    else reportLink.removeAttribute('href');
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
    // A closed archive may be opened after the page language has changed.
    renderedLanguage = language();
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
    const categories = activities ? ['all','awards','conferences','practice','social','community','exhibitions','sports'] : ['all','competition','research','learning','record'];
    for (const category of categories.filter(value => value === 'all' || items.some(item => item.category === value))) {
      const button = element('button', 'hg-filter', t(category));
      button.type = 'button'; button.dataset.category = category; button.dataset.hgCopy = category;
      button.addEventListener('click', () => { selected = category; renderStage(); }); filters.append(button);
    }
    const actions = element('div', 'hg-actions');
    toggleMotion = element('button', 'hg-action'); toggleMotion.type = 'button'; toggleMotion.addEventListener('click', () => { paused = !paused; updateRunning(); });
    toggleGrid = element('button', 'hg-action'); toggleGrid.type = 'button'; toggleGrid.addEventListener('click', () => { grid = !grid; renderStage(); });
    actions.append(toggleMotion, toggleGrid); toolbar.append(filters, actions);
    stage = element('div', 'hg-stage');
    dialog = element('dialog', 'hg-dialog'); dialog.setAttribute('aria-labelledby', `${mount.id}-dialog-title`); dialog.dataset.languageIgnore = '';
    const top = element('div', 'hg-dialog-top');
    dialogTitle = element('h3', 'hg-dialog-title'); dialogTitle.id = `${mount.id}-dialog-title`;
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
    reportLink = element('a', 'hg-report-link', t('article')); reportLink.dataset.hgCopy = 'article'; reportLink.target = '_blank'; reportLink.rel = 'noopener noreferrer'; reportLink.hidden = true;
    imageLink = element('a', 'hg-original', t('original')); imageLink.dataset.hgCopy = 'original'; imageLink.target = '_blank'; imageLink.rel = 'noopener noreferrer';
    bottom.append(previous, dialogCount, next, reportLink, imageLink); dialog.append(top, picture, bottom);
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
  function load() {
  fetch(new URL(mount.dataset.gallerySource, document.baseURI)).then(response => {
    if (!response.ok) throw new Error('Gallery unavailable');
    return response.json();
  }).then(data => {
    const safePath = value => typeof value === 'string' && /^assets\/[a-z\d-]+\/[a-z\d-]+\.webp$/.test(value);
    const categories = activities ? ['awards','conferences','practice','social','community','exhibitions','sports'] : ['competition','research','learning','record'];
    items = (data.items || []).filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && item.group === item.category && typeof item.event === 'string' && /^[a-z\d]+(?:-[a-z\d]+)*$/.test(item.event) && Number.isInteger(item.sortOrder) && categories.includes(item.category) && safePath(item.full) && safePath(item.thumbnail) && Number(item.width) > 0 && Number(item.height) > 0 && (!item.sourceUrl || /^https:\/\/mp\.weixin\.qq\.com\/s\/[\w-]+$/.test(item.sourceUrl)));
    const categoryRank = new Map(categories.map((category, index) => [category, index]));
    items.sort((a, b) => categoryRank.get(a.group) - categoryRank.get(b.group) || a.event.localeCompare(b.event) || a.sortOrder - b.sortOrder);
    if (items.length) build();
  }).catch(() => { /* Keep the server-rendered fallback readable. */ });
  }
  // Fetch and initialize each archive only when requested. The HTML remains usable without JavaScript.
  if (disclosure && !disclosure.open) {
    const onOpen = () => { if (!disclosure.open) return; disclosure.removeEventListener('toggle', onOpen); load(); };
    disclosure.addEventListener('toggle', onOpen);
  } else load();
  }
  document.querySelectorAll('[data-gallery-source]').forEach(initArchive);
})();
