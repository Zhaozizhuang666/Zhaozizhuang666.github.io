(() => {
'use strict';
const $=s=>document.querySelector(s),base=window.VLA_CONFIG.base;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const link=(text,url)=>{const a=el('a',text);a.href=url;return a;};
async function read(name){const r=await fetch(base+name+'.json');if(!r.ok)throw Error();return r.json();}
function failure(target){target.replaceChildren(el('p','内容加载失败。请检查网络或通过本地服务器打开，并使用下方文字指南继续学习。'));}
async function map(){
 const target=$('#industry-lanes');if(!target)return;
 try{
  const roles=await read('roles');let zoom=1,selected=null;
  const lanes=['本体与制造','系统与平台','智能与决策','数据与评测','场景与交付','产品与运营'];
  const detail=$('#role-detail');
  function show(r){
   selected=r.id;document.querySelectorAll('.role-node').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.role===selected)));
   detail.replaceChildren();const head=el('div',null,'role-profile-head');head.append(el('div',r.lane,'eyebrow'),el('h2',r.name));detail.append(head);
   const grid=el('div',null,'role-profile-grid');
   for(const [title,text] of [['日常交付',r.work],['准备技能',r.skills.join(' · ')],['作品集建议',r.portfolio],['面试思考',r.question]]){const section=el('div');section.append(el('h3',title),el('p',text));grid.append(section);}detail.append(grid);
   const actions=el('div',null,'actions');actions.append(link('进入相关学习 →',base+'docs/'+r.study+'/'),link('面试练习 →',base+'interview/?role='+encodeURIComponent(r.name)),link('按学历准备 →',base+'docs/degree-paths/'));detail.append(actions);
  }
  function render(){
   const degree=$('#degree-filter').value,terms=$('#role-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
   const found=roles.filter(r=>(degree==='all'||r.degrees.includes(degree))&&terms.every(t=>(r.name+' '+r.lane+' '+r.work+' '+r.skills.join(' ')+' '+r.portfolio).toLowerCase().includes(t)));
   target.replaceChildren();$('#role-count').textContent=`显示 ${found.length} / ${roles.length} 类岗位`;
   for(const lane of lanes){
    const section=el('section',null,'industry-lane');section.append(el('div','0'+(lanes.indexOf(lane)+1),'lane-index'),el('h2',lane));
    for(const r of found.filter(x=>x.lane===lane)){const b=el('button',null,'role-node');b.type='button';b.dataset.role=r.id;b.setAttribute('aria-pressed',String(r.id===selected));b.append(el('strong',r.name),el('span',r.skills.slice(0,2).join(' / ')));b.addEventListener('click',()=>show(r));section.append(b);}target.append(section);
   }
   if(selected&&!found.some(r=>r.id===selected)){selected=null;detail.replaceChildren(el('h2',found.length?'选择筛选后的岗位':'没有匹配的岗位'),el('p',found.length?'点击岗位查看交付与准备建议。':'尝试减少关键词或选择所有阶段。'));}
  }
  function scale(){const board=$('#industry-board');board.style.width=Math.round(1320*zoom)+'px';board.style.fontSize=(14*zoom)+'px';}
  $('#degree-filter').addEventListener('change',render);$('#role-search').addEventListener('input',render);
  $('#map-zoom-in').addEventListener('click',()=>{zoom=Math.min(1.5,zoom+.15);scale();});
  $('#map-zoom-out').addEventListener('click',()=>{zoom=Math.max(.7,zoom-.15);scale();});
  $('#map-reset').addEventListener('click',()=>{zoom=1;scale();$('#degree-filter').value='all';$('#role-search').value='';selected=null;detail.replaceChildren(el('h2','选择一个岗位'),el('p','查看日常交付、技能与作品集建议。'));render();$('.map-scroll').scrollLeft=0;});render();
 }catch{failure(target);}
}
async function interview(){
 const target=$('#question-list');if(!target)return;
 try{
  const questions=await read('questions'),valid=new Set(questions.map(q=>q.id));let saved=new Set(),only=false;
  const KEY='vla-interview-favorites-v1';try{const s=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(s))saved=new Set(s.filter(x=>valid.has(x)));}catch{}
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify([...saved]));}catch{}};
  const category=$('#question-category');for(const c of new Set(questions.map(q=>q.category))){const o=el('option',c);o.value=c;category.append(o);}
  function render(){
   const terms=$('#question-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean),level=$('#question-level').value;
   const found=questions.filter(q=>(category.value==='all'||q.category===category.value)&&(level==='all'||q.level===level)&&(!only||saved.has(q.id))&&terms.every(t=>(q.question+' '+q.answer+' '+q.followup+' '+q.category).toLowerCase().includes(t)));
   $('#question-count').textContent=`显示 ${found.length} / ${questions.length} 题 · 已收藏 ${saved.size} 题 · 点击题目展开要点与追问`;
   target.replaceChildren();if(!found.length){target.append(el('p','没有匹配的题目。请减少关键词、切换主题，或关闭只看收藏。'));return;}
   for(const q of found){
    const item=el('section',null,'question-item'),d=el('details'),summary=el('summary');summary.append(el('span',q.id.toUpperCase()+' / '+q.category+' · '+q.level,'question-meta'),el('strong',q.question));d.append(summary);
    const answer=el('div',null,'answer');answer.append(el('h3','回答要点'),el('p',q.answer),el('h3','延伸追问'),el('p',q.followup));d.append(answer);
    const b=el('button',saved.has(q.id)?'★ 已收藏':'☆ 收藏','favorite-button');b.setAttribute('aria-label',(saved.has(q.id)?'取消收藏：':'收藏：')+q.question);b.setAttribute('aria-pressed',String(saved.has(q.id)));b.addEventListener('click',()=>{saved.has(q.id)?saved.delete(q.id):saved.add(q.id);persist();if(only){render();return;}b.textContent=saved.has(q.id)?'★ 已收藏':'☆ 收藏';b.setAttribute('aria-pressed',String(saved.has(q.id)));b.setAttribute('aria-label',(saved.has(q.id)?'取消收藏：':'收藏：')+q.question);$('#question-count').textContent=`显示 ${found.length} / ${questions.length} 题 · 已收藏 ${saved.size} 题 · 点击题目展开要点与追问`;});
    item.append(d,b);target.append(item);
   }
  }
  ['#question-search','#question-category','#question-level'].forEach(s=>$(s).addEventListener(s==='#question-search'?'input':'change',render));
  $('#show-favorites').addEventListener('click',()=>{only=!only;$('#show-favorites').setAttribute('aria-pressed',String(only));render();});
  $('#export-favorites').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({format:'vla-guide-interview-favorites',version:1,ids:[...saved]},null,2)],{type:'application/json'}));const a=link('',url);a.download='vla-interview-favorites.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('#import-favorites').addEventListener('click',()=>$('#favorites-file').click());
  $('#favorites-file').addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>100000)throw Error();const d=JSON.parse(await f.text());if(d.format!=='vla-guide-interview-favorites'||d.version!==1||!Array.isArray(d.ids))throw Error();saved=new Set(d.ids.filter(x=>valid.has(x)));persist();render();$('#question-count').textContent+=' · 收藏已导入';}catch{$('#question-count').textContent='导入失败：请选择有效的题库收藏文件。';}e.target.value='';});
  // A role link provides orientation; do not silently filter out relevant cross-discipline questions.
  const role=new URLSearchParams(location.search).get('role');if(role){const hint=el('p','当前探索岗位：'+role+'。请按职责选择主题；题目不是该岗位的专属真题。','notice');target.before(hint);}render();
 }catch{failure(target);}
}
map();interview();
})();
