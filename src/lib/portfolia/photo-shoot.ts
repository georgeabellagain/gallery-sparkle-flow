import { photoSizeError, type PhotoSize } from "./photo-export";
import { pageBlockGeometry, coverBoardGeometry, caseSpineGeometry, visibleBookBounds } from "./book-model";
import { COVER_HEIGHT, COVER_OVERHANG } from "./rigid-cover";
import * as THREE from "three";
import { bookStyleProfile, readableBookStyle, type BookStyle } from "./book-style";
import { sampleCoverColour } from "./cover-colour";
import { loadPreparedEnvironment } from "./prepared-environment";
import { createEnvironmentDiffuser } from "./environment-diffusion";
import { createPaperTextures } from "./paper-textures";
import { backgroundSurfaceMaps } from "./background-presets";
import { studioExposure, studioTopLight, presetShadow, presetDirectLight, HDRI_PRESETS, type HdriId } from "./lighting";
import { dappleTexture } from "./dapple-light";
import { createBookBinding } from "./book-binding";
import type { SurfaceKind } from "./surface";
export type ShootOptions={style:BookStyle;colour:string;wall?:string;floorColour:string;floor?:string;yaw:number;elevation:number;zoom:number;hdri:HdriId;finish:SurfaceKind;brightness:number;strength:number;topLight:number};
export function shootCamera(yaw:number,elevation:number,zoom:number,ratio:number,aspect:number,span=1,centre?:THREE.Vector3){
 const angle=THREE.MathUtils.degToRad(Math.max(-40,Math.min(40,yaw))),pitch=THREE.MathUtils.degToRad(Math.max(2,Math.min(25,elevation)));
 const distance=Math.max(ratio*2.3,span*2.3/aspect)/Math.max(.7,Math.min(1.4,zoom));
 const target=centre?.clone()??new THREE.Vector3(0,ratio*.52,0);
 return {target,position:new THREE.Vector3(target.x+Math.sin(angle)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(angle)*Math.cos(pitch)*distance)};
}
export function createPhotoShoot(host:HTMLElement,front:HTMLCanvasElement,back:HTMLCanvasElement,pages:number,onError:(message:string)=>void=()=>{},initial?:Partial<ShootOptions>){
 const ratio=front.height/front.width,renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.domElement.style.cssText="width:100%;height:100%;display:block;touch-action:none";host.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100),book=new THREE.Group(),closed=new THREE.Group(),spread=new THREE.Group();scene.add(book);book.add(closed,spread);spread.visible=false;
 const textures=new Set<THREE.Texture>(),materials=new Set<THREE.Material>(),geometries=new Set<THREE.BufferGeometry>();
 const material=(options:THREE.MeshStandardMaterialParameters)=>{const m=new THREE.MeshStandardMaterial(options);materials.add(m);return m;};
 const texture=(canvas:HTMLCanvasElement)=>{const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.add(t);return t;};
 const coverColour=sampleCoverColour(front),coverMaterial=material({color:coverColour,roughness:.6,envMapIntensity:1.15}),pageMaterial=material({color:"#f1eee5",roughness:.98});
 const edgePixels=new Uint8Array(128*4);for(let y=0;y<128;y++){const shade=y%4===0?223:250;edgePixels.set([shade,shade,shade,255],y*4);}
 const edgeTexture=new THREE.DataTexture(edgePixels,1,128);edgeTexture.colorSpace=THREE.SRGBColorSpace;edgeTexture.needsUpdate=true;textures.add(edgeTexture);pageMaterial.map=edgeTexture;
 const artMaterial=material({map:texture(front)}),backMaterial=material({map:texture(back)});
 const box=pageBlockGeometry(),plane=new THREE.PlaneGeometry(1,1,32,16),spineGeometry=caseSpineGeometry();[box,plane,spineGeometry].forEach(g=>geometries.add(g));
 const add=(geometry:THREE.BufferGeometry,mat:THREE.Material,parent=closed)=>{const m=new THREE.Mesh(geometry,mat);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const spine=add(spineGeometry,coverMaterial),block=add(box,pageMaterial),frontBoard=add(box,coverMaterial),backBoard=add(box,coverMaterial),art=add(plane,artMaterial),rear=add(plane.clone(),backMaterial);geometries.add(rear.geometry);rear.rotation.y=Math.PI;
 const fan=[add(plane.clone(),pageMaterial),add(plane.clone(),pageMaterial)];fan.forEach(m=>geometries.add(m.geometry));
 const spreadMaterials=[material({}),material({})];
 const spreadPages=spreadMaterials.map((m,i)=>{const geometry=new THREE.PlaneGeometry(1,ratio,32,16);geometries.add(geometry);const pos=geometry.getAttribute("position") as THREE.BufferAttribute;
   for(let n=0;n<pos.count;n++){const x=pos.getX(n);pos.setZ(n,.014+.022*Math.sin(Math.PI*(x+.5)));}pos.needsUpdate=true;geometry.computeVertexNormals();const mesh=add(geometry,m,spread);mesh.position.x=i===0?-.5:.5;return mesh;});
 const binding=createBookBinding(spread,ratio);binding.setCoverColour(coverColour);
 const wallMaterial=material({roughness:1}),floorMaterial=material({roughness:.94}),stageGeometry=new THREE.PlaneGeometry(30,30);geometries.add(stageGeometry);
 const wall=new THREE.Mesh(stageGeometry,wallMaterial);wall.position.set(0,5,-.12);wall.receiveShadow=true;scene.add(wall);
 const floor=new THREE.Mesh(stageGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
 const key=new THREE.DirectionalLight(0xffffff,.6),top=new THREE.DirectionalLight(0xffffff,0),sun=new THREE.SpotLight(0xfff3dc,0,0,Math.PI/5,.35,0);
 top.position.set(0,5,6);scene.add(key,key.target,top,sun,sun.target);
 key.castShadow=sun.castShadow=true;sun.shadow.camera.near=.1;sun.shadow.camera.far=20;sun.shadow.camera.updateProjectionMatrix();
 for(const light of [key,sun]){light.shadow.mapSize.set(2048,2048);light.shadow.normalBias=.008;light.shadow.radius=4;}
 Object.assign(key.shadow.camera,{left:-4,right:4,top:5,bottom:-2,near:.1,far:20});key.shadow.camera.updateProjectionMatrix();
 let options:ShootOptions={style:"flipbook",colour:"#ded9cf",floorColour:"#ded9cf",yaw:20,elevation:10,zoom:1,hdri:"4",finish:"satin",brightness:.5,strength:.75,topLight:0,...initial};
 let outputSize:PhotoSize={width:2048,height:2560};
 let disposed=false,frame=0,open=false,shapeStamp="",environmentKey="",environmentRevision=0,environment:THREE.WebGLRenderTarget|undefined;
 const diffuser=createEnvironmentDiffuser(renderer),pmrem=new THREE.PMREMGenerator(renderer),paper=createPaperTextures(()=>request());
 const masks=new Map<HdriId,THREE.CanvasTexture>();
 const render=(width:number,height:number)=>{renderer.setSize(width,height,false);camera.aspect=width/height;const bounds=visibleBookBounds(open?spread:closed),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());const pose=shootCamera(options.yaw,options.elevation,options.zoom,Math.max(ratio,size.y),camera.aspect,size.x,centre);camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateProjectionMatrix();renderer.render(scene,camera);};
 const paint=()=>{if(disposed)return;const rect=host.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);render(Math.max(1,Math.round(rect.width*dpr)),Math.max(1,Math.round(rect.height*dpr)));};
 const request=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(()=>{frame=0;paint();});};
 const lost=(event:Event)=>{event.preventDefault();onError("Graphics were interrupted. Close and reopen Photo shoot to restore the stage.");};
 renderer.domElement.addEventListener("webglcontextlost",lost);
 const observer=new ResizeObserver(request);observer.observe(host);
 const surfaces=[{url:undefined as string|undefined,revision:0,maps:[] as THREE.Texture[],pending:Promise.resolve()}, {url:undefined as string|undefined,revision:0,maps:[] as THREE.Texture[],pending:Promise.resolve()}];
 const setSurface=(index:number,url:string|undefined,colour:string)=>{
   const state=surfaces[index]!,m=index===0?wallMaterial:floorMaterial;
   m.color.set(url?"#ffffff":colour);if(url===state.url)return;
   state.url=url;const token=++state.revision;
   const clear=()=>{state.maps.forEach(t=>{t.dispose();textures.delete(t);});state.maps=[];m.map=m.normalMap=m.roughnessMap=null;};
   if(!url){clear();m.roughness=.94;m.needsUpdate=true;state.pending=Promise.resolve();return;}
   const maps=backgroundSurfaceMaps(url),loader=new THREE.TextureLoader(),acquired=new Set<THREE.Texture>();let failed=false;
   const load=async(file:string)=>{const t=await loader.loadAsync(file);if(disposed||failed||token!==state.revision){t.dispose();throw new Error("Surface replaced");}acquired.add(t);return t;};
   state.pending=Promise.all([load(url),maps?load(maps.normal):Promise.resolve(null),maps?load(maps.roughness):Promise.resolve(null)]).then(loaded=>{
     if(disposed||token!==state.revision){loaded.forEach(t=>t?.dispose());return;}
     clear();loaded.forEach((t,i)=>{if(!t)return;t.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
       const image=loaded[0]!.image as HTMLImageElement,rx=30/4,ry=30/(4*(image.naturalHeight/image.naturalWidth||1));t.repeat.set(rx,ry);t.offset.set(.5-.5*rx,index===0?.5-((ratio*.52-5)/30+.5)*ry:.5-.5*ry);textures.add(t);state.maps.push(t);});
     acquired.clear();[m.map,m.normalMap,m.roughnessMap]=loaded;m.normalScale.set(1,1);m.roughness=maps?1:.94;m.needsUpdate=true;request();
   }).catch(()=>{failed=true;acquired.forEach(t=>t.dispose());acquired.clear();if(!disposed&&token===state.revision)onError(`The ${index===0?"wall":"floor"} surface could not load.`);throw new Error("A photo surface could not load. Choose another preset.");});void state.pending.catch(()=>{});
 };
 let pendingEnvironment:Promise<void>=Promise.resolve();
 const setLighting=()=>{
   renderer.toneMappingExposure=studioExposure(options.brightness);top.intensity=studioTopLight(options.topLight);
   const shadow=presetShadow(options.hdri);key.position.set(...shadow.position);key.target.position.set(0,ratio*.5,0);key.shadow.radius=shadow.radius*4;
   sun.position.copy(key.position);sun.target.position.copy(key.target.position);sun.penumbra=shadow.penumbra;sun.shadow.radius=shadow.radius*4;
   const pattern=HDRI_PRESETS.find(p=>p.id===options.hdri)?.dapple;
   if(pattern&&!masks.has(options.hdri)){const mask=dappleTexture(pattern,shadow);masks.set(options.hdri,mask);}
   sun.map=pattern?masks.get(options.hdri)!:null;sun.intensity=presetDirectLight(options.hdri,options.strength);sun.visible=Boolean(pattern);key.intensity=pattern?0:.6;
   const stamp=`${options.hdri}|${options.strength}`;if(stamp===environmentKey)return;environmentKey=stamp;
   const token=++environmentRevision,id=options.hdri,strength=options.strength;
   pendingEnvironment=loadPreparedEnvironment(id).then(prepared=>{
     if(disposed||token!==environmentRevision)return;
     const source=new THREE.DataTexture(prepared.pixels,prepared.width,prepared.height,THREE.RGBAFormat,THREE.HalfFloatType);source.mapping=THREE.EquirectangularReflectionMapping;source.needsUpdate=true;
     let target:THREE.WebGLRenderTarget;try{target=pmrem.fromEquirectangular(source);}finally{source.dispose();}
     diffuser.reset();scene.environment=diffuser.apply(target,strength,prepared.colour);environment?.dispose();environment=target;request();
   }).catch(()=>{if(!disposed&&token===environmentRevision)onError("The selected HDRI could not load.");throw new Error("The selected HDRI could not load.");});void pendingEnvironment.catch(()=>{});
 };
 const apply=()=>{
   const style=readableBookStyle(options.style),profile=bookStyleProfile(style),hard=style==="hardback",soft=style==="softcover",stamp=`${style}|${open}|${spreadPages.map(mesh=>Boolean(mesh.userData["coverBoard"])).join()}`;
   closed.visible=!open;spread.visible=open;
   if(shapeStamp!==stamp){shapeStamp=stamp;
     spreadPages.forEach((mesh,index)=>{
       const rigid=hard&&mesh.userData["coverBoard"]===true,uv=mesh.geometry.getAttribute("uv"),p=mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
       for(let i=0;i<p.count;i++){const u=uv.getX(i),v=uv.getY(i),x=u-.5;p.setXYZ(i,rigid?x*(1+2*COVER_OVERHANG)+(index===0?-1:1)*COVER_OVERHANG:x,(v-.5)*(ratio+(rigid?2*COVER_OVERHANG:0)),rigid?COVER_HEIGHT:.014+.022*Math.sin(Math.PI*u));}
       p.needsUpdate=true;mesh.geometry.computeVertexNormals();
     });
     const thickness=style==="flipbook"?.018:Math.min(hard?.14:.075,(hard?.055:.025)+pages*.00045),board=hard?.012:soft?.004:.001;
     spine.visible=style!=="flipbook";spine.rotation.y=Math.PI/2;spine.scale.set((thickness+2*board)/2,ratio+2*profile.overhang,hard?.025:.012);spine.position.x=-.5-profile.overhang+.008;
     block.scale.set(hard?.958:.98,ratio-(hard?.035:.018),thickness);block.position.x=hard?.009:0;frontBoard.scale.set(1+2*profile.overhang,ratio+2*profile.overhang,board);backBoard.scale.copy(frontBoard.scale);
     for(const mesh of [frontBoard,backBoard]){if(mesh.geometry!==box){geometries.delete(mesh.geometry);mesh.geometry.dispose();}mesh.geometry=coverBoardGeometry(1+2*profile.overhang,ratio+2*profile.overhang,board);geometries.add(mesh.geometry);}
     frontBoard.position.z=thickness/2+board/2;backBoard.position.z=-thickness/2-board/2;
     const coverWidth=hard?1+2*profile.overhang:1,coverHeight=hard?ratio+2*profile.overhang:ratio;
     art.scale.set(coverWidth,coverHeight,1);art.position.z=thickness/2+board+.002;rear.scale.copy(art.scale);rear.position.z=-thickness/2-board-.002;
     for(const mesh of [art,rear]){const positions=mesh.geometry.getAttribute("position") as THREE.BufferAttribute;for(let i=0;i<positions.count;i++){const x=positions.getX(i),hinge=mesh===art?x+.5:.5-x;positions.setZ(i,soft?.012*Math.sin(Math.PI*(x+.5)):hard?-.0015*Math.exp(-Math.pow((hinge-.04)/.018,2)):0);}positions.needsUpdate=true;mesh.geometry.computeVertexNormals();}
     fan.forEach((mesh,i)=>{mesh.visible=style==="flipbook";mesh.scale.set(1,ratio,1);mesh.rotation.z=(i+1)*.018;mesh.position.z=-thickness/2-(i+1)*.002;});
     book.rotation.x=-.10;const height=ratio+2*profile.overhang,depth=open?.07:thickness+2*board;
     book.position.set(0,height/2*Math.cos(.1)+depth/2*Math.sin(.1)+.01,-.12+height/2*Math.sin(.1)+depth/2*Math.cos(.1)+.006);
   }
   binding.set(style,true);binding.sync([spreadPages[0]!.visible,spreadPages[1]!.visible],spreadPages.map(mesh=>hard&&mesh.userData["coverBoard"]===true) as [boolean,boolean]);
   for(const m of [artMaterial,backMaterial,...spreadMaterials])paper.apply(m,options.finish);
   setSurface(0,options.wall,options.colour);setSurface(1,options.floor,options.floorColour);scene.background=new THREE.Color(options.colour);setLighting();request();
 };
 apply();
 return {
   set(value:ShootOptions){options=value;apply();},
   setSize(size:PhotoSize){if(photoSizeError(size))return;outputSize={...size};request();},
   exportLimit(){const gl=renderer.getContext();return Math.min(8192,renderer.capabilities.maxTextureSize,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array));},
   setSpread(canvases:readonly [HTMLCanvasElement|null,HTMLCanvasElement|null]|null){
     open=Boolean(canvases);spreadMaterials.forEach((m,i)=>{const old=m.map;if(old){old.dispose();textures.delete(old);}const canvas=canvases?.[i];m.map=canvas?texture(canvas):null;m.needsUpdate=true;spreadPages[i]!.visible=Boolean(canvas);spreadPages[i]!.userData["coverBoard"]=canvas?.dataset["coverBoard"]==="true";});apply();
   },
   async png(){
     let pending:Promise<void>[];do{pending=[pendingEnvironment,...surfaces.map(s=>s.pending)];await Promise.all([...pending,paper.ready()]);}while(pending[0]!==pendingEnvironment||pending[1]!==surfaces[0]!.pending||pending[2]!==surfaces[1]!.pending);
     if(disposed)throw new Error("Photo shoot closed.");if(renderer.getContext().isContextLost())throw new Error("Graphics were interrupted. Reopen Photo shoot.");const {width,height}=outputSize,gl=renderer.getContext(),limit=Math.min(renderer.capabilities.maxTextureSize,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array)),error=photoSizeError(outputSize,limit);if(error)throw new Error(error);
     try{render(width,height);return await new Promise<Blob>((resolve,reject)=>renderer.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error("The image could not be exported.")),"image/png"));}finally{if(!disposed)paint();}
   },
   dispose(){disposed=true;environmentRevision++;surfaces.forEach(s=>s.revision++);cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("webglcontextlost",lost);binding.dispose();paper.dispose();diffuser.dispose();pmrem.dispose();environment?.dispose();masks.forEach(t=>t.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());key.shadow.map?.dispose();sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();},
 };
}
