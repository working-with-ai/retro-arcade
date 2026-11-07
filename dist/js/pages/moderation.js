import { api } from '../account.js';
import { escapeHtml as h,toast,icon } from '../ui.js';
export function render(){
  const el=document.createElement('div');el.className='page platform-page';document.title='举报处理 · 一局童年';
  el.innerHTML=`<header class="catalog-header"><button class="catalog-back" data-back aria-label="返回">${icon('back')}</button><h1>举报处理</h1></header><main class="platform-main"><p>读取中…</p></main>`;
  return{el,mount(){const controller=new AbortController(),host=el.querySelector('main');
    const load=async()=>{const data=await api('/api/admin/reports',{signal:controller.signal});if(controller.signal.aborted)return;host.innerHTML=data.reports.map(r=>`<article class="platform-card"><h2>${h(r.title)}</h2><p>${h(r.reason)}</p><small>${new Date(r.created_at).toLocaleString()}</small><div class="platform-actions"><a href="#/relays?id=${encodeURIComponent(r.relay_id)}">查看挑战</a><button data-hide="${h(r.relay_id)}" ${r.status==='hidden'?'disabled':''}>${r.status==='hidden'?'已下架':'下架挑战'}</button></div></article>`).join('')||'<p>暂无举报</p>';};
    host.addEventListener('click',async event=>{const button=event.target.closest('[data-hide]');if(!button||!confirm('下架后挑战将不再公开展示，确认吗？'))return;button.disabled=true;try{await api(`/api/relays/${button.dataset.hide}/close`,{method:'POST',body:{status:'hidden'}});await load();}catch(e){toast(e.message);button.disabled=false;}},{signal:controller.signal});
    load().catch(e=>{if(!controller.signal.aborted)host.innerHTML=`<p role="alert">${h(e.message)}</p><a href="#/account">返回账号</a>`;});return()=>controller.abort();
  }};
}
