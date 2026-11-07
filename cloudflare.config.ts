import { bindings, defineConfig, triggers } from 'cf/config';

export default defineConfig(({ mode }) => {
const staging = mode === 'staging';
const database = process.env.PLATFORM_DATABASE_ENABLED === 'true';
const auth = database && process.env.PLATFORM_AUTH_ENABLED === 'true';
const payments = auth && process.env.PLATFORM_PAYMENTS_ENABLED === 'true';
const relays = auth && process.env.PLATFORM_RELAYS_ENABLED === 'true';
const authSecrets = ['AUTH_SECRET','PHONE_ENCRYPTION_KEY','ALIYUN_ACCESS_KEY_ID','ALIYUN_ACCESS_KEY_SECRET','SMS_SIGN_NAME','SMS_TEMPLATE_CODE','TURNSTILE_SECRET','TURNSTILE_SITE_KEY'];
const paymentSecrets = ['WX_MCH_ID','WX_APP_ID','WX_PRIVATE_KEY','WX_SERIAL_NO','WX_API_V3_KEY','WX_PUBLIC_KEY','WX_PUBLIC_KEY_ID','WX_APP_SECRET'];
const secrets = [...(auth ? authSecrets : []), ...(payments ? paymentSecrets : [])];
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
      ...(database ? { DB: bindings.d1({ name: staging ? 'retro-arcade-platform-staging' : 'retro-arcade-platform' }) } : {}),
      AUTH_ENABLED: bindings.text(String(auth)),
      PAYMENTS_ENABLED: bindings.text(String(payments)),
      RELAYS_ENABLED: bindings.text(String(relays)),
      ADMIN_USER_IDS: bindings.text(process.env.PLATFORM_ADMIN_USER_IDS || ''),
      ...Object.fromEntries(secrets.map(name => [name, bindings.secret()]))
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
