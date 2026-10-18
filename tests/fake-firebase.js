// minimal fake Firebase RTDB (compat) shared across windows
function makeFake(){
  const root={v:{}};
  const listeners=[]; // {path, type, cb, last}
  const split=p=>p.split("/").filter(Boolean);
  root.v[".info"]={connected:true};
  function get(path){ let o=root.v; for(const k of split(path)){ if(o==null||typeof o!=="object") return null; o=o[k]; } return o===undefined?null:o; }
  function clean(v){ if(v===null||v===undefined) return null; if(typeof v==="object"){ if(v[".sv"]==="timestamp") return Date.now(); const out={}; let any=false; for(const k in v){ const c=clean(v[k]); if(c!==null){ out[k]=c; any=true; } } return any?out:null; } return v; }
  function setAt(path,val){ const ks=split(path); if(!ks.length){ root.v=clean(val)||{}; return; } let o=root.v; for(let i=0;i<ks.length-1;i++){ if(o[ks[i]]==null||typeof o[ks[i]]!=="object") o[ks[i]]={}; o=o[ks[i]]; } const c=clean(val); if(c===null) delete o[ks.at(-1)]; else o[ks.at(-1)]=c; }
  function snap(key,v){ return {key, val:()=>v==null?null:JSON.parse(JSON.stringify(v)), exists:()=>v!=null}; }
  function notify(){ setTimeout(()=>{ for(const l of listeners.slice()){ if(l.dead) continue; const v=get(l.path); const j=JSON.stringify(v);
      if(l.type==="value"){ if(j!==l.last){ l.last=j; l.cb(snap(split(l.path).at(-1),v)); } }
      else { const obj=(v&&typeof v==="object")?v:{}; const prev=l.prev||{}; for(const k in obj){ const cj=JSON.stringify(obj[k]); if(!(k in prev)){ if(l.type==="child_added") l.cb(snap(k,obj[k])); } else if(prev[k]!==cj && l.type==="child_changed") l.cb(snap(k,obj[k])); } const np={}; for(const k in obj) np[k]=JSON.stringify(obj[k]); l.prev=np; } } },0); }
  function Ref(path){ this.path=path; }
  Ref.prototype.set=function(v){ setAt(this.path,v); notify(); return Promise.resolve(); };
  Ref.prototype.update=function(v){ for(const k in v) setAt(this.path+"/"+k,v[k]); notify(); return Promise.resolve(); };
  Ref.prototype.remove=function(){ setAt(this.path,null); notify(); return Promise.resolve(); };
  Ref.prototype.once=function(){ return Promise.resolve(snap(split(this.path).at(-1), get(this.path))); };
  Ref.prototype.on=function(type,cb){ const l={path:this.path,type,cb}; if(type!=="value"){ l.prev={}; } else l.last=undefined; listeners.push(l); notify(); return cb; };
  Ref.prototype.off=function(type,cb){ listeners.forEach(l=>{ if(l.path===this.path && (!cb||l.cb===cb)) l.dead=true; }); };
  Ref.prototype.onDisconnect=function(){ const P=()=>Promise.resolve(); return {set:P,remove:P,update:P,cancel:P}; };
  const dbObj={ ref:p=>new Ref(p) };
  const fb={ apps:[], initializeApp(){ this.apps.push(1); }, database:Object.assign(()=>dbObj,{ServerValue:{TIMESTAMP:{".sv":"timestamp"}}}) };
  fb.__get=get; fb.__reconnect=()=>{ root.v[".info"].connected=false; notify(); setTimeout(()=>{ root.v[".info"].connected=true; notify(); },20); }; fb.__set=(p,v)=>{ setAt(p,v); notify(); }; return fb;
}
module.exports=makeFake;
