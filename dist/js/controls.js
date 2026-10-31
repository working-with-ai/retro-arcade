const ACTIONS = {
  GBA: [
    ['up', '上'], ['down', '下'], ['left', '左'], ['right', '右'],
    ['a', 'A'], ['b', 'B'], ['l', 'L'], ['r', 'R'], ['start', 'START'], ['select', 'SELECT']
  ],
  FC: [
    ['up', '上'], ['down', '下'], ['left', '左'], ['right', '右'],
    ['a', 'A'], ['b', 'B'], ['select', 'SELECT'], ['start', 'START']
  ],
  街机: [
    ['up', '上'], ['down', '下'], ['left', '左'], ['right', '右'],
    ['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D'], ['e', 'E'], ['f', 'F'],
    ['coin', '投币'], ['start', '开始'], ['reset', '重置'],
    ['bios', 'BIOS'], ['sp0', 'SP1'], ['sp1', 'SP2'], ['sp2', 'SP3'], ['sp3', 'SP4'], ['sp4', 'SP5']
  ]
};

const DEFAULTS = {
  GBA: {
    P1: {
      up: { key: 'ArrowUp', pad: 12 }, down: { key: 'ArrowDown', pad: 13 },
      left: { key: 'ArrowLeft', pad: 14 }, right: { key: 'ArrowRight', pad: 15 },
      a: { key: 'KeyX', pad: 0 }, b: { key: 'KeyZ', pad: 1 },
      l: { key: 'KeyQ', pad: 4 }, r: { key: 'KeyE', pad: 5 },
      start: { key: 'Enter', pad: 9 }, select: { key: 'ShiftLeft', pad: 8 }
    }
  },
  FC: {
    P1: {
      up: { key: 'ArrowUp', pad: 12 }, down: { key: 'ArrowDown', pad: 13 },
      left: { key: 'ArrowLeft', pad: 14 }, right: { key: 'ArrowRight', pad: 15 },
      a: { key: 'KeyZ', pad: 0 }, b: { key: 'KeyX', pad: 1 },
      select: { key: 'ShiftLeft', pad: 8 }, start: { key: 'Enter', pad: 9 }
    },
    P2: {
      up: { key: 'KeyW', pad: 12 }, down: { key: 'KeyS', pad: 13 },
      left: { key: 'KeyA', pad: 14 }, right: { key: 'KeyD', pad: 15 },
      a: { key: 'KeyG', pad: 0 }, b: { key: 'KeyH', pad: 1 },
      select: { key: 'KeyT', pad: 8 }, start: { key: 'KeyY', pad: 9 }
    }
  },
  街机: {
    P1: {
      up: { key: 'KeyW', pad: 12 }, down: { key: 'KeyS', pad: 13 },
      left: { key: 'KeyA', pad: 14 }, right: { key: 'KeyD', pad: 15 },
      a: { key: 'KeyJ', pad: 0 }, b: { key: 'KeyK', pad: 1 },
      c: { key: 'KeyL', pad: 2 }, d: { key: 'KeyU', pad: 3 },
      e: { key: 'KeyI', pad: 4 }, f: { key: 'KeyO', pad: 5 },
      coin: { key: 'Digit5', pad: 8 }, start: { key: 'Digit1', pad: 9 },
      reset: { key: 'Digit9' }
    },
    P2: {
      up: { key: 'ArrowUp', pad: 12 }, down: { key: 'ArrowDown', pad: 13 },
      left: { key: 'ArrowLeft', pad: 14 }, right: { key: 'ArrowRight', pad: 15 },
      a: { key: 'Numpad1', pad: 0 }, b: { key: 'Numpad2', pad: 1 },
      c: { key: 'Numpad3', pad: 2 }, d: { key: 'Numpad4', pad: 3 },
      e: { key: 'Numpad5', pad: 4 }, f: { key: 'Numpad6', pad: 5 },
      coin: { key: 'Digit6', pad: 8 }, start: { key: 'Digit2', pad: 9 },
      reset: { key: 'Digit0' }
    },
    P3: {
      up: { key: '', pad: 12 }, down: { key: '', pad: 13 },
      left: { key: '', pad: 14 }, right: { key: '', pad: 15 },
      a: { key: '', pad: 0 }, b: { key: '', pad: 1 }, c: { key: '', pad: 2 }, d: { key: '', pad: 3 },
      e: { key: '', pad: 4 }, f: { key: '', pad: 5 }, coin: { key: '', pad: 8 }, start: { key: '', pad: 9 }
    },
    P4: {
      up: { key: '', pad: 12 }, down: { key: '', pad: 13 },
      left: { key: '', pad: 14 }, right: { key: '', pad: 15 },
      a: { key: '', pad: 0 }, b: { key: '', pad: 1 }, c: { key: '', pad: 2 }, d: { key: '', pad: 3 },
      e: { key: '', pad: 4 }, f: { key: '', pad: 5 }, coin: { key: '', pad: 8 }, start: { key: '', pad: 9 }
    }
  }
};

