let currentUser = null;
export function accountUser() { return currentUser; }
export function setAccountUser(user) { currentUser=user; }
export async function api(path,{method='GET',body,headers={},signal}={}) {
  const binary=body instanceof Uint8Array||body instanceof ArrayBuffer||body instanceof Blob;
  const res=await fetch(path,{method,credentials:'same-origin',headers:{...(body&&!binary?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:binary?body:JSON.stringify(body)}:{}),signal});
  if(!res.ok) {
    const data=await res.json().catch(()=>({})),error=new Error(data.error||`请求失败 (${res.status})`);
    error.status=res.status;error.code=data.code;
    if(res.status===401)currentUser=null;
    throw error;
  }
  return res.headers.get('Content-Type')?.includes('application/json')?res.json():new Uint8Array(await res.arrayBuffer());
}
export async function refreshAccount(signal) {
  try {const data=await api('/api/me',{signal});currentUser=data.user;return data;}
  catch(e){if(e.status===401||e.status===503){currentUser=null;return null;}throw e;}
}
export async function initializeAccount() { await refreshAccount(AbortSignal.timeout(5000)).catch(()=>{}); }
export async function syncLayoutSettings(local,resolveConflict) {
  const remote=await api('/api/me/settings');
  let value=local;
  if(JSON.stringify(local)!==JSON.stringify(remote.value) && Object.keys(remote.value.layouts||{}).length) {
    const choice=await resolveConflict();
    if(choice==='cloud')return remote;
    if(choice!=='local')return null;
  }
  return api('/api/me/settings',{method:'PUT',body:{revision:remote.revision,value}});
}
