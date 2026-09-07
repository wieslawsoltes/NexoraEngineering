/** Nexora Engineering — browser-independent engineering graph and command kernel. */
export const VERSION = 1;
export const GRID = 10;
export const clone = value => structuredClone(value);
export const uid = () => {
  if(globalThis.crypto.randomUUID)return globalThis.crypto.randomUUID();
  const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const snap = (v, step = GRID) => Math.round(v / step) * step;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const TYPES = {
  tank: { label: 'Storage tank', category: 'Equipment', prefix: 'TK', w: 116, h: 150, ports: ['W','E','N','S'] },
  vessel: { label: 'Pressure vessel', category: 'Equipment', prefix: 'V', w: 90, h: 148, ports: ['W','E','N','S'] },
  pump: { label: 'Centrifugal pump', category: 'Equipment', prefix: 'P', w: 58, h: 58, ports: ['W','E','N'] },
  compressor: { label: 'Compressor', category: 'Equipment', prefix: 'K', w: 70, h: 64, ports: ['W','E'] },
  exchanger: { label: 'Heat exchanger', category: 'Equipment', prefix: 'E', w: 138, h: 62, ports: ['W','E','N','S'] },
  filter: { label: 'Process filter', category: 'Equipment', prefix: 'F', w: 62, h: 88, ports: ['W','E','N','S'] },
  valve: { label: 'Gate valve', category: 'Valves', prefix: 'HV', w: 36, h: 28, ports: ['W','E'] },
  controlValve: { label: 'Control valve', category: 'Valves', prefix: 'FV', w: 42, h: 34, ports: ['W','E','N'] },
  checkValve: { label: 'Check valve', category: 'Valves', prefix: 'NRV', w: 36, h: 28, ports: ['W','E'] },
  strainer: { label: 'Y-strainer', category: 'Valves', prefix: 'ST', w: 40, h: 30, ports: ['W','E'] },
  instrument: { label: 'Field instrument', category: 'Instrumentation', prefix: 'PT', w: 42, h: 42, ports: ['W','E','N','S'] },
  controller: { label: 'Panel controller', category: 'Instrumentation', prefix: 'FIC', w: 44, h: 44, ports: ['W','E','N','S'] },
  motor: { label: 'Electric motor', category: 'Electrical', prefix: 'M', w: 44, h: 44, ports: ['W','E','N','S'] },
  breaker: { label: 'Circuit breaker', category: 'Electrical', prefix: 'QF', w: 36, h: 64, ports: ['N','S'] },
  terminal: { label: 'Terminal block', category: 'Electrical', prefix: 'X', w: 28, h: 28, ports: ['N','S','W','E'] },
  offpage: { label: 'Off-page connector', category: 'Connections', prefix: 'CON', w: 62, h: 30, ports: ['W','E'] },
  junction: { label: 'Junction', category: 'Connections', prefix: 'J', w: 8, h: 8, ports: ['W','E','N','S'] },
  text: { label: 'Text annotation', category: 'Annotations', prefix: 'TXT', w: 140, h: 26, ports: [] },
  zone: { label: 'Process area', category: 'Annotations', prefix: 'AREA', w: 280, h: 200, ports: [] }
};
const DIR = { W: [-1, 0], E: [1, 0], N: [0, -1], S: [0, 1] };
export function transform(n, x, y) {
  const angle = (n.rotation || 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return { x: n.x + x * c - y * s, y: n.y + x * s + y * c };
}
export function portPosition(n, name) {
  const dir = DIR[name];
  if (!dir) throw new Error(`Unknown port: ${name}`);
  const p = transform(n, dir[0] * n.w / 2, dir[1] * n.h / 2);
  const a = (n.rotation || 0) * Math.PI / 180;
  const rawX=dir[0]*Math.cos(a)-dir[1]*Math.sin(a),rawY=dir[0]*Math.sin(a)+dir[1]*Math.cos(a);
  const horizontal=Math.abs(rawX)>=Math.abs(rawY);
  return { ...p, dx: horizontal?(Math.sign(rawX)||0):0, dy: horizontal?0:(Math.sign(rawY)||0), node: n.id, port: name };
}
export function nodeBounds(n, labels = false) {
  const pts = [[-n.w/2,-n.h/2],[n.w/2,-n.h/2],[n.w/2,n.h/2],[-n.w/2,n.h/2]].map(p => transform(n,...p));
  const margin = labels ? 34 : 4;
  return { x: Math.min(...pts.map(p=>p.x))-margin, y: Math.min(...pts.map(p=>p.y))-margin,
    maxX: Math.max(...pts.map(p=>p.x))+margin, maxY: Math.max(...pts.map(p=>p.y))+margin };
}
export function intersects(a, b) { return a.x <= b.maxX && a.maxX >= b.x && a.y <= b.maxY && a.maxY >= b.y; }
export function endpoint(e, nodes) { return e.node ? portPosition(nodes.get(e.node), e.port) : {x:e.x, y:e.y, dx:0, dy:0}; }
/** Deterministic orthogonal router, with normal-aligned port escape segments. */
export function routeEdge(e, nodes) {
  const a = endpoint(e.from,nodes), b = endpoint(e.to,nodes);
  if(e.orthogonal===false)return [{x:a.x,y:a.y},...(e.waypoints||[]).map(p=>({x:p.x,y:p.y})),{x:b.x,y:b.y}];
  const pts = [{x:a.x,y:a.y}], push = p => { if(distance(pts.at(-1),p)>0.001)pts.push({x:p.x,y:p.y}); };
  if(e.waypoints?.length) {
    const targets=[...e.waypoints,b];
    for(const p of targets) { const q=pts.at(-1); if(Math.abs(q.x-p.x)>.001&&Math.abs(q.y-p.y)>.001)push({x:p.x,y:q.y}); push(p); }
  } else if(Math.abs(a.x-b.x)<.001 || Math.abs(a.y-b.y)<.001) { push(b); }
  else {
    const escape=20, aa={x:a.x+a.dx*escape,y:a.y+a.dy*escape}, bb={x:b.x+b.dx*escape,y:b.y+b.dy*escape};
    push(aa);
    if(a.dx && b.dx) { const mid=(aa.x+bb.x)/2; push({x:mid,y:aa.y});push({x:mid,y:bb.y}); }
    else if(a.dy && b.dy) { const mid=(aa.y+bb.y)/2;push({x:aa.x,y:mid});push({x:bb.x,y:mid}); }
    else if(a.dx)push({x:bb.x,y:aa.y});else push({x:aa.x,y:bb.y});
    push(bb);push(b);
  }
  // Remove redundant collinear interior vertices without removing U-turns.
  for(let i=1;i<pts.length-1;) {
    const [p,q,r]=[pts[i-1],pts[i],pts[i+1]];
    const cross=(q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);
    const dot=(q.x-p.x)*(r.x-q.x)+(q.y-p.y)*(r.y-q.y);
    if(Math.abs(cross)<.001 && dot>=0)pts.splice(i,1);else i++;
  }
  return pts;
}
export function pointSegmentDistance(p,a,b) {
  const x=b.x-a.x,y=b.y-a.y,l=x*x+y*y;
  const t=l?clamp(((p.x-a.x)*x+(p.y-a.y)*y)/l,0,1):0;
  return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);
}
export class SpatialIndex {
  constructor(cellSize=128) { this.cellSize=cellSize;this.cells=new Map();this.bounds=new Map();this.large=new Set(); }
  clear(){this.cells.clear();this.bounds.clear();this.large.clear();}
  keys(b){const s=this.cellSize,keys=[];for(let x=Math.floor(b.x/s);x<=Math.floor(b.maxX/s);x++)for(let y=Math.floor(b.y/s);y<=Math.floor(b.maxY/s);y++)keys.push(`${x},${y}`);return keys;}
  insert(id,b){this.bounds.set(id,b);const cells=(Math.floor(b.maxX/this.cellSize)-Math.floor(b.x/this.cellSize)+1)*(Math.floor(b.maxY/this.cellSize)-Math.floor(b.y/this.cellSize)+1);if(cells>4096){this.large.add(id);return;}for(const key of this.keys(b)){if(!this.cells.has(key))this.cells.set(key,new Set());this.cells.get(key).add(id);}}
  query(b){const found=new Set(this.large);const count=(b.maxX-b.x)*(b.maxY-b.y)/(this.cellSize*this.cellSize);if(count>20000)return new Set([...this.bounds].filter(([,box])=>intersects(b,box)).map(([id])=>id));for(const k of this.keys(b))for(const id of this.cells.get(k)||[])found.add(id);return new Set([...found].filter(id=>intersects(b,this.bounds.get(id))));}
}
export class Camera {
  constructor(){this.x=700;this.y=450;this.zoom=1;this.width=1;this.height=1;}
  world(p){return {x:(p.x-this.width/2)/this.zoom+this.x,y:(p.y-this.height/2)/this.zoom+this.y};}
  screen(p){return {x:(p.x-this.x)*this.zoom+this.width/2,y:(p.y-this.y)*this.zoom+this.height/2};}
  zoomAt(p,factor){const before=this.world(p);this.zoom=clamp(this.zoom*factor,.08,12);const after=this.world(p);this.x+=before.x-after.x;this.y+=before.y-after.y;}
  fit(box,padding=45){this.x=(box.x+box.maxX)/2;this.y=(box.y+box.maxY)/2;this.zoom=clamp(Math.min((this.width-padding*2)/(box.maxX-box.x),(this.height-padding*2)/(box.maxY-box.y)),.08,12);}
  get bounds(){return {x:this.x-this.width/this.zoom/2,y:this.y-this.height/this.zoom/2,maxX:this.x+this.width/this.zoom/2,maxY:this.y+this.height/this.zoom/2};}
}
function mapDiff(before,after){const b=new Map(before.map(x=>[x.id,x])),a=new Map(after.map(x=>[x.id,x]));return [...new Set([...b.keys(),...a.keys()])].filter(id=>JSON.stringify(b.get(id))!==JSON.stringify(a.get(id))).map(id=>({id,before:b.get(id)||null,after:a.get(id)||null}));}
export class EngineeringStore {
  constructor(data){this.listeners=new Set();this.undoStack=[];this.redoStack=[];this.version=0;this.load(data);}
  load(data){const valid=validateProject(data);this.pending=null;this.meta=valid.meta;this.documents=valid.documents;this.nodes=new Map(valid.nodes.map(n=>[n.id,n]));this.edges=new Map(valid.edges.map(e=>[e.id,e]));this.revisions=valid.revisions||[];this.undoStack=[];this.redoStack=[];this.changed('load');}
  serialize(){return {format:'nexora-project',version:VERSION,meta:clone(this.meta),documents:clone(this.documents),nodes:clone([...this.nodes.values()]),edges:clone([...this.edges.values()]),revisions:clone(this.revisions)};}
  subscribe(f){this.listeners.add(f);return()=>this.listeners.delete(f);}
  changed(label){this.version++;for(const f of this.listeners)f({label,version:this.version});}
  snapshot(){return {meta:clone(this.meta),documents:clone(this.documents),nodes:clone([...this.nodes.values()]),edges:clone([...this.edges.values()])};}
  restore(s){this.meta=clone(s.meta);this.documents=clone(s.documents);this.nodes=new Map(clone(s.nodes).map(n=>[n.id,n]));this.edges=new Map(clone(s.edges).map(e=>[e.id,e]));}
  begin(){if(this.pending)throw new Error('Nested transactions are not supported.');this.pending=this.snapshot();}
  commit(label){if(!this.pending)return false;const before=this.pending;this.pending=null;const after=this.snapshot();const patch={label,time:new Date().toISOString(),nodes:mapDiff(before.nodes,after.nodes),edges:mapDiff(before.edges,after.edges),before:{meta:before.meta,documents:before.documents},after:{meta:after.meta,documents:after.documents}};if(!patch.nodes.length&&!patch.edges.length&&JSON.stringify(patch.before)===JSON.stringify(patch.after))return false;this.undoStack.push(patch);if(this.undoStack.length>100)this.undoStack.shift();this.redoStack=[];this.changed(label);return true;}
  cancel(){if(this.pending){this.restore(this.pending);this.pending=null;this.changed('cancel');}}
  transact(label,fn){this.begin();try{fn();return this.commit(label);}catch(e){this.cancel();throw e;}}
  apply(p,direction){for(const key of ['nodes','edges'])for(const record of p[key]){const value=record[direction];if(value)this[key].set(record.id,clone(value));else this[key].delete(record.id);}this.meta=clone(p[direction].meta);this.documents=clone(p[direction].documents);this.changed(`${direction==='before'?'Undo':'Redo'}: ${p.label}`);}
  undo(){const p=this.undoStack.pop();if(p){this.apply(p,'before');this.redoStack.push(p);return true;}return false;}
  redo(){const p=this.redoStack.pop();if(p){this.apply(p,'after');this.undoStack.push(p);return true;}return false;}
  nextTag(type){const prefix=TYPES[type]?.prefix||'L';const tags=new Set([...this.nodes.values(),...this.edges.values()].map(n=>n.tag));let i=101;while(tags.has(`${prefix}-${i}`))i++;return `${prefix}-${i}`;}
  addNode(type,x,y,docId,extra={}){const def=Object.hasOwn(TYPES,type)?TYPES[type]:null;if(!def)throw new Error('Unknown symbol');if(!this.documents.some(d=>d.id===docId))throw new Error('Unknown document.');num(x,'x');num(y,'y');if(extra.id&&(this.nodes.has(extra.id)||this.edges.has(extra.id)))throw new Error('Duplicate object identifier.');const n={id:uid(),kind:'node',type,docId,x,y,w:def.w,h:def.h,rotation:0,tag:this.nextTag(type),description:def.label,unit:'U-100',status:'In design',layer:def.category==='Instrumentation'?'instruments':def.category==='Annotations'?'annotations':'equipment',props:{pressure:'6',designPressure:'10',temperature:'25',material:'316L',spec:'CS150',manufacturer:'',range:'',fluid:'Cooling water'},...extra};n.props={pressure:'6',designPressure:'10',temperature:'25',material:'316L',spec:'CS150',manufacturer:'',range:'',fluid:'Cooling water',...n.props};this.nodes.set(n.id,n);return n;}
  addEdge(from,to,docId,type='pipe',waypoints=[]){if(!['pipe','signal','cable'].includes(type))throw new Error('Unsupported connection type.');if(!this.documents.some(d=>d.id===docId))throw new Error('Unknown document.');for(const ep of [from,to]){if(ep.node){const n=this.nodes.get(ep.node);if(!n||n.docId!==docId||!TYPES[n.type].ports.includes(ep.port))throw new Error('Invalid port reference.');}else{num(ep.x,'endpoint x');num(ep.y,'endpoint y');}}if(!Array.isArray(waypoints)||waypoints.length>500)throw new Error('Invalid line route.');for(const p of waypoints){num(p.x,'route x');num(p.y,'route y');}const e={id:uid(),kind:'edge',type,docId,orthogonal:true,tag:this.nextTag('pipe'),description:type==='signal'?'Instrument signal':type==='cable'?'Electrical cable':'Process line',from:clone(from),to:clone(to),waypoints:clone(waypoints),unit:'U-100',status:'In design',layer:type==='signal'?'instruments':type==='cable'?'equipment':'piping',props:{diameter:'DN80',spec:'CS150',fluid:'Cooling water',material:'316L',pressure:'6',designPressure:'10',temperature:'25'}};this.edges.set(e.id,e);return e;}
  remove(ids){const set=new Set(ids);for(const [id,e]of this.edges)if(set.has(id)||set.has(e.from.node)||set.has(e.to.node))this.edges.delete(id);for(const id of set)this.nodes.delete(id);}
  duplicate(ids,offset={x:30,y:30}){const map=new Map(),created=[];for(const id of ids){const original=this.nodes.get(id);if(!original)continue;const n=clone(original);n.id=uid();n.tag=this.nextTag(n.type);n.x+=offset.x;n.y+=offset.y;this.nodes.set(n.id,n);map.set(id,n.id);created.push(n.id);}for(const e of [...this.edges.values()])if(map.has(e.from.node)&&map.has(e.to.node)){const copy=clone(e);copy.id=uid();copy.tag=this.nextTag('pipe');copy.from.node=map.get(e.from.node);copy.to.node=map.get(e.to.node);copy.waypoints=copy.waypoints.map(p=>({x:p.x+offset.x,y:p.y+offset.y}));this.edges.set(copy.id,copy);created.push(copy.id);}return created;}
  update(id,key,value){const obj=this.nodes.get(id)||this.edges.get(id);if(!obj)throw new Error('Object not found.');if(key.startsWith('props.')){const name=key.slice(6);if(!/^[a-zA-Z][a-zA-Z0-9_]{0,50}$/.test(name)||['__proto__','constructor','prototype'].includes(name))throw new Error('Invalid attribute name.');obj.props[name]=String(value).slice(0,2000);}else if(['tag','description','unit','status'].includes(key))obj[key]=String(value);else if(['x','y','w','h','rotation'].includes(key)){const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>1e6||(key==='w'||key==='h')&&(n<2||n>10000))throw new Error('Enter a valid dimension.');obj[key]=n;}else throw new Error('Unsupported property.');}
  captureRevision(label){const revision={id:uid(),label:label||`Revision ${this.revisions.length+1}`,created:new Date().toISOString(),snapshot:this.snapshot()};this.revisions.push(revision);if(this.revisions.length>20)this.revisions.shift();this.changed('Capture revision');return revision;}
  compareRevision(revision){const now=this.snapshot(),r=revision.snapshot;return {nodes:mapDiff(r.nodes,now.nodes),edges:mapDiff(r.edges,now.edges)};}
  restoreRevision(id){const r=this.revisions.find(x=>x.id===id);if(!r)throw new Error('Revision not found.');this.transact(`Restore ${r.label}`,()=>this.restore(r.snapshot));}
}
const text=(v,max=2000)=>String(v??'').slice(0,max);
function num(v,name){if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e6)throw new Error(`Invalid coordinate: ${name}`);return v;}
/** Strict projection protects the view layer and limits pathological imported inputs. */
export function validateProject(data,depth=0){
  if(!data||data.format!=='nexora-project'||data.version!==VERSION)throw new Error('Not a supported Nexora project (schema v1).');
  if(!Array.isArray(data.nodes)||!Array.isArray(data.edges)||!Array.isArray(data.documents))throw new Error('Project collections are missing.');
  if(data.nodes.length>20000||data.edges.length>50000||data.documents.length>100||!data.documents.length)throw new Error('Project exceeds supported collection limits.');
  const docs=new Set(),ids=new Set();
  const documents=data.documents.map(d=>{const id=text(d.id,100);if(!id||docs.has(id))throw new Error('Duplicate or empty document id.');docs.add(id);return {id,name:text(d.name,200),code:text(d.code,50),type:d.type==='electrical'?'electrical':'pid',revision:text(d.revision,30),width:clamp(num(d.width,'sheet width'),200,10000),height:clamp(num(d.height,'sheet height'),200,10000)};});
  const props=p=>Object.fromEntries(Object.entries(p||{}).filter(([k,v])=>/^[a-zA-Z][a-zA-Z0-9_]{0,50}$/.test(k)&&!['__proto__','constructor','prototype'].includes(k)&&['string','number','boolean'].includes(typeof v)).slice(0,100).map(([k,v])=>[k,text(v)]));
  function common(o){const id=text(o.id,100);if(!id||ids.has(id))throw new Error('Duplicate or empty object id.');ids.add(id);if(!docs.has(o.docId))throw new Error('Unknown document reference.');return {id,docId:o.docId,tag:text(o.tag,100),description:text(o.description),unit:text(o.unit,100),status:['In design','For review','Approved'].includes(o.status)?o.status:'In design',props:props(o.props)};}
  const nodes=data.nodes.map(n=>{if(!Object.hasOwn(TYPES,n.type))throw new Error('Unsupported symbol type.');return {...common(n),kind:'node',type:n.type,x:num(n.x,'x'),y:num(n.y,'y'),w:clamp(num(n.w,'width'),2,10000),h:clamp(num(n.h,'height'),2,10000),rotation:num(n.rotation||0,'rotation'),layer:['equipment','instruments','annotations'].includes(n.layer)?n.layer:'equipment'};});
  const nodeMap=new Map(nodes.map(n=>[n.id,n]));
  const ep=(p,docId)=>{if(!p||typeof p!=='object')throw new Error('Missing connection endpoint.');if(p.node){const n=nodeMap.get(p.node);if(!n||n.docId!==docId||!TYPES[n.type].ports.includes(p.port))throw new Error('Invalid port reference.');return {node:p.node,port:p.port};}return {x:num(p.x,'endpoint x'),y:num(p.y,'endpoint y')};};
  const edges=data.edges.map(e=>{const c=common(e);if(!['pipe','signal','cable'].includes(e.type))throw new Error('Unsupported connection type.');if(!Array.isArray(e.waypoints)||e.waypoints.length>500)throw new Error('Invalid line route.');return {...c,kind:'edge',type:e.type,orthogonal:e.orthogonal!==false,from:ep(e.from,e.docId),to:ep(e.to,e.docId),waypoints:e.waypoints.map(p=>({x:num(p.x,'route x'),y:num(p.y,'route y')})),layer:e.type==='signal'?'instruments':e.type==='cable'?'equipment':'piping'};});
  const meta={name:text(data.meta?.name||'Untitled plant',200),number:text(data.meta?.number||'NX-001',100),description:text(data.meta?.description),author:text(data.meta?.author||'Engineer',100)};
  const revisions=depth?[]:(data.revisions||[]).slice(-20).map(r=>{if(!r.snapshot)throw new Error('Invalid revision snapshot.');const v=validateProject({format:'nexora-project',version:VERSION,...r.snapshot,revisions:[]},depth+1);return {id:text(r.id,100),label:text(r.label,100),created:text(r.created,100),snapshot:{meta:v.meta,documents:v.documents,nodes:v.nodes,edges:v.edges}};});
  return {format:'nexora-project',version:VERSION,meta,documents,nodes,edges,revisions};
}
export function validateEngineering(store){
  const issues=[],tags=new Map(),connected=new Set();let sequence=0;
  const add=(object,severity,code,message)=>issues.push({id:`issue-${sequence++}`,objectId:object.id,docId:object.docId,tag:object.tag,severity,code,message});
  for(const o of [...store.nodes.values(),...store.edges.values()]){
    if(!o.tag.trim())add(o,'error','TAG001','Object has no engineering tag.');
    else if(tags.has(o.tag))add(o,'error','TAG002',`Duplicate tag; also used by ${tags.get(o.tag)}.`);else tags.set(o.tag,o.description||o.type);
    const p=Number(o.props.pressure),d=Number(o.props.designPressure);
    if(o.props.pressure&&o.props.designPressure&&Number.isFinite(p)&&Number.isFinite(d)&&p>d)add(o,'error','PRS001','Operating pressure exceeds design pressure.');
  }
  for(const e of store.edges.values()){
    for(const end of [e.from,e.to])if(end.node)connected.add(end.node);else add(e,'warning','CON001','Line has a free endpoint. Connect it to an object port.');
    if(e.type==='pipe'&&!e.props.diameter)add(e,'warning','PIP001','Nominal pipe diameter is not specified.');
    if(e.type==='pipe')for(const end of [e.from,e.to]){const n=store.nodes.get(end.node);if(n&&n.props.spec&&e.props.spec&&n.props.spec!==e.props.spec)add(e,'warning','SPC001',`Pipe class ${e.props.spec} differs from ${n.tag}: ${n.props.spec}.`);}
  }
  for(const n of store.nodes.values()){
    if(['text','zone'].includes(n.type))continue;
    if(!connected.has(n.id))add(n,'warning','CON002','Object is not connected to the engineering graph.');
    if(['instrument','controller'].includes(n.type)&&!n.props.range)add(n,'warning','INS001','Instrument measuring range is not specified.');
  }
  return issues;
}
export function csv(rows,keys){const cell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\uFEFF'+[keys.map(cell).join(','),...rows.map(row=>keys.map(k=>cell(row[k])).join(','))].join('\r\n');}
export function makeDemo(){
  const data={format:'nexora-project',version:1,meta:{name:'Northport Water Recovery',number:'NX-2408',description:'Utility systems · Front-end engineering',author:'Project engineer'},documents:[{id:'pid-101',name:'Cooling water system',code:'PID-101',type:'pid',revision:'B.02',width:1440,height:900},{id:'pid-201',name:'Instrument air system',code:'PID-201',type:'pid',revision:'A.01',width:1440,height:900},{id:'eld-101',name:'Pump motor distribution',code:'ELD-101',type:'electrical',revision:'A.01',width:1440,height:900}],nodes:[],edges:[],revisions:[]};
  const s=new EngineeringStore(data);let doc='pid-101';
  const n=(id,type,x,y,tag,description,extra={})=>{const o=s.addNode(type,x,y,doc,{id,tag,description,...extra});return o;};
  const line=(id,from,fp,to,tp,tag,waypoints=[],type='pipe',extra={})=>{const e=s.addEdge({node:from,port:fp},{node:to,port:tp},doc,type,waypoints);e.id=id;e.tag=tag;Object.assign(e,extra);s.edges.delete([...s.edges].find(([,v])=>v===e)[0]);s.edges.set(id,e);return e;};
  n('area-a','zone',310,405,'AREA-01','01 / WATER STORAGE',{w:360,h:380});
  n('area-b','zone',735,405,'AREA-02','02 / CIRCULATION',{w:460,h:380});
  n('area-c','zone',1150,405,'AREA-03','03 / HEAT TRANSFER',{w:300,h:380});
  n('inlet','offpage',130,330,'CW-SUP','Raw water supply');
  n('hv101','valve',230,330,'HV-101','Inlet isolation valve');
  n('tk101','tank',370,385,'TK-101','Cooling water storage',{w:110,h:160});
  n('lt101','instrument',370,255,'LT-101','Tank level transmitter',{props:{range:'0–4 m',spec:'CS150',pressure:'6',designPressure:'10',temperature:'25',material:'316L'}});
  n('hv102','valve',490,385,'HV-102','Tank outlet isolation');
  n('j1','junction',550,385,'J-101','Pump suction header');
  n('st101','strainer',610,355,'ST-101','Duty pump suction strainer');
  n('p101a','pump',700,355,'P-101A','Cooling water pump · duty',{status:'Approved',props:{pressure:'6',designPressure:'10',temperature:'25',material:'316L',spec:'CS150',manufacturer:'Grundfos',flow:'120',power:'18.5',speed:'1450'}});
  n('nrv101','checkValve',795,355,'NRV-101','Duty pump non-return valve');
  n('hv103','valve',865,355,'HV-103','Duty pump discharge isolation');
  n('st102','strainer',610,505,'ST-102','Standby pump suction strainer');
  n('p101b','pump',700,505,'P-101B','Cooling water pump · standby');
  n('nrv102','checkValve',795,505,'NRV-102','Standby pump non-return valve');
  n('hv104','valve',865,505,'HV-104','Standby discharge isolation');
  n('j2','junction',930,355,'J-102','Pump discharge header');
  n('pt101','instrument',790,255,'PT-101','Discharge pressure transmitter',{props:{range:'0–16 bar',spec:'CS150',pressure:'6',designPressure:'10',material:'316L'}});
  n('e101','exchanger',1130,355,'E-101','Plate heat exchanger');
  n('tt101','instrument',1220,255,'TT-101','Outlet temperature transmitter',{props:{range:'',spec:'CS150',temperature:'25'}});
  n('outlet','offpage',1310,355,'CW-RET','To process consumers');
  n('cv101','controlValve',1110,505,'FV-101','Cooling water control valve');
  n('fic101','controller',1110,610,'FIC-101','Flow indicating controller',{props:{range:'0–200 m³/h',spec:'CS150'}});
  n('return','offpage',1300,505,'CW-R01','From process return');
  n('note1','text',337,685,'NOTE-01','DESIGN BASIS  /  120 m³/h · 6 bar · 25 °C',{w:520,h:26});
  n('note2','text',337,715,'NOTE-02','Duty / standby pumps. All wetted parts stainless steel 316L.',{w:560,h:24});
  line('l1','inlet','E','hv101','W','80-CW-1001-CS150');
  line('l2','hv101','E','tk101','W','80-CW-1002-CS150',[{x:285,y:330},{x:285,y:385}]);
  line('s1','tk101','N','lt101','S','LT-101 / AI',[],'signal');
  line('l3','tk101','E','hv102','W','80-CW-1003-CS150');
  line('l4','hv102','E','j1','W','80-CW-1004-CS150');
  line('l5','j1','E','st101','W','80-CW-1005-CS150',[{x:570,y:385},{x:570,y:355}]);
  line('l6','st101','E','p101a','W','80-CW-1006-CS150');
  line('l7','p101a','E','nrv101','W','80-CW-1007-CS150');
  line('l8','nrv101','E','hv103','W','80-CW-1008-CS150');
  line('l9','hv103','E','j2','W','80-CW-1009-CS150');
  line('l10','j1','S','st102','W','80-CW-1010-CS150',[{x:550,y:505}]);
  line('l11','st102','E','p101b','W','80-CW-1011-CS150');
  line('l12','p101b','E','nrv102','W','80-CW-1012-CS150');
  line('l13','nrv102','E','hv104','W','80-CW-1013-CS150');
  line('l14','hv104','E','j2','S','80-CW-1014-CS150',[{x:930,y:505}]);
  line('l15','j2','E','e101','W','80-CW-1015-CS150');
  line('l16','e101','E','outlet','W','80-CW-1016-CS150');
  line('s2','j2','N','pt101','S','PT-101 / AI',[{x:930,y:295},{x:790,y:295}],'signal');
  line('s3','e101','N','tt101','S','TT-101 / AI',[{x:1130,y:295},{x:1220,y:295}],'signal');
  line('l17','return','W','cv101','E','80-CW-1017-CS150');
  line('l18','cv101','W','tk101','S','80-CW-1018-CS150',[{x:1020,y:505},{x:1020,y:645},{x:370,y:645}]);
  line('s4','fic101','N','cv101','N','FV-101 / AO',[{x:1180,y:588},{x:1180,y:465},{x:1110,y:465}],'signal');
  doc='pid-201';
  n('air-zone','zone',720,400,'AREA-201','01 / COMPRESSED AIR TREATMENT',{w:1100,h:340,unit:'U-200'});
  n('air-in','offpage',180,400,'AIR-IN','Ambient intake',{unit:'U-200'});
  n('air-f','filter',350,400,'F-201','Intake filter',{unit:'U-200'});
  n('air-k','compressor',530,400,'K-201','Air compressor',{unit:'U-200'});
  n('air-v','vessel',760,400,'V-201','Air receiver',{unit:'U-200'});
  n('air-p','instrument',760,245,'PT-201','Receiver pressure',{unit:'U-200',props:{range:'0–16 bar',spec:'CS150'}});
  n('air-d','filter',970,400,'F-202','Desiccant dryer',{unit:'U-200'});
  n('air-out','offpage',1190,400,'AIR-OUT','Instrument air header',{unit:'U-200'});
  line('air1','air-in','E','air-f','W','50-IA-2001-CS150');line('air2','air-f','E','air-k','W','50-IA-2002-CS150');line('air3','air-k','E','air-v','W','50-IA-2003-CS150');line('air4','air-v','E','air-d','W','50-IA-2004-CS150');line('air5','air-d','E','air-out','W','50-IA-2005-CS150');line('air6','air-v','N','air-p','S','PT-201 / AI',[],'signal');
  for(const o of [...s.nodes.values(),...s.edges.values()])if(o.docId===doc){o.unit='U-200';o.props.fluid='Instrument air';}
  doc='eld-101';
  n('mcc','text',720,150,'NOTE-E01','MCC-01   /   400 V · 50 Hz · 3 PHASE',{w:540,h:32,unit:'E-100'});
  for(let i=0;i<3;i++){
    const x=410+i*300;
    n(`bus-${i}`,'terminal',x,250,`X-${i+1}01`,'Busbar terminal',{unit:'E-100'});
    n(`br-${i}`,'breaker',x,380,`QF-${i+1}01`,'Motor protection breaker',{unit:'E-100'});
    n(`term-${i}`,'terminal',x,510,`X-${i+1}02`,'Field terminal',{unit:'E-100'});
    n(`mot-${i}`,'motor',x,650,`M-${i+1}01`,['P-101A · 18.5 kW','P-101B · 18.5 kW','K-201 · 22 kW'][i],{w:64,h:64,unit:'E-100'});
    line(`cab-${i}a`,`bus-${i}`,'S',`br-${i}`,'N',`CBL-${i+1}01`,[],'cable');line(`cab-${i}b`,`br-${i}`,'S',`term-${i}`,'N',`CBL-${i+1}02`,[],'cable');line(`cab-${i}c`,`term-${i}`,'S',`mot-${i}`,'N',`CBL-${i+1}03`,[],'cable');
    if(i>0)line(`busbar-${i}`,`bus-${i-1}`,'E',`bus-${i}`,'W',`BUS-${i}`,[],'cable');
  }
  s.undoStack=[];s.captureRevision('B.02 · Initial engineering baseline');return s.serialize();
}