const VALUES = {
  GBA: { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32, l: 1024, r: 2048, start: 1 << 22, select: 1 << 23 },
  FC: { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32, select: 1 << 23, start: 1 << 22 },
  街机: { up: 1, down: 2, left: 4, right: 8, a: 16, b: 32, c: 64, d: 128, e: 256, f: 512, coin: 1 << 23, start: 1 << 22 }
};

const KEY_LABELS = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift', Space: 'Space',
  Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab', ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', MetaLeft: 'Cmd',
  MetaRight: 'Cmd', NumpadEnter: 'Enter', Semicolon: ';', Comma: ',',
  Period: '.', Slash: '/', Backquote: '`', BracketLeft: '[', BracketRight: ']'
};

for (const platform of Object.values(DEFAULTS)) {
  for (const player of Object.values(platform)) {
    for (const binding of Object.values(player)) binding.turbo = false;
  }
}

function platformSlug(platform) {
  if (platform === '街机') return 'arcade';
  if (platform === 'FC') return 'fc';
  return 'gba';
}

function defaultCombos() {
  return Array.from({ length: 4 }, () => ({ key: '', actions: [] }));
}

function normalizeCombos(value) {
  const list = Array.isArray(value) ? value : [];
  return Array.from({ length: 4 }, (_, index) => {
    const item = list[index] && typeof list[index] === 'object' ? list[index] : {};
    return {
      key: typeof item.key === 'string' ? item.key : '',
      actions: Array.isArray(item.actions) ? item.actions.filter(action => typeof action === 'string') : []
    };
  });
}

export function actionsFor(platform) {
  return (ACTIONS[platform] || ACTIONS.GBA).map(([id, label]) => ({ id, label }));
}

export function playersFor(platform) {
  if (platform === 'GBA') return 1;
  if (platform === '街机') return 4;
  return 2;
}

let gamepadAssignments = { platform: '', playerCount: 0, slots: [] };

export function assignGamepads(pads, { platform, playerCount }) {
  const connected = Array.from(pads || []).filter(pad => pad && pad.connected !== false);
  if (playerCount <= 1) {
    gamepadAssignments = { platform, playerCount: 1, slots: [] };
    return [connected[0] || null];
  }
  if (gamepadAssignments.platform !== platform || gamepadAssignments.playerCount !== playerCount) {
    gamepadAssignments = { platform, playerCount, slots: Array(playerCount).fill(null) };
  }
  const slots = gamepadAssignments.slots.slice();
  for (let index = 0; index < playerCount; index += 1) {
    const slot = slots[index];
    if (!slot) continue;
    const current = connected.find(pad => pad.index === slot.index);
    if (!current || (slot.id !== undefined && current.id !== slot.id)) slots[index] = null;
  }
  for (const pad of connected) {
    if (slots.some(slot => slot && slot.index === pad.index && slot.id === pad.id)) continue;
    const empty = slots.findIndex(slot => slot === null);
    if (empty < 0) break;
    slots[empty] = { index: pad.index, id: pad.id };
  }
  gamepadAssignments.slots = slots;
  return slots.map(slot => slot ? connected.find(pad => pad.index === slot.index && pad.id === slot.id) || null : null);
}

export function actionValues(platform, padSetting) {
  const values = { ...(VALUES[platform] || VALUES.GBA) };
  if (platform === '街机' && padSetting && Array.isArray(padSetting.BUTTONS)) {
    const names = {
      BUTTON_A: 'a', BUTTON_B: 'b', BUTTON_C: 'c', BUTTON_D: 'd',
      BUTTON_E: 'e', BUTTON_F: 'f', BUTTON_BIOS: 'bios',
      BUTTON_SP0: 'sp0', BUTTON_SP1: 'sp1', BUTTON_SP2: 'sp2',
      BUTTON_SP3: 'sp3', BUTTON_SP4: 'sp4'
    };
    for (const button of padSetting.BUTTONS) {
      const action = names[button.name];
      const value = Number(button.vaule);
      if (action && value > 0) values[action] = value;
    }
  }
  return values;
}

