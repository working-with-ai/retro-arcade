import { cp, mkdir, rm } from 'node:fs/promises';
import resources from '../worker/resources.json' with { type: 'json' };

const excluded = new Set(Object.values(resources).map(resource => resource.file));
await rm('.cloudflare-public', { recursive: true, force: true });
await mkdir('.cloudflare-public');
await cp('dist', '.cloudflare-public', {
  recursive: true,
  filter: path => !excluded.has(path)
});
await mkdir('.cloudflare-public/vendor', { recursive: true });
await cp('node_modules/qrcode-generator/dist/qrcode.mjs', '.cloudflare-public/vendor/qrcode.js');
