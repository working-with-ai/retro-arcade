import { DAY, bytes, b64, unb64, id, hash, first, all, run, stmt, jsonBody, bodyBytes, fail, response, features, session, limits, rate } from './core.js';
export const products = [{id:'month',name:'月卡',amount:990,days:30},{id:'year',name:'年卡',amount:6900,days:365}];
async function pemKey(pem,kind,usage) {
  const raw=unb64(pem.replace(/-----[^-]+-----|\s/g,''));
  return crypto.subtle.importKey(kind,raw,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,[usage]);
}
async function signature(env,message) {
  return b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',await pemKey(env.WX_PRIVATE_KEY,'pkcs8','sign'),bytes(message)));
}
async function verifyWechat(env,headers,body) {
  const timestamp=headers.get('Wechatpay-Timestamp'),nonce=headers.get('Wechatpay-Nonce'),sig=headers.get('Wechatpay-Signature');
  if(!timestamp||!nonce||!sig||headers.get('Wechatpay-Serial')!==env.WX_PUBLIC_KEY_ID||Math.abs(Date.now()/1000-Number(timestamp))>300)fail(400,'PAYMENT_SIGNATURE','支付签名无效');
  let valid=false;
  try { valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',await pemKey(env.WX_PUBLIC_KEY,'spki','verify'),unb64(sig),bytes(`${timestamp}\n${nonce}\n${body}\n`)); }catch{}
  if(!valid)fail(400,'PAYMENT_SIGNATURE','支付签名无效');
}
export async function wechat(env,method,path,data) {
  const timestamp=String(Math.floor(Date.now()/1000)),nonce=id(),body=data?JSON.stringify(data):'';
  const signed=await signature(env,`${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`);
  const res=await fetch(`https://api.mch.weixin.qq.com${path}`,{method,headers:{Authorization:`WECHATPAY2-SHA256-RSA2048 mchid="${env.WX_MCH_ID}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env.WX_SERIAL_NO}",signature="${signed}"`,Accept:'application/json','Content-Type':'application/json','Wechatpay-Serial':env.WX_PUBLIC_KEY_ID},...(body?{body}:{})});
  const text=await res.text();await verifyWechat(env,res.headers,text);
  if(!res.ok)fail(502,'PAYMENT_PROVIDER','支付服务暂时不可用');
  return text?JSON.parse(text):{};
}
export async function settle(env,transaction) {
  const order=await first(env,'SELECT * FROM orders WHERE id=?',transaction.out_trade_no);
  if(!order||transaction.mchid!==env.WX_MCH_ID||transaction.appid!==env.WX_APP_ID||transaction.amount?.total!==order.amount||transaction.amount?.currency!=='CNY')fail(400,'PAYMENT_MISMATCH','支付订单信息不匹配');
  if(transaction.trade_state!=='SUCCESS')return;
  const paidAt=Date.parse(transaction.success_time);
  if(!Number.isFinite(paidAt)||!transaction.transaction_id)fail(400,'PAYMENT_DATA','支付结果不完整');
  await env.DB.batch([
    stmt(env,"UPDATE orders SET status='paid',paid_at=?,transaction_id=? WHERE id=? AND status NOT IN ('paid','refunded')",paidAt,transaction.transaction_id,order.id),
    stmt(env,"INSERT INTO grants(order_id,user_id,paid_at,duration) SELECT id,user_id,paid_at,duration FROM orders WHERE id=? AND status='paid' ON CONFLICT(order_id) DO NOTHING",order.id)
  ]);
}
export async function paymentWebhook(request,env,url) {
  if(!features(env).payments)fail(503,'UNAVAILABLE','支付尚未开放');
  if(request.method!=='POST')fail(405,'METHOD','不支持此操作');
  const text=new TextDecoder().decode(await bodyBytes(request,524288));await verifyWechat(env,request.headers,text);
  const event=JSON.parse(text),resource=event.resource;
  if(!event.id||resource?.algorithm!=='AEAD_AES_256_GCM')fail(400,'PAYMENT_DATA','通知格式不正确');
  const key=await crypto.subtle.importKey('raw',bytes(env.WX_API_V3_KEY),'AES-GCM',false,['decrypt']);
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(resource.nonce),additionalData:bytes(resource.associated_data||'')},key,unb64(resource.ciphertext));
  const data=JSON.parse(new TextDecoder().decode(decrypted));
  if(url.pathname.endsWith('/refund-notify')) {
    const order=await first(env,'SELECT * FROM orders WHERE id=?',data.out_trade_no);
    if(!order||data.mchid!==env.WX_MCH_ID||data.amount?.total!==order.amount||(data.amount?.currency!==undefined&&data.amount.currency!=='CNY')||data.transaction_id!==order.transaction_id)fail(400,'PAYMENT_MISMATCH','退款订单不匹配');
    if(data.refund_status==='SUCCESS') {
      if(data.amount.refund===order.amount) await env.DB.batch([
        stmt(env,"UPDATE orders SET status='refunded' WHERE id=?",order.id),stmt(env,'UPDATE grants SET revoked=1 WHERE order_id=?',order.id)
      ]);
      else await run(env,'UPDATE orders SET needs_review=1 WHERE id=?',order.id);
    }
  } else { if(event.event_type==='TRANSACTION.SUCCESS')await settle(env,data); }
  await run(env,'INSERT INTO payment_events(id,kind,created_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',event.id,event.event_type,Date.now());
  return response({code:'SUCCESS',message:'成功'});
}
function orderView(order) {
  return {id:order.id,product:order.product,amount:order.amount,channel:order.channel,status:order.status,expiresAt:order.expires_at,createdAt:order.created_at,payment:order.payment?JSON.parse(order.payment):null};
}
export async function paymentRoute(request,env,url,user) {
  const path=url.pathname,now=Date.now();
  if(path==='/api/membership')return response({products,available:features(env).payments,limits:user?limits(user):{member:false,maxBytes:104857600,maxSaves:300,maxPresets:1}});
  if(!user)fail(401,'LOGIN_REQUIRED','请先登录');
  if(!features(env).payments)fail(503,'UNAVAILABLE','会员支付尚未开放');
  if(path==='/api/orders'&&request.method==='POST') {
    await rate(env,`orders:${user.id}`,10,60000);
    const data=await jsonBody(request),product=products.find(p=>p.id===data.product);
    if(!product||!['native','h5','jsapi'].includes(data.channel))fail(400,'PRODUCT','商品或支付方式无效');
    const order={id:id().replaceAll('-',''),user_id:user.id,product:product.id,amount:product.amount,duration:product.days*DAY,channel:data.channel,created_at:now,expires_at:now+900000,status:'pending'};
    await run(env,'INSERT INTO orders(id,user_id,product,amount,duration,channel,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)',order.id,user.id,order.product,order.amount,order.duration,order.channel,now,order.expires_at);
    if(order.channel==='jsapi')return response(orderView(order),201);
    const payment=await createPayment(env,url,order,null,request.headers.get('CF-Connecting-IP'));
    await run(env,'UPDATE orders SET payment=? WHERE id=?',JSON.stringify(payment),order.id);
    return response(orderView({...order,payment:JSON.stringify(payment)}),201);
  }
  if(path==='/api/orders'&&request.method==='GET')return response({orders:(await all(env,'SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 50',user.id)).map(orderView)});
  const match=/^\/api\/orders\/([\w-]+)$/.exec(path);
  if(match&&request.method==='GET') {
    let order=await first(env,'SELECT * FROM orders WHERE id=? AND user_id=?',match[1],user.id);if(!order)fail(404,'ORDER','订单不存在');
    if(['pending','expired'].includes(order.status)) {
      await rate(env,`query:${order.id}`,30,60000);
      const transaction=await wechat(env,'GET',`/v3/pay/transactions/out-trade-no/${order.id}?mchid=${encodeURIComponent(env.WX_MCH_ID)}`);
      await settle(env,transaction);
      if(now>order.expires_at&&transaction.trade_state==='NOTPAY') {
        await wechat(env,'POST',`/v3/pay/transactions/out-trade-no/${order.id}/close`,{mchid:env.WX_MCH_ID});
        await run(env,"UPDATE orders SET status='expired' WHERE id=? AND status='pending'",order.id);
      }
      order=await first(env,'SELECT * FROM orders WHERE id=?',order.id);
    }
    return response(orderView(order));
  }
  if(path==='/api/payments/wechat/oauth/start'&&request.method==='GET') {
    const order=await first(env,"SELECT * FROM orders WHERE id=? AND user_id=? AND channel='jsapi' AND status='pending' AND expires_at>?",url.searchParams.get('orderId'),user.id,now);
    if(!order)fail(404,'ORDER','订单不存在或已过期');
    const state=id()+id();await run(env,'INSERT INTO oauth_states(hash,user_id,order_id,expires_at) VALUES(?,?,?,?)',await hash(state),user.id,order.id,now+600000);
    const params=new URLSearchParams({appid:env.WX_APP_ID,redirect_uri:`${url.origin}/api/payments/wechat/oauth/callback`,response_type:'code',scope:'snsapi_base',state});
    return Response.redirect(`https://open.weixin.qq.com/connect/oauth2/authorize?${params}#wechat_redirect`,302);
  }
  if(path==='/api/payments/wechat/oauth/callback'&&request.method==='GET') {
    const state=await first(env,'DELETE FROM oauth_states WHERE hash=? AND user_id=? AND expires_at>? RETURNING order_id',await hash(url.searchParams.get('state')||''),user.id,now);
    if(!state)fail(400,'OAUTH_STATE','付款授权已失效，请重新开始');
    const code=url.searchParams.get('code');if(!code||code.length>512)fail(400,'OAUTH_CODE','付款授权失败');
    const params=new URLSearchParams({appid:env.WX_APP_ID,secret:env.WX_APP_SECRET,code,grant_type:'authorization_code'});
    const result=await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?${params}`),data=await result.json();
    if(!result.ok||!data.openid)fail(502,'OAUTH','微信授权失败');
    const order=await first(env,"SELECT * FROM orders WHERE id=? AND user_id=? AND status='pending' AND expires_at>?",state.order_id,user.id,now);
    if(!order)fail(409,'ORDER','订单已过期');
    const payment=await createPayment(env,url,order,data.openid,request.headers.get('CF-Connecting-IP'));
    await run(env,'UPDATE orders SET payment=? WHERE id=?',JSON.stringify(payment),order.id);
    return Response.redirect(`${url.origin}/#/order?id=${order.id}`,302);
  }
  fail(404,'NOT_FOUND','接口不存在');
}
async function createPayment(env,url,order,openid,ip) {
  const data={appid:env.WX_APP_ID,mchid:env.WX_MCH_ID,description:`一局童年${order.product==='month'?'月卡':'年卡'}`,out_trade_no:order.id,notify_url:`${url.origin}/api/payments/wechat/notify`,time_expire:new Date(order.expires_at).toISOString(),amount:{total:order.amount,currency:'CNY'}};
  if(order.channel==='jsapi')data.payer={openid};
  if(order.channel==='h5')data.scene_info={payer_client_ip:ip||'0.0.0.0',h5_info:{type:'Wap',app_name:'一局童年',app_url:url.origin}};
  const result=await wechat(env,'POST',`/v3/pay/transactions/${order.channel}`,data);
  if(order.channel==='native')return {codeUrl:result.code_url};
  if(order.channel==='h5')return {h5Url:result.h5_url+`&redirect_url=${encodeURIComponent(`${url.origin}/#/order?id=${order.id}`)}`};
  const timeStamp=String(Math.floor(Date.now()/1000)),nonceStr=id(),pkg=`prepay_id=${result.prepay_id}`;
  return {appId:env.WX_APP_ID,timeStamp,nonceStr,package:pkg,signType:'RSA',paySign:await signature(env,`${env.WX_APP_ID}\n${timeStamp}\n${nonceStr}\n${pkg}\n`)};
}
