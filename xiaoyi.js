/* Local knowledge drawer; online adapters require an explicit future opt-in. */
(() => {
  'use strict';
  const config = window.XIAOYI_CONFIG || {};
  const state = {messages:[],busy:false,models:[],selection:'local',sources:[]};
  const engine = window.XiaoyiEngine.create();
  const memory = window.XiaoyiMemory.create();
  const restoredMessages=()=>memory.isEnabled()?memory.current().flatMap(entry=>[{role:'user',content:entry.user,memoryEntryId:entry.id},{role:'assistant',content:entry.assistant,memoryEntryId:entry.id,sources:entry.sources||[]}]):[];
  state.messages = restoredMessages();
  let needsHydration = state.messages.length > 0;
  function hydrateEngine(history) {
    engine.reset();
    for (let index = 0; index < history.length; index += 2) if (history[index]?.role === 'user') engine.reply(history[index].content, history.slice(0, index + 1));
    needsHydration = false;
  }
  // Online adapters remain available for a future, explicitly configured deployment.
  // The published site intentionally stays local-only unless this opt-in is set.
  const onlineEnabled = config.enableOnline === true;
  const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
  const loadData=()=>engine.loadData();
  function api(path){if(config.apiBase)return `${config.apiBase.replace(/\/$/,'')}/api/${path}`;if(config.endpoint)return path==='chat'?config.endpoint:config.modelsEndpoint||config.endpoint.replace(/\/[^/]+$/,'/models');return ''}
  function context(input){return engine.context(input,state.messages)}
  function recentMessages(){
    const recent=state.messages.slice(-20),kept=[];let chars=0,bytes=0;
    for(let i=recent.length-1;i>=0;i--){
      const role=recent[i].role==='assistant'?'assistant':'user';
      const content=String(recent[i].content||'').slice(0,6000);
      const item={role,content},itemBytes=new TextEncoder().encode(JSON.stringify(item)).byteLength;
      if(kept.length&&(chars+content.length>18000||bytes+itemBytes>30000))break;
      kept.unshift(item);chars+=content.length;bytes+=itemBytes;
    }
    const start=kept.findIndex(message=>message.role==='user');return start<0?[]:kept.slice(start);
  }
  async function answer(input){
    const recallRequest=window.XiaoyiMemory.recallRequest(input);
    if (recallRequest) {
      const records = memory.recall();
      if (!records.length) return {text:'当前标签页尚无已保存记录。对话记录用于恢复上下文，不作为知识库事实。',sources:[],remember:false};
      const query = recallRequest.query;
      const selected = query ? memory.recall(query) : records;
      const shown = (selected.length ? selected : records).slice(0,5);
      return {text:`当前标签页保存的提问记录：\n\n${shown.map(item=>`· ${item.user.slice(0,240)}`).join('\n')}\n\n在 Memory stream 中选择 Continue 可恢复对应会话；New chat 使用独立上下文。`,sources:[],remember:false};
    }
    const chosen=state.models.find(m=>m.value===state.selection);
    if(!onlineEnabled||state.selection==='local'||!chosen)return {...engine.reply(input,state.messages),online:false};
    let contextData=context(input);
    const jsonBytes=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
    while(contextData.sources.length&&jsonBytes(contextData)>15000)contextData.sources.pop();
    if(jsonBytes(contextData)>15000)contextData={kind:'website-library',sources:[],sourceNotes:[]};
    let history=recentMessages();
    const payload=()=>({messages:history,provider:chosen.provider,model:chosen.id,context:contextData});
    while(history.length>1&&jsonBytes(payload())>47000){const next=history.findIndex((message,index)=>index>0&&message.role==='user');history=next>0?history.slice(next):history.slice(-1)}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{const r=await fetch(api('chat'),{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(payload())});if(!r.ok)throw Error('Unavailable');const b=await r.json();if(typeof b.answer!=='string'||!b.answer.trim())throw Error('Invalid reply');return {text:b.answer,sources:Array.isArray(b.sources)?b.sources:contextData.sources,online:true}}
    catch(_){const fallback=engine.reply(input,state.messages);return {...fallback,text:`在线服务暂不可用，以下为本地知识检索结果：\n\n${fallback.text}`,online:false}}finally{clearTimeout(timer)}
  }
  function richText(container,text){const re=/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]+)/g;let start=0;for(const m of text.matchAll(re)){container.append(document.createTextNode(text.slice(start,m.index)));const a=make('a','',m[1]||'Open reference ↗');a.href=m[2]||m[3];a.target='_blank';a.rel='noopener noreferrer';container.append(a);start=m.index+m[0].length}container.append(document.createTextNode(text.slice(start)))}
  function sources(container,records){const clean=(records||[]).filter(s=>s&&/^https?:\/\//.test(s.website||s.url||''));if(!clean.length)return;const box=make('div','xiaoyi-references');box.append(make('span','','REFERENCES / 参考入口'));clean.slice(0,6).forEach(s=>{const a=make('a','',`${s.name||s.title||'Reference'} · ${s.urlType==='search'?'检索入口':'原始来源'} ↗`);a.href=s.website||s.url;a.target='_blank';a.rel='noopener noreferrer';box.append(a)});container.append(box)}
  async function models(select,status,hint){
    select.replaceChildren(new Option('Knowledge / 知识模式','local'));state.models=[];state.selection='local';select.value='local';status.textContent='KNOWLEDGE MODE';
    if(!onlineEnabled||!api('models')){hint.textContent='本地知识检索已启用，不会连接在线模型。';return}
    try{const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);let r;try{r=await fetch(api('models'),{signal:c.signal})}finally{clearTimeout(timer)}if(!r.ok)throw Error('Unavailable');const b=await r.json();select.replaceChildren(new Option('Knowledge / 知识模式','local'));state.models=[];for(const p of b.providers||[])for(const m of p.models||[]){const value=`${p.id}/${m.id}`;state.models.push({...m,value,provider:p.id});select.append(new Option(`${p.label} · ${m.label||m.id}`,value))}if(state.models.length){const first=state.models.find(m=>m.provider===b.default?.provider&&m.id===b.default?.model)||state.models[0];state.selection=first.value;select.value=first.value;status.textContent='ONLINE MODEL';hint.textContent='在线模型已启用，仅提交当前会话的近期上下文。'}else hint.textContent='本地知识检索可用，在线模型未启用。'}catch(_){hint.textContent='在线服务暂不可用，本地知识检索可用。'}
  }
  const launcher=make('button','xiaoyi-launcher');launcher.type='button';launcher.id='xiaoyi-launcher';launcher.innerHTML='<span class="xiaoyi-mascot" aria-hidden="true"><i class="eye"></i><i class="eye"></i><i class="spark">✦</i></span><span class="xiaoyi-launcher-label">Xiaoyi</span><span class="xiaoyi-invite" aria-hidden="true">Technical references<br>and project resources.</span>';launcher.setAttribute('aria-controls','xiaoyi-panel');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-label','Open Xiaoyi / 展开小艺');
  const panel=make('aside','xiaoyi-drawer');panel.id='xiaoyi-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Xiaoyi conversation / 小艺对话');
  panel.innerHTML='<div class="xiaoyi-drawer-top"><div class="xiaoyi-heading"><strong>Xiaoyi <span>✦</span></strong><small>WEBSITE KNOWLEDGE ENTRY</small></div><button type="button" class="xiaoyi-close" aria-label="Close Xiaoyi / 关闭小艺">×</button></div><div class="xiaoyi-model-bar"><label for="xiaoyi-model">MODEL / 模型</label><select id="xiaoyi-model" aria-describedby="xiaoyi-model-hint"><option value="local">Knowledge / 知识模式</option></select><span class="xiaoyi-status">KNOWLEDGE MODE</span></div><p id="xiaoyi-model-hint" class="xiaoyi-model-hint">本地知识检索已启用，不会连接在线模型。</p><div class="xiaoyi-conversation"><div class="xiaoyi-watermark" aria-hidden="true"><span class="xiaoyi-mascot"><i class="eye"></i><i class="eye"></i><i class="spark">✦</i></span><strong>Xiaoyi</strong><span>VLA · AI Infra · Project resources</span></div><div class="xiaoyi-messages" role="log" aria-label="Conversation" aria-live="polite"></div><section id="xiaoyi-memory-view" class="xiaoyi-memory-view" aria-label="Xiaoyi memory stream" hidden></section></div><div class="xiaoyi-suggestions"><button type="button" class="xiaoyi-suggestion">航空航天科创项目</button><button type="button" class="xiaoyi-suggestion">VLA 是什么？</button><button type="button" class="xiaoyi-suggestion">创享艺苑简介</button></div><div class="xiaoyi-tools"><a href="knowledge.html">Knowledge Library ↗</a><div class="xiaoyi-tool-actions"><button class="xiaoyi-memory-toggle" type="button" aria-controls="xiaoyi-memory-view" aria-expanded="false">Memory · 0</button><button class="xiaoyi-clear" type="button">New chat ↺</button></div></div><details class="xiaoyi-external-links"><summary>AI Websites</summary><div class="xiaoyi-external-grid"><a href="https://chat.deepseek.com/">DeepSeek</a><a href="https://www.tongyi.com/">Tongyi Qianwen</a><a href="https://www.kimi.com/">Kimi</a><a href="https://www.doubao.com/chat/">Doubao</a><a href="https://chatglm.cn/">Zhipu Qingyan</a><a href="https://yuanbao.tencent.com/">Tencent Yuanbao</a></div><p class="xiaoyi-external-note">External websites · Chat history is not shared.</p></details><form class="xiaoyi-form"><textarea rows="2" maxlength="3000" placeholder="Ask about a topic or resource…" aria-label="Message Xiaoyi"></textarea><button type="submit" aria-label="Send message">↑</button></form><p class="xiaoyi-privacy">记忆仅限当前标签页会话，不用于训练。共用此标签页前请 Clear all。当前仅使用本地知识模式，不会发送到在线模型。<br>建议与推演供参考，请核对关键事实。</p>';
  const dock=make('div','xiaoyi-dock');
  const dockToggle=make('button','xiaoyi-dock-toggle','▾');
  dockToggle.type='button';
  dockToggle.setAttribute('aria-label','Xiaoyi preview');
  dockToggle.setAttribute('aria-expanded','false');
  dockToggle.setAttribute('aria-controls','xiaoyi-preview');
  dockToggle.title='Drag to either edge · Arrow keys to move';
  const preview=make('div','xiaoyi-preview');preview.id='xiaoyi-preview';
  preview.append(launcher);dock.append(dockToggle,preview);
  const announcement=make('span','xiaoyi-sr-only');announcement.setAttribute('role','status');
  document.body.append(panel,dock,announcement);
  let dockSide='right',dockRatio=null,suppressDockClick=false,pointer=null;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const viewport=()=>{const v=window.visualViewport;return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||document.documentElement.clientWidth,height:v?.height||window.innerHeight}};
  const dockBounds=(v=viewport())=>({min:v.top+12,max:Math.max(v.top+12,v.top+v.height-dockToggle.offsetHeight-12)});
  function positionDock(){
    const v=viewport(),bounds=dockBounds(v);
    const top=dockRatio===null?clamp(92,bounds.min,bounds.max):bounds.min+dockRatio*(bounds.max-bounds.min);
    dock.dataset.side=panel.dataset.side=document.body.dataset.xiaoyiSide=dockSide;
    dock.classList.toggle('is-left',dockSide==='left');
    dock.style.left=dockSide==='left'?v.left+'px':'auto';
    dock.style.right=dockSide==='right'?Math.max(0,document.documentElement.clientWidth-v.left-v.width)+'px':'auto';
    panel.style.left=dockSide==='left'?v.left+'px':'auto';
    panel.style.right=dockSide==='right'?Math.max(0,document.documentElement.clientWidth-v.left-v.width)+'px':'auto';
    dock.style.top=top+'px';
    preview.style.maxWidth=Math.max(0,v.width-52)+'px';
    const dockLeft=dockSide==='left'?v.left:v.left+v.width-dock.offsetWidth;
    const previewLeft=clamp(dockSide==='left'?dockLeft+dock.offsetWidth+8:dockLeft-preview.offsetWidth-8,v.left+8,Math.max(v.left+8,v.left+v.width-preview.offsetWidth-8));
    // Always clear the opposite anchor when crossing sides; CSS must not retain both.
    preview.style.left=dockSide==='left'?previewLeft-dockLeft+'px':'auto';
    preview.style.right=dockSide==='right'?dockLeft+dock.offsetWidth-previewLeft-preview.offsetWidth+'px':'auto';
    const previewTop=clamp(top,bounds.min,Math.max(bounds.min,v.top+v.height-preview.offsetHeight-12));
    dock.style.setProperty('--preview-offset',previewTop-top+'px');
  }
  // A new visit always starts on the right; movement belongs to the current page.
  function placeDock(x,y){
    const bounds=dockBounds();
    const v=viewport();
    dockSide=x<v.left+v.width/2?'left':'right';
    const top=clamp(y-dockToggle.offsetHeight/2,bounds.min,bounds.max);
    dockRatio=bounds.max===bounds.min?0:(top-bounds.min)/(bounds.max-bounds.min);
    positionDock();if(!panel.hidden)layout();
  }
  function pinPreview(pinned){dock.classList.toggle('is-pinned',pinned);dockToggle.setAttribute('aria-expanded',String(pinned))}
  function resetDockPosition(){dockSide='right';dockRatio=null;positionDock();if(!panel.hidden)layout();announcement.textContent='Xiaoyi position reset.'}
  positionDock();
  if('ResizeObserver' in window)new ResizeObserver(positionDock).observe(preview);
  window.addEventListener('resize',positionDock);
  window.visualViewport?.addEventListener('resize',positionDock);
  window.visualViewport?.addEventListener('scroll',positionDock);
  dockToggle.addEventListener('click',()=>{if(suppressDockClick){suppressDockClick=false;return}pinPreview(!dock.classList.contains('is-pinned'))});
  dockToggle.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Escape'].includes(event.key))return;
    event.preventDefault();
    if(event.key==='Home'){resetDockPosition();return}
    if(event.key==='Escape'){pinPreview(false);dockToggle.blur();return}
    const rect=dockToggle.getBoundingClientRect();
    if(event.key==='ArrowLeft')dockSide='left';
    if(event.key==='ArrowRight')dockSide='right';
    if(event.key==='ArrowUp'||event.key==='ArrowDown')placeDock(dockSide==='left'?0:window.innerWidth,rect.top+rect.height/2+(event.key==='ArrowUp'?-1:1)*(event.shiftKey?48:16));
    else{positionDock();if(!panel.hidden)layout()}
  });
  function finishDrag(event){
    if(!pointer||event.pointerId!==pointer.id)return;
    const current=pointer;pointer=null;
    if(current.moved){
      if(event.type==='pointercancel'||event.type==='lostpointercapture'){dockSide=current.side;dockRatio=current.ratio;positionDock()}
      else{placeDock(event.clientX,event.clientY-current.grabOffset);announcement.textContent='Xiaoyi moved to the '+dockSide+' edge.'}
      suppressDockClick=true;setTimeout(()=>{suppressDockClick=false},350);
    }
    dock.classList.remove('is-dragging');document.body.classList.remove('xiaoyi-dragging');
    if(dockToggle.hasPointerCapture(event.pointerId))dockToggle.releasePointerCapture(event.pointerId);
  }
  dockToggle.addEventListener('pointerdown',event=>{
    if(event.button!==0||!event.isPrimary||pointer)return;
    const rect=dockToggle.getBoundingClientRect();
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,side:dockSide,ratio:dockRatio,grabOffset:event.clientY-rect.top-rect.height/2,moved:false};
    dockToggle.setPointerCapture(event.pointerId);
  });
  dockToggle.addEventListener('pointermove',event=>{
    if(!pointer||event.pointerId!==pointer.id)return;
    if(!pointer.moved&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)<6)return;
    pointer.moved=true;pinPreview(false);dock.classList.add('is-dragging');document.body.classList.add('xiaoyi-dragging');
    placeDock(event.clientX,event.clientY-pointer.grabOffset);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])dockToggle.addEventListener(name,finishDrag);

  const close=panel.querySelector('.xiaoyi-close'),messages=panel.querySelector('.xiaoyi-messages'),memoryView=panel.querySelector('.xiaoyi-memory-view'),memoryToggle=panel.querySelector('.xiaoyi-memory-toggle'),form=panel.querySelector('form'),input=form.querySelector('textarea'),send=form.querySelector('button'),select=panel.querySelector('select'),status=panel.querySelector('.xiaoyi-status'),hint=panel.querySelector('.xiaoyi-model-hint'),clear=panel.querySelector('.xiaoyi-clear'),externalLinks=panel.querySelector('.xiaoyi-external-links');let previousFocus=null,discovered=false,memoryOpen=false;
  const frame=document.querySelector('.site-frame'),mobile=matchMedia('(max-width:760px)');
  function layout(){
    const visible=!panel.hidden,modal=visible&&mobile.matches;
    panel.setAttribute('aria-modal',String(modal));
    frame.inert=modal;
    document.body.classList.toggle('xiaoyi-mobile-open',modal);
    if(visible&&!modal){
      const width=document.documentElement.clientWidth;
      const scale=(width-panel.offsetWidth)/width;
      frame.style.setProperty('--site-width',`${width}px`);
      frame.style.setProperty('--site-scale',String(scale));
      // The frame uses CSS zoom, which also scales its margin.
      frame.style.setProperty('--site-offset',`${dockSide==='left'?panel.offsetWidth/scale:0}px`);
    }else{frame.style.removeProperty('--site-width');frame.style.removeProperty('--site-scale');frame.style.removeProperty('--site-offset')}
  }
  function open(){if(!panel.hidden)return;previousFocus=document.activeElement;positionDock();panel.hidden=false;if(externalLinks)externalLinks.open=false;document.body.classList.add('xiaoyi-is-open');launcher.setAttribute('aria-expanded','true');launcher.classList.add('is-open');dock.classList.add('is-open');dock.inert=true;layout();close.focus();if(!discovered){discovered=true;models(select,status,hint);loadData()}}
  function hide(){panel.hidden=true;document.body.classList.remove('xiaoyi-is-open');launcher.setAttribute('aria-expanded','false');launcher.classList.remove('is-open');dock.classList.remove('is-open','is-pinned');dock.inert=false;dockToggle.setAttribute('aria-expanded','false');layout();const returnFocus=previousFocus?.isConnected&&!dock.contains(previousFocus)?previousFocus:dockToggle;returnFocus.focus({preventScroll:true})}
  window.addEventListener('resize',layout);mobile.addEventListener('change',layout);
  launcher.addEventListener('click',()=>panel.hidden?open():hide());close.addEventListener('click',hide);document.querySelectorAll('[data-open-xiaoyi]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();open()}));panel.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();hide()}
    if(e.key==='Tab'&&mobile.matches){const items=[...panel.querySelectorAll('button:not(:disabled),a,summary,select:not(:disabled),textarea:not(:disabled)')].filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
  });
  function render(role,text,records=[]){const e=make('div',`xiaoyi-message ${role}`);richText(e,text);sources(e,records);messages.append(e);messages.scrollTop=messages.scrollHeight;return e}
  function renderTranscript(){
    messages.replaceChildren();
    state.messages.forEach(message=>render(message.role,message.content,message.sources||[]));
    panel.classList.toggle('has-conversation',state.messages.length>0);
  }
  function removeMemoryEntry(item){
    const currentIds=new Set(memory.current().map(entry=>entry.id));
    memory.remove(item.id);
    // A record from another session must never rebuild the active transcript.
    if(!currentIds.has(item.id))return;
    const kept=state.messages.filter(message=>message.memoryEntryId!==item.id);
    if(kept.length===state.messages.length)return;
    state.messages=kept;state.sources=[];needsHydration=true;renderTranscript();
  }
  function renderMemory(){
    const items=memory.list();memoryToggle.textContent=`Memory · ${items.length}`;memoryToggle.setAttribute('aria-expanded',String(memoryOpen));
    memoryView.replaceChildren();memoryView.hidden=!memoryOpen;messages.hidden=memoryOpen;
    if(!memoryOpen)return;
    const head=make('div','xiaoyi-memory-head');head.append(make('strong','','Memory stream'),make('span','',!memory.isEnabled()?'Memory paused':memory.isPersistent()?'Current tab session':'Page only · storage unavailable'));
    const controls=make('div','xiaoyi-memory-controls');const enabled=make('button','xiaoyi-memory-enabled',memory.isEnabled()?'Memory on':'Memory off');enabled.type='button';enabled.setAttribute('aria-pressed',String(memory.isEnabled()));enabled.addEventListener('click',()=>{memory.setEnabled(!memory.isEnabled());renderMemory()});
    const erase=make('button','xiaoyi-memory-erase','Clear all');erase.type='button';erase.disabled=!items.length;erase.addEventListener('click',()=>{memory.clear();reset();renderMemory()});controls.append(enabled,erase);memoryView.append(head,controls);
    if(!items.length){memoryView.append(make('p','xiaoyi-memory-empty',memory.isEnabled()?'Recent exchanges will appear in this tab.':'Turn memory on to keep recent exchanges in this tab.'));return}
    const list=make('div','xiaoyi-memory-list');
    items.forEach(item=>{const row=make('article','xiaoyi-memory-entry'),question=make('p','xiaoyi-memory-question',item.user),actions=make('div','xiaoyi-memory-entry-actions'),resume=make('button','xiaoyi-memory-resume','Continue'),remove=make('button','xiaoyi-memory-delete','Delete');resume.type=remove.type='button';resume.disabled=!memory.isEnabled();resume.addEventListener('click',()=>{memory.resume(item.conversationId);state.messages=restoredMessages();needsHydration=true;renderTranscript();memoryOpen=false;renderMemory()});remove.addEventListener('click',()=>{removeMemoryEntry(item);renderMemory()});actions.append(resume,remove);row.append(question,actions);list.append(row)});
    memoryView.append(list);
    memoryView.querySelectorAll('button').forEach(button=>{button.disabled=button.disabled||state.busy});
  }
  function reset(startNew=true){if(state.busy)return;state.messages=[];state.sources=[];engine.reset();needsHydration=false;if(startNew)memory.startNew();messages.replaceChildren();panel.classList.remove('has-conversation');renderMemory()}
  async function submit(value){const t=value.trim();if(!t||state.busy)return;state.busy=true;memoryOpen=false;renderMemory();panel.classList.add('has-conversation');const userMessage={role:'user',content:t};state.messages.push(userMessage);render('user',t);input.value='';send.disabled=clear.disabled=select.disabled=input.disabled=true;const pending=render('assistant','正在检索资料…');try{await loadData();if(needsHydration)hydrateEngine(state.messages.slice(0,-1));const r=await answer(t);pending.remove();state.sources=r.sources||[];const assistantMessage={role:'assistant',content:r.text,sources:state.sources};state.messages.push(assistantMessage);render('assistant',r.text,state.sources);if(r.remember!==false){const saved=memory.remember(t,r.text,r.sources);if(saved)userMessage.memoryEntryId=assistantMessage.memoryEntryId=saved.id}state.messages=state.messages.slice(-48);renderMemory();status.textContent=r.online?'ONLINE MODEL':'KNOWLEDGE MODE'}catch(_){pending.textContent='暂时无法完成这次回答，请稍后再试。'}finally{state.busy=false;renderMemory();send.disabled=clear.disabled=select.disabled=input.disabled=false;if(!panel.hidden)input.focus()}}
  form.addEventListener('submit',e=>{e.preventDefault();submit(input.value)});input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}});panel.querySelectorAll('.xiaoyi-suggestion').forEach(b=>b.addEventListener('click',()=>submit(b.textContent)));select.addEventListener('change',()=>{state.selection=select.value;status.textContent=select.value==='local'?'KNOWLEDGE MODE':'ONLINE MODEL'});clear.addEventListener('click',reset);memoryToggle.addEventListener('click',()=>{memoryOpen=!memoryOpen;renderMemory()});renderTranscript();renderMemory();
  function restorePageSession(event){if(!event.persisted)return;memory.reload();state.messages=restoredMessages();state.sources=[];engine.reset();needsHydration=state.messages.length>0;renderTranscript();renderMemory()}
  window.addEventListener('pageshow',restorePageSession);
  if(['#xiaoyi','#ask-xiaoyi','#xiaoyi-panel'].includes(location.hash))open();
})();
