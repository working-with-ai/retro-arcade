import { icon } from '../ui.js';

export function render() {
  document.title = '游玩指南 · 一局童年';
  const el = document.createElement('div');
  el.className = 'page page-help';
  el.innerHTML = `<header class="catalog-header">
    <button type="button" class="catalog-back" data-back aria-label="返回">${icon('back')}</button><h1>游玩指南</h1><span class="catalog-back"></span>
  </header>
  <main class="help-main">
    <section class="help-intro"><p>把快乐留在这一局</p><h2>挑游戏，随时开玩</h2><span>无需登录，即可使用当前已开放的游玩工具。</span><a class="primary-pill" href="#/category">浏览游戏分类</a></section>
    <details class="help-item" open><summary>怎么开始游戏？</summary><p>从首页、分类或搜索进入游戏详情，点击「启动游戏」，等待资源加载完成后点击「开始游戏」。街机游戏先投币，再按开始；FC 和 GBA 使用开始键进入游戏。</p></details>
    <details class="help-item"><summary>键盘、手柄和触屏怎么操作？</summary><p>在游戏内打开「菜单 → 按键映射」，可查看并修改键盘按键、设置组合键和连发。连接手柄后可在按键映射中分配玩家。手机和平板会显示屏幕摇杆与按键。</p></details>
    <details class="help-item"><summary>如何保存和继续游戏？</summary><p>游戏内打开「存档 → 我的存档」新建存档。之后可从详情页读取，或在游戏内读取、覆盖、删除。也可导出当前进度为存档文件，以便备份和导入。</p></details>
    <details class="help-item"><summary>怎么在另一台设备继续玩？</summary><p>在「个人 → 云存档同步」生成同步码，再在另一台设备绑定同一个同步码。可以立即同步已有本地存档，随后从游戏详情页读取云端进度。</p><p>同步码用于访问你的云存档，请妥善保存。停止同步会解除本机绑定。</p><a href="#/my">前往云存档同步</a></details>
    <details class="help-item"><summary>金手指和快速选关在哪里？</summary><p>游戏开始后点击「金手指」查看本作可用选项。预置关卡显示在游戏详情页的存档区域，以及游戏内「存档 → 存档商店」中；不同游戏提供的资源不同。</p></details>
    <details class="help-item"><summary>加载失败、没有声音怎么办？</summary><p>先返回游戏详情后重新启动，并检查网络。没有声音时，先点击开始游戏，再检查设备音量和游戏菜单中的音量设置。浏览器或系统可能限制自动播放。</p></details>
    <details class="help-item"><summary>我的记录为什么没有出现在另一台设备？</summary><p>昵称、最近游玩、游戏时长、搜索记录和按键设置保存在当前浏览器。云同步目前用于游戏存档。清理浏览器网站数据可能删除本地记录和本地存档，清理前请先同步或导出存档。</p></details>
    <footer class="help-footer"><a href="licenses.html">模拟器来源与许可</a></footer>
  </main>`;
  return { el };
}
