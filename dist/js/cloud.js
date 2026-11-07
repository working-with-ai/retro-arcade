import { getAllSaveSlots } from './store.js';
import { readSaveBytes } from './saves.js';
import { accountUser, api } from './account.js';

const SYNC_KEY = 'ra:sync-code';
const CODE_PATTERN = /^[A-Z2-7]{26}$/;
const ACCOUNT_SYNC_MODE = '@account';

export function normalizeSyncCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

export function getSyncCode() {
  if (accountUser()) return ACCOUNT_SYNC_MODE;
  return getLegacySyncCode();
}

export function getLegacySyncCode() {
  try {
    const code = normalizeSyncCode(localStorage.getItem(SYNC_KEY));
    return CODE_PATTERN.test(code) ? code : '';
  } catch {
    return '';
  }
}

export function setSyncCode(code) {
  const clean = normalizeSyncCode(code);
  if (!CODE_PATTERN.test(clean)) throw new Error('同步码格式不正确');
  localStorage.setItem(SYNC_KEY, clean);
  return clean;
}

export function clearSyncCode() {
  try { localStorage.removeItem(SYNC_KEY); } catch {}
}

async function readError(response) {
  try {
    const data = await response.json();
    return data.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function checked(response) {
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

export async function createSyncCode() {
  const response = await checked(await fetch('/api/sync', { method: 'POST' }));
  const data = await response.json();
  if (!CODE_PATTERN.test(data.code)) throw new Error('同步码生成失败');
  return data.code;
}

export async function listCloudSaves(code = getSyncCode()) {
  if (code === ACCOUNT_SYNC_MODE) return (await api('/api/me/saves')).saves;
  if (!code) return [];
  const response = await checked(await fetch(`/api/sync/${encodeURIComponent(code)}`));
  const data = await response.json();
  return Array.isArray(data.saves) ? data.saves : [];
}

export async function uploadCloudSave(slot, contents, code = getSyncCode()) {
  if (!code) return false;
  const query = new URLSearchParams({
    label: slot.label || '即时存档',
    createdAt: String(slot.createdAt || Date.now()),
    seconds: String(Math.max(0, Number(slot.seconds) || 0))
  });
  if (code === ACCOUNT_SYNC_MODE) {
    await api(`/api/me/saves/${encodeURIComponent(slot.gameId)}/${encodeURIComponent(slot.id)}?${query}`, {method:'PUT',body:contents});
    return true;
  }
  const url = `/api/sync/${encodeURIComponent(code)}/${encodeURIComponent(slot.gameId)}/${encodeURIComponent(slot.id)}?${query}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: contents
  });
  await checked(response);
  return true;
}

export async function downloadCloudSave(gameId, slotId, code = getSyncCode(), signal) {
  if (code === ACCOUNT_SYNC_MODE) return api(`/api/me/saves/${encodeURIComponent(gameId)}/${encodeURIComponent(slotId)}`, {signal});
  if (!code) throw new Error('还没有开启云存档同步');
  const url = `/api/sync/${encodeURIComponent(code)}/${encodeURIComponent(gameId)}/${encodeURIComponent(slotId)}`;
  const response = await checked(await fetch(url, { signal }));
  return new Uint8Array(await response.arrayBuffer());
}

export async function deleteCloudSave(gameId, slotId, code = getSyncCode()) {
  if (code === ACCOUNT_SYNC_MODE) { await api(`/api/me/saves/${encodeURIComponent(gameId)}/${encodeURIComponent(slotId)}`, {method:'DELETE'}); return; }
  if (!code) throw new Error('还没有开启云存档同步');
  const url = `/api/sync/${encodeURIComponent(code)}/${encodeURIComponent(gameId)}/${encodeURIComponent(slotId)}`;
  await checked(await fetch(url, { method: 'DELETE' }));
}

export async function syncLocalSaves(code = getSyncCode()) {
  if (!code) throw new Error('还没有开启云存档同步');
  const slots = getAllSaveSlots();
  let uploaded = 0;
  for (const slot of slots) {
    const contents = await readSaveBytes(slot.gameId, slot.id);
    if (!contents || !contents.length) continue;
    await uploadCloudSave(slot, contents, code);
    uploaded += 1;
  }
  return uploaded;
}
