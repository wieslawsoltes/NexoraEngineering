import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const files=['core','geometry','renderer','storage','ui','app'];
// Project-local bundler: dependencies are statically ordered, and every import is a single line.
// No runtime or build-time dependencies, network requests, or minifier are required.
const sources=await Promise.all(files.map(async name=>`\n// ---- src/${name}.js ----\n`+(await readFile(join(root,'src',name+'.js'),'utf8')).replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')));
const js=`;(async () => {\n'use strict';\n${sources.join('\n')}\n})().catch(error => { console.error(error); const p=document.createElement('pre'); p.style.cssText='position:fixed;inset:20px;z-index:9999;background:white;padding:24px;color:#a33;white-space:pre-wrap';p.textContent='Nexora failed to initialize: '+error.message; document.body.append(p); });`;
let html=await readFile(join(root,'index.html'),'utf8');const css=await readFile(join(root,'styles.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="styles.css">',`<style>${css}</style>`).replace('<script type="module" src="src/app.js"></script>',`<script>${js.replace(/<\/script/gi,'<\\/script')}</script>`);
await writeFile(join(root,'Nexora-Engineering.html'),html);
await mkdir(join(root,'dist'),{recursive:true});await writeFile(join(root,'dist','index.html'),html);
console.log(`Built standalone HTML: ${(Buffer.byteLength(html)/1024).toFixed(1)} KiB`);
