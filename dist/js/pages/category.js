import { catalogFilters, catalogHref, catalogPlatforms, catalogTypes, filterCatalog, SORT_OPTIONS } from '../catalog.js';
import { getListCount, routeKey, saveListCount } from '../router.js';
import { emptyState, escapeHtml, icon, listRow, mountInfiniteList } from '../ui.js';

function filterRow(label, key, options, filters) {
  return `<nav class="catalog-filter-row" aria-label="${label}">
    <span class="catalog-filter-label">${label}</span>
    <div class="catalog-options">${options.map(option => {
      const active = filters[key] === option.id;
      return `<a class="catalog-chip${active ? ' is-active' : ''}" href="${escapeHtml(catalogHref('/category', { ...filters, [key]: option.id }))}"${active ? ' aria-current="true"' : ''}>${escapeHtml(option.name)}</a>`;
    }).join('')}</div>
  </nav>`;
}

export function render({ data, query, route }) {
  const filters = catalogFilters(data, query);
  const games = filterCatalog(data.games, filters);
  document.title = `${filters.platform || '全部游戏'} · 分类 · 一局童年`;
  const el = document.createElement('div');
  el.className = 'page page-category';
  el.innerHTML = `<header class="catalog-header">
    <button type="button" class="catalog-back" data-back aria-label="返回">${icon('back')}</button>
    <h1>游戏分类</h1>
    <a class="catalog-back" href="#/search" aria-label="搜索游戏">${icon('search')}</a>
  </header>
  <main class="catalog-main">
    <section class="catalog-filters" aria-label="筛选游戏">
      ${filterRow('平台', 'platform', [{ id: '', name: '全部' }, ...catalogPlatforms(data).map(id => ({ id, name: id }))], filters)}
      ${filterRow('类型', 'type', [{ id: '', name: '全部' }, ...catalogTypes(data).map(id => ({ id, name: id }))], filters)}
      ${filterRow('排序', 'sort', SORT_OPTIONS, filters)}
    </section>
    <div class="catalog-result-head"><h2>${escapeHtml(filters.platform || '全部游戏')}</h2><span>${games.length} 款</span><a href="#/category">重置筛选</a></div>
    <div id="catalog-list" class="catalog-list">${games.length ? '' : `${emptyState('这个分类还没有游戏', '换个平台或类型试试')}<a class="primary-pill" href="#/category">查看全部游戏</a>`}</div>
  </main>`;
  return {
    el,
    mount() {
      if (!games.length) return;
      const key = routeKey(route || { path: '/category', query });
      const list = mountInfiniteList({
        host: el.querySelector('#catalog-list'), items: games, pageSize: 20,
        restoreCount: getListCount(key), onCount: count => saveListCount(key, count),
        renderItem: game => listRow(game, { button: '启动', showTags: true })
      });
      return () => list.destroy();
    }
  };
}
