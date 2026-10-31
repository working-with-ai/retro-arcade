const HISTORY_KEY = 'ra:history';
const SEARCH_KEY = 'ra:search';
const SAVES_KEY = 'ra:saves';

let dataPromise;

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export function loadData() {
  if (!dataPromise) {
    dataPromise = fetch(new URL('games.json', document.baseURI), { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`游戏目录加载失败 (${response.status})`);
        return response.json();
      })
      .then(data => {
        data.gamesById = new Map(data.games.map(game => [game.id, game]));
        return data;
      })
      .catch(error => {
        dataPromise = null;
        throw error;
      });
  }
  return dataPromise;
}

export function getHistory() {
  const history = readJSON(HISTORY_KEY, []);
  if (!Array.isArray(history)) return [];
  return history
    .filter(item => item && typeof item.id === 'string')
    .map(item => ({
      id: item.id,
      lastPlayed: Number(item.lastPlayed) || 0,
      seconds: Math.max(0, Number(item.seconds) || 0)
    }))
    .sort((a, b) => b.lastPlayed - a.lastPlayed);
}

function writeHistory(history) {
  writeJSON(HISTORY_KEY, history.slice(0, 40));
}

export function recordPlay(id) {
  const history = getHistory();
  const existing = history.find(item => item.id === id);
  if (existing) {
    existing.lastPlayed = Date.now();
  } else {
    history.unshift({ id, lastPlayed: Date.now(), seconds: 0 });
  }
  writeHistory(history);
}

export function addPlayTime(id, seconds) {
  if (!seconds || seconds < 0) return;
  const history = getHistory();
  const existing = history.find(item => item.id === id);
  if (existing) {
    existing.lastPlayed = Date.now();
    existing.seconds += seconds;
  } else {
    history.unshift({ id, lastPlayed: Date.now(), seconds });
  }
  writeHistory(history);
}

export function getSearchHistory() {
  const history = readJSON(SEARCH_KEY, []);
  return Array.isArray(history) ? history.filter(item => typeof item === 'string').slice(0, 10) : [];
}

export function addSearchTerm(term) {
  const clean = String(term || '').trim();
  if (!clean) return;
  const history = getSearchHistory().filter(item => item !== clean);
  history.unshift(clean);
  writeJSON(SEARCH_KEY, history.slice(0, 10));
}

export function clearSearchHistory() {
  writeJSON(SEARCH_KEY, []);
}

export function getSaveSlots(gameId) {
  return getAllSaveSlots().filter(slot => slot.gameId === gameId);
}

export function getAllSaveSlots() {
  const slots = readJSON(SAVES_KEY, []);
  if (!Array.isArray(slots)) return [];
  return slots
    .filter(slot => slot && slot.gameId && slot.id)
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}

export function removeSaveSlot(gameId, slotId) {
  const slots = getAllSaveSlots().filter(slot => !(slot.gameId === gameId && slot.id === slotId));
  writeJSON(SAVES_KEY, slots);
}

export function updateSaveSlot(gameId, slotId, patch = {}) {
  const slots = getAllSaveSlots();
  const slot = slots.find(item => item.gameId === gameId && item.id === slotId);
  if (!slot) return null;
  Object.assign(slot, patch);
  writeJSON(SAVES_KEY, slots);
  return slot;
}

export function addSaveSlot(slot) {
  const slots = readJSON(SAVES_KEY, []);
  const list = Array.isArray(slots) ? slots : [];
  list.unshift(slot);
  const perGame = new Map();
  const trimmed = list.filter(item => {
    if (!item || !item.gameId) return false;
    const count = perGame.get(item.gameId) || 0;
    perGame.set(item.gameId, count + 1);
    return count < 5;
  });
  writeJSON(SAVES_KEY, trimmed.slice(0, 30));
}

export function platformSlug(platform) {
  if (platform === '街机') return 'arcade';
  if (platform === 'FC') return 'fc';
  return 'gba';
}

export function formatPlayers(value) {
  return String(Number(value) || 0);
}

export function formatPlayTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total >= 3600) {
    const hours = total / 3600;
    return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1).replace('.0', '')}h`;
  }
  if (total > 0 && total < 60) return '不到1min';
  return `${Math.floor(total / 60)}min`;
}

export function formatRelativeTime(timestamp) {
  const value = Number(timestamp) || 0;
  if (!value) return '刚刚';
  const diff = Math.max(0, Date.now() - value);
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`;
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export function formatClock(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function searchGames(data, term) {
  const clean = String(term || '').trim().toLowerCase();
  if (!clean) return [];
  return data.games
    .filter(game => {
      const haystack = [game.name, game.shortName, game.platform, ...(game.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(clean);
    })
    .sort((a, b) => b.players - a.players);
}

export function rankGames(data, tagIndex) {
  const platform = ['', '街机', 'FC', 'GBA'][Number(tagIndex)] || '';
  const list = data.games.filter(game => !platform || game.platform === platform);
  return list.sort((a, b) => b.players - a.players);
}
