(() => {
  'use strict';
  const cache = {};
  const pageSize = 12;
  let active = 'competitions', page = 1, version = 0, results = [];
  const el = id => document.getElementById(id);
  const search = el('library-search'), filter = el('library-filter'), list = el('library-results');
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const localResources = new Set(['resources/vla-guide/', 'resources/ai-network-learning.html']);
  const groups = {
    competitions: {field: 'level', placeholder: 'Search competitions, organizers, or keywords…', options: [['','All levels / 全部级别'],['A','A'],['B1','B1'],['B2','B2']], description: '来自《山西工学院学科竞赛分级》原表。A、B1、B2 为该校目录分类，具体赛制与参赛条件以当届公告为准。'},
    journals: {field: 'batch', placeholder: 'Search a journal title / 输入刊名…', options: [['','All batches / 全部批次'],['第一批','First batch / 第一批'],['第二批','Second batch / 第二批']], description: '整理自所提供的第一批、第二批学术期刊目录。批次根据文件顺序与编号推定；本目录不代表核心期刊、SCI 收录或当前有效出版许可。'},
    learning: {field: 'libraryGroup', placeholder: 'Search VLA, RDMA, or learning topics…', options: [['','All topics / 全部主题'],['VLA','VLA'],['AI Network','AI Network']], description: '本站静态学习资源副本与导航。可直接阅读 VLA 章节与 AI 算力网络资源；资料用于学习定位，不代表已复现实验或核验全部外链。'}
  };
  const normalize = text => String(text || '').toLocaleLowerCase().replace(/[\s·・—–（）()]/g, '');
  const node = (tag, className, text) => { const item = document.createElement(tag); if (className) item.className = className; if (text) item.textContent = text; return item; };

  function card(entry) {
    const journal = active === 'journals', learning = active === 'learning';
    const article = node('article', 'directory-card');
    const head = node('div', 'directory-card-head');
    head.append(node('span', 'card-type', learning ? 'LEARNING / 学习资源' : journal ? 'JOURNAL / 学术期刊' : 'COMPETITION / 学科竞赛'), node('span', 'card-grade', learning ? entry.libraryGroup : journal ? entry.batch : `Campus ${entry.level}`));
    article.append(head, node('h3', '', entry.name), node('p', '', learning ? entry.librarySummary || entry.summary : entry.summary));
    if (!journal && !learning && entry.organizer) article.append(node('p', 'card-organizer', `主办单位（原表）：${entry.organizer}`));
    const footer = node('div', 'directory-card-footer');
    const official = entry.urlType === 'official';
    const a = node('a', '', learning ? 'Open resource / 阅读资料 →' : official ? 'Official website / 官方网站 ↗' : journal ? 'Journal search / 刊名检索 ↗' : 'Competition search / 赛事检索 ↗');
    if (learning && localResources.has(entry.libraryHref)) { a.href = entry.libraryHref; footer.append(a); }
    else if (!learning && /^https?:\/\//.test(entry.website || '')) { a.href = entry.website; a.target = '_blank'; a.rel = 'noopener noreferrer'; footer.append(a); }
    if (learning) footer.append(node('span', 'card-link-note', entry.libraryNote || 'Static learning copy · 本站静态副本'));
    else if (!official) footer.append(node('span', 'card-link-note', 'Search entry · 非官网链接'));
    footer.append(node('span', 'card-source', entry.sourceLocation));
    article.append(footer); return article;
  }

  function render() {
    const data = cache[active]; if (!data) return;
    const query = normalize(search.value), category = filter.value;
    results = data.entries.filter(entry => (!category || entry[groups[active].field] === category) && (!query || normalize([entry.name, entry.organizer, ...(entry.aliases || []), ...(active === 'learning' ? [entry.summary, entry.librarySummary, ...(entry.topics || [])] : [])].join(' ')).includes(query)));
    const pages = Math.max(1, Math.ceil(results.length / pageSize)); page = Math.min(Math.max(1, page), pages);
    list.replaceChildren();
    if (!results.length) list.append(node('div', 'library-empty', 'No matching entries. Try a shorter title or another filter. / 未找到匹配条目，请更换关键词。'));
    else results.slice((page - 1) * pageSize, page * pageSize).forEach(entry => list.append(card(entry)));
    el('result-count').textContent = `${results.length.toLocaleString()} results · ${data.entries.length.toLocaleString()} source records`;
    el('page-status').textContent = `Page ${page} / ${pages}`;
    el('previous-page').disabled = page <= 1;
    el('next-page').disabled = page >= pages;
  }

  async function selectTab(name) {
    active = name; page = 1; const current = ++version;
    const group = groups[name];
    tabs.forEach(tab => { const selected = tab.dataset.tab === name; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
    el('directory-panel').setAttribute('aria-labelledby', `${name}-tab`);
    search.value = ''; search.placeholder = group.placeholder;
    filter.replaceChildren();
    group.options.forEach(([value,label])=>{const option=node('option','',label);option.value=value;filter.append(option)});
    el('library-description').textContent = group.description;
    list.replaceChildren(node('div','library-empty','Loading directory…')); el('result-count').textContent='Loading directory…';
    el('previous-page').disabled = el('next-page').disabled = true;
    try {
      if (!cache[name]) {
        const response=await fetch(`data/${name === 'learning' ? 'technical-knowledge' : name}.json`); if(!response.ok) throw new Error('Fetch failed');
        const data=await response.json();
        cache[name] = name === 'learning' ? {sourceTitle: data.learningSourceTitle, sourceNote: data.learningSourceNote, entries: data.entries.filter(entry => entry.libraryCategory === 'learning' && localResources.has(entry.libraryHref))} : data;
      }
      if (current !== version) return;
      el('library-source').textContent = `${cache[name].sourceTitle} — ${cache[name].sourceNote}`;
      render();
    } catch (_) { if(current !== version)return; list.replaceChildren(node('div','library-empty','The directory could not be loaded. Please refresh and try again. / 暂时无法读取目录，请刷新重试。'));el('result-count').textContent='Directory unavailable'; }
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>selectTab(tab.dataset.tab));
    tab.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;const next=tabs[target];next.focus();selectTab(next.dataset.tab)}});
  });
  search.addEventListener('input',()=>{page=1;render()}); filter.addEventListener('change',()=>{page=1;render()});
  el('previous-page').addEventListener('click',()=>{page--;render();el('library-heading').scrollIntoView({behavior:'smooth',block:'start'})});
  el('next-page').addEventListener('click',()=>{page++;render();el('library-heading').scrollIntoView({behavior:'smooth',block:'start'})});
  const requested = location.hash.slice(1), initial = Object.hasOwn(groups, requested) ? requested : 'competitions'; selectTab(initial);
})();
