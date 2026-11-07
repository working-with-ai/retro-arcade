export const DAY = 86400000;
export const MAX_STATE = 4 * 1024 * 1024;
const encoder = new TextEncoder();
export const bytes = value => encoder.encode(value);
export const id = () => crypto.randomUUID();
export const hex = value => [...new Uint8Array(value)].map(x => x.toString(16).padStart(2, '0')).join('');
export const hash = async value => hex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? bytes(value) : value));
export const b64 = value => btoa(String.fromCharCode(...new Uint8Array(value)));
export const unb64 = value => Uint8Array.from(atob(value), x => x.charCodeAt(0));
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const fail = (status, code, message) => { throw new ApiError(status, code, message); };
export function response(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
export function originCheck(request) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('Origin') !== new URL(request.url).origin) fail(403, 'ORIGIN', '请从本站提交请求');
}
export async function bodyBytes(request, limit = MAX_STATE) {
  if (Number(request.headers.get('Content-Length')) > limit) fail(413, 'TOO_LARGE', '文件过大');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); fail(413, 'TOO_LARGE', '文件过大'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}
export async function jsonBody(request, limit = 65536) {
  try { const value=JSON.parse(new TextDecoder().decode(await bodyBytes(request, limit))); if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'JSON','请求格式错误');return value; }
  catch (e) { if (e instanceof ApiError) throw e; fail(400, 'JSON', '请求格式错误'); }
}
export const stmt = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
export const first = (env, sql, ...args) => stmt(env, sql, ...args).first();
export const all = async (env, sql, ...args) => (await stmt(env, sql, ...args).all()).results;
export const run = (env, sql, ...args) => stmt(env, sql, ...args).run();
export async function mac(secret, value) {
  const key = await crypto.subtle.importKey('raw', bytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, bytes(value)));
}
export function features(env) {
  const auth = env.AUTH_ENABLED === 'true' && !!env.DB && ['AUTH_SECRET', 'PHONE_ENCRYPTION_KEY', 'ALIYUN_ACCESS_KEY_ID', 'ALIYUN_ACCESS_KEY_SECRET', 'SMS_SIGN_NAME', 'SMS_TEMPLATE_CODE', 'TURNSTILE_SECRET', 'TURNSTILE_SITE_KEY'].every(k => !!env[k]);
  const payments = auth && env.PAYMENTS_ENABLED === 'true' && ['WX_MCH_ID','WX_APP_ID','WX_PRIVATE_KEY','WX_SERIAL_NO','WX_API_V3_KEY','WX_PUBLIC_KEY','WX_PUBLIC_KEY_ID','WX_APP_SECRET'].every(k => !!env[k]);
  return { auth, payments, relays: auth && env.RELAYS_ENABLED === 'true', touchEditor: true, turnstileSiteKey: auth ? env.TURNSTILE_SITE_KEY : null };
}
export function limits(user) {
  const member = user.member_until > Date.now();
  return { member, expiresAt: user.member_until, maxBytes: member ? 1073741824 : 104857600, maxSaves: member ? 3000 : 300, maxPresets: member ? 5 : 1 };
}
export async function session(request, env, required = true) {
  if (!env.DB) { if (required) fail(503, 'UNAVAILABLE', '账号服务尚未开放'); return null; }
  const token = /(?:^|;\s*)ra_session=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
  const user = token ? await first(env, 'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', await hash(token), Date.now()) : null;
  if (!user && required) fail(401, 'LOGIN_REQUIRED', '请先登录');
  return user;
}
export async function rate(env, key, max, windowMs) {
  const now = Date.now();
  const row = await first(env, 'INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count', key, now+windowMs, now, now);
  if (row.count > max) fail(429, 'RATE_LIMIT', '操作频繁，请稍后再试');
}
export const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
export function publicUser(user) { return { id: user.id, nickname: user.nickname, ...limits(user) }; }
