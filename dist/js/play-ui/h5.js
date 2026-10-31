const ACTION_SETS = {
  FC: [
    ['turbo-a', 'AA', 'h5-aa'], ['a', 'A', 'h5-a'],
    ['turbo-b', 'BB', 'h5-bb'], ['b', 'B', 'h5-b']
  ],
  GBA: [
    ['turbo-a', 'AA', 'h5-aa'], ['a', 'A', 'h5-a'],
    ['turbo-b', 'BB', 'h5-bb'], ['b', 'B', 'h5-b']
  ],
  街机: [
    ['c', 'C', 'h5-c'], ['f', 'F', 'h5-f'], ['b', 'B', 'h5-b'],
    ['e', 'E', 'h5-e'], ['a', 'A', 'h5-a'], ['d', 'D', 'h5-d'],
    ['combo-abc', 'ABC', 'h5-abc']
  ]
};

// 祖先元素累计的线性变换（本地→屏幕）；纯旋转的逆矩阵就是转置，由调用方套用
function rotationOf(element) {
  let a = 1;
  let b = 0;
  let c = 0;
  let d = 1;
  for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
    const transform = getComputedStyle(node).transform;
    if (!transform || transform === 'none') continue;
    const m = new DOMMatrixReadOnly(transform);
    [a, b, c, d] = [m.a * a + m.c * b, m.b * a + m.d * b, m.a * c + m.c * d, m.b * c + m.d * d];
  }
  return [a, b, c, d];
}

export function h5Markup(platform) {
  const actions = ACTION_SETS[platform] || ACTION_SETS.FC;
  const select = platform === '街机' ? 'coin' : 'select';
  return `<section class="h5-controls h5-${platform === '街机' ? 'arcade' : platform.toLowerCase()}" id="play-touch" aria-label="屏幕游戏按键" hidden>
    <div class="h5-stick" data-h5-stick>
      <span class="h5-stick-ring"></span>
      <span class="h5-stick-knob" data-h5-knob></span>
    </div>
    <div class="h5-system">
      <button type="button" data-h5-action="${select}" data-h5-momentary>投币</button>
      <button type="button" data-h5-action="start" data-h5-momentary>开始</button>
      <button type="button" data-h5-action="speed">加速</button>
    </div>
    <div class="h5-actions">
      ${actions.map(([action, label, className]) => `<button type="button" class="h5-key ${className}" data-h5-action="${action}">${label}</button>`).join('')}
    </div>
  </section>`;
}

export function mountH5({ root, player, onSpeed }) {
  const stick = root.querySelector('[data-h5-stick]');
  const knob = root.querySelector('[data-h5-knob]');
  const speedButton = root.querySelector('[data-h5-action="speed"]');
  const controller = new AbortController();
  const signal = controller.signal;
  let pointer = null;
  let enabled = true;

  const clearDirections = () => {
    for (const action of ['up', 'down', 'left', 'right']) player.setTouchAction(action, false);
  };

  const moveStick = event => {
    if (pointer !== event.pointerId || !enabled) return;
    const rect = stick.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // 竖屏时整页旋转 90°，屏幕坐标要换回旋转后的本地坐标再判断方向
    const screenX = event.clientX - centerX;
    const screenY = event.clientY - centerY;
    const [a, b, c, d] = rotationOf(root);
    let dx = a * screenX + b * screenY;
    let dy = c * screenX + d * screenY;
    const distance = Math.hypot(dx, dy);
    const limit = radius * 0.38;
    if (distance > limit) {
      dx = dx / distance * limit;
      dy = dy / distance * limit;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const threshold = radius * 0.2;
    player.setTouchAction('up', dy < -threshold);
    player.setTouchAction('down', dy > threshold);
    player.setTouchAction('left', dx < -threshold);
    player.setTouchAction('right', dx > threshold);
  };

  const releaseStick = event => {
    if (pointer !== event.pointerId) return;
    pointer = null;
    knob.style.transform = '';
    clearDirections();
  };

  stick.addEventListener('pointerdown', event => {
    if (!enabled) return;
    event.preventDefault();
    pointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    moveStick(event);
  }, { signal });
  stick.addEventListener('pointermove', moveStick, { signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(type, releaseStick, { signal });
  }

  for (const button of root.querySelectorAll('[data-h5-action]')) {
    const action = button.dataset.h5Action;
    if (action === 'speed') {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!enabled) return;
        const speed = onSpeed();
        button.textContent = speed === 1 ? '加速' : `x${speed}`;
      }, { signal });
      continue;
    }
    if (button.hasAttribute('data-h5-momentary')) {
      button.addEventListener('pointerdown', event => {
        if (!enabled) return;
        event.preventDefault();
        event.stopPropagation();
        button.setPointerCapture(event.pointerId);
        player.setTouchAction(action, true);
        button.classList.add('is-pressed');
      }, { signal });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(type, () => {
          player.setTouchAction(action, false);
          button.classList.remove('is-pressed');
        }, { signal });
      }
      continue;
    }
    button.addEventListener('pointerdown', event => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      player.setTouchAction(action, true);
      button.classList.add('is-pressed');
    }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, () => {
        player.setTouchAction(action, false);
        button.classList.remove('is-pressed');
      }, { signal });
    }
  }

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    setEnabled(value) {
      enabled = Boolean(value);
      root.classList.toggle('is-disabled', !enabled);
      if (!enabled) {
        clearDirections();
        knob.style.transform = '';
        for (const button of root.querySelectorAll('.is-pressed')) button.classList.remove('is-pressed');
      }
    },
    updateSpeed(speed) {
      if (speedButton) speedButton.textContent = speed === 1 ? '加速' : `x${speed}`;
    },
    destroy() {
      controller.abort();
      clearDirections();
    }
  };
}
