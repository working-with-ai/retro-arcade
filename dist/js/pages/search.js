import { getListCount, navigate, replace, saveListCount } from '../router.js';
import {
  addSearchTerm,
  clearSearchHistory,
  getSearchHistory,
  rankGames,
  searchGames
} from '../store.js';
import {
  bannerMarkup,
  coverMarkup,
  emptyState,
  escapeHtml,
  icon,
  listRow,
  mountInfiniteList,
  toast
} from '../ui.js';

function historyBlock(history) {
  return `<div class="search-history-block">
    <div class="search-block-head">
      <h2>历史记录</h2>
      ${history.length ? `<button class="text-button" type="button" data-clear-history>清空</button>` : ''}
    </div>
    ${history.length
      ? `<div class="history-chips">${history.map(term => `<button type="button" class="history-chip" data-term="${escapeHtml(term)}">${escapeHtml(term)}</button>`).join('')}</div>`
      : '<p class="search-history-empty">暂无历史记录</p>'}
  </div>`;
}

function hotBlock(data) {
  const hot = rankGames(data, 0).slice(0, 8);
  return `<section class="hot-section">
    <h2 class="hot-title">${icon('flame')}<span>热搜榜</span></h2>
    <div class="hot-grid">
      ${hot.map((game, index) => `<a class="hot-item" href="#/details?id=${encodeURIComponent(game.id)}">
        <span class="hot-no ${index < 3 ? 'is-top' : ''}">${index + 1}</span>
        ${coverMarkup(game, { variant: 'mini' })}
        <span class="hot-name">${escapeHtml(game.name)}</span>
      </a>`).join('')}
    </div>
  </section>`;
}

function resultsHead(games) {
  if (!games.length) return '';
  return `<div class="search-result-head"><h2>搜索结果</h2><span>${games.length} 款</span></div>`;
}

export function render({ data, query }) {
  const initialTerm = (query.get('q') || '').trim();
  document.title = initialTerm ? `${initialTerm} · 搜索 · 一局童年` : '搜索 · 一局童年';
  const history = getSearchHistory();
  const promo = {
    ...(data.banners[0] || {}),
    title: '经典游戏合集',
    subtitle: '挑一款，马上开玩',
    kicker: "EDITOR'S PICK",
    theme: 'sun',
    art: 'pad',
    gameId: 'pokemon-dark-phantom'
  };

  const el = document.createElement('div');
  el.className = 'page page-search';
  el.innerHTML = `<header class="search-header">
    <form class="search-form" role="search">
      <label class="search-input">
        ${icon('search')}
        <input id="search-input" type="search" name="q" value="${escapeHtml(initialTerm)}" placeholder="搜索游戏名称、平台" autocomplete="off" enterkeyhint="search">
      </label>
      <button class="search-submit" type="submit">搜索</button>
    </form>
  </header>
  <main class="search-main">
    <section class="search-results ${initialTerm ? '' : 'is-hidden'}" id="search-results">
      <div id="search-result-head"></div>
      <div class="search-result-list" id="search-result-list"></div>
    </section>
    <section class="search-idle ${initialTerm ? 'is-hidden' : ''}" id="search-idle">
      ${historyBlock(history)}
      <div class="search-promo">
        ${bannerMarkup(promo, { staticMode: false })}
      </div>
      ${hotBlock(data)}
    </section>
  </main>`;

  return {
    el,
    mount() {
      const form = el.querySelector('.search-form');
      const input = el.querySelector('#search-input');
      const idle = el.querySelector('#search-idle');
      const resultsEl = el.querySelector('#search-results');
      const resultHead = el.querySelector('#search-result-head');
      const resultList = el.querySelector('#search-result-list');
      const historyHost = el.querySelector('.search-history-block');
      let infinite = null;

      const showResults = term => {
        const games = searchGames(data, term);
        if (infinite) {
          infinite.destroy();
          infinite = null;
        }
        resultHead.innerHTML = resultsHead(games);
        resultList.innerHTML = '';
        resultsEl.classList.toggle('is-hidden', !term);
        idle.classList.toggle('is-hidden', Boolean(term));
        if (!term) return;
        if (!games.length) {
          resultList.innerHTML = emptyState('没有找到相关游戏', '换个关键词试试，或看看热搜榜');
          return;
        }
        const key = `/search?${new URLSearchParams({ q: term })}`;
        infinite = mountInfiniteList({
          host: resultList,
          items: games,
          pageSize: 20,
          restoreCount: getListCount(key),
          onCount: count => saveListCount(key, count),
          renderItem: game => listRow(game, { button: '启动', showTags: true, className: 'search-row' })
        });
      };

      const commit = term => {
        const clean = String(term || '').trim();
        if (!clean) {
          toast('输入游戏名称再搜索');
          input.focus();
          return;
        }
        addSearchTerm(clean);
        navigate(`/search?q=${encodeURIComponent(clean)}`);
      };

      const onInput = () => {
        const term = input.value.trim();
        showResults(term);
        // 只同步地址不重绘，返回时按实际输入恢复结果
        replace(term ? `/search?q=${encodeURIComponent(term)}` : '/search', { silent: true });
      };
      const onSubmit = event => {
        event.preventDefault();
        commit(input.value);
      };
      const onClick = event => {
        const clearButton = event.target.closest('[data-clear-history]');
        if (clearButton) {
          clearSearchHistory();
          historyHost.innerHTML = `<div class="search-block-head"><h2>历史记录</h2></div><p class="search-history-empty">暂无历史记录</p>`;
          return;
        }
        const chip = event.target.closest('[data-term]');
        if (chip) {
          input.value = chip.dataset.term;
          commit(chip.dataset.term);
        }
      };

      input.addEventListener('input', onInput);
      form.addEventListener('submit', onSubmit);
      idle.addEventListener('click', onClick);
      showResults(initialTerm);

      return () => {
        input.removeEventListener('input', onInput);
        form.removeEventListener('submit', onSubmit);
        idle.removeEventListener('click', onClick);
        if (infinite) infinite.destroy();
      };
    }
  };
}
