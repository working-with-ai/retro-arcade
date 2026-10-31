import { addPlayTime, addSaveSlot, formatClock, getSaveSlots, recordPlay, removeSaveSlot, updateSaveSlot } from './store.js';
import { deleteSaveBytes, readSaveBytes, writeSaveBytes } from './saves.js';
import { deleteCloudSave, downloadCloudSave, getSyncCode, uploadCloudSave } from './cloud.js';
import {
  actionValues,
  actionsFor,
  assignGamepads,
  loadBindings,
  maskForPlayer,
  playersFor
} from './controls.js';
import { ensureFsDirectory, prepareGameAssets, writeFilesToDb } from './resources.js';

const SLOT_STATE_NAME = 'selected.state';
let activePlayer = null;

if (!window.gameInfo) {
  window.gameInfo = { goldenFingerFiles: '', gameAchievement: '' };
}
window.triggerReady = () => {
  if (activePlayer) activePlayer.handleReady();
};

function setVolumeSafe(emuSound, volume) {
  try { emuSound?.setVolume(volume); } catch {}
}

export function createGamePlayer({
  game,
  slotId,
  stageId,
  cloudSlotId,
  canvas,
  touchPad,
  statusElement,
  onRunningChange,
  onPauseChange,
  onCheatsReady,
  onResourcesUnavailable,
  onStatus,
  onPlayersReady
}) {
  const core = game.core;
  if (!core) throw new Error('这款游戏还没有可用的模拟器内核');
  const rootPath = core.rootPath;
  const statePath = core.statePath;
  const context = canvas.getContext('2d', { alpha: false });
  const controller = new AbortController();
  const playerCount = playersFor(game.platform);

  let emulib = null;
  let emuSound = null;
  let image = null;
  let running = false;
  let starting = false;
  let paused = false;
  let frameTime = 0;
  let frameId = 0;
  let speed = 1;
  let volume = 0.5;
  let playTimer = 0;
  let sessionSeconds = 0;
  let flushedSeconds = 0;
  let destroyed = false;
  let inputPaused = false;
  let assets = null;
  let supportedPlayers = playerCount;
  let frameTick = 0;
  let bindings = loadBindings(game.platform);
  let values = actionValues(game.platform);
  let cheatEntries = [];
  let selectedCheats = readSelectedCheats();
  const pressedKeys = new Set();
  const touchActions = Array.from({ length: playerCount }, () => new Set());

  const status = text => {
    if (destroyed) return;
    if (statusElement) statusElement.textContent = text;
    if (onStatus) {
      try { onStatus(text); } catch {}
    }
  };

  function readSelectedCheats() {
    try {
      const stored = JSON.parse(localStorage.getItem(`ra:cheats:${game.id}`) || '{}');
      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  }

  function saveSelectedCheats() {
    try {
      localStorage.setItem(`ra:cheats:${game.id}`, JSON.stringify(selectedCheats));
    } catch {
      /* private mode */
    }
  }

  const flushTime = () => {
    const pending = sessionSeconds - flushedSeconds;
    if (pending > 0) {
      addPlayTime(game.id, pending);
      flushedSeconds = sessionSeconds;
    }
  };

  const stopAudio = () => {
    if (!emuSound) return;
    try {
      emuSound.setVolume(0);
      if (emuSound.resumeTimer) clearInterval(emuSound.resumeTimer);
      if (emuSound.audioCtx && typeof emuSound.audioCtx.close === 'function') {
        emuSound.audioCtx.close().catch(() => {});
      }
    } catch {
      /* audio may already be torn down */
    }
  };

  async function loadStateBytes(contents, label, path = `${rootPath}/${SLOT_STATE_NAME}`) {
    if (destroyed || !emulib) return;
    const bytes = contents instanceof Uint8Array ? contents : new Uint8Array(contents || []);
    if (!bytes.length) throw new Error('存档为空');
    ensureFsDirectory(emulib, path.slice(0, path.lastIndexOf('/')));
    if (destroyed || !emulib) return;
    emulib.FS.writeFile(path, bytes);
    if (destroyed || !emulib) return;
    emulib.ccall('emuLoadState', null, ['string'], [path]);
    emulib._emuUpdate();
    status(label);
  }

  async function loadPendingState() {
    try {
      if (stageId) {
        const stage = assets?.stages?.find(item => String(item.id) === String(stageId));
        if (!stage) throw new Error('预置关卡不存在');
        await loadStateBytes(stage.state, `已进入${stage.label}`, `${rootPath}/stage.state`);
      } else if (cloudSlotId) {
        status('正在下载云端存档…');
        const contents = await downloadCloudSave(game.id, cloudSlotId, getSyncCode(), controller.signal);
        if (destroyed) return;
        await loadStateBytes(contents, '已读取云端存档', `${rootPath}/cloud.state`);
      } else if (slotId) {
        const contents = await readSaveBytes(game.id, slotId);
        if (destroyed) return;
        if (!contents) throw new Error('所选存档不存在或已损坏');
        await loadStateBytes(contents, '已读取所选存档');
      }
    } catch (error) {
      if (destroyed) return;
      console.warn('读档失败', error);
      status(`读档失败：${error.message}`);
    }
  }

  function applyCheats() {
    if (!emulib || !running) return;
    cheatEntries.forEach((entry, index) => {
      const value = Number(selectedCheats[index] ?? entry.default ?? 0);
      if (!value) return;
      try { emulib._emuCheatEnable(index, value); } catch (error) { console.warn('金手指启用失败', error); }
    });
  }

  function handleReady() {
    if (destroyed || !emulib) return;
    canvas.width = emulib._emuGetVideoWidth();
    canvas.height = emulib._emuGetVideoHeight();
    image = context.createImageData(canvas.width, canvas.height);
    frameTick = 0;
    supportedPlayers = playerCount;
    if (playerCount > 2) {
      supportedPlayers = 2;
      for (let player = 2; player < playerCount; player += 1) {
        try {
          emulib._emuSetButton(player, 0);
          supportedPlayers = player + 1;
        } catch {
          break;
        }
      }
    }
    running = true;
    starting = false;
    paused = false;
    recordPlay(game.id);
    sessionSeconds = 0;
    flushedSeconds = 0;
    if (playTimer) clearInterval(playTimer);
    playTimer = setInterval(() => {
      if (!running || paused) return;
      sessionSeconds += 1;
      if (sessionSeconds - flushedSeconds >= 10) flushTime();
    }, 1000);
    status(`游戏进行中 · ${game.platform}${assets?.resourcesUnavailable ? ' · 金手指资源暂不可用' : ''}`);
    if (onRunningChange) onRunningChange(true);
    if (onPlayersReady) onPlayersReady(supportedPlayers);
    if (onPauseChange) onPauseChange(false);
    applyCheats();
    if (onCheatsReady) onCheatsReady(cheatEntries, selectedCheats);
    frameId = requestAnimationFrame(renderFrame);
    setTimeout(() => { if (!destroyed && running) applyCheats(); }, 300);
    loadPendingState();
  }

  function renderFrame(time) {
    if (!running || destroyed) return;
    frameId = requestAnimationFrame(renderFrame);
    if (paused) return;
    if (time - frameTime < 1000 / 65) return;
    frameTime = time;
    frameTick += 1;
    const pads = assignGamepads(navigator.getGamepads ? navigator.getGamepads() : [], {
      platform: game.platform,
      playerCount
    });
    for (let player = 0; player < supportedPlayers; player += 1) {
      const keys = maskForPlayer({
        platform: game.platform,
        bindings,
        player: `P${player + 1}`,
        heldKeys: pressedKeys,
        touchActions: touchActions[player],
        pad: pads[player] || null,
        padIndex: player,
        values,
        turboTick: frameTick
      });
      try { emulib._emuSetButton(player, keys); } catch (error) { console.warn('手柄输入失败', error); }
    }
    try {
      emulib._emuUpdate();
      const pixels = new Uint16Array(emulib.HEAPU8.buffer, emulib._emuGetVideoData(), canvas.width * canvas.height);
      for (let i = 0; i < pixels.length; i += 1) {
        const color = pixels[i];
        image.data[i * 4] = ((color >> 11) & 31) * 255 / 31;
        image.data[i * 4 + 1] = ((color >> 5) & 63) * 255 / 63;
        image.data[i * 4 + 2] = (color & 31) * 255 / 31;
        image.data[i * 4 + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    } catch (error) {
      console.error(error);
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
      if (playTimer) clearInterval(playTimer);
      flushTime();
      status('模拟器运行出错，请返回重试');
    }
  }

  async function start() {
    if (running || starting || destroyed) return;
    starting = true;
    status('正在准备模拟器…');
    if (!window.libemu) {
      starting = false;
      throw new Error('模拟器脚本尚未加载');
    }
    try {
      emuSound = new window.EMUSound(null);
    } catch (error) {
      console.warn('音频初始化失败，将静音运行', error);
      emuSound = null;
    }
    window.emuSound = emuSound;
    try {
      const module = await window.libemu({
        locateFile: name => new URL(`runtime/${name}`, document.baseURI).href,
        onAbort: () => status('模拟器加载失败，请刷新重试')
      });
      if (destroyed) {
        stopAudio();
        return;
      }
      emulib = module;
      window.emulib = module;
      window.emuSound = emuSound;
      if (emuSound) {
        emuSound.emscriptenModule = emulib;
        setVolumeSafe(emuSound, volume);
      }
      assets = await prepareGameAssets(game, status);
      if (destroyed) {
        stopAudio();
        return;
      }
      if (assets.resourcesUnavailable && onResourcesUnavailable) {
        try { onResourcesUnavailable(); } catch {}
      }
      values = actionValues(game.platform, assets.padSetting);
      bindings = loadBindings(game.platform);
      applyExtraDefaults();
      cheatEntries = assets.cheats || [];
      selectedCheats = readSelectedCheats();
      window.gameInfo = window.gameInfo || {};
      window.gameInfo.goldenFingerFiles = (assets.iniText || '').replace(/^\uFEFF/, '');
      try {
        await writeFilesToDb(rootPath, assets.romFiles);
      } catch (error) {
        throw new Error(`写入游戏缓存失败：${error.message}`);
      }
      if (destroyed) {
        stopAudio();
        return;
      }
      status(`正在启动 ${core.gameMode} 内核…`);
      try {
        emulib.ccall('emuSetJson', null, ['string'], [JSON.stringify({
          gameType: core.gameType,
          gameMode: core.gameMode,
          romPath: core.romPath,
          rootPath: core.rootPath,
          startMode: 0,
          gameID: game.id
        })]);
      } catch (error) {
        throw new Error(`emuSetJson 失败：${error.message}`);
      }
      emulib._emuFast(speed);
    } catch (error) {
      starting = false;
      stopAudio();
      console.error(error);
      status(`加载失败：${error.message}，请刷新重试`);
      throw error;
    }
  }

  function togglePause() {
    if (!running || !emulib) return paused;
    paused = !paused;
    try { emulib._emuPause(paused ? 1 : 0); } catch {}
    if (emuSound) setVolumeSafe(emuSound, paused ? 0 : volume);
    status(paused ? '游戏已暂停' : `游戏进行中 · ${game.platform}`);
    if (onPauseChange) onPauseChange(paused);
    return paused;
  }

  function setSpeed(next) {
    speed = Number(next) || 1;
    if (emulib) emulib._emuFast(speed);
    status(`已切换到 ${speed}× 速度`);
  }

  function setVolume(next) {
    volume = Math.min(1, Math.max(0, Number(next)));
    if (emuSound && !paused) setVolumeSafe(emuSound, volume);
  }

  function captureState() {
    if (!emulib || !running) throw new Error('游戏尚未开始');
    emulib.ccall('emuSaveState', null, ['string'], [statePath]);
    emulib._emuUpdate();
    const contents = emulib.FS.readFile(statePath);
    if (!contents.length) throw new Error('存档为空');
    return contents;
  }

  function thumbnail() {
    try {
      const thumb = document.createElement('canvas');
      thumb.width = 128;
      thumb.height = 96;
      thumb.getContext('2d').drawImage(canvas, 0, 0, 128, 96);
      return thumb.toDataURL('image/jpeg', 0.6);
    } catch {
      return '';
    }
  }

  async function saveState() {
    const contents = captureState();
    const createdAt = Date.now();
    const slot = {
      id: `slot-${createdAt}`,
      gameId: game.id,
      label: `即时存档 · ${formatClock(createdAt)}`,
      createdAt,
      seconds: sessionSeconds,
      thumb: thumbnail()
    };
    await writeSaveBytes(game.id, slot.id, contents);
    addSaveSlot(slot);
    const code = getSyncCode();
    if (code) {
      try {
        await uploadCloudSave(slot, contents, code);
        status('即时存档已保存并同步到云端');
      } catch (error) {
        console.warn('云同步失败', error);
        status('即时存档已保存到本地（云同步失败）');
      }
    } else {
      status('即时存档已保存到当前浏览器');
    }
    return slot;
  }

  async function loadState() {
    if (!emulib) throw new Error('游戏尚未开始');
    if (emulib.FS.analyzePath(statePath).exists) {
      emulib.ccall('emuLoadState', null, ['string'], [statePath]);
      emulib._emuUpdate();
      status('已读取即时存档');
      return;
    }
    const [latest] = getSaveSlots(game.id);
    if (!latest) throw new Error('还没有即时存档，请先点击「存档」');
    const contents = await readSaveBytes(game.id, latest.id);
    if (destroyed) return;
    if (!contents) throw new Error('存档数据已损坏');
    await loadStateBytes(contents, '已读取上次保存的即时存档', statePath);
  }

  async function loadSlot(slotId) {
    const contents = await readSaveBytes(game.id, slotId);
    if (destroyed) return;
    if (!contents) throw new Error('所选存档不存在或已损坏');
    await loadStateBytes(contents, '已读取所选存档');
  }

  async function loadCloudSlot(slotId) {
    status('正在下载云端存档…');
    const contents = await downloadCloudSave(game.id, slotId, getSyncCode(), controller.signal);
    if (destroyed) return;
    await loadStateBytes(contents, '已读取云端存档', `${rootPath}/cloud.state`);
  }

  async function loadStage(stageId) {
    const stage = assets?.stages?.find(item => String(item.id) === String(stageId));
    if (!stage) throw new Error('预置关卡不存在');
    await loadStateBytes(stage.state, `已进入${stage.label}`, `${rootPath}/stage.state`);
    return stage;
  }

  async function overwriteSlot(slotId) {
    const contents = captureState();
    const createdAt = Date.now();
    await writeSaveBytes(game.id, slotId, contents);
    const slot = updateSaveSlot(game.id, slotId, { createdAt, seconds: sessionSeconds, thumb: thumbnail() });
    const current = {
      id: slotId,
      gameId: game.id,
      label: slot?.label || '即时存档',
      createdAt,
      seconds: sessionSeconds,
      thumb: slot?.thumb || ''
    };
    const code = getSyncCode();
    if (code) {
      try {
        await uploadCloudSave(current, contents, code);
        status('存档已覆盖并同步到云端');
      } catch (error) {
        console.warn('云同步失败', error);
        status('存档已覆盖到本地（云同步失败）');
      }
    } else {
      status('存档已覆盖');
    }
    return current;
  }

  async function deleteSlot(slotId) {
    await deleteSaveBytes(game.id, slotId);
    removeSaveSlot(game.id, slotId);
    const code = getSyncCode();
    if (code) {
      try { await deleteCloudSave(game.id, slotId, code); } catch (error) { console.warn('云端删除失败', error); }
    }
    status('已删除存档');
  }

  async function overwriteCloudSlot(slotId, label = '云端存档') {
    const contents = captureState();
    const slot = {
      id: slotId,
      gameId: game.id,
      label,
      createdAt: Date.now(),
      seconds: sessionSeconds,
      thumb: thumbnail()
    };
    await uploadCloudSave(slot, contents, getSyncCode());
    status('云端存档已覆盖');
    return slot;
  }

  async function deleteCloudSlot(slotId) {
    await deleteCloudSave(game.id, slotId, getSyncCode());
    status('已删除云端存档');
  }

  function reload() {
    if (!emulib) return false;
    try {
      emulib._emuReset();
      emulib._emuUpdate();
      status('已重新加载');
      return true;
    } catch {
      return false;
    }
  }

  function setTouchAction(action, pressed, player = 0) {
    const target = touchActions[player];
    if (!target) return;
    if (pressed) target.add(action);
    else target.delete(action);
  }

  async function exportState() {
    const contents = captureState();
    const url = URL.createObjectURL(new Blob([contents]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(game.shortName || game.name).replace(/\s+/g, '-')}-${core.gameMode}.state`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(`即时存档已导出 · ${Math.ceil(contents.length / 1024)} KB`);
  }

  async function importState(file) {
    if (!file || !emulib) return;
    try {
      await loadStateBytes(await file.arrayBuffer(), '已导入即时存档', `${rootPath}/imported.state`);
    } catch (error) {
      status(`导入失败：${error.message}`);
    }
  }

  function isBoundKey(code) {
    for (const player of Object.values(bindings)) {
      for (const binding of Object.values(player)) {
        if (binding && !Array.isArray(binding) && binding.key === code) return true;
      }
      for (const combo of player.combos || []) {
        if (combo.key === code) return true;
      }
    }
    return false;
  }

  function isResetKey(code) {
    return Object.values(bindings).some(player => player.reset?.key === code);
  }

  function bindControls() {
    const signal = controller.signal;
    for (const type of ['keydown', 'keyup']) {
      window.addEventListener(type, event => {
        if (!running || inputPaused || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
        if (!isBoundKey(event.code) && !pressedKeys.has(event.code)) return;
        event.preventDefault();
        if (type === 'keydown') {
          pressedKeys.add(event.code);
          if (isResetKey(event.code) && emulib) {
            try {
              emulib._emuReset();
              emulib._emuUpdate();
              status('已重置');
            } catch {}
          }
        } else {
          pressedKeys.delete(event.code);
        }
      }, { signal });
    }
    window.addEventListener('blur', () => {
      pressedKeys.clear();
      touchActions.forEach(set => set.clear());
    }, { signal });
    if (!touchPad) return;
    for (const button of touchPad.querySelectorAll('[data-action]')) {
      const action = button.dataset.action;
      const player = Math.max(0, Number(button.dataset.player) || 0);
      button.addEventListener('pointerdown', event => {
        if (!running || !touchActions[player]) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        touchActions[player].add(action);
        button.classList.add('is-pressed');
      }, { signal });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(type, () => {
          touchActions[player]?.delete(action);
          button.classList.remove('is-pressed');
        }, { signal });
      }
    }
  }

  function setInputPaused(value) {
    inputPaused = Boolean(value);
    pressedKeys.clear();
  }

  // 街机 pad_setting 中的特殊键（BIOS / SPn），标签按原名，只有一个 SP 时显示为“SP”
  function extraActions() {
    const buttons = assets?.padSetting?.BUTTONS;
    if (!Array.isArray(buttons)) return [];
    const extras = buttons
      .map(button => ({ match: /^BUTTON_(BIOS|SP(\d))$/.exec(button.name), value: Number(button.vaule) }))
      .filter(item => item.match && item.value > 0)
      .map(({ match, value }) => match[1] === 'BIOS'
        ? { id: 'bios', label: 'BIOS', value }
        : { id: `sp${match[2]}`, label: `SP${match[2]}`, value });
    const sps = extras.filter(extra => extra.id !== 'bios');
    if (sps.length === 1) sps[0].label = 'SP';
    return extras;
  }

  // 与参照站默认键位一致：BIOS 用 0，第一个 SP 用 P；只补未保存过的键
  function applyExtraDefaults() {
    const extras = extraActions();
    const firstSp = extras.find(extra => extra.id !== 'bios');
    const defaults = { bios: 'Digit0', ...(firstSp ? { [firstSp.id]: 'KeyP' } : {}) };
    for (const extra of extras) {
      if (!bindings.P1 || bindings.P1[extra.id] || !defaults[extra.id]) continue;
      bindings.P1[extra.id] = { key: defaults[extra.id] };
    }
  }

  function reloadBindings() {
    bindings = loadBindings(game.platform);
    values = actionValues(game.platform, assets?.padSetting);
    applyExtraDefaults();
    pressedKeys.clear();
  }

  function setCheat(index, value) {
    selectedCheats[index] = Number(value) || 0;
    saveSelectedCheats();
    if (emulib && running) {
      try { emulib._emuCheatEnable(index, Number(value) || 0); } catch (error) { console.warn('金手指切换失败', error); }
    }
    return selectedCheats[index];
  }

  function resetCheats() {
    selectedCheats = {};
    saveSelectedCheats();
    cheatEntries.forEach((entry, index) => {
      if (emulib && running) {
        try { emulib._emuCheatEnable(index, 0); } catch {}
      }
    });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    running = false;
    if (frameId) cancelAnimationFrame(frameId);
    if (playTimer) clearInterval(playTimer);
    flushTime();
    controller.abort();
    if (emulib) {
      try { emulib._emuPause(1); } catch {}
    }
    stopAudio();
    pressedKeys.clear();
    touchActions.forEach(set => set.clear());
    if (activePlayer === api) activePlayer = null;
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {});
    }
  }

  bindControls();
  const api = {
    start,
    destroy,
    handleReady,
    togglePause,
    setSpeed,
    setVolume,
    saveState,
    loadState,
    loadSlot,
    loadCloudSlot,
    loadStage,
    overwriteSlot,
    deleteSlot,
    overwriteCloudSlot,
    deleteCloudSlot,
    reload,
    exportState,
    importState,
    getCheats: () => ({ entries: cheatEntries, selected: selectedCheats }),
    setCheat,
    resetCheats,
    reloadBindings,
    setInputPaused,
    setTouchAction,
    getBindings: () => bindings,
    getActions: () => actionsFor(game.platform),
    getPlayers: () => supportedPlayers,
    getStages: () => assets?.stages || [],
    getExtraActions: () => extraActions(),
    getSpeed: () => speed,
    getVolume: () => volume,
    isRunning: () => running,
    isPaused: () => paused
  };
  activePlayer = api;
  return api;
}
