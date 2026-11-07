import { MAX_STATE, id, hash, first, all, run, stmt, jsonBody, bodyBytes, safeId, fail, response, limits, publicUser } from './core.js';
export async function saveAccount(env, user, gameId, slotId, body, metadata = {}) {
  if (!safeId(gameId) || !safeId(slotId) || !body.length || body.length>MAX_STATE) fail(400, 'SAVE_INVALID', '存档格式或大小不正确');
  const operation = id(), key = `account-saves/${user.id}/${operation}.state`, now = Date.now();
  await run(env, 'INSERT INTO uploads(id,user_id,game_id,slot_id,object_key,size,created_at) VALUES(?,?,?,?,?,?,?)', operation, user.id, gameId, slotId, key, body.length, now);
  try {
    await env.RESOURCES.put(key, body, { httpMetadata: { contentType: 'application/octet-stream', cacheControl: 'no-store' } });
    await env.DB.batch([
      stmt(env, `INSERT INTO saves(user_id,game_id,slot_id,object_key,size,label,created_at,seconds,operation_id)
        SELECT user_id,game_id,slot_id,object_key,size,?,?,?,id FROM uploads WHERE id=?
        ON CONFLICT(user_id,game_id,slot_id) DO UPDATE SET object_key=excluded.object_key,size=excluded.size,label=excluded.label,created_at=excluded.created_at,seconds=excluded.seconds,operation_id=excluded.operation_id`, String(metadata.label || '即时存档').slice(0,80), Number(metadata.createdAt) || now, Math.max(0, Math.floor(Number(metadata.seconds)||0)), operation),
      stmt(env, 'DELETE FROM uploads WHERE id=?', operation)
    ]);
  } catch (e) {
    // A committed object may still be referenced when a response is lost. Never delete it here.
    await run(env, 'DELETE FROM uploads WHERE id=?', operation).catch(()=>{});
    throw e;
  }
  return { ok: true, gameId, slotId };
}
export async function validateSettings(value, maxPresets, previous = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400,'SETTINGS','设置格式错误');
  const layouts = {};
  for (const platform of ['FC','GBA','街机']) {
    const list = value.layouts?.[platform]; if (list === undefined) continue;
    if (!Array.isArray(list) || list.length>5) fail(400,'SETTINGS','布局数量不正确');
    const old = previous.layouts?.[platform] || [];
    if (list.length>maxPresets) {
      // Expired subscribers can retain/export/delete saved layouts, but cannot change excess presets.
      if (list.length>old.length || list.some((x,i)=>i>=maxPresets && JSON.stringify(x)!==JSON.stringify(old.find(y=>y.id===x.id)))) fail(403,'MEMBER_REQUIRED','当前方案可编辑一套布局，额外预设将保留');
    }
    const seen = new Set();
    layouts[platform] = list.map(preset => {
      if (!safeId(preset.id) || seen.has(preset.id)) fail(400,'SETTINGS','布局标识不正确');
      seen.add(preset.id);
      const variants = {};
      for (const orientation of ['portrait','landscape']) {
        const controls = preset.variants?.[orientation] || {};
        if (typeof controls!=='object' || Array.isArray(controls) || Object.keys(controls).length>24) fail(400,'SETTINGS','布局格式错误');
        variants[orientation] = {};
        for (const [key,c] of Object.entries(controls)) {
          if (!/^(stick|a|b|c|d|e|f|l|r|turbo-a|turbo-b|combo-abc|coin|select|start|speed)$/.test(key) || !c || ![c.x,c.y,c.size,c.opacity].every(Number.isFinite) || c.x<0 || c.x>1 || c.y<0 || c.y>1 || c.size<0.6 || c.size>1.8 || c.opacity<0.2 || c.opacity>1) fail(400,'SETTINGS','按键位置或大小无效');
          variants[orientation][key] = { x:c.x,y:c.y,size:c.size,opacity:c.opacity,hidden:!!c.hidden };
        }
      }
      return { id:preset.id,name:String(preset.name||'我的布局').slice(0,20),variants };
    });
  }
  return { version:1,layouts };
}
export async function accountRoute(request, env, url, user, games) {
  const path = url.pathname;
  if (path==='/api/me') {
    if (request.method==='GET') {
      const usage=await first(env,'SELECT COUNT(*) count,COALESCE(SUM(size),0) bytes FROM saves WHERE user_id=?',user.id);
      return response({ user:publicUser(user),usage });
    }
    if (request.method==='PATCH') {
      const data=await jsonBody(request),name=String(data.nickname||'').trim();
      if (!name || name.length>20) fail(400,'NICKNAME','昵称需为1–20个字符');
      await run(env,'UPDATE users SET nickname=? WHERE id=?',name,user.id);
      return response({ user:publicUser({...user,nickname:name}) });
    }
  }
  if (path==='/api/me/settings') {
    const stored=await first(env,'SELECT * FROM settings WHERE user_id=?',user.id);
    if (request.method==='GET') return response({ revision:stored?.revision||0,value:stored?JSON.parse(stored.value):{version:1,layouts:{}} });
    if (request.method==='PUT') {
      const data=await jsonBody(request),value=await validateSettings(data.value,limits(user).maxPresets,stored?JSON.parse(stored.value):{});
      let result;
      if (!stored && data.revision===0) result=await run(env,'INSERT INTO settings(user_id,revision,value) VALUES(?,1,?) ON CONFLICT(user_id) DO NOTHING',user.id,JSON.stringify(value));
      else result=await run(env,'UPDATE settings SET revision=revision+1,value=? WHERE user_id=? AND revision=?',JSON.stringify(value),user.id,Number(data.revision));
      if (!result?.meta.changes) fail(409,'SETTINGS_CONFLICT','云端布局已更新，请选择要保留的版本');
      return response({revision:(stored?.revision||0)+1,value});
    }
  }
  if (path==='/api/me/import-sync' && request.method==='POST') {
    const data=await jsonBody(request),code=String(data.code||'').toUpperCase();
    if (!/^[A-Z2-7]{26}$/.test(code)) fail(400,'SYNC_CODE','同步码格式不正确');
    const cursor=data.cursor?String(data.cursor):undefined;
    if (cursor && cursor.length>2048) fail(400,'CURSOR','分页参数无效');
    const page=await env.RESOURCES.list({prefix:`cloud-saves/${code}/`,limit:10,cursor,include:['customMetadata']});
    let imported=0;
    for (const object of page.objects) {
      const [gameId,slotId,...rest]=object.key.slice(`cloud-saves/${code}/`.length).split('/');
      if (rest.length || !games.has(gameId) || !safeId(slotId) || object.size>MAX_STATE) continue;
      const importedSlot=`import-${(await hash(`${code}:${gameId}:${slotId}`)).slice(0,40)}`;
      if (await first(env,'SELECT 1 FROM saves WHERE user_id=? AND game_id=? AND slot_id=?',user.id,gameId,importedSlot)) continue;
      const saved=await env.RESOURCES.get(object.key); if (!saved) continue;
      await saveAccount(env,user,gameId,importedSlot,new Uint8Array(await saved.arrayBuffer()),object.customMetadata||{}); imported++;
    }
    return response({imported,cursor:page.truncated?page.cursor:null});
  }
  if (path==='/api/me/saves' && request.method==='GET') {
    const rows=await all(env,'SELECT game_id gameId,slot_id slotId,label,size,created_at createdAt,seconds FROM saves WHERE user_id=? ORDER BY created_at DESC',user.id);
    return response({saves:rows});
  }
  const match=/^\/api\/me\/saves\/([^/]+)\/([^/]+)$/.exec(path);
  if (match) {
    const [,gameId,slotId]=match;
    if (!games.has(gameId) || !safeId(slotId)) fail(404,'NOT_FOUND','存档不存在');
    if (request.method==='PUT') return response(await saveAccount(env,user,gameId,slotId,await bodyBytes(request),Object.fromEntries(url.searchParams)));
    const saved=await first(env,'SELECT * FROM saves WHERE user_id=? AND game_id=? AND slot_id=?',user.id,gameId,slotId);
    if (!saved) fail(404,'NOT_FOUND','存档不存在');
    if (request.method==='GET') {
      const object=await env.RESOURCES.get(saved.object_key);if(!object)fail(404,'NOT_FOUND','存档数据不存在');
      return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Length':String(saved.size),'X-Content-Type-Options':'nosniff'}});
    }
    if (request.method==='DELETE') {
      await run(env,'DELETE FROM saves WHERE user_id=? AND game_id=? AND slot_id=?',user.id,gameId,slotId);
      return response({ok:true}); // Unreferenced immutable blobs are swept after a grace period.
    }
  }
  fail(405,'METHOD','不支持此操作');
}
