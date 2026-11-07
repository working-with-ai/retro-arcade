import { ApiError, DAY, first, all, run, response, features, originCheck, session, fail } from './core.js';
import { authRoute } from './auth.js';
import { accountRoute } from './accounts.js';
import { relayRoute } from './relays.js';
import { paymentRoute, paymentWebhook, wechat, settle } from './payments.js';
export async function platformApi(request,env,url,games,resources) {
  const p=url.pathname;
  if(!/^\/api\/(capabilities|auth(?:\/|$)|me(?:\/|$)|membership(?:\/|$)|orders(?:\/|$)|payments(?:\/|$)|relays(?:\/|$)|admin(?:\/|$))/.test(p))return null;
  try {
    if(p==='/api/capabilities')return response(features(env));
    if(['/api/payments/wechat/notify','/api/payments/wechat/refund-notify'].includes(p))return await paymentWebhook(request,env,url);
    originCheck(request);
    if(p.startsWith('/api/auth/'))return await authRoute(request,env,url);
    if(p==='/api/membership')return await paymentRoute(request,env,url,await session(request,env,false));
    if(!env.DB)fail(503,'UNAVAILABLE','服务尚未开放');
    if(p.startsWith('/api/relays')) {
      if(!features(env).relays)fail(503,'UNAVAILABLE','挑战接力尚未开放');
      return await relayRoute(request,env,url,await session(request,env,false),games,resources);
    }
    const user=await session(request,env);
    if(p==='/api/admin/reports') {
      if(!String(env.ADMIN_USER_IDS||'').split(',').includes(user.id))fail(403,'ADMIN','无权访问');
      return response({reports:await all(env,'SELECT p.*,r.title,r.status FROM reports p JOIN relays r ON r.id=p.relay_id ORDER BY p.created_at DESC LIMIT 100')});
    }
    if(p.startsWith('/api/me'))return await accountRoute(request,env,url,user,games);
    return await paymentRoute(request,env,url,user);
  } catch(error) {
    if(error instanceof ApiError)return response({error:error.message,code:error.code},error.status);
    const message=String(error.message||'');
    if(/QUOTA_|UNIQUE constraint failed: uploads/.test(message))return response({error:'云空间已满或此存档正在上传，请稍后重试',code:'QUOTA_OR_BUSY'},409);
    if(/RELAY_CONFLICT|UNIQUE constraint failed: relay_steps/.test(message))return response({error:'接棒已过期或进度已更新，请刷新挑战',code:'RELAY_CONFLICT'},409);
    if(/RELAY_DAILY_LIMIT/.test(message))return response({error:'每天最多发起3场挑战',code:'RELAY_DAILY_LIMIT'},429);
    console.error(JSON.stringify({event:'platform_error',path:p,name:error.name}));
    return response({error:'服务暂时不可用，请稍后重试',code:'INTERNAL'},503);
  }
}
export async function maintainPlatform(env) {
  if(!env.DB)return;
  const now=Date.now();
  await run(env,'DELETE FROM sessions WHERE expires_at<?',now);
  await run(env,'DELETE FROM sms_codes WHERE expires_at<?',now-DAY);
  await run(env,'DELETE FROM rate_limits WHERE expires_at<?',now);
  await run(env,'DELETE FROM oauth_states WHERE expires_at<?',now);
  await run(env,'DELETE FROM uploads WHERE created_at<?',now-3600000);
  await run(env,"UPDATE relays SET status='closed',ended_at=expires_at,lease_owner=NULL,lease_hash=NULL,lease_until=0 WHERE status='active' AND expires_at<?",now);
  if(features(env).payments) {
    const orders=await all(env,"SELECT * FROM orders WHERE status='pending' AND expires_at<? ORDER BY created_at LIMIT 10",now);
    for(const order of orders)try {
      const data=await wechat(env,'GET',`/v3/pay/transactions/out-trade-no/${order.id}?mchid=${encodeURIComponent(env.WX_MCH_ID)}`);
      await settle(env,data);
      if(data.trade_state==='NOTPAY')await wechat(env,'POST',`/v3/pay/transactions/out-trade-no/${order.id}/close`,{mchid:env.WX_MCH_ID});
      if(data.trade_state!=='SUCCESS')await run(env,"UPDATE orders SET status='expired' WHERE id=? AND status='pending'",order.id);
    }catch {console.error(JSON.stringify({event:'order_reconcile_failed',orderId:order.id}));}
  }
  // Sweep a bounded page per run. Persistent cursor avoids repeatedly scanning the first page.
  for(const prefix of ['account-saves/','relay-saves/']) {
    const cursorKey=`gc:${prefix}`;
    // Cursor stored in a dedicated rate-limit key; settings has a real-user foreign key.
    const cursorRow=await first(env,'SELECT key FROM rate_limits WHERE key LIKE ? LIMIT 1',`${cursorKey}%`);
    const cursor=cursorRow?.key.slice(cursorKey.length)||undefined;
    const page=await env.RESOURCES.list({prefix,limit:100,cursor});
    for(const object of page.objects) {
      if(Number(object.uploaded)>now-DAY)continue;
      if(prefix==='account-saves/') {
        if(!await first(env,'SELECT 1 FROM saves WHERE object_key=? UNION SELECT 1 FROM uploads WHERE object_key=?',object.key,object.key))await env.RESOURCES.delete(object.key);
      } else {
        const step=await first(env,'SELECT r.status,r.ended_at,r.expires_at FROM relay_steps s JOIN relays r ON r.id=s.relay_id WHERE s.object_key=?',object.key);
        if(!step||((step.status!=='active')&&now>(step.ended_at||step.expires_at)+30*DAY))await env.RESOURCES.delete(object.key);
      }
    }
    if(cursorRow)await run(env,'DELETE FROM rate_limits WHERE key=?',cursorRow.key);
    if(page.truncated)await run(env,'INSERT INTO rate_limits(key,count,expires_at) VALUES(?,0,?) ON CONFLICT(key) DO UPDATE SET expires_at=excluded.expires_at',cursorKey+page.cursor,now+DAY);
  }
}
