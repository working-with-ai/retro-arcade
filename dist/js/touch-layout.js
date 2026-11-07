import { MEMBERSHIP_LIMITS } from './membership-limits.js';

const KEY='ra:touch-layouts:v1';
export function getLayouts(){
  const value={version:1,layouts:{}};
  try{
    const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v?.version!==1||!v.layouts)return value;
    for(const platform of ['FC','GBA','街机']){
      if(!Array.isArray(v.layouts[platform]))continue;
      const seen=new Set();
      value.layouts[platform]=v.layouts[platform].slice(0,MEMBERSHIP_LIMITS.member.maxPresets).filter(p=>p&&typeof p.id==='string'&&/^[\w-]{1,100}$/.test(p.id)&&!seen.has(p.id)&&(seen.add(p.id),true)).map(p=>{
        const variants={portrait:{},landscape:{}};
        for(const orientation of ['portrait','landscape'])for(const [key,c] of Object.entries(p.variants?.[orientation]||{})){
          // Keep these keys and clampControl ranges aligned with worker/platform/accounts.js validateSettings.
          if(/^(stick|a|b|c|d|e|f|l|r|turbo-a|turbo-b|combo-abc|coin|select|start|speed)$/.test(key)&&c&&typeof c==='object')variants[orientation][key]=clampControl(c);
        }
        return{id:p.id,name:String(p.name||'我的布局').slice(0,20),variants};
      });
    }
  }catch{}
  return value;
}
export function replaceLayouts(value){localStorage.setItem(KEY,JSON.stringify(value));}
export function presetsFor(platform){return getLayouts().layouts[platform]||[];}
export function savePreset(platform,preset,max=MEMBERSHIP_LIMITS.free.maxPresets){
  const data=getLayouts(),list=[...(data.layouts[platform]||[])],index=list.findIndex(x=>x.id===preset.id);
  if(index<0){if(list.length>=max)throw Error(`当前方案每个平台最多保存${max}套布局`);list.push(preset);}else if(index>=max)throw Error('此预设已保留，续费后可继续编辑');else list[index]=preset;
  data.layouts[platform]=list;replaceLayouts(data);
}
export function removePreset(platform,presetId){const data=getLayouts();data.layouts[platform]=(data.layouts[platform]||[]).filter(x=>x.id!==presetId);replaceLayouts(data);}
export function activePreset(platform){try{return localStorage.getItem(`${KEY}:active:${platform}`)||'';}catch{return '';}}
export function setActivePreset(platform,presetId){localStorage.setItem(`${KEY}:active:${platform}`,presetId);}
// Bounds mirror worker/platform/accounts.js validateSettings; local imports clamp, API writes reject.
export function clampControl(c){const n=(v,f)=>Number.isFinite(v)?v:f;return{x:Math.min(1,Math.max(0,n(c.x,.5))),y:Math.min(1,Math.max(0,n(c.y,.5))),size:Math.min(1.8,Math.max(.6,n(c.size,1))),opacity:Math.min(1,Math.max(.2,n(c.opacity,1))),hidden:!!c.hidden};}
