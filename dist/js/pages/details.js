import { formatPlayTime, formatRelativeTime, getSaveSlots } from '../store.js';
import { getSyncCode, listCloudSaves } from '../cloud.js';
import { loadResourcesInfo } from '../resources.js';
import { coverMarkup, emptyState, escapeHtml, formatPlayers, icon, toast } from '../ui.js';
import { formatVideoTime, getGameVideo } from '../videos.js';

function screenshotArt(game, shot, index) {
  return `<div class="shot-art shot-tone-${escapeHtml(shot.tone || 'forest')} shot-index-${index}">
    <span class="shot-sun"></span>
    <span class="shot-hills"></span>
    <span class="shot-ghost">${escapeHtml((game.shortName || game.name).slice(0, 1))}</span>
    <span class="shot-scan"></span>
    <span class="shot-label">${escapeHtml(shot.label || '游戏画面')}</span>
  </div>`;
}

// 实机录像：直接播放 R2 上的视频，Range 请求由 worker 处理，可拖拽进度
function videoMarkup(game, video) {
  const firstShot = (game.screenshots || []).find(shot => shot && shot.src);
  const poster = firstShot ? escapeHtml(firstShot.src) : (game.cover ? escapeHtml(game.cover) : '');
  const duration = Number(video.duration) || 0;
  return `<video class="shot-video" src="${escapeHtml(video.url)}"${poster ? ` poster="${poster}"` : ''} playsinline webkit-playsinline preload="metadata" controls></video>
    <button class="shot-video-play" type="button" aria-label="播放${escapeHtml(game.shortName || game.name)}实机画面">
      <span class="shot-center">${icon('play')}</span>
    </button>
    <span class="shot-badge">实机录像${duration ? ` <b>${formatVideoTime(duration)}</b>` : ''}</span>`;
}

function cloudBadge() {
  return '<span class="cloud-badge">云</span>';
}

function saveRow(game, slot, cloudBySlot) {
  const isCloud = cloudBySlot?.has(slot.id);
  return `<article class="save-row ${isCloud ? 'is-cloud' : ''}">
    <a class="card-hit" href="#/play?id=${encodeURIComponent(game.id)}&amp;slot=${encodeURIComponent(slot.id)}" aria-label="继续 ${escapeHtml(slot.label)}"></a>
    ${coverMarkup(game, { variant: 'save' })}
    <div class="save-info">
      <h3>${escapeHtml(slot.label || '即时存档')}${isCloud ? cloudBadge() : ''}</h3>
      <p>${formatRelativeTime(slot.createdAt)} · 游玩 ${formatPlayTime(slot.seconds)}</p>
    </div>
    <button class="launch-btn save-go" type="button" data-launch="${escapeHtml(game.id)}" data-slot="${escapeHtml(slot.id)}">去玩</button>
  </article>`;
}

function stageRow(game, stage, imageUrl) {
  const thumb = imageUrl
    ? `<span class="stage-thumb"><img src="${imageUrl}" alt="${escapeHtml(stage.label)}" loading="lazy"></span>`
    : coverMarkup(game, { variant: 'save' });
  return `<article class="save-row stage-row">
    <a class="card-hit" href="#/play?id=${encodeURIComponent(game.id)}&amp;stage=${encodeURIComponent(stage.id)}" aria-label="进入${escapeHtml(stage.label)}"></a>
    ${thumb}
    <div class="save-info">
      <h3>${escapeHtml(stage.label)}</h3>
      <p>预置关卡 · 点击直接进入</p>
    </div>
    <button class="launch-btn save-go" type="button" data-launch="${escapeHtml(game.id)}" data-stage="${escapeHtml(stage.id)}">去玩</button>
  </article>`;
}

function cloudRow(game, save) {
  return `<article class="save-row is-cloud">
    <a class="card-hit" href="#/play?id=${encodeURIComponent(game.id)}&amp;cloud=${encodeURIComponent(save.slotId)}" aria-label="读取云端 ${escapeHtml(save.label)}"></a>
    ${coverMarkup(game, { variant: 'save' })}
    <div class="save-info">
      <h3>${escapeHtml(save.label || '云端存档')}${cloudBadge()}</h3>
      <p>${formatRelativeTime(save.createdAt)} · 游玩 ${formatPlayTime(save.seconds)}</p>
    </div>
    <button class="launch-btn save-go" type="button" data-launch="${escapeHtml(game.id)}" data-cloud="${escapeHtml(save.slotId)}">去玩</button>
  </article>`;
}

