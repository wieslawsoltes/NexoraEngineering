import { symbolGeometry, escapeXML } from './geometry.js';
import { TYPES } from './core.js';
const PATHS={
  project:'M3 20V8l9-5 9 5v12H3ZM8 20v-7h8v7M7 8h.01M12 8h.01M17 8h.01',
  home:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
  search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  chevron:'m8 10 4 4 4-4',
  check:'m5 12 4 4L19 6',
  plus:'M12 5v14M5 12h14',minus:'M5 12h14',close:'m6 6 12 12M18 6 6 18',
  pointer:'m5 3 15 9-7 2-3 7-5-18Z',
  hand:'M8 11V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 4-3 7-7 7h-1c-2 0-4-1-5-3l-4-6a2 2 0 0 1 3-2l2 3',
  pipe:'M3 18h8V6h10M3 15h5V3h13M2 14v5M20 2v5',
  signal:'M3 18h3m3 0h3v-3m0-3V9m0-3V4h3m3 0h3',
  text:'M4 4h16M12 4v16M8 20h8',
  rotate:'M4 8a9 9 0 1 1-1 8M4 3v5h5',
  fit:'M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6M8 8h8v8H8Z',
  grid:'M4 4h16v16H4ZM4 9h16M4 15h16M9 4v16M15 4v16',
  layers:'m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
  undo:'M9 5 3 11l6 6M3 11h12a6 6 0 0 1 6 6v3',
  redo:'m15 5 6 6-6 6M21 11H9a6 6 0 0 0-6 6v3',
  shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  export:'M12 15V3m-4 4 4-4 4 4M4 12v8h16v-8',
  download:'M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6',
  save:'M4 3h13l4 4v14H3V3h1ZM7 3v7h9V3M7 21v-7h10v7',
  folder:'M3 6h7l2 3h9v12H3V6Zm0 3h18',
  folderopen:'M3 9V5h7l2 3h8v3M3 11h20l-4 9H1l2-9Z',
  document:'M5 2h10l5 5v15H5V2Zm10 0v6h5M9 12h7M9 16h7',
  diagram:'M4 4h16v16H4ZM7 10h4v5h6M7 7h4v6H7V7Zm8 7h3v3h-3Z',
  table:'M3 4h18v16H3ZM3 9h18M3 14h18M8 4v16M15 4v16',
  database:'M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3ZM4 6v12c0 2 4 3 8 3s8-1 8-3V6M4 12c0 2 4 3 8 3s8-1 8-3',
  link:'m10 14 4-4m-5-3 2-2a5 5 0 0 1 7 7l-2 2m-1 3-2 2a5 5 0 0 1-7-7l2-2',
  unlink:'M8 8 4 4m12 12 4 4M10 5l1-1a5 5 0 0 1 7 7l-1 1M7 12l-1 1a5 5 0 0 0 7 7l1-1M9 15l6-6',
  external:'M14 3h7v7m0-7L10 14M10 5H3v16h16v-7',
  locate:'M12 2v4m0 12v4M2 12h4m12 0h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  tree:'M5 3v15h14M5 10h14M12 3h7v5h-7V3Zm0 12h7v6h-7v-6Z',
  panel:'M3 4h18v16H3ZM9 4v16',
  help:'M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  copy:'M8 8h13v13H8V8ZM4 16H3V3h13v1',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  align:'M4 3v18M8 5h12v5H8V5Zm0 10h7v5H8v-5Z',
  distribute:'M3 3v18M21 3v18M7 7h3v10H7V7Zm7 0h3v10h-3V7Z',
  ruler:'m3 16 13-13 5 5L8 21l-5-5Zm3-3 3 3m0-6 2 2m1-5 3 3m0-6 2 2',
  history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v6l4 2',
  compare:'M8 3v18M16 3v18M3 7h8m-3-3 3 3-3 3M21 17h-8m3-3-3 3 3 3',
  warning:'m12 3 10 18H2L12 3Zm0 6v5m0 3h.01',
  pump:'M19 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM9 6l7 5-7 5V6ZM1 11h4m14 0h4M8 17l-2 4h12l-2-4',
  tank:'M5 6c0-4 14-4 14 0v12c0 4-14 4-14 0V6Zm0 0c0 4 14 4 14 0M5 17c0 4 14 4 14 0',
  valve:'M3 6v12l18-12v12L3 6ZM1 12h2m18 0h2',
  instrument:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M9 7h6M10 17h4',
  motor:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM7 16V8l5 6 5-6v8',
  cable:'M6 2v6l12 8v6M18 2v6L6 16v6',
  edit:'m4 16 12-12 4 4L8 20l-5 1 1-5Zm10-10 4 4',
  print:'M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6v-7ZM17 11h1',
  moon:'M21 14A9 9 0 0 1 10 3a9 9 0 1 0 11 11',
  box:'m12 2 10 5v10l-10 5-10-5V7l10-5Zm-10 5 10 5 10-5M12 12v10',
  lightning:'m14 2-9 12h7l-2 8 9-12h-7l2-8Z',
  clipboard:'M9 5H5v17h14V5h-4M9 2h6v6H9V2Z',
  arrow:'M4 12h16m-6-6 6 6-6 6',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'
};
export function icon(name,size=16){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]||PATHS.box}"/></svg>`;}
export function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);el.removeAttribute('data-icon');});}
export function symbolIcon(type,width=56,height=44){const d=TYPES[type];const g=symbolGeometry({id:'preview',type,x:0,y:0,w:d.w,h:d.h,rotation:0,tag:d.prefix+'-101',description:''});const pad=Math.max(d.w,d.h)*.2;const box=[-d.w/2-pad,-d.h/2-pad,d.w+pad*2,d.h+pad*2];let s=`<svg width="${width}" height="${height}" viewBox="${box.join(' ')}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;for(const f of g.fills)s+=`<polygon points="${f.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${f.color}"/>`;for(const l of g.lines)s+=`<path d="M${l.a.x} ${l.a.y}L${l.b.x} ${l.b.y}" stroke="${l.color}" stroke-width="${Math.max(1.6,Math.max(d.w,d.h)/38)}" stroke-linecap="round"/>`;if(['instrument','controller','motor'].includes(type))for(const t of g.texts)s+=`<text x="${t.x}" y="${t.y}" fill="${t.color}" font-family="Arial" font-size="${t.size}" text-anchor="middle" dominant-baseline="central">${escapeXML(t.text)}</text>`;return s+'</svg>';}
export const el=id=>document.getElementById(id);
export const esc=escapeXML;
export const typeIcon=type=>({pump:'pump',tank:'tank',vessel:'tank',valve:'valve',controlValve:'valve',checkValve:'valve',instrument:'instrument',controller:'instrument',motor:'motor',pipe:'pipe',signal:'signal',cable:'cable',text:'text',zone:'box',offpage:'arrow'}[type]||'box');
export function toast(message,error=false){const div=document.createElement('div');div.className='toast'+(error?' error':'');div.innerHTML=icon(error?'warning':'check')+`<span>${esc(message)}</span>`;el('toast-region').append(div);setTimeout(()=>div.remove(),error?6000:3500);}
export function downloadFile(name,content,type='application/octet-stream'){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
