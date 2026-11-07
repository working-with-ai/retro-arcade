import { accountUser } from '../account.js';
import { activePreset, setActivePreset, presetsFor, savePreset, removePreset, clampControl } from '../touch-layout.js';
import { escapeHtml as h,toast } from '../ui.js';
function transformOf(element){let a=1,b=0,c=0,d=1;for(let node=element;node&&node!==document.documentElement;node=node.parentElement){const t=getComputedStyle(node).transform;if(t==='none')continue;const m=new DOMMatrixReadOnly(t);[a,b,c,d]=[m.a*a+m.c*b,m.b*a+m.d*b,m.a*c+m.c*d,m.b*c+m.d*d];}return[a,b,c,d];}
export function createTouchEditor({root,platform,player}){
  const controller=new AbortController(),signal=controller.signal;let controls=[],defaults={},draft=null,editing=false,selected='',drag=null,wasPaused=false,current=null;
  const orientation=()=>innerWidth<innerHeight?'portrait':'landscape';
  const pane=document.createElement('section');pane.className='touch-editor-panel';pane.hidden=true;pane.setAttribute('aria-label','编辑触屏布局');root.parentElement.appendChild(pane);
  function localPoint(x,y){const rect=root.getBoundingClientRect(),[a,b,c,d]=transformOf(root),dx=x-(rect.left+rect.width/2),dy=y-(rect.top+rect.height/2);return{x:a*dx+b*dy+root.clientWidth/2,y:c*dx+d*dy+root.clientHeight/2};}
  function initialize(){
    if(controls.length)return;
    const items=[root.querySelector('[data-h5-stick]'),...root.querySelectorAll('[data-h5-action]')].filter(Boolean),unit=Math.min(root.clientWidth,root.clientHeight);
    controls=items.map(node=>{
      const key=node.hasAttribute('data-h5-stick')?'stick':node.dataset.h5Action,rect=node.getBoundingClientRect(),point=localPoint(rect.left+rect.width/2,rect.top+rect.height/2);
      defaults[key]={x:point.x/root.clientWidth,y:point.y/root.clientHeight,size:1,opacity:1,hidden:false};
      return{node,key,w:node.offsetWidth/unit,h:node.offsetHeight/unit};
    });
    for(const c of controls){c.node.dataset.layoutKey=c.key;c.node.classList.add('layout-control');root.appendChild(c.node);}
  }
  function position(){
    if(!controls.length)return;
    const variant=(editing?draft:current)?.variants?.[orientation()]||{},W=root.clientWidth,H=root.clientHeight,unit=Math.min(W,H);
    for(const item of controls){
      const c=clampControl({...defaults[item.key],...variant[item.key]}),w=Math.max(44,item.w*unit*c.size),height=Math.max(44,item.h*unit*c.size);
      let x=Math.min(W-w/2,Math.max(w/2,c.x*W)),y=Math.min(H-height/2,Math.max(height/2,c.y*H));
      // Keep the persistent menu area at the top unobstructed.
      y=Math.max(Math.min(H-height/2,64+height/2),y);
      Object.assign(item.node.style,{position:'absolute',left:`${x}px`,top:`${y}px`,right:'auto',bottom:'auto',width:`${w}px`,height:`${height}px`,transform:'translate(-50%,-50%)',opacity:String(editing?Math.max(.35,c.opacity):c.opacity),zIndex:'2'});
      item.node.hidden=!editing&&c.hidden;item.node.classList.toggle('layout-selected',editing&&selected===item.key);
    }
  }
  function apply(){
    if(editing){position();return;}
    const list=presetsFor(platform);current=list.find(p=>p.id===activePreset(platform))||list[0]||null;
    if(current){initialize();position();}else if(controls.length)position();
  }
  function fields(){
    const c={...defaults[selected],...draft.variants[orientation()]?.[selected]};
    pane.innerHTML=`<div class="touch-editor-head"><strong>编辑触屏布局</strong><button data-edit-action="cancel">取消</button><button data-edit-action="save">保存</button></div><p>拖动按键调整位置，选择按键后调整大小和透明度。</p><div class="touch-editor-fields"><label>当前按键<select data-control>${controls.map(x=>`<option value="${h(x.key)}"${x.key===selected?' selected':''}>${x.key==='stick'?'摇杆':h(x.node.textContent.trim())}</option>`).join('')}</select></label><label>大小<input data-size type="range" min="0.6" max="1.8" step="0.05" value="${c.size}"></label><label>透明度<input data-opacity type="range" min="0.2" max="1" step="0.05" value="${c.opacity}"></label><label><input type="checkbox" data-hidden ${c.hidden?'checked':''}>隐藏该按键</label></div><div class="touch-editor-presets"><input data-name maxlength="20" aria-label="预设名称" value="${h(draft.name)}"><button data-edit-action="reset">恢复默认</button><button data-edit-action="new">另存为新预设</button><select data-preset aria-label="选择预设"><option value="">选择已存预设</option>${presetsFor(platform).map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('')}</select><button data-edit-action="delete">删除当前预设</button></div><p role="status" data-editor-status></p>`;
  }
  function open(){
    if(!player.isRunning()){toast('请先开始游戏');return;}
    initialize();current=presetsFor(platform).find(p=>p.id===activePreset(platform))||presetsFor(platform)[0]||null;
    draft=current?structuredClone(current):{id:crypto.randomUUID(),name:'我的布局',variants:{portrait:{},landscape:{}}};
    draft.variants[orientation()]={...structuredClone(defaults),...draft.variants[orientation()]};
    selected=controls[0].key;editing=true;wasPaused=player.isPaused();if(!wasPaused)player.togglePause();player.setInputPaused(true);root.classList.add('is-layout-editing');pane.hidden=false;fields();position();
  }
  function close(){editing=false;drag=null;pane.hidden=true;root.classList.remove('is-layout-editing');player.setInputPaused(false);if(!wasPaused&&player.isPaused())player.togglePause();apply();}
  root.addEventListener('pointerdown',event=>{
    if(!editing)return;const node=event.target.closest('[data-layout-key]');if(!node)return;
    event.preventDefault();event.stopImmediatePropagation();selected=node.dataset.layoutKey;drag={pointer:event.pointerId,key:selected};node.setPointerCapture(event.pointerId);fields();position();
  },{capture:true,signal});
  root.addEventListener('pointermove',event=>{
    if(!editing||drag?.pointer!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();const point=localPoint(event.clientX,event.clientY);
    draft.variants[orientation()]||={};draft.variants[orientation()][selected]=clampControl({...defaults[selected],...draft.variants[orientation()][selected],x:point.x/root.clientWidth,y:point.y/root.clientHeight});position();
  },{capture:true,signal});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,event=>{if(editing){if(drag?.pointer===event.pointerId)drag=null;event.stopImmediatePropagation();}},{capture:true,signal});
  pane.addEventListener('input',event=>{
    if(event.target.matches('[data-name]')){draft.name=event.target.value;return;}
    const entry={...defaults[selected],...draft.variants[orientation()]?.[selected]};
    if(event.target.matches('[data-size]'))entry.size=Number(event.target.value);
    if(event.target.matches('[data-opacity]'))entry.opacity=Number(event.target.value);
    if(event.target.matches('[data-hidden]'))entry.hidden=event.target.checked;
    draft.variants[orientation()]||={};draft.variants[orientation()][selected]=entry;position();
  },{signal});
  pane.addEventListener('change',event=>{
    if(event.target.matches('[data-control]')){selected=event.target.value;fields();position();}
    if(event.target.matches('[data-preset]')&&event.target.value){const p=presetsFor(platform).find(p=>p.id===event.target.value);if(p){draft=structuredClone(p);fields();position();}}
  },{signal});
  pane.addEventListener('click',event=>{
    const action=event.target.closest('[data-edit-action]')?.dataset.editAction;if(!action)return;
    try{
      if(action==='cancel'){close();return;}
      if(action==='reset'){draft.variants[orientation()]=structuredClone(defaults);fields();position();return;}
      if(action==='delete'){if(confirm('删除当前预设？')){removePreset(platform,draft.id);setActivePreset(platform,'');close();}return;}
      if(action==='new'){
        if(presetsFor(platform).length >= (accountUser()?.maxPresets||1))throw Error('预设数量已达当前方案上限');
        draft.id=crypto.randomUUID();
      }
      draft.name=String(draft.name||'我的布局').trim().slice(0,20)||'我的布局';
      savePreset(platform,draft,accountUser()?.maxPresets||1);setActivePreset(platform,draft.id);close();toast('触屏布局已保存，可在账号页同步');
    }catch(e){pane.querySelector('[data-editor-status]').textContent=e.message;}
  },{signal});
  window.addEventListener('resize',()=>{if(editing){draft.variants[orientation()]||={};fields();}requestAnimationFrame(position);},{signal});
  window.addEventListener('keydown',event=>{if(editing&&event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}},{capture:true,signal});
  return{apply,open,cancel(){if(editing)close();},isEditing:()=>editing,destroy(){controller.abort();pane.remove();if(editing)close();}};
}
