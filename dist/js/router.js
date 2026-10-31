const listeners = new Set();
const scrollPositions = new Map();
const listCounts = new Map();
const historyStack = [];
let currentKey = '';

function readRoute() {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const source = raw || '/';
  const question = source.indexOf('?');
  const path = (question >= 0 ? source.slice(0, question) : source) || '/';
  const query = new URLSearchParams(question >= 0 ? source.slice(question + 1) : '');
  return { path, query, hash: source };
}

function routeKey(route) {
  const query = route.query.toString();
  return query ? `${route.path}?${query}` : route.path;
}

function emit() {
  const route = readRoute();
  const previousKey = currentKey;
  currentKey = routeKey(route);
  for (const listener of listeners) listener(route, previousKey);
}

function go(path) {
  const next = `#${path}`;
  if (location.hash === next) {
    emit();
    return;
  }
  location.hash = next;
}

export function currentRoute() {
  return readRoute();
}

export function navigate(path) {
  if (currentKey) historyStack.push(currentKey);
  if (historyStack.length > 30) historyStack.shift();
  go(path);
}

export function replace(path, { silent = false } = {}) {
  const next = `#${path}`;
  if (location.hash === next) return;
  history.replaceState(null, '', next);
  if (silent) currentKey = routeKey(readRoute());
  else emit();
}

export function back(fallback = '/') {
  let previous = '';
  while (historyStack.length) {
    const candidate = historyStack.pop();
    if (candidate && candidate !== currentKey) {
      previous = candidate;
      break;
    }
  }
  go(previous || fallback);
}

export function saveScroll(key = currentKey) {
  if (!key) return;
  scrollPositions.set(key, window.scrollY || 0);
}

export function restoreScroll(key) {
  window.scrollTo(0, scrollPositions.get(key) || 0);
}

export function saveListCount(key, count) {
  if (!key) return;
  const value = Math.max(0, Number(count) || 0);
  if (value) listCounts.set(key, value);
  else listCounts.delete(key);
}

export function getListCount(key) {
  return listCounts.get(key) || 0;
}

export function startRouter(listener) {
  listeners.add(listener);
  // hash 导航和前进后退都会触发 hashchange；再监听 popstate 会让同一次导航渲染两次
  const onChange = () => emit();
  window.addEventListener('hashchange', onChange);
  if (!location.hash) history.replaceState(null, '', '#/');
  currentKey = routeKey(readRoute());
  listener(readRoute());
  return () => {
    listeners.delete(listener);
    window.removeEventListener('hashchange', onChange);
  };
}

export { routeKey };
