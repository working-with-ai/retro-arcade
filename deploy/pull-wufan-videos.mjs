#!/usr/bin/env node
/**
 * 从悟饭 H5 抓到的视频清单批量入库。
 *
 * 输入清单格式（键为游戏名，值与 dist/games.json 的 name 对应）：
 *   { "魂斗罗": { "video": "https://7xokg4cdn.myyx618.com/模拟器视频/魂斗罗x.mp4", "gameId": "452377455" }, ... }
 *
 * 用法：
 *   node deploy/pull-wufan-videos.mjs [清单路径] [--limit N] [--dry-run]
 *
 * 产物：下载到 media/videos/<gameId>.mp4，并上传 R2 videos/<gameId>/clip.mp4
 * 之后执行 npm run deploy，详情页首屏即可在线播放。
 */
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import catalog from '../dist/games.json' with { type: 'json' };

const BUCKET = 'pokemon-dark-phantom-resources';
const OUT_DIR = 'media/videos';
const args = process.argv.slice(2);
const manifestPath = args.find(arg => !arg.startsWith('--')) || 'wufan-videos.json';
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) || Infinity : Infinity;

const byName = new Map(catalog.games.map(game => [game.name, game.id]));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

await mkdir(OUT_DIR, { recursive: true });

async function download(url, target) {
  // 悟饭的文件名含中文与空格，直接交给 fetch 会 404，需要先做一次 URI 编码
  const response = await fetch(encodeURI(url));
  if (!response.ok) throw new Error(`下载失败 ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1024) throw new Error('文件过小，疑似不是视频');
  await writeFile(target, bytes);
  return bytes;
}

const report = { uploaded: [], skipped: [], failed: [] };
let processed = 0;

for (const [name, entry] of Object.entries(manifest)) {
  if (processed >= limit) break;
  const url = entry?.video;
  if (!url) {
    report.skipped.push({ name, reason: 'no-video-url' });
    continue;
  }
  const gameId = entry.gameId || byName.get(name);
  if (!gameId) {
    report.skipped.push({ name, reason: 'no-game-id' });
    continue;
  }
  processed += 1;
  const target = join(OUT_DIR, `${gameId}.mp4`);
  try {
    let bytes;
    try {
      bytes = new Uint8Array(await readFile(target));
    } catch {
      bytes = await download(url, target);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (dryRun) {
      report.uploaded.push({ gameId, name, bytes: bytes.byteLength, sha256, dryRun: true });
      continue;
    }
    const key = `videos/${gameId}/clip.mp4`;
    const result = spawnSync('node_modules/.bin/cf', [
      'r2', 'buckets', 'objects', 'upload', key,
      '--bucket-name', BUCKET,
      '--file', target,
      '--content-type', 'video/mp4',
      '--content-length', String(bytes.byteLength)
    ], { stdio: 'ignore', env: process.env });
    if (result.status !== 0) throw new Error(`R2 上传失败：${key}`);
    report.uploaded.push({ gameId, name, key, bytes: bytes.byteLength, sha256 });
    console.log(JSON.stringify({ event: 'video_uploaded', gameId, name, bytes: bytes.byteLength }));
  } catch (error) {
    report.failed.push({ gameId, name, error: error.message });
    console.log(JSON.stringify({ event: 'video_failed', name, message: error.message }));
  }
}

const info = await stat(OUT_DIR).catch(() => null);
console.log(JSON.stringify({
  summary: {
    uploaded: report.uploaded.length,
    skipped: report.skipped.length,
    failed: report.failed.length,
    outDir: info ? OUT_DIR : null
  },
  failed: report.failed.slice(0, 20)
}, null, 2));
