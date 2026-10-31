import { getSyncCode, listCloudSaves } from '../cloud.js';
import {
  actionsFor,
  assignGamepads,
  keyLabel,
  playersFor,
  resetBindings,
  saveBindings
} from '../controls.js';
import { h5Markup, mountH5 } from '../play-ui/h5.js';
import { createGamePlayer } from '../player.js';
import { navigate } from '../router.js';
import { formatPlayTime, formatRelativeTime, getSaveSlots } from '../store.js';
import { escapeHtml, icon, toast } from '../ui.js';

function notFound() {
  const el = document.createElement('div');
  el.className = 'page page-play';
  el.innerHTML = `<div class="play-coming"><h1>没有找到这款游戏</h1><a class="primary-pill" href="#/">回到首页</a></div>`;
  document.title = '游戏不存在 · 一局童年';
  return { el };
}

function unavailable(game) {
  const el = document.createElement('div');
  el.className = 'page page-play';
  el.innerHTML = `<div class="play-coming"><h1>即将上线</h1><p>${escapeHtml(game.name)} 还在准备中。</p><a class="primary-pill" href="#/details?id=${encodeURIComponent(game.id)}">查看详情</a></div>`;
  document.title = `${game.name} · 一局童年`;
  return { el };
}

function imageType(bytes) {
  return bytes?.[0] === 0x89 && bytes?.[1] === 0x50 ? 'image/png' : 'image/jpeg';
}

