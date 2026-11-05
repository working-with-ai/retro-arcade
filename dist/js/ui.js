const ICON_PATHS = {
  home: '<path d="M4 11.2 12 4l8 7.2"/><path d="M6.4 10.5V20h11.2v-9.5"/><path d="M10.2 20v-5.1h3.6V20"/>',
  compass: '<circle cx="12" cy="12" r="8.2"/><path d="m14.8 9.2-1.8 4-4 1.8 1.8-4z"/>',
  search: '<circle cx="11" cy="11" r="6.4"/><path d="m15.8 15.8 4.1 4.1"/>',
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5.6 20c.5-3.4 3-5.3 6.4-5.3s5.9 1.9 6.4 5.3"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  chevron: '<path d="m9.5 5 7 7-7 7"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  flame: '<path d="M12.2 3.2c.5 3-1.8 4.1-2.8 6.2-.9 1.8-.2 3.1 1.1 3.5-.2-1.3.5-2.3 1.5-3.2.1 2.4 2.7 3.4 2.7 5.9 0 2.2-1.7 3.7-3.9 3.7-2.6 0-4.5-2-4.5-4.7 0-2.3 1.2-4.1 2.6-5.7 1.6-1.8 3-3.2 3.3-5.7z" fill="currentColor" stroke="none"/>',
  play: '<path d="M8.2 5.3 19 12 8.2 18.7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3"/>',
  volume: '<path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M15.5 9c1 .8 1.5 1.9 1.5 3s-.5 2.2-1.5 3"/><path d="M18.5 6.8c1.7 1.4 2.6 3.2 2.6 5.2s-.9 3.8-2.6 5.2"/>',
  fullscreen: '<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/>',
  save: '<path d="M5 4h10.5L19 7.5V20H5z"/><path d="M8.2 4v6h7V4M8.2 20v-6h7.6v6"/>',
  load: '<path d="M5 4h10.5L19 7.5V20H5z"/><path d="M8.2 4v6h7V4"/><path d="m9 14 3 3 3-3"/><path d="M12 17v-4.2"/>',
  download: '<path d="M12 4v10.5M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  upload: '<path d="M12 16V5.5M8 9l4-4 4 4"/><path d="M5 19h14"/>',
  speed: '<path d="m13.2 3-7 10h5.2L10.8 21l7-11h-5.2z"/>',
  touch: '<rect x="7" y="3.5" width="10" height="17" rx="2.2"/><path d="M10 6.2h4M10.5 17.5h3"/>',
  gamepad: '<path d="M7.2 8h9.6c2.8 0 4.2 2.4 4.7 5.4.5 3.3-.8 5.6-2.8 5.6-1.5 0-2.3-1-3.1-2.2H8.4C7.6 18 6.8 19 5.3 19c-2 0-3.3-2.3-2.8-5.6C3 10.4 4.4 8 7.2 8z"/><path d="M7.4 11.2v4M5.4 13.2h4M16.2 12h.1M18.1 14h.1"/>',
  arcade: '<path d="M9 14.5h6v6.2H9z" fill="currentColor" stroke="none"/><path d="M12 4.2v9.4M12 4.2c2.2 0 3.6 1.4 3.6 3.1S14.2 10.4 12 10.4 8.4 9 8.4 7.3 9.8 4.2 12 4.2z" fill="currentColor" stroke="none"/><circle cx="21" cy="16" r="2" fill="currentColor" stroke="none"/><circle cx="21" cy="21" r="2" fill="currentColor" stroke="none"/><circle cx="4" cy="18.5" r="1.6" fill="currentColor" stroke="none"/>',
  fc: '<rect x="3.5" y="9.5" width="25" height="13" rx="6"/><path d="M8.5 13v6M5.5 16h6"/><circle cx="21.5" cy="14.5" r="1.8"/><circle cx="24.8" cy="18" r="1.8"/><path d="M9 7.5h14l2 2"/>',
  gba: '<rect x="3" y="5.5" width="26" height="21" rx="5"/><rect x="8" y="9.5" width="16" height="10" rx="1.5"/><path d="M7 18.5h4M9 16.5v4"/><circle cx="23.5" cy="17.5" r="1.5"/><circle cx="26" cy="20" r="1.5"/>',
  question: '<circle cx="12" cy="12" r="8.4"/><path d="M9.8 9.2c.3-1.4 1.5-2.2 3-2 1.4.2 2.3 1.4 2.1 2.8-.2 1.5-1.8 1.8-2.5 2.8-.4.6-.4 1.2-.4 1.7"/><circle cx="12" cy="17.2" r=".8" fill="currentColor" stroke="none"/>',
  trash: '<path d="M5 7h14M9.5 7V5h5v2M7.5 7l.8 12.5h7.4L16.5 7M10.5 10v6.5M13.5 10v6.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  spark: '<path d="m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/><path d="M18.5 3.5v3M17 5h3"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2.2"/><path d="M6.5 9.5h.1M9.5 9.5h.1M12.5 9.5h.1M15.5 9.5h.1M18 9.5h.1M6.5 13h.1M9.5 13h.1M12.5 13h.1M15.5 13h.1M18 13h.1M8 16.5h8"/>',
  screen: '<rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>',
  reload: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v5h-5"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5h16v10H4z"/><path d="M9 19.5v-5h6v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10z"/><path d="m13.8 7.2 3.5 3.5"/>',
  speakerOff: '<path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  finger: '<path d="M9.2 12.5V5.2a1.5 1.5 0 0 1 3 0v6.3l.2-1.6a1.4 1.4 0 0 1 2.8.3v1.3l.3-.9a1.4 1.4 0 0 1 2.7.6v1.2l.4-.6a1.3 1.3 0 0 1 2.4.9v2.7c0 3.2-2.2 5.6-5.4 5.6h-1.8c-1.6 0-3-.8-3.9-2.1l-3.2-4.6a1.4 1.4 0 0 1 2.2-1.7z" fill="currentColor" stroke="none"/>',
  video: '<rect x="3" y="6.2" width="12.6" height="11.6" rx="2.4"/><path d="m15.6 12 5.4-3.3v6.6L15.6 12z"/><circle cx="9.3" cy="12" r="2.2" fill="currentColor" stroke="none"/>',
  cloud: '<path d="M7.5 18.5h-.8a4 4 0 0 1-.4-8 5.6 5.6 0 0 1 10.9-1 3.8 3.8 0 0 1 .3 7.6"/><path d="M12 19.5v-6.8M9.4 15.2 12 12.6l2.6 2.6"/>',
  menu: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  frame: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>',
  shrink: '<path d="M14 4v6h6M10 20v-6H4M14 10l6.5-6.5M10 14l-6.5 6.5"/>',
  box: '<path d="M4 9.5 12 13l8-3.5v8.2L12 21l-8-3.3z"/><path d="M12 13v8M4 9.5 7 5l8 3.4M20 9.5 17 5l-8 3.4"/><path d="m9.3 3.6.9 1.8M14.7 3.6l-.9 1.8M12 2.6v2.2"/>'
};

