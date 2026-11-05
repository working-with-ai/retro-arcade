import { bindings, defineConfig, triggers } from 'cf/config';

export default defineConfig({
  accountId: '46bfda57b03f5303659ef8d27f94374a',
  worker: {
    name: 'retro-arcade',
    entrypoint: './worker/index.js',
    compatibilityDate: '2026-10-31',
    assets: { runWorkerFirst: ['/roms/*', '/runtime/libvba.wasm', '/runtime/libnes.wasm', '/runtime/libfba_v2.wasm', '/games/*', '/videos/*', '/api/*'] },
    env: {
      ASSETS: bindings.assets(),
      RESOURCES: bindings.r2({ name: 'pokemon-dark-phantom-resources' })
    },
    triggers: [triggers.scheduled({ schedule: '* * * * *' })],
    observability: {
      enabled: true,
      logs: { enabled: true },
      traces: { enabled: true, headSamplingRate: 0.01 }
    }
  }
});