export function render({ data, query }) {
  const game = data.gamesById.get(query.get('id'));
  if (!game) return notFound();
  if (!game.playable || !game.core) return unavailable(game);

  const platform = game.platform;
  const basePlayers = playersFor(platform);
  document.title = `${game.shortName || game.name} · 一局童年`;
  const isH5 = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth < 900);
  const el = document.createElement('div');
  el.className = `page page-play is-immersive${isH5 ? ' is-h5' : ''}`;
  el.dataset.platform = platform;
  el.innerHTML = `<div class="play-rotate">
    <section class="play-screen" id="play-stage">
      <div class="play-canvas-frame" id="play-canvas-frame">
        <canvas id="play-canvas" width="240" height="160" aria-label="${escapeHtml(game.name)}游戏画面"></canvas>
      </div>
    </section>
    <div class="play-float-icons">
      <button type="button" class="float-cheats" data-drawer="cheats" aria-label="金手指">${icon('finger')}<span>金手指</span></button>
      <button type="button" data-drawer="saves" aria-label="存档">${icon('cloud')}<span>存档</span></button>
      <button type="button" data-drawer="menu" aria-label="菜单">${icon('menu')}<span>菜单</span></button>
    </div>
    <div class="play-status-sr" id="play-status" role="status">准备就绪 · 点击开始</div>
    ${h5Markup(platform)}
    <div class="play-drawer-backdrop" id="drawer-backdrop" hidden></div>
    <aside class="play-drawer" id="play-drawer" aria-hidden="true"><div id="drawer-content"></div></aside>
  </div>
  <div class="play-start-overlay is-loading" id="play-overlay">
    <i class="play-loader" aria-hidden="true"></i>
    <strong>${escapeHtml(game.shortName || game.name)}</strong>
    <p id="play-loading-text">游戏加载中…</p>
    <button class="play-start" id="play-start" type="button">开始游戏</button>
  </div>`;

  return {
    el,
    mount() {
      const screen = el.querySelector('#play-stage');
      const frame = el.querySelector('#play-canvas-frame');
      const canvas = el.querySelector('#play-canvas');
      const overlay = el.querySelector('#play-overlay');
      const startButton = el.querySelector('#play-start');
      const statusEl = el.querySelector('#play-status');
      const drawer = el.querySelector('#play-drawer');
      const drawerContent = el.querySelector('#drawer-content');
      const backdrop = el.querySelector('#drawer-backdrop');
      const touchRoot = el.querySelector('#play-touch');
      const floatButtons = [...el.querySelectorAll('[data-drawer]')];
      let standardMode = false;
      let muted = false;
      let lastVolume = 0.5;
      let paused = false;
      let resourcesUnavailable = false;
      let supportedPlayers = basePlayers;
      let drawerType = '';
      let drawerOpen = false;
      let cheatState = { entries: [], selected: {} };
      let keyPlayer = 1;
      let listening = null;
      let gamepadTimer = 0;
      let savesToken = 0;
      let saveTab = 'mine';
      let storeFilter = 'general';
      let stageUrls = new Map();
      let h5 = null;
      let backdropTimer = 0;
      const controller = new AbortController();
      const signal = controller.signal;

      const player = createGamePlayer({
        game,
        slotId: query.get('slot'),
        stageId: query.get('stage'),
        cloudSlotId: query.get('cloud'),
        canvas,
        touchPad: null,
        statusElement: statusEl,
        onRunningChange: running => {
          if (!running) return;
          overlay.classList.add('is-hidden');
          h5?.setVisible(true);
          supportedPlayers = player.getPlayers();
          applyCanvasLayout();
          statusEl.textContent = `游戏进行中 · ${platform}${resourcesUnavailable ? ' · 金手指资源暂不可用' : ''}`;
          if (drawerType === 'keys') renderKeymap();
          if (drawerType === 'cheats') renderCheats();
          if (drawerType === 'saves') renderSaves();
        },
        onPauseChange: value => {
          paused = value;
          if (drawerType === 'menu') renderMenu();
        },
        onPlayersReady: count => {
          supportedPlayers = count;
          if (keyPlayer > count) keyPlayer = 1;
          if (drawerType === 'keys') renderKeymap();
        },
        onResourcesUnavailable: () => {
          resourcesUnavailable = true;
          toast('金手指资源暂不可用');
        },
        onCheatsReady: (entries, selected) => {
          cheatState = { entries, selected };
          if (drawerType === 'cheats') renderCheats();
        },
        onStatus: text => {
          if (/失败|已保存|已读取|已进入|已切换|已导入|已导出|已覆盖|已删除|已重置|重新加载/.test(text)) toast(text);
        }
      });
      h5 = isH5 ? mountH5({ root: touchRoot, player, onSpeed: cycleSpeed }) : null;
      h5?.setVisible(false);
      h5?.updateSpeed(player.getSpeed());

      function applyCanvasLayout() {
        const width = canvas.width;
        const height = canvas.height;
        if (!width || !height) return;
        const availableWidth = screen.clientWidth;
        const availableHeight = screen.clientHeight;
        if (!availableWidth || !availableHeight) return;
        const h5Layout = el.classList.contains('is-h5');
        const box = h5Layout ? [1, 1] : [0.568, 0.581];
        const shrink = standardMode ? 0.362 : 1;
        const scale = Math.min(availableWidth * box[0] / width, availableHeight * box[1] / height) * shrink;
        canvas.style.width = `${Math.max(1, Math.round(width * scale))}px`;
        canvas.style.height = `${Math.max(1, Math.round(height * scale))}px`;
      }

      function setSpeed(next) {
        const value = Number(next) || 1;
        player.setSpeed(value);
        h5?.updateSpeed(value);
        if (drawerType === 'menu') renderMenu();
        toast(`已切换到 ${value}× 速度`);
      }

      function cycleSpeed() {
        const speeds = [1, 2, 4, 8];
        const current = speeds.indexOf(player.getSpeed());
        const next = speeds[(current + 1) % speeds.length];
        setSpeed(next);
        return next;
      }

      function menuMarkup() {
        return `<div class="drawer-menu">
          <button type="button" class="drawer-item" data-menu-action="fullscreen" data-action="fullscreen">${icon('fullscreen')}<span>全屏</span></button>
          <button type="button" class="drawer-item" data-menu-action="standard">${icon(standardMode ? 'shrink' : 'frame')}<span>${standardMode ? '小屏画面' : '标准画面'}</span></button>
          <button type="button" class="drawer-item" data-menu-action="mute">${icon(muted ? 'speakerOff' : 'volume')}<span>声音</span></button>
          <button type="button" class="drawer-item" data-menu-action="reload">${icon('reload')}<span>重新加载</span></button>
          <button type="button" class="drawer-item" data-menu-action="keys" data-action="keys">${icon('keyboard')}<span>按键映射</span></button>
          <button type="button" class="drawer-exit" data-menu-action="exit">退出游戏</button>
        </div>`;
      }

      function keymapShell() {
        return `<div class="drawer-head"><span class="drawer-title">${icon('keyboard')}键盘</span><button type="button" class="drawer-reset" data-keys-reset>重置</button></div>
          <div class="drawer-underline"></div>
          <div class="key-player-row"><span class="key-player-label">P位选择</span><div class="key-player-tabs" id="key-player-tabs"></div></div>
          <div class="turbo-row"><span>连发速度</span><input id="turbo-speed" type="range" min="1" max="4" step="1" value="1" aria-label="连发速度"><b id="turbo-label">1X</b></div>
          <div id="key-rows"></div>
          <div id="special-rows"></div>
          <div class="combo-head">组合键</div>
          <div id="combo-rows"></div>`;
      }

      function renderMenu() {
        drawerContent.innerHTML = menuMarkup();
      }

      function renderKeymap() {
        const bindings = player.getBindings();
        const tabs = drawerContent.querySelector('#key-player-tabs');
        const rows = drawerContent.querySelector('#key-rows');
        const combos = drawerContent.querySelector('#combo-rows');
        const specials = drawerContent.querySelector('#special-rows');
        const turbo = drawerContent.querySelector('#turbo-speed');
        const turboLabel = drawerContent.querySelector('#turbo-label');
        if (!tabs || !rows || !combos || !specials) return;
        if (keyPlayer > supportedPlayers) keyPlayer = 1;
        tabs.innerHTML = Array.from({ length: supportedPlayers }, (_, index) => `<button type="button" data-key-player="${index + 1}" class="${keyPlayer === index + 1 ? 'is-active' : ''}"><i></i>${index + 1}P</button>`).join('');
        const actionMap = new Map(actionsFor(platform).map(action => [action.id, action]));
        const order = platform === '街机'
          ? ['coin', 'start', 'up', 'down', 'left', 'right', 'a', 'b', 'c', 'd', 'e', 'f']
          : platform === 'FC'
            ? ['select', 'start', 'up', 'down', 'left', 'right', 'a', 'b']
            : ['select', 'start', 'up', 'down', 'left', 'right', 'a', 'b', 'l', 'r'];
        const actions = order.map(id => actionMap.get(id)).filter(Boolean);
        const turboable = new Set(platform === '街机' ? ['a', 'b', 'c', 'd', 'e', 'f'] : ['a', 'b']);
        rows.innerHTML = actions.map(action => {
          const binding = bindings[`P${keyPlayer}`]?.[action.id] || { key: '', pad: -1, turbo: false };
          const active = listening && listening.player === keyPlayer && listening.action === action.id && listening.combo === null;
          return `<div class="keymap-row">
            <span class="keymap-label">${escapeHtml(action.label)}</span>
            <button type="button" class="keymap-key ${active ? 'is-listening' : ''}" data-bind-action="${action.id}">${active ? '按下按键…' : `<kbd>${escapeHtml(keyLabel(binding.key))}</kbd>`}</button>
            ${turboable.has(action.id) ? `<div class="keymap-mode"><button type="button" data-turbo-action="${action.id}" data-turbo-value="0" class="${binding.turbo ? '' : 'is-active'}">单发</button><button type="button" data-turbo-action="${action.id}" data-turbo-value="1" class="${binding.turbo ? 'is-active' : ''}">连发</button></div>` : ''}
          </div>`;
        }).join('');
        const comboActions = platform === '街机' ? ['a', 'b', 'c', 'd', 'e', 'f'] : ['a', 'b'];
        const playerCombos = bindings[`P${keyPlayer}`]?.combos || [];
        combos.innerHTML = playerCombos.map((combo, index) => {
          const active = listening && listening.player === keyPlayer && listening.combo === index;
          return `<div class="combo-row">
            <button type="button" class="combo-key ${active ? 'is-listening' : ''}" data-combo-key="${index}">${active ? '按下按键…' : escapeHtml(combo.key ? keyLabel(combo.key) : '空')}</button>
            <div class="combo-checks">${comboActions.map(action => `<label><input type="checkbox" data-combo-index="${index}" data-combo-action="${action}" ${combo.actions.includes(action) ? 'checked' : ''}><span>${escapeHtml(action.toUpperCase())}</span></label>`).join('')}</div>
          </div>`;
        }).join('');
        if (platform === '街机') {
          const reset = bindings[`P${keyPlayer}`]?.reset || { key: '' };
          const extras = player.getExtraActions();
          const specialRows = [`<div class="keymap-row"><span class="keymap-label">重置</span><button type="button" class="keymap-key ${listening && listening.player === keyPlayer && listening.action === 'reset' ? 'is-listening' : ''}" data-bind-action="reset">${listening && listening.player === keyPlayer && listening.action === 'reset' ? '按下按键…' : `<kbd>${escapeHtml(keyLabel(reset.key))}</kbd>`}</button></div>`];
          for (const extra of extras) {
            const binding = bindings[`P${keyPlayer}`]?.[extra.id] || { key: '' };
            const active = listening && listening.player === keyPlayer && listening.action === extra.id;
            specialRows.push(`<div class="keymap-row"><span class="keymap-label">${escapeHtml(extra.label)}</span><button type="button" class="keymap-key ${active ? 'is-listening' : ''}" data-bind-action="${extra.id}">${active ? '按下按键…' : `<kbd>${escapeHtml(keyLabel(binding.key))}</kbd>`}</button></div>`);
          }
          specials.innerHTML = specialRows.join('');
        } else {
          specials.innerHTML = '';
        }
        if (turbo) turbo.value = String(bindings.turboSpeed || 1);
        if (turboLabel) turboLabel.textContent = `${bindings.turboSpeed || 1}X`;
      }

      function renderCheats() {
        const list = drawerContent.querySelector('#cheat-list');
        if (!list) return;
        if (!cheatState.entries.length) {
          list.innerHTML = '<p class="drawer-empty">开始游戏后可在这里开启金手指。</p>';
          return;
        }
        list.innerHTML = cheatState.entries.map((entry, index) => {
          const value = Number(cheatState.selected[index] ?? entry.default ?? 0);
          if (entry.options.length === 2 && entry.options.some(option => option.value === 0) && entry.options.some(option => option.value === 1)) {
            return `<label class="cheat-row"><span>${escapeHtml(entry.name)}</span><input type="checkbox" data-cheat-index="${index}" ${value ? 'checked' : ''}><i></i></label>`;
          }
          if (entry.options.length <= 4) {
            return `<div class="cheat-row cheat-row-seg"><span>${escapeHtml(entry.name)}</span><div class="cheat-seg">${entry.options.map(option => `<button type="button" data-cheat-option="${index}" data-cheat-value="${option.value}" class="${option.value === value ? 'is-active' : ''}">${escapeHtml(option.label)}</button>`).join('')}</div></div>`;
          }
          return `<label class="cheat-row cheat-row-select"><span>${escapeHtml(entry.name)}</span><select data-cheat-index="${index}">${entry.options.map(option => `<option value="${option.value}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
        }).join('');
      }

      function cheatsShell() {
        return `<div class="drawer-head"><span class="drawer-title">${icon('gamepad')}金手指</span></div>
          <div class="drawer-underline"></div>
          <div class="cheat-list" id="cheat-list"></div>`;
      }

      function savesShell() {
        return `<div class="save-tabs">
            <button type="button" data-save-tab="mine" class="${saveTab === 'mine' ? 'is-active' : ''}">${icon('save')}我的存档</button>
            <button type="button" data-save-tab="store" class="${saveTab === 'store' ? 'is-active' : ''}">${icon('store')}存档商店</button>
          </div>
          <div id="save-panel" class="save-panel"><p class="drawer-empty">加载中…</p></div>`;
      }

      function releaseStageUrls() {
        for (const url of stageUrls.values()) URL.revokeObjectURL(url);
        stageUrls = new Map();
      }

      async function renderSaves() {
        if (drawerType !== 'saves') return;
        const panel = drawerContent.querySelector('#save-panel');
        if (!panel) return;
        const token = ++savesToken;
        releaseStageUrls();
        if (saveTab === 'store') {
          const stages = [...player.getStages()].sort((a, b) => storeFilter === 'latest' ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id));
          const filters = `<div class="store-filters"><button type="button" data-store-filter="general" class="${storeFilter === 'general' ? 'is-active' : ''}">综合</button><button type="button" data-store-filter="latest" class="${storeFilter === 'latest' ? 'is-active' : ''}">最新</button></div>`;
          if (!stages.length) {
            panel.innerHTML = `${filters}<div class="drawer-empty-state">${icon('store')}<p>暂无数据</p><span>本作没有预置关卡存档</span></div>`;
            return;
          }
          panel.innerHTML = `${filters}<div class="save-list">${stages.map(stage => {
            let url = game.cover;
            if (stage.image) {
              url = URL.createObjectURL(new Blob([stage.image], { type: imageType(stage.image) }));
              stageUrls.set(stage.id, url);
            }
            return `<article class="save-item stage-item">
              <img class="save-thumb" src="${url}" alt="">
              <div class="save-info"><strong>${escapeHtml(stage.label)}</strong><span>预置关卡 · 点击直接进入</span></div>
              <button type="button" class="save-play" data-stage-play="${escapeHtml(stage.id)}">去玩</button>
            </article>`;
          }).join('')}</div>`;
          return;
        }
        const local = getSaveSlots(game.id);
        let cloud = [];
        const code = getSyncCode();
        if (code) {
          try {
            cloud = (await listCloudSaves(code)).filter(save => save.gameId === game.id);
          } catch {
            cloud = [];
          }
        }
        if (token !== savesToken || drawerType !== 'saves') return;
        const localIds = new Set(local.map(slot => slot.id));
        const cloudBySlot = new Map(cloud.map(save => [save.slotId, save]));
        const cloudOnly = cloud.filter(save => !localIds.has(save.slotId));
        const toolbar = `<button type="button" class="save-new" data-save-new data-action="save">${icon('plus')}新建存档</button>`;
        const transfer = `<div class="save-transfer">
          <button type="button" class="save-tool" data-save-export>导出当前进度</button>
          <label class="save-tool">导入存档文件<input id="save-import-file" type="file" accept=".state" hidden></label>
        </div>`;
        const rows = [
          ...local.map(slot => {
            const cloudSave = cloudBySlot.get(slot.id);
            return `<article class="save-item">
              <img class="save-thumb" src="${slot.thumb || game.cover}" alt="">
              <div class="save-info"><strong>${escapeHtml(slot.label || '即时存档')}${cloudSave ? '<em class="cloud-mark">云</em>' : ''}</strong><span>${formatRelativeTime(slot.createdAt)} · 游玩 ${formatPlayTime(slot.seconds)}</span></div>
              <div class="save-actions">
                <button type="button" data-save-load="local:${escapeHtml(slot.id)}">读取</button>
                <button type="button" data-save-overwrite="local:${escapeHtml(slot.id)}">覆盖</button>
                <button type="button" class="danger" data-save-delete="local:${escapeHtml(slot.id)}">删除</button>
              </div>
            </article>`;
          }),
          ...cloudOnly.map(save => `<article class="save-item">
            <img class="save-thumb" src="${game.cover}" alt="">
            <div class="save-info"><strong>${escapeHtml(save.label || '云端存档')}<em class="cloud-mark">云</em></strong><span>${formatRelativeTime(save.createdAt)} · 游玩 ${formatPlayTime(save.seconds)}</span></div>
            <div class="save-actions">
              <button type="button" data-save-load="cloud:${escapeHtml(save.slotId)}">读取</button>
              <button type="button" data-save-overwrite="cloud:${escapeHtml(save.slotId)}" data-save-label="${escapeHtml(save.label || '云端存档')}">覆盖</button>
              <button type="button" class="danger" data-save-delete="cloud:${escapeHtml(save.slotId)}">删除</button>
            </div>
          </article>`)
        ];
        panel.innerHTML = `${toolbar}${rows.length ? `<div class="save-list">${rows.join('')}</div>` : `<div class="drawer-empty-state">${icon('box')}<p>暂无数据</p></div>`}${transfer}`;
      }

      function openDrawer(type) {
        drawerType = type;
        drawerOpen = true;
        stopListening();
        h5?.setEnabled(false);
        player.setInputPaused(type === 'keys');
        if (type === 'menu') renderMenu();
        else if (type === 'keys') {
          drawerContent.innerHTML = keymapShell();
          renderKeymap();
        } else if (type === 'cheats') {
          drawerContent.innerHTML = cheatsShell();
          renderCheats();
        } else if (type === 'saves') {
          drawerContent.innerHTML = savesShell();
          renderSaves();
        }
        // 每次打开都从顶部开始，不沿用上一个抽屉的滚动位置
        drawerContent.scrollTop = 0;
        drawer.dataset.type = type;
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        floatButtons.forEach(button => button.classList.toggle('is-active', button.dataset.drawer === type));
        if (backdropTimer) clearTimeout(backdropTimer);
        backdrop.hidden = false;
        requestAnimationFrame(() => backdrop.classList.add('is-visible'));
      }

      function closeDrawer() {
        if (!drawerOpen) return;
        drawerOpen = false;
        drawerType = '';
        if (drawerContent.contains(document.activeElement)) document.activeElement.blur();
        stopListening();
        player.setInputPaused(false);
        h5?.setEnabled(true);
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        floatButtons.forEach(button => button.classList.remove('is-active'));
        backdrop.classList.remove('is-visible');
        if (backdropTimer) clearTimeout(backdropTimer);
        backdropTimer = setTimeout(() => { backdrop.hidden = true; }, 220);
      }

      function stopListening() {
        listening = null;
        if (gamepadTimer) clearInterval(gamepadTimer);
        gamepadTimer = 0;
        player.setInputPaused(drawerType === 'keys');
        if (drawerType === 'keys') renderKeymap();
      }

      function startListening(playerIndex, action, combo = null) {
        listening = { player: playerIndex, action, combo };
        player.setInputPaused(true);
        renderKeymap();
        if (gamepadTimer) clearInterval(gamepadTimer);
        if (combo !== null) return;
        gamepadTimer = setInterval(() => {
          if (!listening || !navigator.getGamepads || drawerType !== 'keys') return;
          const pads = assignGamepads(navigator.getGamepads(), { platform, playerCount: basePlayers });
          const pad = pads[listening.player - 1];
          if (!pad) return;
          const button = pad.buttons.findIndex(item => item?.pressed);
          if (button < 0) return;
          const bindings = player.getBindings();
          if (!bindings[`P${listening.player}`][listening.action]) bindings[`P${listening.player}`][listening.action] = { key: '', pad: -1, turbo: false };
          bindings[`P${listening.player}`][listening.action].pad = button;
          saveBindings(platform, bindings);
          player.reloadBindings();
          stopListening();
          toast(`已绑定手柄 ${button + 1}`);
        }, 80);
      }

      const onBindKey = event => {
        if (!listening) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.code === 'Escape') {
          stopListening();
          return;
        }
        const bindings = player.getBindings();
        const playerKey = `P${listening.player}`;
        if (listening.combo !== null) {
          bindings[playerKey].combos[listening.combo].key = event.code;
        } else {
          if (!bindings[playerKey][listening.action]) bindings[playerKey][listening.action] = { key: '', pad: -1, turbo: false };
          bindings[playerKey][listening.action].key = event.code;
        }
        saveBindings(platform, bindings);
        player.reloadBindings();
        stopListening();
        toast(`已绑定 ${keyLabel(event.code)}`);
      };

      async function onMenuAction(action) {
        try {
          if (action === 'fullscreen') {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await el.requestFullscreen();
            requestAnimationFrame(applyCanvasLayout);
          } else if (action === 'standard') {
            standardMode = !standardMode;
            applyCanvasLayout();
            renderMenu();
          } else if (action === 'mute') {
            if (!muted) {
              lastVolume = player.getVolume() || 0.5;
              player.setVolume(0);
            } else {
              player.setVolume(lastVolume);
            }
            muted = !muted;
            renderMenu();
          } else if (action === 'reload') {
            const ok = player.reload();
            if (!ok) window.location.reload();
            else closeDrawer();
          } else if (action === 'keys') {
            openDrawer('keys');
          } else if (action === 'pause') {
            player.togglePause();
          } else if (action === 'exit') {
            player.destroy();
            navigate(`/details?id=${encodeURIComponent(game.id)}`);
          }
        } catch (error) {
          toast(error.message || '操作失败');
        }
      }

      const onDrawerClick = async event => {
        const target = event.target.closest('button, label');
        if (!target) return;
        if (target.dataset.keyPlayer) {
          keyPlayer = Number(target.dataset.keyPlayer) || 1;
          stopListening();
          renderKeymap();
          return;
        }
        if (target.dataset.bindAction) {
          startListening(keyPlayer, target.dataset.bindAction);
          return;
        }
        if (target.dataset.turboAction) {
          const bindings = player.getBindings();
          const value = Number(target.dataset.turboValue) === 1;
          bindings[`P${keyPlayer}`][target.dataset.turboAction].turbo = value;
          saveBindings(platform, bindings);
          player.reloadBindings();
          renderKeymap();
          return;
        }
        if (target.dataset.comboKey !== undefined) {
          startListening(keyPlayer, 'combo', Number(target.dataset.comboKey));
          return;
        }
        if (target.dataset.keysReset !== undefined) {
          const defaults = resetBindings(platform);
          saveBindings(platform, defaults);
          player.reloadBindings();
          stopListening();
          renderKeymap();
          toast('已恢复默认按键');
          return;
        }
        if (target.dataset.cheatOption !== undefined) {
          const index = Number(target.dataset.cheatOption);
          const value = Number(target.dataset.cheatValue) || 0;
          player.setCheat(index, value);
          cheatState.selected[index] = value;
          renderCheats();
          return;
        }
        if (target.dataset.cheatReset !== undefined) {
          player.resetCheats();
          cheatState.selected = {};
          renderCheats();
          return;
        }
        if (target.dataset.menuAction) {
          await onMenuAction(target.dataset.menuAction);
          return;
        }
        if (target.dataset.speed) {
          setSpeed(Number(target.dataset.speed));
          return;
        }
        if (target.dataset.saveTab) {
          saveTab = target.dataset.saveTab;
          drawerContent.innerHTML = savesShell();
          renderSaves();
          return;
        }
        if (target.dataset.storeFilter) {
          storeFilter = target.dataset.storeFilter;
          renderSaves();
          return;
        }
        if (target.dataset.saveNew !== undefined) {
          target.disabled = true;
          try { await player.saveState(); }
          catch (error) { toast(`存档失败：${error.message}`); }
          finally { target.disabled = false; renderSaves(); }
          return;
        }
        if (target.dataset.saveExport !== undefined) {
          try { await player.exportState(); } catch (error) { toast(error.message); }
          return;
        }
        if (target.dataset.saveLoad) {
          const [kind, id] = [target.dataset.saveLoad.slice(0, target.dataset.saveLoad.indexOf(':')), target.dataset.saveLoad.slice(target.dataset.saveLoad.indexOf(':') + 1)];
          try {
            if (kind === 'cloud') await player.loadCloudSlot(id);
            else await player.loadSlot(id);
            closeDrawer();
          } catch (error) {
            toast(`读档失败：${error.message}`);
          }
          return;
        }
        if (target.dataset.saveOverwrite) {
          const [kind, id] = [target.dataset.saveOverwrite.slice(0, target.dataset.saveOverwrite.indexOf(':')), target.dataset.saveOverwrite.slice(target.dataset.saveOverwrite.indexOf(':') + 1)];
          target.disabled = true;
          try {
            if (kind === 'cloud') await player.overwriteCloudSlot(id, target.dataset.saveLabel || '云端存档');
            else await player.overwriteSlot(id);
            renderSaves();
          } catch (error) {
            toast(`覆盖失败：${error.message}`);
          } finally {
            target.disabled = false;
          }
          return;
        }
        if (target.dataset.saveDelete) {
          const [kind, id] = [target.dataset.saveDelete.slice(0, target.dataset.saveDelete.indexOf(':')), target.dataset.saveDelete.slice(target.dataset.saveDelete.indexOf(':') + 1)];
          target.disabled = true;
          try {
            if (kind === 'cloud') await player.deleteCloudSlot(id);
            else await player.deleteSlot(id);
            renderSaves();
          } catch (error) {
            toast(`删除失败：${error.message}`);
          } finally {
            target.disabled = false;
          }
          return;
        }
        if (target.dataset.stagePlay) {
          try {
            await player.loadStage(target.dataset.stagePlay);
            closeDrawer();
          } catch (error) {
            toast(`进入关卡失败：${error.message}`);
          }
        }
      };

      const onDrawerChange = event => {
        const target = event.target;
        if (target.dataset?.cheatIndex !== undefined) {
          const index = Number(target.dataset.cheatIndex);
          const value = target.type === 'checkbox' ? (target.checked ? 1 : 0) : Number(target.value);
          player.setCheat(index, value);
          cheatState.selected[index] = value;
          return;
        }
        if (target.dataset?.comboIndex !== undefined) {
          const index = Number(target.dataset.comboIndex);
          const bindings = player.getBindings();
          const combo = bindings[`P${keyPlayer}`].combos[index];
          const action = target.dataset.comboAction;
          if (target.checked) {
            if (!combo.actions.includes(action)) combo.actions.push(action);
          } else {
            combo.actions = combo.actions.filter(item => item !== action);
          }
          saveBindings(platform, bindings);
          player.reloadBindings();
          return;
        }
        if (target.id === 'save-import-file') {
          const file = target.files?.[0];
          if (file) player.importState(file).then(() => renderSaves());
        }
      };

      const onDrawerInput = event => {
        if (event.target.id === 'turbo-speed') {
          const bindings = player.getBindings();
          bindings.turboSpeed = Math.min(4, Math.max(1, Number(event.target.value) || 1));
          saveBindings(platform, bindings);
          player.reloadBindings();
          const label = drawerContent.querySelector('#turbo-label');
          if (label) label.textContent = `${bindings.turboSpeed}X`;
        }
      };

      const onGlobalKey = event => {
        if (event.code !== 'Escape') return;
        if (listening) return;
        if (drawerOpen) {
          event.preventDefault();
          closeDrawer();
        } else {
          event.preventDefault();
          player.togglePause();
        }
      };

      const onResize = () => applyCanvasLayout();
      const onFullscreen = () => requestAnimationFrame(applyCanvasLayout);

      // 与参照站一致：进入游戏页即开始加载，失败后才显示重试按钮
      const onStart = async () => {
        overlay.classList.add('is-loading');
        startButton.disabled = true;
        try {
          await player.start();
        } catch {
          overlay.classList.remove('is-loading');
          startButton.disabled = false;
          startButton.textContent = '重新开始';
          toast('游戏加载失败，请重试');
        }
      };

      const onFloat = event => {
        const button = event.target.closest('[data-drawer]');
        if (!button) return;
        if (drawerOpen && button.dataset.drawer === drawerType) closeDrawer();
        else openDrawer(button.dataset.drawer);
      };

      startButton.addEventListener('click', onStart);
      el.addEventListener('click', onFloat);
      drawerContent.addEventListener('click', onDrawerClick);
      drawerContent.addEventListener('change', onDrawerChange);
      drawerContent.addEventListener('input', onDrawerInput);
      backdrop.addEventListener('click', closeDrawer);
      window.addEventListener('keydown', onBindKey, { capture: true, signal });
      window.addEventListener('keydown', onGlobalKey, { capture: true, signal });
      window.addEventListener('resize', onResize, { signal });
      document.addEventListener('fullscreenchange', onFullscreen, { signal });
      renderMenu();
      onStart();

      return () => {
        controller.abort();
        if (gamepadTimer) clearInterval(gamepadTimer);
        if (backdropTimer) clearTimeout(backdropTimer);
        releaseStageUrls();
        h5?.destroy();
        player.destroy();
      };
    }
  };
}
