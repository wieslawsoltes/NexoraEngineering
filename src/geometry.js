import { TYPES, transform, nodeBounds, routeEdge, SpatialIndex, pointSegmentDistance } from './core.js';
export const PALETTE = { ink:'#344d5b',pipe:'#247d79',signal:'#8263a6',cable:'#bd8751',muted:'#87959d',zone:'#c6d3d6',soft:'#edf5f4',paper:'#ffffff',accent:'#008a81' };
export const escapeXML = s => String(s??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export function colorVector(hex){const h=hex.replace('#','');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255,1];}
class Pen {
  constructor(n){this.n=n;this.lines=[];this.fills=[];this.texts=[];this.color=PALETTE.ink;}
  p(x,y){return transform(this.n,x*this.n.w,y*this.n.h);}
  line(x1,y1,x2,y2,color=this.color,width=1.8,dash=0){this.lines.push({a:this.p(x1,y1),b:this.p(x2,y2),color,width,dash});}
  path(points,{close=false,fill=null,color=this.color,width=1.8,dash=0}={}){const pts=points.map(([x,y])=>this.p(x,y));if(fill)this.fills.push({points:pts,color:fill});for(let i=1;i<pts.length;i++)this.lines.push({a:pts[i-1],b:pts[i],color,width,dash});if(close)this.lines.push({a:pts.at(-1),b:pts[0],color,width,dash});}
  rect(x,y,w,h,options={}){this.path([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],{close:true,...options});}
  ellipse(cx,cy,rx,ry,options={}){const pts=[];for(let i=0;i<64;i++){const a=i*Math.PI*2/64;pts.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}this.path(pts,{close:true,...options});}
  arc(cx,cy,rx,ry,start,end,options={}){const pts=[];for(let i=0;i<=32;i++){const a=start+(end-start)*i/32;pts.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}this.path(pts,options);}
  label(x,y,text,size=14,weight=400,color=this.color,align='center'){const p=this.p(x,y);this.texts.push({...p,text,size,weight,color,align});}
}
export function symbolGeometry(n){
  const p=new Pen(n),C=PALETTE;
  switch(n.type){
    case 'tank':
      p.rect(-.5,-.38,1,.76,{fill:'#f2f8f7'});p.ellipse(0,-.38,.5,.12,{fill:'#f7faf9'});p.arc(0,.38,.5,.12,0,Math.PI);p.line(-.5,.2,.5,.2,'#c0d5d2',1.2,5);p.line(-.36,.5,-.36,.57);p.line(.36,.5,.36,.57);p.line(-.46,.57,-.26,.57);p.line(.26,.57,.46,.57);p.label(0,-.02,'CW',19,600,'#6a9490');break;
    case 'vessel':
      p.path([[-.5,-.3],[-.5,.3]],{});p.line(.5,-.3,.5,.3);p.arc(0,-.3,.5,.2,Math.PI,2*Math.PI);p.arc(0,.3,.5,.2,0,Math.PI);p.line(-.5,-.3,.5,-.3,C.zone,1,4);p.line(-.5,.3,.5,.3,C.zone,1,4);p.line(-.35,.5,-.35,.6);p.line(.35,.5,.35,.6);break;
    case 'pump':
      p.ellipse(0,0,.45,.45,{fill:'#eef6f5',width:2});p.path([[-.21,-.32],[.32,0],[-.21,.32]],{close:true,fill:'#d5e8e4',width:1.5});p.line(-.5,0,-.45,0);p.line(.45,0,.5,0);p.line(-.22,.4,-.35,.58);p.line(.22,.4,.35,.58);p.line(-.42,.58,.42,.58);break;
    case 'compressor':
      p.ellipse(0,0,.46,.46,{fill:'#eff6f5'});p.path([[-.25,-.32],[.3,-.13],[.3,.13],[-.25,.32]],{close:true});p.line(-.5,0,-.25,0);p.line(.3,0,.5,0);break;
    case 'exchanger':
      p.rect(-.4,-.5,.8,1,{fill:'#eef6f5'});p.arc(-.4,0,.1,.5,Math.PI/2,Math.PI*1.5);p.arc(.4,0,.1,.5,-Math.PI/2,Math.PI/2);for(let i=-.3;i<.35;i+=.12)p.line(i,-.38,i+.16,.38,'#648f8b',1.3);p.line(-.5,0,-.4,0);p.line(.4,0,.5,0);p.line(-.3,.5,-.3,.65);p.line(.3,.5,.3,.65);break;
    case 'filter':
      p.rect(-.5,-.5,1,1,{fill:'#f6f9f9'});p.line(-.5,-.5,.5,.5);p.line(-.5,.5,.5,-.5);p.line(-.35,-.5,.5,.35,C.zone,1);p.line(-.5,-.35,.35,.5,C.zone,1);break;
    case 'valve':case 'controlValve':case 'checkValve':
      p.path([[-.5,-.45],[-.5,.45],[0,0]],{close:true,fill:'#fff'});p.path([[.5,-.45],[.5,.45],[0,0]],{close:true,fill:'#fff'});
      if(n.type==='checkValve'){p.line(0,-.5,0,.5);p.line(-.05,.5,.2,.5);}
      if(n.type==='controlValve'){p.line(0,0,0,-.8);p.arc(0,-.8,.32,.28,Math.PI,2*Math.PI);p.line(-.32,-.8,.32,-.8);}
      break;
    case 'strainer':p.line(-.5,0,.5,0);p.path([[-.22,0],[.08,.48],[.38,.28],[.17,0]],{close:true,fill:'#fff'});p.line(.02,.25,.24,.12,C.muted,1,2);break;
    case 'instrument':case 'controller': {
      p.color=C.signal;if(n.type==='controller')p.rect(-.5,-.5,1,1,{color:C.signal,width:1.3});p.ellipse(0,0,.48,.48,{fill:'#fbf9fd',color:C.signal,width:1.5});p.line(-.48,0,.48,0,C.signal,1.1);
      const parts=n.tag.split('-');p.label(0,-.19,parts[0],12,600,C.signal);p.label(0,.23,parts.slice(1).join('-')||'101',11,500,C.signal);break;}
    case 'motor':p.color=C.cable;p.ellipse(0,0,.48,.48,{fill:'#fdf8f1',color:C.cable});p.label(0,.02,'M',22,500,C.cable);break;
    case 'breaker':p.color=C.cable;p.line(0,-.5,0,-.18);p.line(0,-.18,.28,.19);p.line(0,.2,0,.5);p.rect(-.23,-.16,.46,.36,{color:C.cable,width:1.3,dash:4});break;
    case 'terminal':p.color=C.cable;p.rect(-.5,-.5,1,1,{color:C.cable,fill:'#fffaf3'});p.ellipse(0,0,.2,.2,{color:C.cable,width:1.2});break;
    case 'offpage':p.path([[-.5,-.5],[.22,-.5],[.5,0],[.22,.5],[-.5,.5]],{close:true,fill:'#edf5f4',color:C.pipe});p.line(-.32,0,.21,0,C.pipe,1.2);p.path([[.08,-.16],[.24,0],[.08,.16]],{color:C.pipe,width:1.2});break;
    case 'junction':p.ellipse(0,0,.5,.5,{fill:C.pipe,color:C.pipe,width:1});break;
    case 'zone':p.rect(-.5,-.5,1,1,{color:C.zone,width:1,dash:6});p.label(-.46,-.43,n.description,12,600,'#7d929a','left');return p;
    case 'text':p.label(-.5,0,n.description,14,n.tag==='NOTE-01'?600:400,'#75868f','left');return p;
  }
  if(!['instrument','controller','junction'].includes(n.type)){
    const compact=['valve','checkValve','controlValve','strainer','offpage','terminal','breaker'].includes(n.type);
    p.texts.push({x:n.x,y:nodeBounds(n).maxY+(compact?11:18),text:n.tag,size:compact?12:15,weight:600,color:C.ink,align:'center'});
    if(!compact)p.texts.push({x:n.x,y:nodeBounds(n).maxY+36,text:n.description,size:11.5,weight:400,color:'#7a8b94',align:'center'});
  }
  return p;
}
export function edgeGeometry(e,nodes){
  const pts=routeEdge(e,nodes),color=PALETTE[e.type]||PALETTE.pipe,lines=[],texts=[];
  for(let i=1;i<pts.length;i++)lines.push({a:pts[i-1],b:pts[i],color,width:e.type==='pipe'?2.2:1.5,dash:e.type==='signal'?6:0});
  let best=null;for(const l of lines)if(Math.abs(l.a.y-l.b.y)<.01&&(!best||Math.abs(l.a.x-l.b.x)>Math.abs(best.a.x-best.b.x)))best=l;
  if(best&&Math.abs(best.a.x-best.b.x)>155){texts.push({x:(best.a.x+best.b.x)/2,y:best.a.y-11,text:e.tag,size:11,weight:500,color,align:'center',background:true});
    if(e.type==='pipe'){const direction=Math.sign(best.b.x-best.a.x),x=(best.a.x+best.b.x)/2+Math.abs(best.b.x-best.a.x)*.27,y=best.a.y;lines.push({a:{x:x-direction*7,y:y-4},b:{x,y},color,width:1.6,dash:0},{a:{x:x-direction*7,y:y+4},b:{x,y},color,width:1.6,dash:0});}}
  return {lines,texts,fills:[],points:pts};
}
export class EngineeringScene {
  constructor(){this.cache=new Map();this.index=new SpatialIndex();this.entries=new Map();this.revision=0;}
  update(store,docId,layers){
    this.entries.clear();this.index.clear();const alive=new Set();
    for(const n of store.nodes.values())if(n.docId===docId&&layers[n.layer]!==false){const key=JSON.stringify(n);let cached=this.cache.get(n.id);if(cached?.key!==key){cached={key,geometry:symbolGeometry(n)};this.cache.set(n.id,cached);}this.entries.set(n.id,{...cached.geometry,object:n});this.index.insert(n.id,nodeBounds(n,true));alive.add(n.id);}
    for(const e of store.edges.values())if(e.docId===docId&&layers[e.layer]!==false){const key=JSON.stringify(e)+JSON.stringify(e.from.node?store.nodes.get(e.from.node):null)+JSON.stringify(e.to.node?store.nodes.get(e.to.node):null);let cached=this.cache.get(e.id);if(cached?.key!==key){cached={key,geometry:edgeGeometry(e,store.nodes)};this.cache.set(e.id,cached);}this.entries.set(e.id,{...cached.geometry,object:e});const pts=cached.geometry.points;this.index.insert(e.id,{x:Math.min(...pts.map(p=>p.x))-25,y:Math.min(...pts.map(p=>p.y))-25,maxX:Math.max(...pts.map(p=>p.x))+25,maxY:Math.max(...pts.map(p=>p.y))+25});alive.add(e.id);}
    for(const id of this.cache.keys())if(!alive.has(id))this.cache.delete(id);this.revision++;
  }
  visible(bounds){const ids=this.index.query(bounds),result={lines:[],fills:[],texts:[],count:ids.size};
    // Geometry is ordered so area outlines and connections precede device symbols.
    const entries=[...ids].map(id=>this.entries.get(id)).sort((a,b)=>(a.object.type==='zone'?-1:a.object.kind==='edge'?0:1)-(b.object.type==='zone'?-1:b.object.kind==='edge'?0:1));
    for(const entry of entries){result.lines.push(...entry.lines);result.fills.push(...entry.fills);result.texts.push(...entry.texts);}return result;
  }
  hit(point,tolerance=8){const ids=this.index.query({x:point.x-tolerance,y:point.y-tolerance,maxX:point.x+tolerance,maxY:point.y+tolerance});let edge=null,zone=null;
    for(const id of [...ids].reverse()){const entry=this.entries.get(id),o=entry.object;if(o.kind==='node'){
      const a=-(o.rotation||0)*Math.PI/180,dx=point.x-o.x,dy=point.y-o.y,x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);
      if(Math.abs(x)<=o.w/2+tolerance&&Math.abs(y)<=o.h/2+tolerance){if(o.type==='zone'){const border=Math.min(Math.abs(Math.abs(x)-o.w/2),Math.abs(Math.abs(y)-o.h/2));if(border<tolerance||y<-o.h/2+32)zone=id;}else return id;}
    } else if(entry.lines.some(l=>pointSegmentDistance(point,l.a,l.b)<tolerance))edge=id;}
    return edge||zone;
  }
}
export function geometryToSVG(scene,doc,{labels=true}={}){
  const all=scene.visible({x:-1e6,y:-1e6,maxX:1e6,maxY:1e6});let body=`<rect width="${doc.width}" height="${doc.height}" fill="white"/><rect x="30" y="30" width="${doc.width-60}" height="${doc.height-60}" fill="none" stroke="#bdcbd0"/>`;
  for(const f of all.fills)body+=`<polygon points="${f.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${f.color}"/>`;
  for(const l of all.lines)body+=`<path d="M ${l.a.x} ${l.a.y} L ${l.b.x} ${l.b.y}" fill="none" stroke="${l.color}" stroke-width="${l.width}" stroke-linecap="round"${l.dash?` stroke-dasharray="${l.dash} ${l.dash}"`:''}/>`;
  if(labels)for(const t of all.texts)body+=`<text x="${t.x}" y="${t.y}" font-family="Arial,sans-serif" font-size="${t.size}" font-weight="${t.weight}" fill="${t.color}" text-anchor="${t.align==='left'?'start':'middle'}" dominant-baseline="central">${escapeXML(t.text)}</text>`;
  body+=`<path d="M 30 ${doc.height-95} H ${doc.width-30}" stroke="#bdcbd0"/><text x="50" y="${doc.height-59}" font-family="Arial,sans-serif" font-size="19" fill="#344d5b">NEXORA  /  ${escapeXML(doc.name)}</text><text x="${doc.width-310}" y="${doc.height-59}" font-family="Arial,sans-serif" font-size="15" fill="#344d5b">${escapeXML(doc.code)}   |   REV ${escapeXML(doc.revision)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">${body}</svg>`;
}
export function geometryToDXF(scene){
  const all=scene.visible({x:-1e6,y:-1e6,maxX:1e6,maxY:1e6}),out=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','0','ENDSEC','0','SECTION','2','ENTITIES'];
  for(const l of all.lines)out.push('0','LINE','8','NEXORA','10',String(l.a.x),'20',String(-l.a.y),'30','0','11',String(l.b.x),'21',String(-l.b.y),'31','0');
  for(const t of all.texts)out.push('0','TEXT','8','LABELS','10',String(t.x),'20',String(-t.y),'30','0','40',String(t.size),'1',t.text.replace(/[^\x20-\x7E]/g,'?'),'50','0');
  out.push('0','ENDSEC','0','EOF');return out.join('\r\n');
}
