import { DAY, bytes, b64, unb64, id, hash, mac, first, run, stmt, jsonBody, fail, response, features, session, sessionToken, rate, publicUser } from './core.js';
async function encryptPhone(phone, secret) {
  const key = await crypto.subtle.importKey('raw', unb64(secret), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return `${b64(iv)}.${b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes(phone)))}`;
}
export async function sendSms(env, phone, code) {
  const body = new URLSearchParams({ PhoneNumbers: phone.slice(3), SignName: env.SMS_SIGN_NAME, TemplateCode: env.SMS_TEMPLATE_CODE, TemplateParam: JSON.stringify({ code }) }).toString();
  const headers = { 'content-type': 'application/x-www-form-urlencoded', host: 'dysmsapi.aliyuncs.com', 'x-acs-action': 'SendSms', 'x-acs-version': '2017-05-25', 'x-acs-date': new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), 'x-acs-signature-nonce': id(), 'x-acs-content-sha256': await hash(body) };
  const names = Object.keys(headers).sort();
  const canonical = `POST\n/\n\n${names.map(k => `${k}:${headers[k].trim()}\n`).join('')}\n${names.join(';')}\n${headers['x-acs-content-sha256']}`;
  headers.authorization = `ACS3-HMAC-SHA256 Credential=${env.ALIYUN_ACCESS_KEY_ID},SignedHeaders=${names.join(';')},Signature=${await mac(env.ALIYUN_ACCESS_KEY_SECRET, `ACS3-HMAC-SHA256\n${await hash(canonical)}`)}`;
  const res = await fetch('https://dysmsapi.aliyuncs.com/', { method: 'POST', headers, body });
  const data = await res.json();
  if (!res.ok || data.Code !== 'OK') fail(502, 'SMS_FAILED', '验证码发送失败，请稍后重试');
}
export async function authRoute(request, env, url) {
  if (request.method !== 'POST') fail(405, 'METHOD', '不支持此操作');
  if (url.pathname === '/api/auth/logout') {
    if(!env.DB)fail(503,'UNAVAILABLE','账号服务尚未开放');
    const token = sessionToken(request);
    if (token) await run(env, 'DELETE FROM sessions WHERE token_hash=?', await hash(token));
    return response({ ok: true }, 200, { 'Set-Cookie': 'ra_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
  }
  if (!features(env).auth) fail(503, 'UNAVAILABLE', '短信登录尚未开放');
  const data = await jsonBody(request);
  const phone = String(data.phone || '').replace(/^\+86/, '');
  if (!/^1[3-9]\d{9}$/.test(phone)) fail(400, 'PHONE', '请输入有效的中国大陆手机号');
  const normalized = `+86${phone}`, phoneKey = await mac(env.AUTH_SECRET, `phone:${normalized}`), now = Date.now();
  const ipKey = await mac(env.AUTH_SECRET, `ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
  if (url.pathname === '/api/auth/sms') {
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(data.turnstileToken || ''), remoteip: request.headers.get('CF-Connecting-IP') || '' }) });
    const verified = await check.json();
    if (!verified.success || verified.hostname !== url.hostname || verified.action !== 'sms_login') fail(400, 'HUMAN_CHECK', '请完成人机验证');
    await rate(env, `sms:minute:${phoneKey}`, 1, 60000);
    await rate(env, `sms:day:${phoneKey}`, 10, DAY);
    await rate(env, `sms:ip:${ipKey}`, 30, DAY);
    const random = new Uint32Array(1); let value;
    do { crypto.getRandomValues(random); value = random[0]; } while (value >= 4294000000);
    const code = String(value % 1000000).padStart(6, '0'), codeId = id();
    await env.DB.batch([
      stmt(env, 'UPDATE sms_codes SET used=1 WHERE phone_key=?', phoneKey),
      stmt(env, 'INSERT INTO sms_codes(id,phone_key,code_hash,phone_enc,created_at,expires_at) VALUES(?,?,?,?,?,?)', codeId, phoneKey, await mac(env.AUTH_SECRET, `${codeId}:${code}`), await encryptPhone(normalized, env.PHONE_ENCRYPTION_KEY), now, now+300000)
    ]);
    try { await sendSms(env, normalized, code); } catch (e) { await run(env, 'UPDATE sms_codes SET used=1 WHERE id=?', codeId); throw e; }
    return response({ ok: true, retryAfter: 60, expiresIn: 300 });
  }
  if (url.pathname !== '/api/auth/verify') fail(404, 'NOT_FOUND', '接口不存在');
  await rate(env, `verify:ip:${ipKey}`, 60, 60000);
  const code = await first(env, 'SELECT * FROM sms_codes WHERE phone_key=? ORDER BY created_at DESC LIMIT 1', phoneKey);
  if (!code || code.used || code.expires_at <= now || code.attempts >= 5) fail(400, 'OTP_INVALID', '验证码错误或已失效');
  const attempted = await first(env, 'UPDATE sms_codes SET attempts=attempts+1 WHERE id=? AND used=0 AND attempts<5 AND expires_at>? RETURNING id', code.id, now);
  if (!attempted || !/^\d{6}$/.test(String(data.code)) || await mac(env.AUTH_SECRET, `${code.id}:${data.code}`) !== code.code_hash) fail(400, 'OTP_INVALID', '验证码错误或已失效');
  const consumed = await first(env, 'UPDATE sms_codes SET used=1 WHERE id=? AND used=0 RETURNING id', code.id);
  if (!consumed) fail(400, 'OTP_INVALID', '验证码已使用');
  await run(env, 'INSERT INTO users(id,phone_key,phone_enc,nickname,created_at) VALUES(?,?,?,?,?) ON CONFLICT(phone_key) DO NOTHING', id(), phoneKey, code.phone_enc, `玩家${id().slice(0,4)}`, now);
  const user = await first(env, 'SELECT * FROM users WHERE phone_key=?', phoneKey), token = id()+id();
  await run(env, 'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', await hash(token), user.id, now+30*DAY);
  return response({ user: publicUser(user) }, 200, { 'Set-Cookie': `ra_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` });
}
