import { getListCount, routeKey, saveListCount } from '../router.js';
import { formatDate, rankGames } from '../store.js';
import { bannerMarkup, escapeHtml, gameCard, icon, listRow, miniCard, mountInfiniteList, platformIcon, rankRow } from '../ui.js';

const TAB_NAMES = ['推荐', '上新', '榜单'];
const RANK_TABS = [
  { name: '热门榜', index: 0 },
  { name: '街机榜', index: 1 },
  { name: 'FC榜', index: 2 },
  { name: 'GBA榜', index: 3 }
];
const PLATFORM_RANK = { arcade: 1, fc: 2, gba: 3 };

function homeNav(tabsIdx) {
  const tabs = [0, 1, 2].map(index => {
    const active = index === tabsIdx ? ' is-active' : '';
    const suffix = index === 0 ? '' : `?tabsIdx=${index}`;
    return `<a class="home-tab${active}" href="#/${suffix}">${TAB_NAMES[index]}</a>`;
  }).join('');
  return `<header class="home-nav">
    <nav class="home-tabs" aria-label="首页分类">${tabs}</nav>
    <a class="nav-search" href="#/search" aria-label="搜索游戏">${icon('search')}</a>
  </header>`;
}

function bannerCarousel(data) {
  const slides = data.banners.map(banner => `<div class="banner-slide">${bannerMarkup(banner)}</div>`).join('');
  const dots = data.banners.map((banner, index) => `<button type="button" class="banner-dot ${index === 0 ? 'is-active' : ''}" data-slide="${index}" aria-label="切换到第 ${index + 1} 张推荐"></button>`).join('');
  return `<section class="banner" aria-label="精选推荐">
    <div class="banner-track">${slides}</div>
    <div class="banner-dots">${dots}</div>
  </section>`;
}

function platformRow(data) {
  return `<section class="platform-row" aria-label="游戏平台">${data.platforms.map(platform => `
    <a class="platform-card platform-${platform.theme}" href="#/?tabsIdx=2&tagsIdx=${PLATFORM_RANK[platform.theme] || 0}">
      <span class="platform-icon">${platformIcon(platform.icon)}</span>
      <span>${escapeHtml(platform.name)}</span>
    </a>`).join('')}</section>`;
}

function gridSection(title, games, moreHref = '') {
  return `<section class="game-section">
    <div class="section-head">
      <h2>${escapeHtml(title)}</h2>
      ${moreHref ? `<a class="section-more" href="${moreHref}">更多 ${icon('chevron')}</a>` : ''}
    </div>
    <div class="game-grid">${games.map(gameCard).join('')}</div>
  </section>`;
}

function miniSection(section, data) {
  const games = section.gameIds.map(id => data.gamesById.get(id)).filter(Boolean).slice(0, 6);
  return `<section class="mini-section">
    <div class="section-head">
      <h2>${escapeHtml(section.name)}</h2>
      <a class="section-more" href="#/list?section=${encodeURIComponent(section.id)}">更多 ${icon('chevron')}</a>
    </div>
    <div class="mini-row">${games.map(miniCard).join('')}</div>
  </section>`;
}

function recommendPage(data) {
  const popular = (data.popular || data.games.slice(0, 6).map(game => game.id))
    .map(id => data.gamesById.get(id))
    .filter(Boolean);
  return `<main class="home-main">
    ${bannerCarousel(data)}
    ${platformRow(data)}
    ${gridSection('大家都在玩', popular)}
    ${data.sections.map(section => miniSection(section, data)).join('')}
  </main>`;
}

function newPage() {
  return `<main class="home-main new-main">
    <div class="new-list" id="new-list"></div>
  </main>`;
}

function rankPage(tagsIdx) {
  return `<main class="home-main rank-main">
    <nav class="rank-tabs" aria-label="榜单分类">
      ${RANK_TABS.map(tab => `<a class="rank-tab ${tab.index === tagsIdx ? 'is-active' : ''}" href="#/?tabsIdx=2&tagsIdx=${tab.index}">${tab.name}</a>`).join('')}
    </nav>
    <div class="rank-list" id="rank-list"></div>
  </main>`;
}

export function render({ data, query, route }) {
  const tabsIdx = Math.min(2, Math.max(0, Number(query.get('tabsIdx')) || 0));
  const tagsIdx = Math.min(3, Math.max(0, Number(query.get('tagsIdx')) || 0));
  document.title = tabsIdx === 0
    ? '一局童年 · 经典游戏平台'
    : `${TAB_NAMES[tabsIdx]} · 一局童年`;

  const el = document.createElement('div');
  el.className = 'page page-home';
  el.innerHTML = `${homeNav(tabsIdx)}${tabsIdx === 0 ? recommendPage(data) : tabsIdx === 1 ? newPage() : rankPage(tagsIdx)}`;

  return {
    el,
    mount() {
      const key = routeKey(route || { path: '/', query });
      if (tabsIdx === 1) {
        const sorted = [...data.games].sort((a, b) => {
          if (a.releaseDate === b.releaseDate) return b.players - a.players;
          return String(b.releaseDate).localeCompare(String(a.releaseDate));
        });
        const host = el.querySelector('#new-list');
        const infinite = mountInfiniteList({
          host,
          items: sorted,
          pageSize: 20,
          restoreCount: getListCount(key),
          onCount: count => saveListCount(key, count),
          renderItem: (game, index) => {
            const previous = index > 0 ? sorted[index - 1] : null;
            const date = !previous || previous.releaseDate !== game.releaseDate
              ? `<h2 class="date-title">${formatDate(game.releaseDate)}</h2>`
              : '';
            return `${date}${listRow(game, { button: '', showTags: true, className: 'new-row' })}`;
          }
        });
        return () => infinite.destroy();
      }
      if (tabsIdx === 2) {
        const games = rankGames(data, tagsIdx);
        const host = el.querySelector('#rank-list');
        const infinite = mountInfiniteList({
          host,
          items: games,
          pageSize: 20,
          restoreCount: getListCount(key),
          onCount: count => saveListCount(key, count),
          renderItem: (game, index) => rankRow(game, index)
        });
        return () => infinite.destroy();
      }
      const banner = el.querySelector('.banner');
      const track = el.querySelector('.banner-track');
      if (!banner || !track) return undefined;
      const dots = [...el.querySelectorAll('.banner-dot')];
      const count = dots.length;
      let index = 0;
      let timer = null;
      let startX = null;

      const go = next => {
        index = (next + count) % count;
        track.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
      };
      const start = () => {
        if (count < 2) return;
        stop();
        timer = setInterval(() => go(index + 1), 4200);
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };
      const onDot = event => {
        const button = event.target.closest('[data-slide]');
        if (!button) return;
        event.preventDefault();
        go(Number(button.dataset.slide));
        start();
      };
      const onDown = event => { startX = event.clientX; };
      const onUp = event => {
        if (startX == null) return;
        const distance = event.clientX - startX;
        startX = null;
        if (Math.abs(distance) > 34) {
          go(index + (distance < 0 ? 1 : -1));
          start();
        }
      };
      const onVisibility = () => {
        if (document.hidden) stop();
        else start();
      };

      banner.addEventListener('click', onDot);
      banner.addEventListener('pointerdown', onDown, { passive: true });
      banner.addEventListener('pointerup', onUp, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      start();

      return () => {
        stop();
        banner.removeEventListener('click', onDot);
        banner.removeEventListener('pointerdown', onDown);
        banner.removeEventListener('pointerup', onUp);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }
  };
}
