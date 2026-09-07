import { colorVector } from './geometry.js';
/** Native WebGPU pipelines. Lines are instanced analytic capsules, not line-list primitives. */
const SHADER = /* wgsl */`
struct Camera { viewport: vec2f, center: vec2f, zoom: f32, dpr: f32, pad: vec2f }
@group(0) @binding(0) var<uniform> camera: Camera;
struct LineOut { @builtin(position) position: vec4f, @location(0) local: vec2f, @location(1) color: vec4f, @location(2) dimensions: vec4f }
@vertex fn lineVertex(@builtin(vertex_index) vi: u32, @location(0) a: vec2f, @location(1) b: vec2f, @location(2) color: vec4f, @location(3) style: vec4f) -> LineOut {
  let corners = array<vec2f,6>(vec2f(0,-1),vec2f(1,-1),vec2f(0,1),vec2f(0,1),vec2f(1,-1),vec2f(1,1));
  let pa=(a-camera.center)*camera.zoom+camera.viewport*.5;
  let pb=(b-camera.center)*camera.zoom+camera.viewport*.5;
  let len=max(length(pb-pa),0.0001); let direction=(pb-pa)/len; let normal=vec2f(-direction.y,direction.x);
  let halfWidth=max(style.x*camera.zoom*.5,.45); let fringe=1.0/camera.dpr; let corner=corners[vi];
  let local=vec2f(mix(-halfWidth-fringe,len+halfWidth+fringe,corner.x),corner.y*(halfWidth+fringe));
  let pixel=pa+direction*local.x+normal*local.y;
  var o:LineOut;o.position=vec4f(pixel/camera.viewport*vec2f(2,-2)+vec2f(-1,1),0,1);
  o.local=local;o.color=color;o.dimensions=vec4f(len,halfWidth,style.y*camera.zoom,fringe);return o;
}
@fragment fn lineFragment(i:LineOut) -> @location(0) vec4f {
  let outside=vec2f(max(max(-i.local.x,i.local.x-i.dimensions.x),0.0),i.local.y);
  let dist=length(outside)-i.dimensions.y;
  let coverage=1.0-smoothstep(-i.dimensions.w*.65,i.dimensions.w*.65,dist);
  if(i.dimensions.z>0.0 && (i.local.x-floor(i.local.x/(i.dimensions.z*2.0))*(i.dimensions.z*2.0))>i.dimensions.z){discard;}
  return vec4f(i.color.rgb,i.color.a*coverage);
}
struct FillOut { @builtin(position) position:vec4f, @location(0) color:vec4f }
@vertex fn fillVertex(@location(0) position:vec2f,@location(1) color:vec4f)->FillOut {
  let pixel=(position-camera.center)*camera.zoom+camera.viewport*.5;
  var o:FillOut;o.position=vec4f(pixel/camera.viewport*vec2f(2,-2)+vec2f(-1,1),0,1);o.color=color;return o;
}
@fragment fn fillFragment(i:FillOut)->@location(0) vec4f {return i.color;}
`;
export class DiagramRenderer {
  constructor(gpuCanvas,fallbackCanvas,onState=()=>{}){this.canvas=gpuCanvas;this.fallback=fallbackCanvas;this.onState=onState;this.mode='initializing';this.device=null;this.uploadKey='';this.buffers={};this.data=null;this.drawCalls=0;this.disposed=false;this.ready=this.initialize();}
  async initialize(){
    try {
      if(new URLSearchParams(location.search).get('renderer')==='canvas')throw new Error('Canvas renderer requested');
      if(!navigator.gpu)throw new Error('WebGPU is unavailable in this browser/context');
      const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(!adapter)throw new Error('No WebGPU adapter available');
      const device=await adapter.requestDevice();this.device=device;
      device.addEventListener('uncapturederror',e=>{this.lastError=e.error.message;this.useFallback(`GPU error: ${e.error.message}`);});
      device.lost.then(info=>{if(!this.disposed)this.useFallback(`GPU device lost: ${info.message||info.reason}`);});
      const context=this.canvas.getContext('webgpu');if(!context)throw new Error('GPU canvas context unavailable');this.context=context;
      const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'premultiplied'});
      device.pushErrorScope('validation');
      const shader=device.createShaderModule({label:'Nexora analytic vector shader',code:SHADER});
      const compilation=await shader.getCompilationInfo();const failures=compilation.messages.filter(m=>m.type==='error');if(failures.length)throw new Error(failures.map(m=>m.message).join('\n'));
      this.uniform=device.createBuffer({label:'Camera uniform',size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
      const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
      this.bindGroup=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:this.uniform}}]});
      const target={format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}};
      this.linePipeline=await device.createRenderPipelineAsync({label:'Instanced anti-aliased vector strokes',layout:pipelineLayout,vertex:{module:shader,entryPoint:'lineVertex',buffers:[{arrayStride:48,stepMode:'instance',attributes:[{shaderLocation:0,offset:0,format:'float32x2'},{shaderLocation:1,offset:8,format:'float32x2'},{shaderLocation:2,offset:16,format:'float32x4'},{shaderLocation:3,offset:32,format:'float32x4'}]}]},fragment:{module:shader,entryPoint:'lineFragment',targets:[target]},primitive:{topology:'triangle-list'}});
      this.fillPipeline=await device.createRenderPipelineAsync({label:'Vector fill triangles',layout:pipelineLayout,vertex:{module:shader,entryPoint:'fillVertex',buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x2'},{shaderLocation:1,offset:8,format:'float32x4'}]}]},fragment:{module:shader,entryPoint:'fillFragment',targets:[target]},primitive:{topology:'triangle-list'}});
      const error=await device.popErrorScope();if(error)throw new Error(error.message);
      if(this.disposed)return;this.mode='webgpu';this.adapterInfo=adapter.info;this.canvas.style.display='block';this.fallback.style.display='none';this.uploadKey='';this.onState('WebGPU',adapter.info?.description||'Native GPU acceleration');
    } catch(error){this.lastError=error.message;this.useFallback(error.message);}
  }
  useFallback(reason){this.mode='canvas';this.canvas.style.display='none';this.fallback.style.display='block';this.ctx=this.fallback.getContext('2d');this.onState('Canvas 2D',reason);}
  resize(width,height,dpr){this.width=width;this.height=height;this.dpr=dpr;const max=this.device?.limits.maxTextureDimension2D||8192;const factor=Math.min(dpr,max/Math.max(width,height));this.effectiveDpr=factor;for(const c of [this.canvas,this.fallback]){const w=Math.max(1,Math.round(width*factor)),h=Math.max(1,Math.round(height*factor));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}c.style.width=width+'px';c.style.height=height+'px';}}
  ensureBuffer(name,bytes){let record=this.buffers[name];if(!record||record.size<bytes){record?.buffer.destroy();const size=Math.max(256,2**Math.ceil(Math.log2(Math.max(bytes,1))));if(size>this.device.limits.maxBufferSize)throw new Error('Drawing exceeds GPU buffer limits');record={size,buffer:this.device.createBuffer({label:name,size,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST})};this.buffers[name]=record;}return record.buffer;}
  upload(data,key){if(this.uploadKey===key)return;this.uploadKey=key;const strokes=new Float32Array(data.lines.length*12);let i=0;for(const l of data.lines){strokes.set([l.a.x,l.a.y,l.b.x,l.b.y,...colorVector(l.color),l.width,l.dash||0,0,0],i);i+=12;}
    const count=data.fills.reduce((n,f)=>n+Math.max(0,f.points.length-2)*3,0),vertices=new Float32Array(count*6);i=0;for(const f of data.fills){const color=colorVector(f.color);for(let j=1;j<f.points.length-1;j++)for(const p of [f.points[0],f.points[j],f.points[j+1]]){vertices.set([p.x,p.y,...color],i);i+=6;}}
    this.strokeBuffer=this.ensureBuffer('Stroke instances',strokes.byteLength);this.fillBuffer=this.ensureBuffer('Fill vertices',vertices.byteLength);if(strokes.length)this.device.queue.writeBuffer(this.strokeBuffer,0,strokes);if(vertices.length)this.device.queue.writeBuffer(this.fillBuffer,0,vertices);this.strokeCount=data.lines.length;this.fillCount=count;this.uploadBytes=strokes.byteLength+vertices.byteLength;
  }
  render(data,camera,key){this.data=data;this.drawCalls=0;if(this.mode==='initializing')return;
    if(this.mode==='webgpu')try{this.upload(data,key);this.device.queue.writeBuffer(this.uniform,0,new Float32Array([this.width,this.height,camera.x,camera.y,camera.zoom,this.effectiveDpr,0,0]));const encoder=this.device.createCommandEncoder({label:'Diagram frame'});const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'store'}]});pass.setBindGroup(0,this.bindGroup);if(this.fillCount){pass.setPipeline(this.fillPipeline);pass.setVertexBuffer(0,this.fillBuffer);pass.draw(this.fillCount);this.drawCalls++;}if(this.strokeCount){pass.setPipeline(this.linePipeline);pass.setVertexBuffer(0,this.strokeBuffer);pass.draw(6,this.strokeCount);this.drawCalls++;}pass.end();this.device.queue.submit([encoder.finish()]);return;}catch(e){this.lastError=e.message;this.useFallback(e.message);}
    const ctx=this.ctx||this.fallback.getContext('2d'),dpr=this.effectiveDpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.width,this.height);ctx.translate(this.width/2,this.height/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);ctx.lineCap='round';ctx.lineJoin='round';
    for(const f of data.fills){ctx.fillStyle=f.color;ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
    // Batch strokes by style; connected primitives share a single Canvas2D stroke call.
    const groups=new Map();for(const l of data.lines){const k=`${l.color}|${l.width}|${l.dash}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(l);}for(const lines of groups.values()){const l=lines[0];ctx.strokeStyle=l.color;ctx.lineWidth=Math.max(l.width,.9/camera.zoom);ctx.setLineDash(l.dash?[l.dash,l.dash]:[]);ctx.beginPath();for(const s of lines){ctx.moveTo(s.a.x,s.a.y);ctx.lineTo(s.b.x,s.b.y);}ctx.stroke();this.drawCalls++;}ctx.setLineDash([]);
  }
  dispose(){this.disposed=true;for(const r of Object.values(this.buffers))r.buffer.destroy();this.uniform?.destroy();this.context?.unconfigure();this.device?.destroy();}
}
