import { DAY, id, hash, first, all, run, stmt, jsonBody, bodyBytes, safeId, fail, response, rate } from './core.js';
export async function fingerprint(game, resources) {
  if(!game)return 'unavailable';
  return hash(JSON.stringify({core:game.core,runtime:Object.values(resources).filter(r=>r.key?.startsWith('runtime/')).map(r=>[r.key,r.sha256]).sort()}));
}
export async function relayRoute(request,env,url,user,games,resources) {
  const now=Date.now(),path=url.pathname;
  if(path==='/api/relays/compatibility') {
    const game=games.get(url.searchParams.get('gameId'));if(!game)fail(404,'GAME','游戏不存在');
    return response({fingerprint:await fingerprint(game,resources)});
  }
  if(path==='/api/relays' && request.method==='GET') {
    const status=url.searchParams.get('status')==='ended'?'ended':'active',offset=Math.min(10000,Math.max(0,Number(url.searchParams.get('offset'))||0));
    const condition=status==='active'?"r.status='active' AND r.expires_at>?":"(r.status IN ('closed','completed') OR (r.status='active' AND r.expires_at<=?))";
    const rows=await all(env,`SELECT r.id,r.game_id gameId,r.title,r.description,r.status,r.created_at createdAt,r.expires_at expiresAt,r.head_seq headSeq,u.nickname FROM relays r JOIN users u ON u.id=r.user_id WHERE ${condition} ORDER BY r.created_at DESC LIMIT 20 OFFSET ?`,now,offset);
    return response({relays:rows,nextOffset:rows.length===20?offset+20:null});
  }
  if(path==='/api/relays' && request.method==='POST') {
    if(!user)fail(401,'LOGIN_REQUIRED','请先登录');
    const game=games.get(url.searchParams.get('gameId'));
    if(!game?.playable)fail(400,'GAME','游戏不可用');
    const version=await fingerprint(game,resources);
    if(url.searchParams.get('fingerprint')!==version)fail(409,'VERSION','游戏资源已更新，请重新启动游戏后发起');
    const body=await bodyBytes(request);if(!body.length)fail(400,'EMPTY','存档不能为空');
    const relayId=id(),stepId=id(),key=`relay-saves/${relayId}/${stepId}.state`;
    // Reserve the daily creation quota before storing any binary data.
    await run(env,"INSERT INTO relays(id,user_id,game_id,fingerprint,title,description,status,created_at,expires_at) VALUES(?,?,?,?,?,?,'draft',?,?)",relayId,user.id,game.id,version,(url.searchParams.get('title')||`${game.shortName||game.name}接力`).slice(0,50),(url.searchParams.get('description')||'一起继续闯关').slice(0,200),now,now+7*DAY);
    await env.RESOURCES.put(key,body,{httpMetadata:{contentType:'application/octet-stream',cacheControl:'no-store'}});
    await env.DB.batch([
      stmt(env,"UPDATE relays SET status='active' WHERE id=?",relayId),
      stmt(env,'INSERT INTO relay_steps(id,relay_id,seq,user_id,object_key,size,sha256,created_at) VALUES(?,?,0,?,?,?,?,?)',stepId,relayId,user.id,key,body.length,await hash(body),now)
    ]);
    return response({id:relayId},201);
  }
  const match=/^\/api\/relays\/([\w-]+)(?:\/(claim|release|submit|close|reports|state))?$/.exec(path);
  if(!match)fail(404,'NOT_FOUND','挑战不存在');
  const [,relayId,action]=match,relay=await first(env,'SELECT r.*,u.nickname FROM relays r JOIN users u ON u.id=r.user_id WHERE r.id=?',relayId);
  if(!relay || ['hidden','draft'].includes(relay.status))fail(404,'NOT_FOUND','挑战不存在或已下架');
  if(!action && request.method==='GET') {
    const steps=await all(env,'SELECT s.seq,s.created_at createdAt,s.size,u.nickname FROM relay_steps s JOIN users u ON u.id=s.user_id WHERE relay_id=? ORDER BY seq',relayId);
    return response({relay:{id:relay.id,gameId:relay.game_id,title:relay.title,description:relay.description,status:relay.expires_at<=now&&relay.status==='active'?'expired':relay.status,nickname:relay.nickname,headSeq:relay.head_seq,expiresAt:relay.expires_at,fingerprint:relay.fingerprint,owner:relay.user_id===user?.id,leaseMine:relay.lease_owner===user?.id,leaseUntil:relay.lease_until,compatible:await fingerprint(games.get(relay.game_id),resources)===relay.fingerprint},steps});
  }
  if(!user)fail(401,'LOGIN_REQUIRED','请先登录');
  if(action==='reports' && request.method==='POST') {
    const data=await jsonBody(request),reason=String(data.reason||'').trim();if(!reason || reason.length>200)fail(400,'REASON','请填写200字以内的举报理由');
    await run(env,'INSERT INTO reports(id,relay_id,user_id,reason,created_at) VALUES(?,?,?,?,?) ON CONFLICT(relay_id,user_id) DO NOTHING',id(),relayId,user.id,reason,now);
    return response({ok:true});
  }
  if(action==='close' && request.method==='POST') {
    const data=await jsonBody(request),admin=String(env.ADMIN_USER_IDS||'').split(',').includes(user.id);
    if(relay.user_id!==user.id&&!admin)fail(403,'OWNER','仅发起人可结束挑战');
    const status=data.status==='hidden'&&admin?'hidden':data.status==='completed'?'completed':'closed';
    await run(env,'UPDATE relays SET status=?,ended_at=?,lease_owner=NULL,lease_hash=NULL,lease_until=0 WHERE id=?',status,now,relayId);
    return response({ok:true});
  }
  if(await fingerprint(games.get(relay.game_id),resources)!==relay.fingerprint)fail(409,'VERSION','游戏资源版本已改变，无法继续此挑战');
  if(action==='state' && request.method==='GET') {
    if(relay.status==='hidden'||now>(relay.ended_at||relay.expires_at)+30*DAY)fail(410,'EXPIRED','挑战存档已过保留期');
    const seq=url.searchParams.has('seq')?Number(url.searchParams.get('seq')):relay.head_seq;
    const step=await first(env,'SELECT * FROM relay_steps WHERE relay_id=? AND seq=?',relayId,seq);
    const object=step?await env.RESOURCES.get(step.object_key):null;if(!object)fail(404,'NOT_FOUND','接力存档不存在');
    return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Length':String(step.size)}});
  }
  const token=request.headers.get('X-Relay-Lease')||'',leaseHash=await hash(token);
  if(!safeId(token)||token.length<32)fail(400,'LEASE','接棒凭据无效');
  if(action==='claim' && request.method==='POST') {
    const row=await first(env,`UPDATE relays SET lease_owner=?,lease_hash=?,lease_until=CASE WHEN lease_owner=? AND lease_hash=? AND lease_until>? THEN lease_until ELSE ? END
      WHERE id=? AND status='active' AND expires_at>? AND head_seq<50 AND (lease_until<=? OR lease_owner IS NULL OR (lease_owner=? AND lease_hash=?)) RETURNING lease_until`,user.id,leaseHash,user.id,leaseHash,now,now+1800000,relayId,now,now,user.id,leaseHash);
    if(!row)fail(409,'CLAIMED','挑战已结束或正在由其他玩家接棒');
    return response({leaseUntil:row.lease_until});
  }
  if(action==='release' && request.method==='POST') {
    await run(env,'UPDATE relays SET lease_owner=NULL,lease_hash=NULL,lease_until=0 WHERE id=? AND lease_owner=? AND lease_hash=?',relayId,user.id,leaseHash);
    return response({ok:true});
  }
  if(action==='submit' && request.method==='POST') {
    await rate(env,`relay-submit:${user.id}`,10,60000);
    const submission=request.headers.get('Idempotency-Key'),expected=Number(request.headers.get('X-Relay-Revision'));
    if(!safeId(submission)||submission.length<32)fail(400,'REQUEST_ID','提交标识无效');
    const body=await bodyBytes(request),digest=await hash(body);if(!body.length)fail(400,'EMPTY','存档不能为空');
    const existing=await first(env,'SELECT * FROM relay_steps WHERE id=?',submission);
    if(existing) {
      if(existing.relay_id!==relayId||existing.user_id!==user.id||existing.sha256!==digest)fail(409,'REQUEST_ID','重复提交的内容不一致');
      return response({ok:true,seq:existing.seq});
    }
    if(relay.head_seq!==expected||relay.lease_owner!==user.id||relay.lease_hash!==leaseHash||relay.lease_until<=now)fail(409,'RELAY_CONFLICT','接棒已过期或进度已更新');
    const key=`relay-saves/${relayId}/${submission}.state`;
    await env.RESOURCES.put(key,body,{httpMetadata:{contentType:'application/octet-stream',cacheControl:'no-store'}});
    await run(env,'INSERT INTO relay_steps(id,relay_id,seq,user_id,object_key,size,sha256,lease_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?)',submission,relayId,expected+1,user.id,key,body.length,digest,leaseHash,now);
    return response({ok:true,seq:expected+1});
  }
  fail(405,'METHOD','不支持此操作');
}
