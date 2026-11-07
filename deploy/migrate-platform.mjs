import { readFile, readdir } from 'node:fs/promises';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare account and deployment credentials are required');
const projectConfig=await readFile(new URL('../cloudflare.config.ts',import.meta.url),'utf8');
const projectAccount=/accountId:\s*['"]([a-f0-9]{32})['"]/.exec(projectConfig)?.[1];
console.log(JSON.stringify({event:'cloudflare_auth_context',accountMatchesProject:account===projectAccount,accountHasOuterWhitespace:account!==account.trim(),tokenHasOuterWhitespace:token!==token.trim()}));
if(!projectAccount||account!==projectAccount)throw Error('CLOUDFLARE_ACCOUNT_ID does not exactly match the project accountId; verify the repository secret');
if(token!==token.trim())throw Error('CLOUDFLARE_API_TOKEN contains leading or trailing whitespace; verify the repository secret');
const name=process.env.DEPLOY_MODE==='staging'?'retro-arcade-platform-staging':'retro-arcade-platform';
async function api(path,method='GET',body){
  const res=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json();
  if(!res.ok||!data.success){
    if(res.status===401||res.status===403){
      for(const [scope,endpoint] of [['user','/user/tokens/verify'],['account',`/accounts/${account}/tokens/verify`]]){
        try{
          const check=await fetch(`https://api.cloudflare.com/client/v4${endpoint}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
          const verified=await check.json();
          console.log(JSON.stringify({event:'cloudflare_token_check',scope,httpStatus:check.status,active:verified.success===true&&verified.result?.status==='active',errorCodes:(verified.errors||[]).map(e=>e.code)}));
        }catch{console.log(JSON.stringify({event:'cloudflare_token_check',scope,requestFailed:true}));}
      }
    }
    throw Error(`D1 provisioning/migration failed (${res.status}, error codes ${(data.errors||[]).map(e=>e.code).join(',')}); verify D1 Edit permission and account access on the deployment token`);
  }
  return data.result;
}
const list=await api('/d1/database?per_page=100');
let database=list.find(x=>x.name===name);
if(!database)database=await api('/d1/database','POST',{name});
const dbId=database.uuid||database.id;
async function query(sql,params=[]){const result=await api(`/d1/database/${dbId}/query`,'POST',{sql,params});if(result.some(r=>r.success===false))throw Error('D1 SQL migration failed');return result;}
await query('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  const existing=await query('SELECT id FROM schema_migrations WHERE id=?',[file]);if(existing[0].results.length)continue;
  // Migrations use idempotent DDL and do not drop or rewrite existing application data.
  await query(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
  await query('INSERT OR IGNORE INTO schema_migrations(id,applied_at) VALUES(?,?)',[file,Date.now()]);
  console.log(`Applied ${file}`);
}
console.log(`D1 database ${name} is ready`);
