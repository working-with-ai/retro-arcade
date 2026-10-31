import { getListCount, routeKey, saveListCount } from '../router.js';
import { escapeHtml, gameCard, icon, mountInfiniteList } from '../ui.js';

export function render({ data, query, route }) {
  const requested = query.get('section');
  const section = data.sections.find(item => item.id === requested) || data.sections[0];
  const games = section.gameIds.map(id => data.gamesById.get(id)).filter(Boolean);
  document.title = `${section.name} · 一局童年`;
  const el = document.createElement('div');
  el.className = 'page page-list';
  el.innerHTML = `<header class="sub-nav">
    <button class="nav-back" type="button" data-back aria-label="返回">${icon('back')}</button>
    <span class="sub-nav-title">${escapeHtml(section.name)}</span>
    <span class="sub-nav-tail"></span>
  </header>
  <main class="list-main">
    <div class="list-intro">
      <p class="eyebrow">COLLECTION</p>
      <h1>${escapeHtml(section.name)}</h1>
      <p>${escapeHtml(section.subtitle || '精选好游戏，随时开一局')}</p>
      <span>共 ${games.length} 款</span>
    </div>
    <div class="game-grid" id="section-grid"></div>
  </main>`;
  return {
    el,
    mount() {
      const key = routeKey(route || { path: '/list', query });
      const infinite = mountInfiniteList({
        host: el.querySelector('#section-grid'),
        items: games,
        pageSize: 20,
        restoreCount: getListCount(key),
        onCount: count => saveListCount(key, count),
        renderItem: game => gameCard(game)
      });
      return () => infinite.destroy();
    }
  };
}
