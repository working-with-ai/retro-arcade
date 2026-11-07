import { getListCount, routeKey, saveListCount } from '../router.js';
import { bannerMarkup, icon, listRow, mountInfiniteList } from '../ui.js';

export function render({ data, route, query }) {
  document.title = '爽玩宝库 · 一局童年';
  const games = data.discover.map(id => data.gamesById.get(id)).filter(Boolean);
  const feature = data.banners.find(banner => banner.id === 'challenge') || data.banners[0];
  const el = document.createElement('div');
  el.className = 'page page-discover';
  el.innerHTML = `<header class="sub-header">
    <h1>爽玩宝库</h1><a class="catalog-entry" href="#/category">全部分类 ${icon('chevron')}</a>
  </header>
  <main class="discover-main">
    <a class="relay-discover-entry" href="#/relays"><strong>挑战接力</strong><span>一份存档，一起继续闯关 ${icon('chevron')}</span></a>
    <a class="feature-banner" href="#/list?section=classic" aria-label="打开速通挑战专题">
      ${bannerMarkup(feature, { staticMode: true })}
    </a>
    <div class="discover-list" id="discover-list"></div>
    <p class="discover-foot">${icon('gamepad')}<span>更多经典游戏正在路上</span></p>
  </main>`;
  return {
    el,
    mount() {
      const key = routeKey(route || { path: '/discover', query });
      const infinite = mountInfiniteList({
        host: el.querySelector('#discover-list'),
        items: games,
        pageSize: 10,
        restoreCount: getListCount(key),
        onCount: count => saveListCount(key, count),
        renderItem: game => listRow(game, { button: '去玩', showHeat: true, showTags: false, className: 'discover-row' })
      });
      return () => infinite.destroy();
    }
  };
}
