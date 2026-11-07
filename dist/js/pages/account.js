import { api, refreshAccount, setAccountUser, syncLayoutSettings } from '../account.js';
import { getAllSaveSlots, getLocalProfile } from '../store.js';
import { readSaveBytes } from '../saves.js';
import { getLegacySyncCode } from '../cloud.js';
import { getLayouts, replaceLayouts } from '../touch-layout.js';
import { navigate } from '../router.js';
import { escapeHtml as h, icon, toast } from '../ui.js';
const header=title=>`<header class="catalog-header"><button type="button" class="catalog-back" data-back aria-label="返回">${icon('back')}</button><h1>${title}</h1><span></span></header>`;
export function render({query}) {
  document.title='账号与云空间 · 一局童年';
  const el=document.createElement('div');el.className='page platform-page';
  el.innerHTML=header('账号与云空间')+'<main class="platform-main"><p role="status">正在读取账号…</p></main>';
  return {el,mount(){
    const host=el.querySelector('main'),controller=new AbortController();let widget=null,timer=null,turnstileToken='',capabilities=null;
    const status=message=>{const p=host.querySelector('[data-status]');if(p)p.textContent=message;};
    const login=()=>{
      host.innerHTML=`<section class="platform-card"><h2>手机号登录</h2><p>登录后可同步存档与布局，参与挑战接力。</p>${capabilities.auth?`<form data-login><label>手机号<input name="phone" type="tel" inputmode="numeric" pattern="1[3-9][0-9]{9}" maxlength="11" placeholder="中国大陆手机号" required autocomplete="tel-national"></label><div id="human-check"></div><label>验证码<div class="platform-inline"><input name="code" pattern="[0-9]{6}" maxlength="6" inputmode="numeric" autocomplete="one-time-code" required><button type="button" data-send>获取验证码</button></div></label><button class="platform-primary" type="submit">登录 / 注册</button></form>`:'<p class="platform-notice">短信登录暂未开放，当前可以继续免登录游玩。</p>'}<p role="status" data-status></p></section>`;
      if(!capabilities.auth)return;
      const setup=()=>{
        if(controller.signal.aborted||!host.querySelector('#human-check'))return;
        widget=window.turnstile.render(host.querySelector('#human-check'),{sitekey:capabilities.turnstileSiteKey,action:'sms_login',callback:token=>{turnstileToken=token;},'expired-callback':()=>{turnstileToken='';}});
      };
      if(window.turnstile)setup();else{
        const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=setup;script.onerror=()=>status('验证组件加载失败，请刷新重试');document.head.appendChild(script);
      }
    };
    const load=async()=>{
      capabilities=await api('/api/capabilities',{signal:controller.signal});const data=await refreshAccount();if(controller.signal.aborted)return;
      if(!data){login();return;}
      const u=data.user;
      host.innerHTML=`<section class="platform-card"><h2>${h(u.nickname)}</h2><p>${u.member?'会员有效至 '+new Date(u.expiresAt).toLocaleString():'免费账号'}</p><p>云存档 ${data.usage.count} / ${u.maxSaves} 条 · ${(data.usage.bytes/1048576).toFixed(1)} / ${u.maxBytes/1048576} MB</p><form data-profile><label>账号昵称<input name="nickname" maxlength="20" required value="${h(u.nickname)}"></label><button type="submit">保存昵称</button></form><div class="platform-actions"><a href="#/membership">会员与订单</a><button data-logout>退出登录</button></div></section><section class="platform-card"><h2>导入与同步</h2><p>导入会复制到当前账号，原本地存档和同步码存档都会保留。</p><div class="platform-actions"><button data-import-local>导入本机资料和存档</button><button data-import-sync>导入旧同步码存档</button><button data-layout-sync>同步触屏布局</button></div><p role="status" data-status></p></section><section class="platform-card"><h2>账号云存档</h2><div data-saves>读取中…</div></section>`;
      const saves=await api('/api/me/saves',{signal:controller.signal});if(controller.signal.aborted)return;
      host.querySelector('[data-saves]').innerHTML=saves.saves.length?saves.saves.map(s=>`<article class="account-save"><div><strong>${h(s.label)}</strong><small>${h(s.gameId)} · ${Math.ceil(s.size/1024)} KB</small></div><a href="#/play?id=${encodeURIComponent(s.gameId)}&cloud=${encodeURIComponent(s.slotId)}">继续玩</a><button data-delete-save="${h(s.gameId)}/${h(s.slotId)}">删除</button></article>`).join(''):'<p>暂无云存档。进入游戏保存进度，或导入已有存档。</p>';
    };
    const onSubmit=async event=>{
      event.preventDefault();const form=event.target,data=Object.fromEntries(new FormData(form));
      const button=form.querySelector('[type=submit]');button.disabled=true;
      try{
        if(form.matches('[data-login]')){
          const result=await api('/api/auth/verify',{method:'POST',body:data});setAccountUser(result.user);
          const next=query.get('next');navigate(next?.startsWith('/')&&!next.startsWith('//')?next:'/account');
        }else{await api('/api/me',{method:'PATCH',body:{nickname:data.nickname}});toast('账号昵称已保存');await load();}
      }catch(e){status(e.message);toast(e.message);}finally{button.disabled=false;}
    };
    const onClick=async event=>{
      const button=event.target.closest('button');if(!button)return;
      try{
        if(button.matches('[data-send]')){
          const phone=host.querySelector('[name=phone]').value;if(!/^1[3-9]\d{9}$/.test(phone))throw Error('请输入有效手机号');
          if(!turnstileToken)throw Error('请先完成人机验证');
          button.disabled=true;
          try{await api('/api/auth/sms',{method:'POST',body:{phone,turnstileToken}});status('验证码已发送，5分钟内有效');let seconds=60;timer=setInterval(()=>{button.textContent=`${--seconds}秒后重发`;if(seconds<=0){clearInterval(timer);button.disabled=false;button.textContent='重新发送';}},1000);}
          catch(e){button.disabled=false;throw e;}finally{turnstileToken='';if(widget!==null)window.turnstile.reset(widget);}
          return;
        }
        if(button.matches('[data-logout]')){await api('/api/auth/logout',{method:'POST'});setAccountUser(null);await load();return;}
        if(button.dataset.deleteSave){if(!confirm('删除此账号云存档？本地存档不受影响。'))return;await api('/api/me/saves/'+button.dataset.deleteSave,{method:'DELETE'});await load();return;}
        if(button.matches('[data-import-local]')){
          button.disabled=true;const profile=getLocalProfile();await api('/api/me',{method:'PATCH',body:profile});let count=0;
          for(const slot of getAllSaveSlots()){
            const contents=await readSaveBytes(slot.gameId,slot.id);if(!contents?.length)continue;
            // Stable imported slot ID makes retries safe and avoids replacing ordinary account slots.
            const imported='local-'+slot.id.replace(/[^\w-]/g,'').slice(0,65);
            const params=new URLSearchParams({label:slot.label||'本机导入',seconds:String(slot.seconds||0),createdAt:String(slot.createdAt||Date.now())});
            await api(`/api/me/saves/${encodeURIComponent(slot.gameId)}/${imported}?${params}`,{method:'PUT',body:contents});status(`已导入 ${++count} 条存档`);
          }status(`已导入 ${count} 条存档，原始存档已保留`);toast('导入完成');await load();return;
        }
        if(button.matches('[data-import-sync]')){
          const code=prompt('输入旧的26位同步码（会复制存档，原数据保留）',getLegacySyncCode());if(!code)return;
          button.disabled=true;let cursor=null,count=0;do{const result=await api('/api/me/import-sync',{method:'POST',body:{code,cursor}});cursor=result.cursor;count+=result.imported;status(`已复制 ${count} 条存档`);}while(cursor);toast(`已导入 ${count} 条存档`);await load();return;
        }
        if(button.matches('[data-layout-sync]')){
          button.disabled=true;const result=await syncLayoutSettings(getLayouts(),()=>Promise.resolve(confirm('本机与云端布局不同。点击“确定”保留本机并上传；点击“取消”使用云端布局。')?'local':'cloud'));
          if(result)replaceLayouts(result.value);status('触屏布局已同步');toast('布局已同步');
        }
      }catch(e){status(e.message);toast(e.message);}finally{if(!button.matches('[data-send]'))button.disabled=false;}
    };
    host.addEventListener('submit',onSubmit,{signal:controller.signal});host.addEventListener('click',onClick,{signal:controller.signal});
    load().catch(e=>{if(!controller.signal.aborted)host.innerHTML=`<p role="alert">${h(e.message)}</p>`;});
    return()=>{controller.abort();clearInterval(timer);if(widget!==null)window.turnstile?.remove(widget);};
  }};
}