function saveRows(game, { stages, local, cloud, loading, imageUrls }) {
  const cloudBySlot = new Set(cloud.map(save => save.slotId));
  const localIds = new Set(local.map(slot => slot.id));
  const cloudOnly = cloud.filter(save => !localIds.has(save.slotId));
  const rows = [
    ...stages.map(stage => stageRow(game, stage, imageUrls.get(stage.id))),
    ...local.map(slot => saveRow(game, slot, cloudBySlot)),
    ...cloudOnly.map(save => cloudRow(game, save))
  ];
  if (!rows.length) {
    return loading
      ? '<p class="save-loading">正在读取关卡与云端存档…</p>'
      : emptyState('还没有存档', '进入游戏后点击「存档」，进度会显示在这里');
  }
  return `${rows.join('')}${loading ? '<p class="save-loading">正在读取关卡与云端存档…</p>' : ''}`;
}

function notFound() {
  const el = document.createElement('div');
  el.className = 'page page-details';
  el.innerHTML = `<header class="detail-nav is-scrolled">
    <button class="nav-back" type="button" data-back-home aria-label="返回">${icon('back')}</button>
    <span class="detail-nav-title">游戏详情</span>
  </header>
  <div class="detail-missing">
    ${emptyState('没有找到这款游戏', '它可能已经下架，或链接有误')}
    <a class="primary-pill" href="#/">回到首页</a>
  </div>`;
  document.title = '游戏详情 · 一局童年';
  return { el };
}