// 街机 pad_setting 里的特殊键，位值按游戏提供，不在默认键位表中
const EXTRA_ACTIONS = ['bios', 'sp0', 'sp1', 'sp2', 'sp3', 'sp4'];

function cloneDefaults(platform) {
  const defaults = JSON.parse(JSON.stringify(DEFAULTS[platform] || DEFAULTS.GBA));
  for (const player of Object.values(defaults)) player.combos = defaultCombos();
  defaults.turboSpeed = 1;
  return defaults;
}

export function loadBindings(platform) {
  const defaults = cloneDefaults(platform);
  try {
    const stored = JSON.parse(localStorage.getItem(`ra:keys:${platformSlug(platform)}`) || 'null');
    if (!stored || typeof stored !== 'object') return defaults;
    for (const player of Object.keys(defaults)) {
      for (const action of Object.keys(defaults[player])) {
        if (action === 'combos') continue;
        const value = stored[player]?.[action];
        if (value && typeof value === 'object') {
          if (typeof value.key === 'string') defaults[player][action].key = value.key;
          if (Number.isInteger(value.pad)) defaults[player][action].pad = value.pad;
          if (typeof value.turbo === 'boolean') defaults[player][action].turbo = value.turbo;
        }
      }
      if (stored[player]?.combos) defaults[player].combos = normalizeCombos(stored[player].combos);
      for (const action of EXTRA_ACTIONS) {
        const value = stored[player]?.[action];
        if (value && typeof value === 'object' && typeof value.key === 'string') defaults[player][action] = { key: value.key };
      }
    }
    defaults.turboSpeed = Math.min(4, Math.max(1, Number(stored.turboSpeed) || 1));
  } catch {
    /* use defaults */
  }
  return defaults;
}

export function saveBindings(platform, bindings) {
  try {
    localStorage.setItem(`ra:keys:${platformSlug(platform)}`, JSON.stringify(bindings));
  } catch {
    /* private mode */
  }
}

export function resetBindings(platform) {
  try { localStorage.removeItem(`ra:keys:${platformSlug(platform)}`); } catch {}
  const defaults = cloneDefaults(platform);
  defaults.turboSpeed = 1;
  return defaults;
}

export function keyLabel(code) {
  if (!code) return '未绑定';
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `N${code.slice(6)}`;
  if (/^F\d+$/.test(code)) return code;
  return code;
}

export function bindingLabel(binding) {
  const parts = [keyLabel(binding?.key)];
  if (Number.isInteger(binding?.pad)) parts.push(`手柄${binding.pad + 1}`);
  return parts.join(' · ');
}

export function maskForPlayer({
  platform,
  bindings,
  player,
  heldKeys,
  touchActions,
  pad,
  padIndex,
  values,
  turboTick = 0
}) {
  const playerBindings = bindings[player] || {};
  const actionValues = values || actionValues(platform);
  const turboSpeed = Math.min(4, Math.max(1, Number(bindings.turboSpeed) || 1));
  // 每档周期至少 2 帧，否则连发永远处于按下状态
  const period = [0, 8, 6, 4, 2][turboSpeed];
  let mask = 0;
  for (const action of actionsFor(platform)) {
    const binding = playerBindings[action.id];
    if (!binding) continue;
    const turboTouch = touchActions.has(`turbo-${action.id}`);
    const pressed = heldKeys.has(binding.key)
      || touchActions.has(action.id)
      || turboTouch
      || Boolean(pad?.buttons?.[binding.pad]?.pressed);
    if (!pressed) continue;
    const turbo = binding.turbo || turboTouch;
    if (turbo && Math.floor(turboTick) % period >= period / 2) continue;
    mask |= actionValues[action.id] || 0;
  }
  for (const action of EXTRA_ACTIONS) {
    const binding = playerBindings[action];
    if (binding?.key && heldKeys.has(binding.key)) mask |= actionValues[action] || 0;
  }
  for (const combo of playerBindings.combos || []) {
    if (!combo.key || !heldKeys.has(combo.key)) continue;
    for (const action of combo.actions) mask |= actionValues[action] || 0;
  }
  if (touchActions.has('combo-abc')) mask |= (actionValues.a || 0) | (actionValues.b || 0);
  if (pad) {
    const axisX = pad.axes[0] || 0;
    const axisY = pad.axes[1] || 0;
    if (axisY < -0.55) mask |= actionValues.up;
    if (axisY > 0.55) mask |= actionValues.down;
    if (axisX < -0.55) mask |= actionValues.left;
    if (axisX > 0.55) mask |= actionValues.right;
  }
  return mask;
}
