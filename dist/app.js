import { back, navigate, restoreScroll, routeKey, saveScroll, startRouter } from './js/router.js';
import { loadData } from './js/store.js';
import { initializeAccount } from './js/account.js';
import { toast } from './js/ui.js';
import { render as renderHome } from './js/pages/home.js';
import { render as renderDiscover } from './js/pages/discover.js';
import { render as renderSearch } from './js/pages/search.js';
import { render as renderMy } from './js/pages/my.js';
import { render as renderDetails } from './js/pages/details.js';
import { render as renderList } from './js/pages/list.js';
import { render as renderPlay } from './js/pages/play.js';
import { render as renderCategory } from './js/pages/category.js';
import { render as renderHelp } from './js/pages/help.js';
import { render as renderAccount } from './js/pages/account.js';
import { render as renderMembership } from './js/pages/membership.js';
import { render as renderRelays } from './js/pages/relays.js';
import { render as renderModeration } from './js/pages/moderation.js';

const PAGES = {
  '/': renderHome,
  '/discover': renderDiscover,
  '/search': renderSearch,
  '/my': renderMy,
  '/details': renderDetails,
  '/list': renderList,
  '/play': renderPlay,
  '/category': renderCategory,
  '/help': renderHelp,
  '/account': renderAccount,
  '/membership': renderMembership,
  '/order': renderMembership,
  '/relays': renderRelays,
  '/moderation': renderModeration
};
const TAB_ROUTES = new Set(['/', '/discover', '/search', '/my']);

const app = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let data = null;
let view = null;
let booted = false;

function bootMarkup() {
  return `<div class="boot-screen">
    <div class="boot-logo" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <rect x="5" y="13" width="54" height="38" rx="13" fill="#3c2a1d"/>
        <rect x="9" y="17" width="46" height="30" rx="10" fill="#6b4a2e"/>
        <rect x="15" y="23" width="34" height="18" rx="6" fill="#f3ddb7"/>
        <circle cx="26" cy="30" r="3.4" fill="#3c2a1d"/>
        <circle cx="38" cy="30" r="3.4" fill="#3c2a1d"/>
        <path d="M27 36c2 2.6 8 2.6 10 0" fill="none" stroke="#3c2a1d" stroke-width="2" stroke-linecap="round"/>
        <circle cx="14" cy="20" r="2.2" fill="#f0b35a"/>
        <circle cx="50" cy="20" r="2.2" fill="#f0b35a"/>
        <circle cx="14" cy="44" r="2.2" fill="#f0b35a"/>
        <circle cx="50" cy="44" r="2.2" fill="#f0b35a"/>
      </svg>
    </div>
    <strong>一局童年</strong>
    <span>RETRO ARCADE</span>
    <i class="boot-spinner"></i>
  </div>`;
}

function updateTabbar(route) {
  const visible = TAB_ROUTES.has(route.path);
  tabbar.hidden = !visible;
  if (!visible) return;
  const active = route.path;
  for (const link of tabbar.querySelectorAll('[data-tab]')) {
    link.classList.toggle('is-active', link.dataset.tab === active);
    if (link.dataset.tab === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function updateBody(route) {
  const page = route.path === '/' ? 'home' : route.path.slice(1);
  document.body.dataset.page = page;
}

function renderError(message) {
  app.innerHTML = `<div class="fatal-screen">
    <strong>没能打开游戏平台</strong>
    <p>${message}</p>
    <button type="button" data-reload>重新加载</button>
  </div>`;
}

async function renderRoute(route, previousKey) {
  const key = routeKey(route);
  if (previousKey) saveScroll(previousKey);
  if (view?.destroy) {
    try { view.destroy(); } catch (error) { console.error(error); }
  }
  view = null;

  const factory = PAGES[route.path];
  if (!factory) {
    app.innerHTML = `<div class="fatal-screen">
      <strong>页面走丢了</strong>
      <p>这个地址没有对应的页面。</p>
      <a class="primary-pill" href="#/">回到首页</a>
    </div>`;
    tabbar.hidden = true;
    window.scrollTo(0, 0);
    return;
  }

  try {
    const result = factory({ data, query: route.query, route });
    app.replaceChildren(result.el);
    const cleanup = result.mount ? result.mount() : null;
    view = {
      el: result.el,
      destroy: () => {
        if (typeof cleanup === 'function') cleanup();
        if (typeof result.destroy === 'function') result.destroy();
      }
    };
  } catch (error) {
    console.error(error);
    renderError(error.message || '页面渲染失败');
    tabbar.hidden = true;
    return;
  }

  updateTabbar(route);
  updateBody(route);
  requestAnimationFrame(() => restoreScroll(key));
}

function setupGlobalClicks() {
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const launch = event.target.closest('[data-launch]');
    if (launch) {
      event.preventDefault();
      event.stopPropagation();
      const game = data?.gamesById.get(launch.dataset.launch);
      if (!game) return;
      if (game.playable) {
        const params = new URLSearchParams({ id: game.id });
        if (launch.dataset.slot) params.set('slot', launch.dataset.slot);
        if (launch.dataset.stage) params.set('stage', launch.dataset.stage);
        if (launch.dataset.cloud) params.set('cloud', launch.dataset.cloud);
        navigate(`/play?${params}`);
      } else {
        toast('即将上线，敬请期待');
      }
      return;
    }

    const toastButton = event.target.closest('[data-toast]');
    if (toastButton) {
      event.preventDefault();
      event.stopPropagation();
      toast(toastButton.dataset.toast || '暂未开放');
      return;
    }

    const reload = event.target.closest('[data-reload]');
    if (reload) {
      window.location.reload();
      return;
    }

    const backHome = event.target.closest('[data-back-home]');
    if (backHome) {
      event.preventDefault();
      navigate('/');
      return;
    }

    const backButton = event.target.closest('[data-back]');
    if (backButton) {
      event.preventDefault();
      back('/');
      return;
    }

    const link = event.target.closest('a[href^="#/"]');
    if (link) {
      event.preventDefault();
      navigate(link.getAttribute('href').slice(1));
    }
  });
}

async function boot() {
  if (booted) return;
  booted = true;
  app.innerHTML = bootMarkup();
  setupGlobalClicks();
  try {
    [data] = await Promise.all([loadData(), initializeAccount()]);
  } catch (error) {
    console.error(error);
    renderError(error.message || '游戏目录加载失败');
    return;
  }
  startRouter(renderRoute);
}

boot();
