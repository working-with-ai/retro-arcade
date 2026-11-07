import { api,accountUser } from '../account.js';
import { navigate } from '../router.js';
import { escapeHtml as h,icon,toast } from '../ui.js';
export const relayToken=id=>{const key=`ra:relay-lease:${id}`;let token=sessionStorage.getItem(key);if(!token){token=crypto.randomUUID();sessionStorage.setItem(key,token);}return token;};
export function render({query,data}) {
  const relayId=query.get('id'),el=document.createElement('div');el.className='page platform-page';document.title='挑战接力 · 一局童年';
  el.innerHTML=`<header class="catalog-header"><button class="catalog-back" type="button" data-back aria-label="返回">${icon('back')}</button><h1>挑战接力</h1><a href="#/account">账号</a></header><main class="platform-main"><p role="status">加载中…</p></main>`;
  return{el,mount(){
    const host=el.querySelector('main'),controller=new AbortController();let detail=null,offset=null,capabilities=null;
    const card=r=>`<a class="platform-card relay-card" href="#/relays?id=${encodeURIComponent(r.id)}"><span>${h(data.gamesById.get(r.gameId)?.name||'经典游戏')}</span><h2>${h(r.title)}</h2><p>${h(r.description)}</p><small>${h(r.nickname)} · 已完成${r.headSeq}棒</small></a>`;
    const load=async()=>{
      capabilities=await api('/api/capabilities',{signal:controller.signal});if(controller.signal.aborted)return;
      if(!capabilities.relays){host.innerHTML='<section class="platform-card"><h2>一份存档，一起闯关</h2><p>挑战接力暂未开放。开放后可从游戏菜单发起，邀请其他玩家继续你的进度。</p></section>';return;}
      if(!relayId){
        const ended=query.get('status')==='ended',list=await api('/api/relays?status='+(ended?'ended':'active'),{signal:controller.signal});if(controller.signal.aborted)return;offset=list.nextOffset;
        host.innerHTML=`<p>登录后可从游戏内菜单发起接力，每棒限时30分钟。</p><nav class="platform-actions"><a href="#/relays">进行中</a><a href="#/relays?status=ended">已结束</a></nav><div data-list>${list.relays.map(card).join('')||'<p>还没有挑战，来发起第一场吧。</p>'}</div><button data-more ${offset===null?'hidden':''}>加载更多</button>`;return;
      }
      const result=await api('/api/relays/'+encodeURIComponent(relayId),{signal:controller.signal});if(controller.signal.aborted)return;detail=result.relay;
      const r=detail,active=r.status==='active'&&r.compatible;
      host.innerHTML=`<section class="platform-card"><h2>${h(r.title)}</h2><p>${h(r.description)}</p><p>发起人：${h(r.nickname)} · ${h(data.gamesById.get(r.gameId)?.name||'经典游戏')}</p><p>${r.status==='active'?'进行中':r.status==='completed'?'发起人标记已完成':'已结束'} · 已提交${r.headSeq}棒</p>${!r.compatible?'<p class="platform-notice">游戏资源已更新，此挑战暂不能继续。</p>':''}${r.leaseUntil>Date.now()?`<p>当前${r.leaseMine?'由你':'由其他玩家'}接棒，截止 ${new Date(r.leaseUntil).toLocaleTimeString()}</p>`:''}<div class="platform-actions">${!accountUser()?'<a href="#/account?next='+encodeURIComponent('/relays?id='+relayId)+'">登录后接棒</a>':active?`<button data-claim ${r.leaseUntil>Date.now()&&!r.leaseMine?'disabled':''}>${r.leaseMine?'继续我的接棒':'接棒挑战'}</button>${r.leaseMine?'<button data-release>放弃接棒</button>':''}`:''}<button data-share>分享挑战</button>${r.owner?'<button data-close>结束挑战</button><button data-complete>标记已完成</button>':''}${accountUser()?'<button data-report>举报</button>':''}</div><p role="status" data-status></p></section><section class="platform-card"><h2>接力记录</h2>${result.steps.map(s=>`<article class="account-save"><span>${s.seq===0?'起始存档':'第'+s.seq+'棒'} · ${h(s.nickname)}</span><small>${new Date(s.createdAt).toLocaleString()}</small></article>`).join('')}</section>`;
    };
    host.addEventListener('click',async event=>{
      const button=event.target.closest('button');if(!button)return;button.disabled=true;
      try{
        if(button.matches('[data-more]')){const list=await api(`/api/relays?status=${query.get('status')==='ended'?'ended':'active'}&offset=${offset}`);host.querySelector('[data-list]').insertAdjacentHTML('beforeend',list.relays.map(card).join(''));offset=list.nextOffset;button.hidden=offset===null;}
        else if(button.matches('[data-claim]')){const token=relayToken(relayId);await api(`/api/relays/${relayId}/claim`,{method:'POST',headers:{'X-Relay-Lease':token}});navigate(`/play?id=${encodeURIComponent(detail.gameId)}&relay=${encodeURIComponent(relayId)}`);}
        else if(button.matches('[data-release]')){await api(`/api/relays/${relayId}/release`,{method:'POST',headers:{'X-Relay-Lease':relayToken(relayId)}});await load();}
        else if(button.matches('[data-share]')){const link=location.origin+'/#/relays?id='+encodeURIComponent(relayId);if(navigator.share)await navigator.share({title:detail.title,url:link});else{await navigator.clipboard.writeText(link);toast('挑战链接已复制');}}
        else if(button.matches('[data-close],[data-complete]')){if(!confirm('结束后将不能再接棒，确定吗？'))return;await api(`/api/relays/${relayId}/close`,{method:'POST',body:{status:button.matches('[data-complete]')?'completed':'closed'}});await load();}
        else if(button.matches('[data-report]')){const reason=prompt('请填写举报理由（最多200字）');if(!reason)return;await api(`/api/relays/${relayId}/reports`,{method:'POST',body:{reason}});toast('举报已提交');}
      }catch(e){if(e.name!=='AbortError')toast(e.message);}finally{button.disabled=false;}
    },{signal:controller.signal});
    load().catch(e=>{if(!controller.signal.aborted)host.innerHTML=`<p role="alert">${h(e.message)}</p><a href="#/account?next=${encodeURIComponent('/relays?id='+relayId)}">前往登录</a>`;});
    return()=>controller.abort();
  }};
}
