import { bindings, defineConfig, triggers } from 'cf/config';

export default defineConfig(({ mode }) => {
const staging = mode === 'staging';
const secrets = ['AUTH_SECRET','PHONE_ENCRYPTION_KEY','ALIYUN_ACCESS_KEY_ID','ALIYUN_ACCESS_KEY_SECRET','SMS_SIGN_NAME','SMS_TEMPLATE_CODE','TURNSTILE_SECRET','TURNSTILE_SITE_KEY','WX_MCH_ID','WX_APP_ID','WX_PRIVATE_KEY','WX_SERIAL_NO','WX_API_V3_KEY','WX_PUBLIC_KEY','WX_PUBLIC_KEY_ID','WX_APP_SECRET','ADMIN_USER_IDS'];
return {
  accountId: '46bfda57b03f5303659ef8d27f94374a',
  worker: {
    name: staging ? 'retro-arcade-staging' : 'retro-arcade',
    entrypoint: './worker/index.js',
    compatibilityDate: '2026-10-31',
    assets: { runWorkerFirst: ['/roms/*', '/runtime/libvba.wasm', '/runtime/libnes.wasm', '/runtime/libfba_v2.wasm', '/games/*', '/videos/*', '/api/*'] },
    env: {
      ASSETS: bindings.assets(),
      RESOURCES: bindings.r2({ name: staging ? 'retro-arcade-staging-resources' : 'pokemon-dark-phantom-resources' }),
      DB: bindings.d1({ name: staging ? 'retro-arcade-platform-staging' : 'retro-arcade-platform' }),
      ...Object.fromEntries(['AUTH_ENABLED','PAYMENTS_ENABLED','RELAYS_ENABLED',...secrets].map(name => [name, bindings.secret()]))
    },
    triggers: [triggers.scheduled({ schedule: '* * * * *' })],
    observability: {
      enabled: true,
      logs: { enabled: true },
      traces: { enabled: true, headSamplingRate: 0.01 }
    }
  }
};
});
