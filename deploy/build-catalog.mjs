import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const manifestPath = process.argv[2] || '/Users/qilin.guo/AiProjects/res/wufan-ranking-resources.json';
const outputPath = new URL('../dist/games.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const screenshots = JSON.parse(await readFile(new URL('./wufan-screenshots.json', import.meta.url), 'utf8'));

const PLATFORM = {
  FC: { gameMode: 'FC', gameType: 35, plugin: 'FC', slug: 'fc' },
  街机: { gameMode: 'FBA_V2', gameType: 31, plugin: 'FBA', slug: 'arcade' },
  GBA: { gameMode: 'VBA', gameType: 33, plugin: 'VBA', slug: 'gba' }
};

const KEYWORDS = {
  pocket: ['口袋妖怪', '宝可梦', '宠物'],
  sanguo: ['三国', '三剑圣', '三圣剑', '群雄起源'],
  dino: ['恐龙快打'],
  classic: ['魂斗罗', '超级玛丽', '忍者神龟', '冒险岛', '赤色要塞', '绿色兵团', '双截龙', '松鼠大战', 'SD快打', '热血格斗', '假面骑士', '古巴战士', '封神榜', '圣火徽章', '重装机兵'],
  relax: ['俄罗斯方块', '中国象棋', '炸弹人', '坦克大战', '雪人兄弟', '玛丽医生', '越野摩托车', '火箭车', '足球', '棒球', '摔角', '吞食天地']
};

function objectOf(game, kind) {
  return game.objects.find(object => object.kind === kind);
}

function coverExt(game) {
  const cover = objectOf(game, 'cover');
  if (!cover) return '';
  return cover.key.split('.').pop().toLowerCase();
}

function matches(name, key) {
  return KEYWORDS[key].some(keyword => name.includes(keyword));
}

function lucky(game, salt = 0) {
  const id = String(game.id);
  let hash = Number(id) + salt;
  return Math.abs(Math.sin(hash) * 10000) % 1000;
}

function buildTags(game) {
  const name = game.name;
  const category =
    /口袋妖怪|宝可梦|宠物/.test(name) ? '角色扮演' :
    /三国|群雄/.test(name) ? '策略' :
    /恐龙快打|快打|格斗|拳皇|街霸|热血/.test(name) ? '格斗' :
    /魂斗罗|雷电|1945|射击|飞机/.test(name) ? '射击' :
    /超级玛丽|忍者神龟|冒险岛|赤色要塞|绿色兵团|双截龙|松鼠大战|炸弹人|坦克大战/.test(name) ? '闯关' :
    /俄罗斯方块|中国象棋|玛丽医生|炸弹人/.test(name) ? '益智' :
    /足球|棒球|摔角|越野|火箭车/.test(name) ? '体育' :
    /赛车|摩托/.test(name) ? '竞速' : '经典';
  const extra = /改版|版|汉化|中文|加强|纯净|修复|完美|无限/.test(name) ? '改版' : '怀旧';
  return [game.platform, category, extra];
}

function deriveDescription(game, platform) {
  const category = buildTags(game)[1];
  return `《${game.name}》是 ${platform} 平台的${category}作品，支持浏览器直接游玩。内置即时存档、按键自定义与金手指选项，打开就能找回当年的手感。`;
}

function releaseDateFor(rank) {
  const date = new Date(Date.UTC(2026, 9, 31));
  date.setUTCDate(date.getUTCDate() - Math.floor((rank - 1) / 8) * 2);
  return date.toISOString().slice(0, 10);
}

function scoreFor(rank) {
  return Number((9.8 - ((rank * 7) % 23) / 23 * 1.4).toFixed(1));
}

function playersFor(rank, id) {
  return Math.max(37, 42000 - rank * 370 + (Number(id) % 211));
}

function shortName(name) {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

function coreFor(game, id, info, rom) {
  const packageName = game.package;
  const rootPath = `/${packageName}`;
  if (id === 'pokemon-dark-phantom') {
    return {
      gameMode: 'VBA',
      gameType: 33,
      plugin: 'VBA',
      rootPath: '/pokemon-dark-phantom-vba',
      romPath: '/pokemon-dark-phantom-vba/pokemon-dark.gba',
      statePath: '/pokemon-dark-phantom-vba/adventure.state',
      romUrl: 'roms/pokemon-dark.gba',
      resourcesUrl: `games/${id}/resources.zip`,
      size: 33554188,
      legacy: true
    };
  }
  return {
    gameMode: info.gameMode,
    gameType: info.gameType,
    plugin: info.plugin,
    rootPath,
    romPath: `${rootPath}/${packageName}.zip`,
    statePath: `${rootPath}/adventure.state`,
    romUrl: `games/${id}/rom.zip`,
    resourcesUrl: game.objects.some(object => object.kind === 'resources') ? `games/${id}/resources.zip` : '',
    size: rom?.bytes || 0
  };
}

const games = manifest.games.map(game => {
  const info = PLATFORM[game.platform];
  if (!info) throw new Error(`Unknown platform: ${game.platform}`);
  const id = Number(game.id) === 1713536658 ? 'pokemon-dark-phantom' : String(game.id);
  const ext = coverExt(game);
  const rom = objectOf(game, 'rom');
  return {
    id,
    r2Id: String(game.id),
    rank: game.rank,
    name: game.name,
    shortName: shortName(game.name),
    platform: game.platform,
    package: game.package,
    tags: buildTags(game),
    players: playersFor(game.rank, game.id),
    score: scoreFor(game.rank),
    releaseDate: releaseDateFor(game.rank),
    desc: id === 'pokemon-dark-phantom'
      ? '回到丰缘地区，开启一段熟悉又陌生的冒险。全新剧情、全新地图与更完整的伙伴阵容，在浏览器里重温掌机时代最耐玩的角色扮演体验。支持即时存档、金手指与跨设备云存档。'
      : deriveDescription(game, game.platform),
    cover: ext ? `games/${id}/cover.${ext}` : '',
    coverExt: ext,
    coverTone: (game.rank % 4) + 1,
    screenshots: (screenshots[id]?.images || []).map(image => ({ src: image.src })),
    playable: true,
    hasResources: Boolean(objectOf(game, 'resources')),
    core: coreFor(game, id, info, rom)
  };
});

const byId = new Map(games.map(game => [game.id, game]));
const idsFor = key => games.filter(game => matches(game.name, key)).map(game => game.id);

const sections = [
  { id: 'pocket', name: '口袋热门改版', subtitle: '经典掌机冒险，一次玩个够', gameIds: idsFor('pocket') },
  { id: 'sanguo', name: '三国群英传', subtitle: '三国题材的街机与红白机经典', gameIds: idsFor('sanguo') },
  { id: 'dino', name: '恐龙快打合集', subtitle: '街机厅里最热闹的那台机器', gameIds: idsFor('dino') },
  { id: 'classic', name: '经典闯关', subtitle: '魂斗罗、玛丽与童年搭子', gameIds: idsFor('classic') },
  { id: 'relax', name: '打发无聊时间', subtitle: '随开随玩的小品与益智合集', gameIds: idsFor('relax') },
  { id: 'arcade', name: '街机厅精选', subtitle: '投币、开打、再来一局', gameIds: games.filter(game => game.platform === '街机').map(game => game.id) }
];

const bannerGames = {
  brand: byId.get('452377455') || games[0],
  pokemon: byId.get('pokemon-dark-phantom'),
  arcade: byId.get('3913852899') || games.find(game => game.platform === '街机'),
  challenge: byId.get('1663697867') || byId.get('mla') || games.find(game => game.platform === 'FC')
};

const banners = [
  { id: 'brand', title: '一局童年', subtitle: '经典重启 · 掌上开玩', kicker: 'RETRO ARCADE', theme: 'sun', art: 'pad', gameId: bannerGames.brand.id },
  { id: 'pokemon', title: '漆黑的魅影', subtitle: 'GBA 冒险 · 现已可玩', kicker: 'NOW PLAYING', theme: 'gba', art: 'handheld', gameId: bannerGames.pokemon.id },
  { id: 'arcade', title: '街机之夜', subtitle: '像素弹幕 · 一键开战', kicker: 'ARCADE NIGHT', theme: 'night', art: 'ship', gameId: bannerGames.arcade.id },
  { id: 'challenge', title: '速通挑战', subtitle: '本周精选 · 等你来战', kicker: 'SPEED RUN', theme: 'mint', art: 'flag', gameId: bannerGames.challenge.id }
];

const discoverIds = [
  '452377455',
  '3913852899',
  '1736527658',
  '1663697867',
  'pokemon-dark-phantom',
  '1241117653',
  '530554297',
  '122078927',
  '3521755551',
  '4168643380'
].filter(id => byId.has(id));
if (discoverIds.length < 8) {
  for (const game of games) {
    if (discoverIds.length >= 10) break;
    if (!discoverIds.includes(game.id)) discoverIds.push(game.id);
  }
}

const output = {
  brand: { name: '一局童年', tagline: '把快乐留在这一局', subtitle: 'RETRO ARCADE' },
  banners,
  platforms: [
    { id: 'arcade', name: '街机', icon: 'arcade', theme: 'arcade' },
    { id: 'fc', name: 'FC', icon: 'fc', theme: 'fc' },
    { id: 'gba', name: 'GBA', icon: 'gba', theme: 'gba' }
  ],
  sections: sections.filter(section => section.gameIds.length),
  discover: discoverIds,
  popular: games.slice(0, 6).map(game => game.id),
  games
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  games: games.length,
  platforms: Object.fromEntries(['FC', '街机', 'GBA'].map(platform => [platform, games.filter(game => game.platform === platform).length])),
  sections: output.sections.map(section => [section.id, section.gameIds.length]),
  output: outputPath.pathname
}, null, 2));
