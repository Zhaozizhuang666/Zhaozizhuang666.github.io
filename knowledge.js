(() => {
  'use strict';
  const cache = {};
  const pageSize = 12;
  let active = 'competitions', page = 1, version = 0, results = [];
  const el = id => document.getElementById(id);
  const search = el('library-search'), filter = el('library-filter'), list = el('library-results');
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const normalize = text => String(text || '').toLocaleLowerCase().replace(/[\s·・—–（）()]/g, '');
  const node = (tag, className, text) => { const item = document.createElement(tag); if (className) item.className = className; if (text) item.textContent = text; return item; };

  function card(entry) {
    const journal = active === 'journals';
    const article = node('article', 'directory-card');
    const head = node('div', 'directory-card-head');
    head.append(node('span', 'card-type', journal ? 'JOURNAL / 学术期刊' : 'COMPETITION / 学科竞赛'), node('span', 'card-grade', journal ? entry.batch : `Campus ${entry.level}`));
    article.append(head, node('h3', '', entry.name), node('p', '', entry.summary));
    if (!journal && entry.organizer) article.append(node('p', 'card-organizer', `主办单位（原表）：${entry.organizer}`));
    const footer = node('div', 'directory-card-footer');
    const official = entry.urlType === 'official';
    const a = node('a', '', official ? 'Official website / 官方网站 ↗' : journal ? 'Journal search / 刊名检索 ↗' : 'Competition search / 赛事检索 ↗');
    if (/^https?:\/\//.test(entry.website || '')) { a.href = entry.website; a.target = '_blank'; a.rel = 'noopener noreferrer'; footer.append(a); }
    if (!official) footer.append(node('span', 'card-link-note', 'Search entry · 非官网链接'));
    footer.append(node('span', 'card-source', entry.sourceLocation));
    article.append(footer); return article;
  }

  function render() {
    const data = cache[active]; if (!data) return;
    const query = normalize(search.value), category = filter.value;
    results = data.entries.filter(entry => (!category || (active === 'journals' ? entry.batch : entry.level) === category) && (!query || normalize([entry.name, entry.organizer, ...(entry.aliases || [])].join(' ')).includes(query)));
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
    const journal = name === 'journals';
    tabs.forEach(tab => { const selected = tab.dataset.tab === name; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
    el('directory-panel').setAttribute('aria-labelledby', `${name}-tab`);
    search.value = ''; search.placeholder = journal ? 'Search a journal title / 输入刊名…' : 'Search competitions, organizers, or keywords…';
    filter.replaceChildren();
    (journal ? [['','All batches / 全部批次'],['第一批','First batch / 第一批'],['第二批','Second batch / 第二批']] : [['','All levels / 全部级别'],['A','A'],['B1','B1'],['B2','B2']]).forEach(([value,label])=>{const option=node('option','',label);option.value=value;filter.append(option)});
    el('library-description').textContent = journal ? '整理自所提供的第一批、第二批学术期刊目录。批次根据文件顺序与编号推定；本目录不代表核心期刊、SCI 收录或当前有效出版许可。' : '来自《山西工学院学科竞赛分级》原表。A、B1、B2 为该校目录分类，具体赛制与参赛条件以当届公告为准。';
    list.replaceChildren(node('div','library-empty','Loading directory…')); el('result-count').textContent='Loading directory…';
    el('previous-page').disabled = el('next-page').disabled = true;
    try {
      if (!cache[name]) { const response=await fetch(`data/${name}.json`); if(!response.ok) throw new Error('Fetch failed'); cache[name]=await response.json(); }
      if (current !== version) return;
      el('library-source').textContent = `${cache[name].sourceTitle} — ${cache[name].sourceNote}`;
      render();
    } catch (_) { if(current !== version)return; list.replaceChildren(node('div','library-empty','The directory could not be loaded. Please refresh and try again. / 暂时无法读取目录，请刷新重试。'));el('result-count').textContent='Directory unavailable'; }
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>selectTab(tab.dataset.tab));
    tab.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const next=tabs[(index+1)%tabs.length];next.focus();selectTab(next.dataset.tab)}});
  });
  search.addEventListener('input',()=>{page=1;render()}); filter.addEventListener('change',()=>{page=1;render()});
  el('previous-page').addEventListener('click',()=>{page--;render();el('library-heading').scrollIntoView({behavior:'smooth',block:'start'})});
  el('next-page').addEventListener('click',()=>{page++;render();el('library-heading').scrollIntoView({behavior:'smooth',block:'start'})});
  const initial = location.hash === '#journals' ? 'journals' : 'competitions'; selectTab(initial);
})();
