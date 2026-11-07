import { api, accountUser, refreshAccount } from '../account.js';
import { navigate } from '../router.js';
import { escapeHtml as h, icon, toast } from '../ui.js';
import { MEMBERSHIP_LIMITS } from '../membership-limits.js';
const head=title=>`<header class="catalog-header"><button class="catalog-back" type="button" data-back aria-label="返回">${icon('back')}</button><h1>${title}</h1><a href="#/account">账号</a></header>`;
const statusNames={pending:'等待付款',paid:'支付成功',expired:'订单已过期',refunded:'已退款'};
export function render({query,route}) {
  const orderPage=route.path==='/order',el=document.createElement('div');el.className='page platform-page';
  document.title=`${orderPage?'会员订单':'会员权益'} · 一局童年`;
  el.innerHTML=head(orderPage?'会员订单':'会员权益')+'<main class="platform-main"><p role="status">加载中…</p></main>';
  return {el,mount(){
    const host=el.querySelector('main'),controller=new AbortController();let interval=null,busy=false,current=null,automaticChecks=0;
    const showOrder=async()=>{
      current=await api('/api/orders/'+encodeURIComponent(query.get('id')||''),{signal:controller.signal});if(controller.signal.aborted)return;
      host.innerHTML=`<section class="platform-card"><h2>${statusNames[current.status]||h(current.status)}</h2><p>${current.product==='month'?'月卡30天':'年卡365天'} · ¥${(current.amount/100).toFixed(2)}</p><small>订单号：${h(current.id)}</small><div data-payment></div><p role="status" data-status></p><div class="platform-actions"><button data-check>刷新支付状态</button><a href="#/account">查看权益</a><a href="#/membership">返回会员页</a></div></section>`;
      if(current.status!=='pending'){clearInterval(interval);await refreshAccount();return;}
      const payment=host.querySelector('[data-payment]');
      if(current.channel==='native'&&current.payment?.codeUrl){
        const {default:qrcode}=await import('/vendor/qrcode.js');if(controller.signal.aborted)return;
        const qr=qrcode(0,'M');qr.addData(current.payment.codeUrl);qr.make();payment.innerHTML=`<div class="payment-qr">${qr.createSvgTag({cellSize:5,margin:4,scalable:true})}</div><p>请使用微信扫一扫付款。</p>`;
      }else if(current.channel==='h5'&&current.payment?.h5Url){
        const a=document.createElement('a');a.className='platform-primary';a.textContent='打开微信支付';a.href=current.payment.h5Url;payment.appendChild(a);
      }else if(current.channel==='jsapi'){
        payment.innerHTML=current.payment?'<button class="platform-primary" data-jsapi>微信付款</button>':`<a class="platform-primary" href="/api/payments/wechat/oauth/start?orderId=${encodeURIComponent(current.id)}">授权并付款</a>`;
      }
      if(!interval)interval=setInterval(async()=>{if(document.hidden||busy||++automaticChecks>60){if(automaticChecks>60)clearInterval(interval);return;}busy=true;try{await showOrder();}catch(e){const status=host.querySelector('[data-status]');if(status)status.textContent=e.message;}finally{busy=false;}},5000);
    };
    const load=async()=>{
      if(orderPage){await showOrder();return;}
      const data=await api('/api/membership',{signal:controller.signal});if(controller.signal.aborted)return;
      host.innerHTML=`<section class="platform-card membership-hero"><h2>多留一点进度，多保存几套手感</h2><p>基础游玩、金手指、本地存档和触屏编辑继续免费。</p><table class="membership-table"><thead><tr><th>权益</th><th>免费账号</th><th>会员</th></tr></thead><tbody><tr><td>云存档</td>${Object.values(MEMBERSHIP_LIMITS).map(plan=>`<td>${plan.maxBytes>=1024**3?plan.maxBytes/1024**3+'GB':plan.maxBytes/1024**2+'MB'} / ${plan.maxSaves}条</td>`).join('')}</tr><tr><td>每平台布局预设</td>${Object.values(MEMBERSHIP_LIMITS).map(plan=>`<td>${plan.maxPresets}套</td>`).join('')}</tr></tbody></table><p>${data.limits.member?'会员有效至 '+new Date(data.limits.expiresAt).toLocaleString():'按需购买，不自动续费。到期保留已有数据。'}</p></section><section class="platform-card"><h2>选择会员卡</h2><div class="product-list">${data.products.map(p=>`<button data-product="${h(p.id)}" ${!data.available?'disabled':''}><strong>${h(p.name)} · ${p.days}天</strong><b>¥${(p.amount/100).toFixed(2)}</b></button>`).join('')}</div>${!data.available?'<p class="platform-notice">会员支付暂未开放，免费功能可以正常使用。</p>':''}<p role="status" data-status></p><a href="#/account">登录与账号资料</a></section><section class="platform-card"><h2>最近订单</h2><div data-orders>${accountUser()?'读取中…':'登录后查看订单'}</div></section>`;
      if(accountUser()&&data.available){const orders=await api('/api/orders',{signal:controller.signal});if(controller.signal.aborted)return;host.querySelector('[data-orders]').innerHTML=orders.orders.length?orders.orders.map(o=>`<a class="account-save" href="#/order?id=${encodeURIComponent(o.id)}"><span>${o.product==='month'?'月卡':'年卡'} · ¥${(o.amount/100).toFixed(2)}</span><b>${statusNames[o.status]||h(o.status)}</b></a>`).join(''):'<p>暂无订单</p>';}
    };
    host.addEventListener('click',async event=>{
      const button=event.target.closest('button');if(!button)return;
      try{
        if(button.dataset.product){
          if(!accountUser()){navigate('/account?next='+encodeURIComponent('/membership'));return;}
          button.disabled=true;const channel=/MicroMessenger/i.test(navigator.userAgent)?'jsapi':matchMedia('(pointer:coarse)').matches?'h5':'native';
          const order=await api('/api/orders',{method:'POST',body:{product:button.dataset.product,channel}});navigate('/order?id='+order.id);
        }else if(button.matches('[data-check]')){button.disabled=true;await showOrder();}
        else if(button.matches('[data-jsapi]')){
          if(!window.WeixinJSBridge)throw Error('请在微信中重新打开此页面');
          window.WeixinJSBridge.invoke('getBrandWCPayRequest',current.payment,()=>{showOrder().catch(e=>toast(e.message));});
        }
      }catch(e){toast(e.message);const status=host.querySelector('[data-status]');if(status)status.textContent=e.message;}finally{button.disabled=false;}
    },{signal:controller.signal});
    load().catch(e=>{if(!controller.signal.aborted)host.innerHTML=`<p role="alert">${h(e.message)}</p><a href="#/account">前往登录</a>`;});
    return()=>{controller.abort();clearInterval(interval);};
  }};
}
