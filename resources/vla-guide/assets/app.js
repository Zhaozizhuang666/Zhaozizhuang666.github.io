(() => {
'use strict';
const cfg=window.VLA_CONFIG, $=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
const KEY='vla-guide-v2';
let state={completed:[],checks:{},last:null};
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&Array.isArray(saved.completed)&&saved.checks&&typeof saved.checks==='object')state=saved;}catch{}
const ids=new Set(cfg.articleIds); state.completed=state.completed.filter(x=>ids.has(x));
const toast=message=>{ $('#toast').textContent=message;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').textContent='',3500);};
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{toast('浏览器无法保存进度，请导出备份。');}}
function renderProgress(){
 all('[data-progress-count]').forEach(el=>el.textContent=state.completed.length);
 all('[data-progress-percent]').forEach(el=>el.textContent=Math.round(state.completed.length/cfg.articleIds.length*100)+'%');
 all('[data-progress-bar]').forEach(el=>el.style.width=state.completed.length/cfg.articleIds.length*100+'%');
 const complete=$('#complete-article');if(complete){const done=state.completed.includes(cfg.articleId);complete.textContent=done?'✓ 已完成本章':'标记本章完成';complete.setAttribute('aria-pressed',done);}
 const resume=$('#resume');if(resume&&ids.has(state.last)){resume.href=cfg.base+'docs/'+state.last+'/';resume.firstElementChild.textContent='继续上次阅读';}
}
if(cfg.articleId){state.last=cfg.articleId;save();}
all('.it input[type=checkbox]').forEach(el=>{const key=cfg.articleId+':'+el.id;el.checked=!!state.checks[key];el.addEventListener('change',()=>{state.checks[key]=el.checked;save();});});
$('#complete-article')?.addEventListener('click',()=>{state.completed=state.completed.includes(cfg.articleId)?state.completed.filter(x=>x!==cfg.articleId):[...state.completed,cfg.articleId];save();renderProgress();});
$('#export-progress')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({format:'vla-guide-progress',version:2,...state},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='vla-guide-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('#import-progress')?.addEventListener('click',()=>$('#progress-file').click());
$('#progress-file')?.addEventListener('change',async ev=>{try{const f=ev.target.files[0];if(!f)return;if(f.size>1000000)throw Error();const s=JSON.parse(await f.text());if(s.format!=='vla-guide-progress'||s.version!==2||!Array.isArray(s.completed)||!s.checks||typeof s.checks!=='object'||Array.isArray(s.checks))throw Error();state={completed:[...new Set(s.completed.filter(x=>ids.has(x)))],checks:Object.fromEntries(Object.entries(s.checks).filter(([k,v])=>typeof v==='boolean'&&k.length<200)),last:ids.has(s.last)?s.last:null};save();renderProgress();toast('进度已导入');}catch{toast('无法导入：请选择有效的 VLA Guide 进度文件。');}ev.target.value='';});
$('#reset-progress')?.addEventListener('click',()=>{if(confirm('清空本浏览器的章节与条目进度？建议先导出备份。')){state={completed:[],checks:{},last:null};save();renderProgress();toast('学习进度已清空');}});
$('#menu-toggle')?.addEventListener('click',()=>{const el=$('.sidebar');if(!el){document.querySelector('#growth')?.scrollIntoView({behavior:'smooth'});return;}const open=el.classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',open);});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){$('.sidebar')?.classList.remove('open');$('#menu-toggle')?.setAttribute('aria-expanded','false');}});
const dialog=$('#search-dialog'),input=$('#search-input'),results=$('#search-results');let index=null,loading=null;
function showMessage(s){results.replaceChildren();const p=document.createElement('div');p.className='empty';p.textContent=s;results.append(p);}
async function loadIndex(){if(index)return index;if(!loading)loading=fetch(cfg.base+'search-index.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>index=data).catch(e=>{loading=null;throw e;});return loading;}
function search(){if(!index)return;const terms=input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);const matches=index.map(a=>({...a,score:terms.reduce((v,t)=>v+(a.title.toLowerCase().includes(t)?10:0)+(a.tags.join(' ').toLowerCase().includes(t)?4:0),0)})).filter(a=>terms.every(t=>(a.title+' '+a.description+' '+a.text+' '+a.tags.join(' ')).toLowerCase().includes(t))).sort((a,b)=>b.score-a.score).slice(0,30);results.replaceChildren();if(!matches.length){showMessage('没有匹配的章节。试试 OpenVLA、坐标系、评测或 LoRA。');return;}for(const a of matches){const link=document.createElement('a');link.href=cfg.base+'docs/'+a.id+'/';const title=document.createElement('b');title.textContent=a.title;const desc=document.createElement('p');desc.textContent=a.moduleTitle+' · '+a.description.slice(0,105);link.append(title,desc);results.append(link);}}
async function openSearch(){if(!dialog.open)dialog.showModal();input.focus();showMessage('正在加载全文索引…');try{await loadIndex();search();}catch{showMessage('搜索索引加载失败。请通过本地服务器或在线站点打开页面后重试。');}}
$('#search-open').addEventListener('click',openSearch);$('#search-close').addEventListener('click',()=>dialog.close());input.addEventListener('input',search);
input.addEventListener('keydown',ev=>{if(ev.key==='ArrowDown'){results.querySelector('a')?.focus();ev.preventDefault();}if(ev.key==='Enter')results.querySelector('a')?.click();});
results.addEventListener('keydown',ev=>{const links=[...results.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(ev.key==='ArrowDown'){links[Math.min(i+1,links.length-1)]?.focus();ev.preventDefault();}if(ev.key==='ArrowUp'){if(i<=0)input.focus();else links[i-1].focus();ev.preventDefault();}});
document.addEventListener('keydown',ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();openSearch();}});
dialog.addEventListener('click',ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dialog.close();}});

function initStarfield(){
 const canvas=$('#starfield'),control=$('#motion-toggle');
 if(!canvas||!control)return;
 const context=canvas.getContext('2d');if(!context){control.hidden=true;return;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let enabled=true;try{enabled=localStorage.getItem('vla-guide-stars')!=='paused';}catch{}
 let stars=[],width=0,height=0,frame=0,last=0,time=0;
 const isDark=()=>document.documentElement.dataset.theme==='dark';
 const canAnimate=()=>enabled&&!reduced.matches&&isDark()&&!document.hidden;
 function draw(){
  context.clearRect(0,0,width,height);
  for(const star of stars){
   const alpha=star.alpha*(.76+.24*Math.sin(time*star.speed+star.phase));
   context.beginPath();context.arc(star.x,star.y,star.radius,0,Math.PI*2);
   context.fillStyle=`rgba(223,228,242,${alpha})`;context.fill();
   if(star.radius>1.05){
    const glow=context.createRadialGradient(star.x,star.y,0,star.x,star.y,star.radius*4);
    glow.addColorStop(0,`rgba(215,224,248,${alpha*.16})`);glow.addColorStop(1,'rgba(215,224,248,0)');
    context.fillStyle=glow;context.fillRect(star.x-6,star.y-6,12,12);
   }
  }
 }
 function tick(now){
  if(!canAnimate()){frame=0;return;}
  if(now-last>=1000/30){
   const dt=Math.min((now-last)/1000,.08);last=now;time+=dt;
   for(const star of stars){star.y+=dt*star.depth*1.4;star.x+=dt*star.depth*.45;if(star.y>height+4)star.y=-4;if(star.x>width+4)star.x=-4;}
   draw();
  }
  frame=requestAnimationFrame(tick);
 }
 function sync(){
  if(frame)cancelAnimationFrame(frame);frame=0;
  const active=canAnimate();canvas.dataset.motion=active?'running':'still';
  control.setAttribute('aria-pressed',String(enabled&&!reduced.matches));
  control.title=reduced.matches?'已按系统设置减少动态效果':enabled?'暂停星空动画':'开启星空动画';
  draw();if(active){last=performance.now();frame=requestAnimationFrame(tick);}
 }
 function resize(){
  width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);
  const count=Math.min(210,Math.max(55,Math.round(width*height/5800)));
  stars=Array.from({length:count},()=>({x:Math.random()*width,y:Math.random()*height,radius:.35+Math.random()**2*1.1,alpha:.2+Math.random()*.45,speed:.25+Math.random()*.5,phase:Math.random()*Math.PI*2,depth:.35+Math.random()*.8}));
  sync();
 }
 control.addEventListener('click',()=>{enabled=reduced.matches?false:!enabled;try{localStorage.setItem('vla-guide-stars',enabled?'running':'paused');}catch{};sync();if(reduced.matches)toast('已遵循系统的减少动态效果设置，保留静态星空。');});
 new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
 let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,120);});
 resize();
}

document.querySelector('#print-notes')?.addEventListener('click',()=>window.print());
renderProgress();
initStarfield();
})();