export function icon(name, className = '') {
  const body = ICON_PATHS[name] || ICON_PATHS.gamepad;
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export function platformIcon(name) {
  const body = ICON_PATHS[name] || ICON_PATHS.gamepad;
  return `<svg class="platform-svg" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstCharacter(name) {
  const match = String(name || '').replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
  return (match || '游').slice(0, 1);
}

function hashNumber(value) {
  let hash = 0;
  for (let i = 0; i < String(value).length; i += 1) {
    hash = (hash * 31 + String(value).charCodeAt(i)) >>> 0;
  }
  return hash;
}

const TAG_STYLES = ['orange', 'blue', 'green', 'purple'];

export function tagMarkup(tags, limit = 4) {
  return `<div class="tag-list">${(tags || []).slice(0, limit).map((tag, index) => {
    const style = index === 0 ? 'orange' : TAG_STYLES[(hashNumber(tag) % (TAG_STYLES.length - 1)) + 1];
    return `<span class="tag tag-${style}">${escapeHtml(tag)}</span>`;
  }).join('')}</div>`;
}

export function coverMarkup(game, { variant = 'card' } = {}) {
  const platform = game.platform === '街机' ? 'arcade' : game.platform === 'FC' ? 'fc' : 'gba';
  const tone = Number(game.coverTone) || 1;
  const cover = game.cover
    ? `<img class="cover-img" src="${escapeHtml(game.cover)}" alt="" loading="${variant === 'hero' ? 'eager' : 'lazy'}" onerror="this.remove()">`
    : '';
  return `<div class="game-cover cover-${variant} platform-${platform} tone-${tone}" aria-hidden="true">
    <span class="cover-grid"></span>
    <span class="cover-glow"></span>
    <span class="cover-platform">${escapeHtml(game.platform)}</span>
    <span class="cover-char">${escapeHtml(firstCharacter(game.name))}</span>
    ${cover}
    ${game.cover ? '' : `<span class="cover-stamp">${game.playable ? 'PLAY' : 'SOON'}</span>`}
  </div>`;
}

export function launchButton(game, label = '启动', extraClass = '') {
  return `<button class="launch-btn ${extraClass}" type="button" data-launch="${escapeHtml(game.id)}" aria-label="${escapeHtml(label)}${escapeHtml(game.shortName || game.name)}">${escapeHtml(label)}</button>`;
}

export function gameCard(game) {
  return `<article class="game-card">
    <a class="card-hit" href="#/details?id=${encodeURIComponent(game.id)}" aria-label="查看 ${escapeHtml(game.name)}"></a>
    ${coverMarkup(game)}
    <div class="card-content">
      <div class="card-info">
        <h3 class="card-name">${escapeHtml(game.name)}</h3>
        <p class="card-meta"><span>${escapeHtml(game.platform)}</span><i>·</i>${formatPlayers(game.players)}人在玩</p>
      </div>
      ${launchButton(game)}
    </div>
  </article>`;
}

export function listRow(game, { button = '启动', showHeat = false, showTags = true, className = '' } = {}) {
  const meta = showHeat
    ? `<p class="row-heat">${icon('flame')}<span>${formatPlayers(game.players)}</span></p>`
    : `<p class="row-meta"><span>${escapeHtml(game.platform)}</span><i>·</i>${formatPlayers(game.players)}人在玩</p>`;
  return `<article class="list-row ${className}">
    <a class="card-hit" href="#/details?id=${encodeURIComponent(game.id)}" aria-label="查看 ${escapeHtml(game.name)}"></a>
    ${coverMarkup(game, { variant: 'row' })}
    <div class="row-info">
      <h3 class="row-name">${escapeHtml(game.name)}</h3>
      ${meta}
      ${showTags ? tagMarkup(game.tags, 3) : ''}
    </div>
    ${button ? launchButton(game, button) : ''}
  </article>`;
}

export function rankRow(game, index, { button = '启动' } = {}) {
  return `<article class="rank-row">
    <span class="rank-no ${index < 3 ? 'is-top' : ''}">${index + 1}</span>
    <a class="card-hit" href="#/details?id=${encodeURIComponent(game.id)}" aria-label="查看 ${escapeHtml(game.name)}"></a>
    ${coverMarkup(game, { variant: 'row' })}
    <div class="row-info">
      <h3 class="row-name">${escapeHtml(game.name)}</h3>
      <p class="row-meta"><span>${escapeHtml(game.platform)}</span><i>·</i>${formatPlayers(game.players)}人在玩</p>
      ${tagMarkup(game.tags, 3)}
    </div>
    ${launchButton(game, button, 'rank-launch')}
  </article>`;
}

export function miniCard(game) {
  return `<a class="mini-card" href="#/details?id=${encodeURIComponent(game.id)}">
    ${coverMarkup(game, { variant: 'mini' })}
    <span class="mini-name">${escapeHtml(game.name)}</span>
  </a>`;
}

export function formatPlayers(value) {
  return String(Number(value) || 0);
}

export function emptyIllustration() {
  return `<svg class="empty-art" viewBox="0 0 120 96" aria-hidden="true">
    <ellipse cx="60" cy="84" rx="40" ry="6" fill="rgba(0,0,0,.05)"/>
    <circle cx="60" cy="38" r="22" fill="#f0f1f3"/>
    <circle cx="60" cy="34" r="13" fill="#dfe1e5"/>
    <path d="M42 48c0-8 8-14 18-14s18 6 18 14v10H42z" fill="#e8e9ec"/>
    <rect x="44" y="56" width="32" height="18" rx="9" fill="#d8dade"/>
    <circle cx="53" cy="65" r="2" fill="#b9bcc2"/>
    <circle cx="67" cy="65" r="2" fill="#b9bcc2"/>
    <circle cx="86" cy="30" r="4" fill="#eceef1"/>
    <circle cx="94" cy="42" r="3" fill="#f1f2f4"/>
    <circle cx="26" cy="44" r="3" fill="#eceef1"/>
  </svg>`;
}

export function emptyState(title, note = '') {
  return `<div class="empty-state">${emptyIllustration()}<p>${escapeHtml(title)}</p>${note ? `<span>${escapeHtml(note)}</span>` : ''}</div>`;
}

export function avatarMarkup(className = '') {
  return `<span class="avatar ${className}" aria-hidden="true">
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
      <rect x="24" y="46" width="16" height="4" rx="2" fill="#2b1d14"/>
    </svg>
  </span>`;
}

function bannerArt(kind) {
  if (kind === 'handheld') {
    return `<svg viewBox="0 0 180 170" class="banner-art-svg" aria-hidden="true">
      <g transform="rotate(-12 90 90)">
        <rect x="42" y="35" width="100" height="128" rx="18" fill="rgba(255,255,255,.94)"/>
        <rect x="56" y="52" width="72" height="58" rx="6" fill="#28304d"/>
        <rect x="62" y="58" width="60" height="46" rx="3" fill="#7fd0a2"/>
        <path d="M64 92l12-16 10 11 8-8 20 13v10H64z" fill="#4f9b72"/>
        <circle cx="70" cy="70" r="5" fill="#f9e58b"/>
        <rect x="60" y="120" width="34" height="10" rx="3" fill="#d9dbe3"/>
        <path d="M70 122v18M61 131h18" stroke="#83879a" stroke-width="5" stroke-linecap="round"/>
        <circle cx="115" cy="126" r="7" fill="#e36c63"/>
        <circle cx="129" cy="136" r="7" fill="#e36c63"/>
      </g>
      <circle cx="151" cy="35" r="4" fill="rgba(255,255,255,.5)"/>
      <circle cx="30" cy="142" r="6" fill="rgba(255,255,255,.18)"/>
    </svg>`;
  }
  if (kind === 'ship') {
    return `<svg viewBox="0 0 180 170" class="banner-art-svg" aria-hidden="true">
      <g fill="rgba(255,255,255,.92)">
        <rect x="88" y="56" width="8" height="8"/><rect x="80" y="64" width="24" height="8"/>
        <rect x="72" y="72" width="40" height="8"/><rect x="64" y="80" width="56" height="8"/>
        <rect x="72" y="88" width="40" height="8"/><rect x="79" y="96" width="26" height="6"/>
        <rect x="86" y="104" width="12" height="14"/>
      </g>
      <g fill="rgba(255,255,255,.38)">
        <rect x="30" y="40" width="5" height="5"/><rect x="52" y="26" width="3" height="3"/>
        <rect x="140" y="52" width="4" height="4"/><rect x="154" y="86" width="6" height="6"/>
        <rect x="36" y="102" width="4" height="4"/><rect x="22" y="74" width="3" height="3"/>
      </g>
      <path d="M56 128h68M44 138h92M64 148h48" stroke="rgba(255,255,255,.22)" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
  }
  if (kind === 'flag') {
    return `<svg viewBox="0 0 180 170" class="banner-art-svg" aria-hidden="true">
      <path d="M82 28v120" stroke="rgba(255,255,255,.9)" stroke-width="7" stroke-linecap="round"/>
      <path d="M89 36h54l-12 18 12 18H89z" fill="rgba(255,255,255,.92)"/>
      <path d="M100 47h26M100 57h18" stroke="#5c9b8a" stroke-width="4" stroke-linecap="round"/>
      <circle cx="76" cy="146" r="9" fill="rgba(255,255,255,.75)"/>
      <circle cx="47" cy="44" r="3" fill="rgba(255,255,255,.4)"/>
      <circle cx="142" cy="110" r="5" fill="rgba(255,255,255,.22)"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 180 170" class="banner-art-svg" aria-hidden="true">
    <g transform="translate(24 48) rotate(-8 66 42)">
      <rect x="0" y="14" width="132" height="64" rx="28" fill="rgba(255,255,255,.94)"/>
      <rect x="0" y="14" width="132" height="64" rx="28" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="2"/>
      <path d="M27 38v20M17 48h20" stroke="#3b3d51" stroke-width="7" stroke-linecap="round"/>
      <circle cx="101" cy="40" r="8" fill="#ff9d7a"/>
      <circle cx="116" cy="53" r="8" fill="#ffcf66"/>
      <circle cx="88" cy="53" r="8" fill="#82c9ff"/>
      <circle cx="66" cy="47" r="4" fill="#b9bcc9"/>
      <circle cx="76" cy="47" r="4" fill="#b9bcc9"/>
    </g>
    <circle cx="152" cy="35" r="8" fill="rgba(255,255,255,.16)"/>
    <circle cx="30" cy="146" r="5" fill="rgba(255,255,255,.25)"/>
  </svg>`;
}

export function bannerMarkup(banner, { href = '', staticMode = false, className = '' } = {}) {
  const link = href || (banner.gameId ? `#/details?id=${encodeURIComponent(banner.gameId)}` : '');
  const inner = `<span class="banner-glow"></span>
    ${bannerArt(banner.art)}
    <span class="banner-copy">
      <em>${escapeHtml(banner.kicker || 'RETRO ARCADE')}</em>
      <strong>${escapeHtml(banner.title || '一局童年')}</strong>
      <span>${escapeHtml(banner.subtitle || '把快乐留在这一局')}</span>
    </span>`;
  const body = `<div class="banner-inner theme-${escapeHtml(banner.theme || 'sun')}">${inner}</div>`;
  if (staticMode || !link) return `<div class="banner-static ${className}">${body}</div>`;
  return `<a class="banner-static ${className}" href="${link}" aria-label="${escapeHtml(banner.title || '推荐')}">${body}</a>`;
}

export function toast(message) {
  const wrap = document.getElementById('toast');
  if (!wrap) return;
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  wrap.appendChild(item);
  requestAnimationFrame(() => item.classList.add('is-visible'));
  setTimeout(() => item.classList.remove('is-visible'), 1900);
  setTimeout(() => item.remove(), 2300);
}

export function mountInfiniteList({
  host,
  items,
  renderItem,
  pageSize = 20,
  restoreCount = 0,
  loadingText = '加载中…',
  endText = '已经到底了',
  onCount
}) {
  if (!host) return { getCount: () => 0, destroy: () => {} };
  const total = items.length;
  const initial = Math.max(0, Math.min(total, Number(restoreCount) || 0));
  let count = Math.min(total, Math.max(initial, Math.min(pageSize, total)));
  let loading = false;
  let destroyed = false;
  const sentinel = document.createElement('div');
  sentinel.className = 'infinite-sentinel';
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadMore();
  }, { rootMargin: '240px 0px' });

  const paint = () => {
    if (destroyed) return;
    host.innerHTML = items.slice(0, count).map((item, index) => renderItem(item, index)).join('');
    host.appendChild(sentinel);
    sentinel.innerHTML = count >= total
      ? `<span class="infinite-end">${escapeHtml(endText)}</span>`
      : `<span class="infinite-loading">${escapeHtml(loadingText)}</span>`;
    if (onCount) onCount(count);
  };

  const loadMore = () => {
    if (destroyed || loading || count >= total) return;
    loading = true;
    sentinel.innerHTML = `<span class="infinite-loading">${escapeHtml(loadingText)}</span>`;
    requestAnimationFrame(() => {
      if (destroyed) return;
      count = Math.min(total, count + pageSize);
      loading = false;
      paint();
    });
  };

  host.innerHTML = '';
  paint();
  observer.observe(sentinel);
  return {
    getCount: () => count,
    destroy: () => {
      destroyed = true;
      observer.disconnect();
    }
  };
}
