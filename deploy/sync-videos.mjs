#!/usr/bin/env node
/**
 * 把本地已有的实机视频批量写入 R2。
 *
 * 用法：
 *   node deploy/sync-videos.mjs                    # 扫描 media/videos
 *   node deploy/sync-videos.mjs <目录或文件…>       # 指定来源
 *
 * 文件命名约定：<gameId>.mp4 / <gameId>.webm，例如 452377455.mp4。
 * 上传后的 key 为 videos/<gameId>/clip.<ext>，与 worker 的 /videos/<gameId> 对应。
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { basename, extname, join } from 'node:path';
import catalog from '../dist/games.json' with { type: 'json' };

const BUCKET = 'pokemon-dark-phantom-resources';
const VIDEO_TYPES = { '.mp4': 'video/mp4', '.webm': 'video/webm' };
const knownGames = new Set(catalog.games.map(game => game.id));

async function collect(targets) {
  const files = [];
  for (const target of targets) {
    const info = await stat(target);
    if (info.isDirectory()) {
      for (const entry of await readdir(target)) {
        const path = join(target, entry);
        if (VIDEO_TYPES[extname(entry).toLowerCase()]) files.push(path);
      }
      continue;
    }
    files.push(target);
  }
  return files;
}

const targets = process.argv.slice(2);
const files = await collect(targets.length ? targets : ['media/videos']);
if (!files.length) {
  console.log(JSON.stringify({ event: 'no_video_found', hint: '把 <gameId>.mp4 放进 media/videos 后重试' }));
  process.exit(0);
}

let uploaded = 0;
for (const file of files) {
  const ext = extname(file).toLowerCase();
  const contentType = VIDEO_TYPES[ext];
  const gameId = basename(file, extname(file));
  if (!contentType) {
    console.log(JSON.stringify({ event: 'skip_type', file }));
    continue;
  }
  if (!knownGames.has(gameId)) {
    console.log(JSON.stringify({ event: 'skip_unknown_game', file, gameId }));
    continue;
  }
  const contents = await readFile(file);
  const sha256 = createHash('sha256').update(contents).digest('hex');
  const key = `videos/${gameId}/clip${ext}`;
  const result = spawnSync('node_modules/.bin/cf', [
    'r2', 'buckets', 'objects', 'upload', key,
    '--bucket-name', BUCKET,
    '--file', file,
    '--content-type', contentType,
    '--content-length', String(contents.byteLength)
  ], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`R2 upload failed: ${key}`);
  uploaded += 1;
  console.log(JSON.stringify({ event: 'video_uploaded', gameId, key, bytes: contents.byteLength, sha256 }));
}

console.log(JSON.stringify({ event: 'done', uploaded, total: files.length }));