export function render({ data, query }) {
  const game = data.gamesById.get(query.get('id'));
  if (!game) return notFound();
  document.title = `${game.shortName || game.name} · 一局童年`;
  const shots = (game.screenshots || []).filter(shot => shot && shot.src);
  const available = Boolean(game.playable && game.core);
  const local = getSaveSlots(game.id);

  const el = document.createElement('div');
  el.className = `page page-details ${available ? 'is-playable' : 'is-coming'}`;
  el.innerHTML = `<header class="detail-nav">
    <button class="nav-back" type="button" data-back aria-label="返回">${icon('back')}</button>
    <span class="detail-nav-title">${escapeHtml(game.name)}</span>
  </header>
  <main class="detail-main">
    <section class="detail-hero">
      ${coverMarkup(game, { variant: 'hero' })}
      <div class="detail-hero-copy">
        <h1>${escapeHtml(game.name)}</h1>
        <p><span>${escapeHtml(game.platform)}</span><i>·</i>${formatPlayers(game.players)}人在玩</p>
        ${available ? '' : '<span class="coming-badge">即将上线</span>'}
      </div>
      <div class="score-card">
        <span>评分</span>
        <strong>${Number(game.score || 0).toFixed(1)}</strong>
      </div>
    </section>
    <div class="shots-scroll" aria-label="游戏画面与截图">
      ${shots.length
        ? shots.map((shot, index) => `<figure class="shot-slide">
        <img class="shot-image" src="${escapeHtml(shot.src)}" alt="${escapeHtml(`${game.shortName || game.name} 游戏画面 ${index + 1}`)}" loading="lazy" decoding="async">
      </figure>`).join('')
        : `<figure class="shot-slide" data-shot-primary>
        ${screenshotArt(game, { label: '游戏画面', tone: 'forest' }, 0)}
        <button class="shot-hit" type="button" data-launch="${escapeHtml(game.id)}" aria-label="${available ? `启动${escapeHtml(game.shortName || game.name)}` : '游戏即将上线'}"></button>
        <span class="shot-badge">${available ? '暂无实机录像' : '即将上线'}</span>
      </figure>`}
    </div>
    <section class="detail-copy">
      <div class="desc-wrap">
        <p class="detail-desc">${escapeHtml(game.desc || '这款游戏正在准备中。')}</p>
        <button class="desc-toggle" type="button">更多</button>
      </div>
    </section>
    <section class="cloud-save">
      <div class="cloud-head">
        <h2>云存档</h2>
        <span>预置关卡 · 本地 · 云端</span>
      </div>
      <div id="save-area">${saveRows(game, { stages: [], local, cloud: [], loading: true, imageUrls: new Map() })}</div>
    </section>
  </main>
  <div class="detail-bottom-bar">
    <button class="primary-launch" type="button" data-launch="${escapeHtml(game.id)}">
      <span>${icon('gamepad')}</span>启动游戏
    </button>
  </div>`;

  return {
    el,
    mount() {
      const nav = el.querySelector('.detail-nav');
      const area = el.querySelector('#save-area');
      const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 112);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      const descWrap = el.querySelector('.desc-wrap');
      const toggle = el.querySelector('.desc-toggle');
      const onToggle = () => {
        const expanded = descWrap.classList.toggle('is-expanded');
        toggle.textContent = expanded ? '收起' : '更多';
      };
      toggle.addEventListener('click', onToggle);

      let destroyed = false;
      let imageUrls = new Map();
      const videoController = new AbortController();

      // 首屏「游戏画面」：R2 上有实机录像就排在第一位，后面接悟饭原图
      const strip = el.querySelector('.shots-scroll');
      const primaryShot = el.querySelector('.shot-slide[data-shot-primary]');
      for (const image of el.querySelectorAll('.shot-slide img.shot-image')) {
        const markFailed = () => {
          if (destroyed || !image.isConnected) return;
          const badge = document.createElement('span');
          badge.className = 'shot-badge';
          badge.textContent = '图片加载失败';
          image.replaceWith(badge);
        };
        if (image.complete && image.naturalWidth === 0) markFailed();
        else image.addEventListener('error', markFailed, { once: true });
      }
      if (strip && available) {
        (async () => {
          const video = await getGameVideo(game.id, { signal: videoController.signal });
          if (destroyed || !strip.isConnected) return;
          if (!video) return;
          const slide = primaryShot || document.createElement('figure');
          if (primaryShot) primaryShot.removeAttribute('data-shot-primary');
          else {
            slide.className = 'shot-slide';
            strip.insertBefore(slide, strip.firstElementChild);
          }
          const restore = status => {
            if (destroyed) return;
            if (!primaryShot) {
              slide.remove();
              return;
            }
            primaryShot.classList.remove('has-video', 'is-playing');
            primaryShot.innerHTML = `${screenshotArt(game, { label: '游戏画面', tone: 'forest' }, 0)}
            <button class="shot-hit" type="button" data-launch="${escapeHtml(game.id)}" aria-label="启动${escapeHtml(game.shortName || game.name)}"></button>
            <span class="shot-badge">${escapeHtml(status)}</span>`;
          };
          slide.innerHTML = videoMarkup(game, video);
          slide.classList.add('has-video');
          const media = slide.querySelector('.shot-video');
          const playButton = slide.querySelector('.shot-video-play');
          if (!media || !playButton) {
            restore('实机录像加载失败');
            return;
          }
          // 时长以视频自身元数据为准：CLI 批量上传的素材没有附带时长也能显示
          const refreshDuration = () => {
            if (!Number.isFinite(media.duration) || media.duration <= 0) return;
            const badge = slide.querySelector('.shot-badge');
            if (!badge) return;
            let label = badge.querySelector('b');
            if (!label) {
              label = document.createElement('b');
              badge.appendChild(document.createTextNode(' '));
              badge.appendChild(label);
            }
            label.textContent = formatVideoTime(media.duration);
          };
          media.addEventListener('loadedmetadata', refreshDuration);
          if (media.readyState >= 1) refreshDuration();
          media.addEventListener('error', () => restore('实机录像加载失败'));
          playButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            media.play().catch(() => {
              toast('当前浏览器无法播放这段视频');
              restore('实机录像无法播放');
            });
          });
          media.addEventListener('playing', () => slide.classList.add('is-playing'));
          media.addEventListener('pause', () => slide.classList.remove('is-playing'));
          media.addEventListener('ended', () => slide.classList.remove('is-playing'));
        })();
      }
      const releaseImages = () => {
        for (const url of imageUrls.values()) URL.revokeObjectURL(url);
        imageUrls = new Map();
      };
      const paint = (stages, cloud, loading) => {
        releaseImages();
        for (const stage of stages) {
          if (stage.image) {
            const type = stage.file.endsWith('.png') ? 'image/png' : 'image/jpeg';
            imageUrls.set(stage.id, URL.createObjectURL(new Blob([stage.image], { type })));
          }
        }
        area.innerHTML = saveRows(game, {
          stages,
          local: getSaveSlots(game.id),
          cloud,
          loading,
          imageUrls
        });
      };

      (async () => {
        let stages = [];
        let cloud = [];
        try {
          if (game.core?.resourcesUrl) {
            const resources = await loadResourcesInfo(game);
            stages = resources.stages || [];
          }
        } catch (error) {
          console.warn('读取预置关卡失败', error);
        }
        try {
          const code = getSyncCode();
          if (code) cloud = (await listCloudSaves(code)).filter(save => save.gameId === game.id);
        } catch (error) {
          console.warn('读取云端存档失败', error);
        }
        if (destroyed) return;
        paint(stages, cloud, false);
      })();

      return () => {
        destroyed = true;
        videoController.abort();
        window.removeEventListener('scroll', onScroll);
        toggle.removeEventListener('click', onToggle);
        releaseImages();
      };
    }
  };
}
