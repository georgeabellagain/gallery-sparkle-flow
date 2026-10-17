import * as THREE from "three";
import { bookStyleProfile, readableBookStyle, type BookStyle } from "./book-style";
import { sampleCoverColour } from "./cover-colour";
export type ShootOptions={style:BookStyle;colour:string;wall?:string;yaw:number;elevation:number;zoom:number};
export function shootCamera(yaw:number,elevation:number,zoom:number,ratio:number,aspect:number){
  const angle=THREE.MathUtils.degToRad(Math.max(-40,Math.min(40,yaw)));
  const pitch=THREE.MathUtils.degToRad(Math.max(2,Math.min(25,elevation)));
  const distance=Math.max(ratio*2.3,2.3/aspect)/Math.max(.7,Math.min(1.4,zoom));
  const target=new THREE.Vector3(0,ratio*.52,0);
  return {target,position:new THREE.Vector3(Math.sin(angle)*distance, target.y+Math.sin(pitch)*distance,Math.cos(angle)*Math.cos(pitch)*distance)};
}
/** Standalone closed-book photographic stage; the shared reader is never moved. */
export function createPhotoShoot(host:HTMLElement,front:HTMLCanvasElement,back:HTMLCanvasElement,pages:number,onError:(message:string)=>void=()=>{}){
  const ratio=front.height/front.width,renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.domElement.style.cssText="width:100%;height:100%;display:block;touch-action:none";
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100),book=new THREE.Group();scene.add(book);
  const textures=new Set<THREE.Texture>(),materials=new Set<THREE.Material>(),geometries=new Set<THREE.BufferGeometry>();
  const material=(options:THREE.MeshStandardMaterialParameters)=>{const value=new THREE.MeshStandardMaterial(options);materials.add(value);return value;};
  const texture=(canvas:HTMLCanvasElement)=>{const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.add(t);return t;};
  const colour=sampleCoverColour(front),coverMaterial=material({color:colour,roughness:.8}),pageMaterial=material({color:"#f1eee5",roughness:.98});
  const edgePixels=new Uint8Array(128*4);
  for(let y=0;y<128;y++){const shade=y%4===0?200:255;edgePixels.set([shade,shade,shade,255],y*4);}
  const edgeTexture=new THREE.DataTexture(edgePixels,1,128);edgeTexture.colorSpace=THREE.SRGBColorSpace;edgeTexture.needsUpdate=true;textures.add(edgeTexture);pageMaterial.map=edgeTexture;
  const artMaterial=material({map:texture(front),roughness:.82}),backMaterial=material({map:texture(back),roughness:.82});
  const box=new THREE.BoxGeometry(1,1,1),plane=new THREE.PlaneGeometry(1,1,32,8);geometries.add(box);geometries.add(plane);
  const add=(geometry:THREE.BufferGeometry,mat:THREE.Material)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=mesh.receiveShadow=true;book.add(mesh);return mesh;};
  const spineGeometry=new THREE.CylinderGeometry(1,1,1,24);geometries.add(spineGeometry);const spine=add(spineGeometry,coverMaterial);
  const block=add(box,pageMaterial),frontBoard=add(box,coverMaterial),backBoard=add(box,coverMaterial),art=add(plane,artMaterial),rear=add(plane.clone(),backMaterial);geometries.add(rear.geometry);rear.rotation.y=Math.PI;
  const fan=[add(plane.clone(),pageMaterial),add(plane.clone(),pageMaterial)];fan.forEach(mesh=>geometries.add(mesh.geometry));
  const wallMaterial=material({color:"#ded9cf",roughness:1}),floorMaterial=material({color:"#ded9cf",roughness:.94});
  const stageGeometry=new THREE.PlaneGeometry(30,30);geometries.add(stageGeometry);
  const wall=new THREE.Mesh(stageGeometry,wallMaterial);wall.position.set(0,5,-.12);wall.receiveShadow=true;scene.add(wall);
  const floor=new THREE.Mesh(stageGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
  scene.add(new THREE.HemisphereLight(0xffffff,0xc6c0b5,2.2));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,5,6);key.target.position.set(0,ratio/2,0);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:4,bottom:-2,near:.1,far:20});key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=.008;key.shadow.radius=4;
  scene.add(key,key.target);
  let options:ShootOptions={style:"flipbook",colour:"#ded9cf",yaw:20,elevation:10,zoom:1},disposed=false,frame=0,wallUrl:string|undefined,revision=0;
  const render=(width:number,height:number)=>{renderer.setSize(width,height,false);camera.aspect=width/height;const pose=shootCamera(options.yaw,options.elevation,options.zoom,ratio,camera.aspect);camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateProjectionMatrix();renderer.render(scene,camera);};
  const paint=()=>{if(disposed)return;const box=host.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);render(Math.max(1,Math.round(box.width*dpr)),Math.max(1,Math.round(box.height*dpr)));};
  const request=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(()=>{frame=0;paint();});};
  const observer=new ResizeObserver(request);observer.observe(host);
  let shapeStyle:BookStyle|undefined, pendingWall:Promise<void>=Promise.resolve();
  const apply=()=>{
    const style=readableBookStyle(options.style),profile=bookStyleProfile(style),hard=style==="hardback",soft=style==="softcover";
    if(shapeStyle!==style){
    shapeStyle=style;
    const thickness=style==="flipbook"?.018:Math.min(hard?.14:.075,(hard?.055:.025)+pages*.00045),board=hard?.024:soft?.004:.001;
    spine.visible=style!=="flipbook";spine.scale.set((thickness+2*board)/2,ratio,(thickness+2*board)/2);spine.position.x=-.5+(thickness+2*board)/2;
    block.scale.set(.98,ratio-.018,thickness);frontBoard.scale.set(1+2*profile.overhang,ratio+2*profile.overhang,board);backBoard.scale.copy(frontBoard.scale);
    frontBoard.position.z=thickness/2+board/2;backBoard.position.z=-thickness/2-board/2;
    art.scale.set(1,ratio,1);art.position.z=thickness/2+board+.001;rear.scale.copy(art.scale);rear.position.z=-thickness/2-board-.001;
    // Flexible softcover has a subtle curved fore edge; hardcover remains planar.
    const positions=plane.getAttribute("position") as THREE.BufferAttribute;
    for(let i=0;i<positions.count;i++){const x=positions.getX(i);positions.setZ(i,soft?.018*Math.sin(Math.PI*(x+.5)):0);}positions.needsUpdate=true;plane.computeVertexNormals();
    fan.forEach((mesh,i)=>{mesh.visible=style==="flipbook";mesh.scale.set(1,ratio,1);mesh.rotation.z=(i+1)*.018;mesh.position.z=-thickness/2-(i+1)*.002;});
    book.rotation.x=-.10;
    const height=ratio+2*profile.overhang,depth=thickness+2*board;
    book.position.set(0,height/2*Math.cos(.1)+depth/2*Math.sin(.1)+.01,-.12+height/2*Math.sin(.1)+depth/2*Math.cos(.1)+.006);
    }
    wallMaterial.color.set(options.colour);floorMaterial.color.set(options.colour);scene.background=new THREE.Color(options.colour);
    if(options.wall!==wallUrl){
      wallUrl=options.wall;const token=++revision;const previous=wallMaterial.map;wallMaterial.map=null;wallMaterial.needsUpdate=true;if(previous){previous.dispose();textures.delete(previous);}
      pendingWall=wallUrl ? new THREE.TextureLoader().loadAsync(wallUrl).then(t=>{
        if(disposed||revision!==token){t.dispose();return;}
        t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;const image=t.image as HTMLImageElement;
        const repeatsX=30/4,repeatsY=30/(4*(image.naturalHeight/image.naturalWidth||1));
        t.repeat.set(repeatsX,repeatsY);t.offset.set(.5-.5*repeatsX,.5-((ratio*.52-5)/30+.5)*repeatsY);textures.add(t);wallMaterial.map=t;wallMaterial.color.set("#ffffff");wallMaterial.needsUpdate=true;request();
      }).catch(error=>{if(!disposed&&revision===token)onError("The wall picture could not load. Choose another background.");throw new Error("The wall picture could not load. Choose another background.");}) : Promise.resolve();
      void pendingWall.catch(()=>{});
    }else if(wallMaterial.map)wallMaterial.color.set("#ffffff");
    request();
  };
  apply();
  return {
    set(value:ShootOptions){options=value;apply();},
    async png(){
      let loading:Promise<void>;do{loading=pendingWall;await loading;}while(loading!==pendingWall);
      if(disposed)throw new Error("Photo shoot closed.");
      const width=Math.min(2048,Math.floor(renderer.capabilities.maxTextureSize/1.25)),height=Math.round(width*1.25);
      try{render(width,height);return await new Promise<Blob>((resolve,reject)=>renderer.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error("The image could not be exported.")),"image/png"));}finally{if(!disposed)paint();}
    },
    dispose(){disposed=true;revision++;cancelAnimationFrame(frame);observer.disconnect();textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());key.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();},
  };
}
